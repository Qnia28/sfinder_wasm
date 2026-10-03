"""Independent raw/quality/profile audit. Never loads or runs the native solver."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import re
import statistics
import subprocess
import sys

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-execution-diagnosis-20261003')
RUN=int(sys.argv[1]);download=HERE/f'github-run-{RUN}'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
readrows=lambda p:[json.loads(l) for l in p.read_text(encoding='utf-8').splitlines()]
summaries=list(download.rglob('SUMMARY.json'))
if not summaries:
    run=load(download/'RUN.json')
    report={'status':'PRESERVED_PREFLIGHT_OR_LOCK_FAILURE','runId':RUN,'sourceCommit':run['headSha'],'actualInputCalls':0,
        'executionTierIdentified':False,'noNativeRetries':True,'productChanged':False,'campaignClockReset':False}
    with (HERE/'ANALYSIS.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(report));sys.exit(0)
assert len(summaries)==1
folder=summaries[0].parent;s=load(summaries[0]);lock=s['lock'];run=load(download/'RUN.json')
assert lock['commit']==run['headSha']=='fede5036e786f2779b650700f5e2b39cd3341318'
assert sha(canon(lock))==s['lockSha256']
assert lock['maxCalls']==16 and lock['plainCalls']==12 and lock['profileCalls']==4
assert not s['clockReset'] and s['campaign']['originCreated']=='2026-10-03T04:18:25Z'
assert load(download/'INITIAL_RUN.json')['created_at']==s['campaign']['originCreated']
assert lock['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
files=load(folder/'FILES.json')['files']
for f in files:
    b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
for f in lock['files']:assert sha(git('show',f"{lock['commit']}:{f['file']}"))==f['sha256'],f['file']
assert git('diff','--name-only',lock['evidenceParent'],lock['commit'],'--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003','experiments/a0-order-diagnosis-20261003','experiments/a0-tier-diagnosis-20261003')==b''
cap=load(folder.parent/'CAPABILITY.json');assert sha((folder.parent/'CAPABILITY.json').read_bytes())==lock['capabilitySha256']
assert cap['capability']==lock['capability']==s['capability']['capability']
assert not cap['executionTierIdentified'] and cap['nativeActualInputCalls']==0
assert len(cap['rows'])==3 and all(not r['tierIdentified'] for r in cap['rows'])
entry=lock['input'];assert entry['id']=='board-028--restricted-split--ordinary'
with (REPO/'experiments/a0-diagnosis-20261003'/entry['pack']).open('rb') as f:f.seek(entry['offset']);b=f.read(entry['length'])
assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256']
index={k:i for i,k in enumerate(m['keys'])}
def quality(keys):
    chosen={index[k] for k in keys};q=sorted(max((v for i,v in row if i in chosen),default=0) for row in m['rows']);assert q[0]>0;return q
seed_q=quality(m['seedKeys'])
rows=readrows(folder/'runs.jsonl') if (folder/'runs.jsonl').exists() else []
outcomes=readrows(folder/'outcomes.jsonl') if (folder/'outcomes.jsonl').exists() else []
assert len(rows)==s['verifiedCalls'] and len(outcomes)==s['attemptedCalls']
assert len({r['runId'] for r in rows})==len(rows)
assert {r['runId'] for r in rows}=={o['runId'] for o in outcomes if o['status']=='VERIFIED'}
assert [r['runId'] for r in outcomes]==[r['runId'] for r in lock['schedule'][:len(outcomes)]]
expected={r['runId']:r for r in lock['schedule']}
profile_reports=[];rawcount=0
frameindex=lambda frame:int(re.search(r'wasm-function(?:\[|#)(\d+)\]?',frame['functionName']).group(1)) if re.search(r'wasm-function(?:\[|#)(\d+)\]?',frame['functionName']) else None
def aggregate(record,begin,end):
    p=record['profile'];assert len(p['samples'])==len(p['timeDeltas']);assert p['endTime']>=p['startTime']
    nodes={n['id']:n for n in p['nodes']};assert len(nodes)==len(p['nodes'])
    parents={}
    for n in p['nodes']:
        for child in n.get('children',[]):assert child in nodes and child not in parents;parents[child]=n['id']
    def ancestry(id):
        ids=[];seen=set()
        while id is not None:
            assert id not in seen;seen.add(id);ids.append(id);id=parents.get(id)
        return ids
    self_us=collections.Counter();inclusive_us=collections.Counter();categories=collections.Counter();count=0;t=p['startTime'];covered=0;unknown=[];api_deltas=[]
    for id,delta in zip(p['samples'],p['timeDeltas']):
        assert id in nodes and delta>=0
        previous=t;t+=delta;weight=max(0,min(t,end)-max(previous,begin))
        if weight<=0:continue
        count+=1;covered+=weight;api_deltas.append(delta);idx=frameindex(nodes[id]['callFrame'])
        if idx is not None:self_us[idx]+=weight;categories['identifiedWasmSelf']+=weight
        elif 'wasm' in nodes[id]['callFrame'].get('url','').lower():categories['unidentifiedWasmSelf']+=weight;unknown.append(nodes[id]['callFrame'])
        else:categories['jsRuntimeOrOtherSelf']+=weight
        # Unique function indices per ancestry prevent recursive double count.
        ancestors={frameindex(nodes[a]['callFrame']) for a in ancestry(id)}-{None}
        for a in ancestors:inclusive_us[a]+=weight
    assert t<=p['endTime']+100000
    duration=end-begin;assert duration>0
    assert p['startTime']<=begin+10000 and p['endTime']>=end-10000
    functions=[{'functionIndex':i,'selfSampleUs':self_us[i],'selfFraction':self_us[i]/covered if covered else 0,
        'inclusiveSampleUs':inclusive_us[i],'inclusiveFraction':inclusive_us[i]/covered if covered else 0} for i in sorted(set(self_us)|set(inclusive_us))]
    functions.sort(key=lambda f:f['selfSampleUs'],reverse=True)
    return {'apiSamples':count,'apiBoundaryUs':duration,'coveredSampleUs':covered,'sampleCoverageFraction':covered/duration,
        'selfCategoriesUs':dict(categories),'unknownWasmExamples':unknown[:10],'functions':functions,
        'samplesAll':len(p['samples']),'profileEndMinusDeltaSumUs':p['endTime']-t,
        'apiDeltaMedianUs':statistics.median(api_deltas) if api_deltas else None,'apiDeltaMaxUs':max(api_deltas) if api_deltas else None,
        'aggregation':'interval overlaps API hrtime boundary; recursive inclusive function index deduplicated per sample; self/inclusive never summed',
        'sampleQuality':'SUFFICIENT_FOR_COARSE_LOCATION' if count>=100 and covered/duration>=.9 and categories['identifiedWasmSelf']/covered>=.8 else 'INSUFFICIENT_FOR_COARSE_LOCATION'}
capability_rechecks=[]
for row,flags in zip(cap['rows'],[[],['--liftoff-only'],['--no-liftoff','--no-wasm-lazy-compilation']]):
    assert row['execArgv']==flags
    p=row['profile'];nodes={n['id']:n for n in p['nodes']};indices={frameindex(nodes[id]['callFrame']) for id in p['samples']}-{None}
    assert {0,1}<=indices
    segments=[]
    for seg in row['segments']:
        agg=aggregate(row,seg['start'],seg['end']);segments.append({'name':seg['name'],'functionIndices':[f['functionIndex'] for f in agg['functions']],
            'apiSamples':agg['apiSamples'],'sampleCoverageFraction':agg['sampleCoverageFraction']})
        if seg['name']=='spinA':assert any(f['functionIndex']==0 and f['selfFraction']>.8 for f in agg['functions'])
        if seg['name']=='spinB':assert any(f['functionIndex']==1 and f['selfFraction']>.8 for f in agg['functions'])
    capability_rechecks.append({'flags':flags,'segments':segments,'tierIdentified':False})
for r in rows:
    for k,v in expected[r['runId']].items():
        if k!='profile':assert r[k]==v,(k,r[k],v)
    raw=readrows(folder/r['rawFile']);assert [a['type'] for a in raw]==['phase-start','phase-result','audit-result'];rawcount+=3
    assert raw[1]['raw']==r['probe'] and raw[1]['options']==r['options'] and raw[1]['apiMs']==r['apiMs']
    for key in ['profile','worker','threadCpu','engine','sampleBoundary']:assert raw[1][key]==r[key]
    assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
    assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
    assert 0<r['apiMs']<30000 and r['verificationMs']<30000 and r['worker']['callCount']==1
    assert r['worker']['pid']==r['engine']['pid'] and r['engine']['execArgv']==r['engineFlags']
    assert r['worker']['cpu']==r['worker']['allowed']==s['runtime']['workerCpu']
    p=r['probe'];ids=sorted(index[k] for k in p['keys']);q=quality(p['keys'])
    assert len(ids)==len(set(ids))==p['count']==m['K'] and q==p['qualityVector'] and q>=seed_q
    assert r['options']['seedKeys']==m['seedKeys'] and r['options']['stateBudget']==100000 and r['options']['integrated']
    assert bool(r['options'].get('partitioned'))==(r['label']=='A')
    assert r['seedKeysSha256']==entry['seedKeysSha256']==sha(canon(m['seedKeys'])) and r['primaryProofSha256']==sha(canon(m['primary']))
    assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
    assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
    if not p['completed']:
        c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p))
        assert len(c['calls'])==2 and all(a=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for a in c['calls'])
    res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
    if r['instrumented']:
        profile_rows=readrows(folder/'profiles'/f"{r['runId']}.jsonl");assert len(profile_rows)==1
        pr=profile_rows[0];assert pr['runId']==r['runId'] and pr['record']==r['inspector'] and sha(canon(pr['data']))==r['inspector']['profileSha256']
        boundary=r['sampleBoundary'];summary=aggregate(pr['data'],boundary['startUs'],boundary['endUs'])
        adapter=r['profile'];assert adapter['coreEntries']==1 and not adapter['getterHooks']
        assert abs(adapter['preCoreWallMs']+adapter['coreWallMs']+adapter['postCoreWallMs']-r['apiMs'])<1e-6
        profile_reports.append({'runId':r['runId'],'variant':r['label'],'block':r['block'],'apiMsDiagnosticOnly':r['apiMs'],
            'threadCpuMsDiagnosticOnly':(r['threadCpu']['user']+r['threadCpu']['system'])/1000,'coreProfile':adapter,'executionTierIdentified':False,**summary})
    else:assert r['profile'] is None and r['inspector'] is None
assert len({r['worker']['pid'] for r in rows})==len(rows)
determinism={v:len({sha(canon(r['probe'])) for r in rows if r['label']==v}) for v in ['R','A']};assert all(n<=1 for n in determinism.values())
pairs=[];state_quality_pairs=0
for id in dict.fromkeys(r['pairId'] for r in rows):
    rr=[r for r in rows if r['pairId']==id]
    if len(rr)!=2:continue
    one,two=rr;item={'pairId':id,'pair':one['pair'],'instrumented':one['instrumented'],'block':one['block'],'apiMs':[r['apiMs'] for r in rr]}
    if {r['label'] for r in rr}=={'R','A'}:
        r=next(r for r in rr if r['label']=='R');a=next(r for r in rr if r['label']=='A')
        assert a['probe']['searchedStates']<=r['probe']['searchedStates'] and a['probe']['qualityVector']>=r['probe']['qualityVector'];state_quality_pairs+=1
        ratio=a['apiMs']/r['apiMs'];delta=a['apiMs']-r['apiMs'];item.update({'aToRRatio':ratio,'aMinusRMs':delta,'largeASlower':ratio>=1.2 and delta>=500,'largeRSlower':1/ratio>=1.2 and -delta>=500})
    else:item['maxToMinRatio']=max(item['apiMs'])/min(item['apiMs'])
    pairs.append(item)
plain_pairs=[p for p in pairs if not p['instrumented']]
controls=[p for p in plain_pairs if p['pair'] in ['RR','AA']];cross=[p for p in plain_pairs if p['pair'] in ['RA','AR']]
alarm=any(p['maxToMinRatio']>1.1 for p in controls)
large_a=sum(p['largeASlower'] for p in cross)>=3;large_r=sum(p['largeRSlower'] for p in cross)>=3
classification='REPEATED_LARGE_A_COST' if large_a and not alarm and len(controls)==2 else 'REPEATED_LARGE_R_COST' if large_r and not alarm and len(controls)==2 else 'ENVIRONMENT_CONTROL_ALARM' if alarm else 'NO_REPEATED_LARGE_DIFFERENCE' if len(cross)==4 else 'INCOMPLETE_COMPARISON'
groups={}
for instrumented in [False,True]:
    for v in ['R','A']:
        rr=[r for r in rows if r['label']==v and r['instrumented']==instrumented]
        groups[f"{'profile' if instrumented else 'plain'}:{v}"]={'count':len(rr),'apiSamplesMs':[r['apiMs'] for r in rr],
            'medianApiMs':statistics.median(r['apiMs'] for r in rr) if rr else None,'threadCpuSamplesMs':[(r['threadCpu']['user']+r['threadCpu']['system'])/1000 for r in rr]}
tracepattern=re.compile(r'Compiled function\s+(0x[0-9a-fA-F]+)#(\d+)\s+using\s+(Liftoff|TurboFan),\s+took\s+(\d+)\s+ms[^\n]*')
traces=[]
for r in rows:
    if not r['instrumented']:continue
    logfile=folder/'logs'/f"{r['runId']}.jsonl";chunks=readrows(logfile) if logfile.exists() else [];text=''.join(c['text'] for c in chunks if c['stream']=='stdout')
    events=[{'modulePointer':mm[0],'functionIndex':int(mm[1]),'compiler':mm[2],'compileMsRounded':int(mm[3])} for mm in tracepattern.findall(text)]
    traces.append({'runId':r['runId'],'variant':r['label'],'compilerGenerationCounts':dict(collections.Counter(e['compiler'] for e in events)),
        'events':events,'rawCompiledLiterals':text.count('Compiled function'),'parsedEvents':len(events),'executionTierIdentified':False})
report={'status':'COMPLETE_INDEPENDENTLY_AUDITED' if s['status']=='COMPLETE' and len(rows)==16 else 'PRESERVED_PARTIAL','runId':RUN,'sourceCommit':lock['commit'],
    'nativeCallsVerified':len(rows),'attemptedCalls':len(outcomes),'plainCalls':sum(not r['instrumented'] for r in rows),'profileCalls':len(profile_reports),
    'capability':cap['capability'],'independentSyntheticSegmentRechecks':capability_rechecks,'executionTierIdentified':False,'outcomeCounts':dict(collections.Counter(o['status'] for o in outcomes)),
    'probeStatusCounts':dict(collections.Counter(r['status'] for r in rows)),'sourceBlobsVerified':len(lock['files']),'artifactFilesVerified':len(files),
    'rawRecordsVerified':rawcount,'weightedQualityAndSeedRecalculations':2*len(rows),'stateQualityPairsVerified':state_quality_pairs,
    'determinismCounts':determinism,'runtime':s['runtime'],'groups':groups,'pairs':pairs,'controlAlarm':alarm,
    'classification':classification,'profiles':profile_reports,'compilerGenerationTraces':traces,'notRun':s['notRun'],'stopReason':s['stopReason'],
    'campaign':s['campaign'],'clockReset':False,'productChanged':False,'performanceConfirmationCalls':0,'primaryPcThresholdCalls':0,
    'limits':'Function sample location only; generated code is not every-frame execution tier; profile and plain calls not pooled; two controls not a noise-distribution estimate.'}
output=HERE/('ANALYSIS_RECHECK.json' if (HERE/'ANALYSIS.json').exists() else 'ANALYSIS.json')
with output.open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['profiles','compilerGenerationTraces']},indent=2))
print(json.dumps({'profileSummaries':[{k:v for k,v in p.items() if k not in ['functions','unknownWasmExamples']} for p in profile_reports]},indent=2))
