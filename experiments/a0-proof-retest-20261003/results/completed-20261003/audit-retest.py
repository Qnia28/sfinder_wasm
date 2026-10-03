"""Independent raw/witness/per-host retest audit. No native solver, no old value replacement."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import math
import statistics
import subprocess
import sys

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
EX=REPO/'experiments/a0-proof-retest-20261003'
RUN=int(sys.argv[1]);DOWNLOAD=HERE/f'github-run-{RUN}'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def js_json_sha(value):
    # Lock contains timing ratios: ECMAScript and Python render a few doubles differently.
    # Use the producer's JSON.stringify wire format for this hash only, not native execution.
    return subprocess.check_output(['node','-e',"const fs=require('fs'),c=require('crypto');const v=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(c.createHash('sha256').update(JSON.stringify(v)).digest('hex'));"],input=canon(value)).decode()
readrows=lambda p:[json.loads(l) for l in p.read_text(encoding='utf-8').splitlines()]
run=load(DOWNLOAD/'RUN.json');proof=load(HERE/'PROOF_AUDIT.json');assert proof['status']=='INDEPENDENT_EXACT_VERIFIED'
selection=load(EX/'RETEST_SELECTION.json');schedule=load(EX/'RETEST_SCHEDULE.json')['runs'];expected={r['runId']:r for r in schedule};assert len(expected)==2460
entryby={e['id']:e for e in load(EX/'RETEST_INPUTS.json')['entries']};input_cache={};seed_q={};ids_cache={}
for id,e in entryby.items():
    with (REPO/'experiments/a0-integrated-revalidation-20261003'/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
    assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
    assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==e['identitySha256']
    input_cache[id]=m;ids_cache[id]={k:i for i,k in enumerate(m['keys'])}
def qfor(id,keys):
    chosen={ids_cache[id][k] for k in keys};q=sorted(max((v for i,v in row if i in chosen),default=0) for row in input_cache[id]['rows']);assert q[0]>0;return q
for id,m in input_cache.items():seed_q[id]=qfor(id,m['seedKeys'])
old_probes={}
for source in selection['sourceFiles']:
    p=Path(source['file']);assert sha(p.read_bytes())==source['sha256']
    for r in readrows(p):
        key=(r['matrixId'],r['variant']);value=sha(canon(r['probe']));assert key not in old_probes or old_probes[key]==value;old_probes[key]=value
rows=[];outcomes=[];summaries=[];raw_count=0;resultfiles=0;sourcefiles=0;seen_commits=set();pids_by_host={};profile_calls=0
summary_paths=sorted(DOWNLOAD.rglob('SUMMARY.json'))
summary_paths=[p for p in summary_paths if p.parent.name in ['0','1','2','3','4']]
assert len(summary_paths)==5
for sp in summary_paths:
    s=load(sp);host=s['host'];folder=sp.parent;lock=s['lock'];assert lock['commit']==run['headSha'];assert lock['stage']=='RETEST'
    assert lock['maxCalls']==2460 and lock['stateBudget']==100000 and lock['apiSeconds']==10 and lock['processSeconds']==30
    assert lock['proof']==proof and lock['selection']==selection and js_json_sha(lock)==s['lockSha256']
    assert not s['clockReset'] and s['originMs']==int(__import__('datetime').datetime.fromisoformat(proof['origin'].replace('Z','+00:00')).timestamp()*1000)
    if lock['commit'] not in seen_commits:
        for f in lock['files']:assert sha(subprocess.check_output(['git','-C',str(REPO),'show',f"{lock['commit']}:{f['file']}"]))==f['sha256'],f['file']
        sourcefiles+=len(lock['files']);seen_commits.add(lock['commit'])
    for f in load(folder/'FILES.json')['files']:
        b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];resultfiles+=1
    rr=readrows(folder/'runs.jsonl') if (folder/'runs.jsonl').exists() else []
    oo=readrows(folder/'outcomes.jsonl') if (folder/'outcomes.jsonl').exists() else []
    assert len(rr)==s['verifiedCalls'] and len(oo)==s['attemptedCalls']
    assert [o['runId'] for o in oo]==[r['runId'] for r in schedule if r['host']==host][:len(oo)]
    assert {r['runId'] for r in rr}=={o['runId'] for o in oo if o['status']=='VERIFIED'}
    for r in rr:
        for k,v in expected[r['runId']].items():assert r[k]==v
        assert r['host']==host and r['profile'] is None
        raw=readrows(folder/r['rawFile']);assert [a['type'] for a in raw]==['phase-start','phase-result','audit-result'];raw_count+=3
        assert raw[1]['raw']==r['probe'] and raw[1]['apiMs']==r['apiMs'] and raw[1]['options']==r['options']
        for k in ['worker','cpu','threadCpu','profile']:assert raw[1][k]==r[k]
        assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
        m=input_cache[r['matrixId']];p=r['probe'];ids=sorted(ids_cache[r['matrixId']][k] for k in p['keys']);q=qfor(r['matrixId'],p['keys'])
        assert len(ids)==len(set(ids))==p['count']==m['K'] and q==p['qualityVector'] and q>=seed_q[r['matrixId']]
        assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
        assert r['primaryProofSha256']==sha(canon(m['primary'])) and r['seedKeysSha256']==sha(canon(m['seedKeys']))
        assert r['options']['seedKeys']==m['seedKeys'] and r['options']['stateBudget']==100000 and r['options']['integrated']
        assert bool(r['options'].get('partitioned'))==(r['variant']=='A')
        assert r['worker']['callCount']==1 and r['worker']['cpu']=='UNPINNED'
        assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
        assert 0<r['apiMs']<10000 and r['verificationMs']<30000 and 1<=p['searchedStates']<=100000
        assert p['completed']==(r['status']=='PROBE_EXACT')
        assert sha(canon(p))==old_probes[(r['matrixId'],r['variant'])],r['runId']
        if not p['completed']:
            c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p))
            assert len(c['calls'])==2 and all(a=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for a in c['calls'])
        res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
    pids=[r['worker']['pid'] for r in rr];assert len(pids)==len(set(pids));pids_by_host[host]=len(pids)
    summaries.append({'host':host,'status':s['status'],'attemptedCalls':len(oo),'verifiedCalls':len(rr),'stopReason':s['stopReason'],'notRun':s['notRun'],'runtime':s['runtime'],'operationalWallMs':s['operationalWallMs']})
    rows+=rr;outcomes+=oo
assert len({r['runId'] for r in rows})==len(rows)
bypair=collections.defaultdict(list)
for r in rows:bypair[r['pairId']].append(r)
pairdata=[];environment=[];state_pairs=0
for pair,rr in bypair.items():
    if len(rr)!=2:continue
    rr.sort(key=lambda r:r['position']);one,two=rr
    if one['kind']=='ENVIRONMENT_CONTROL':
        assert one['variant']==two['variant'];ratio=max(r['apiMs'] for r in rr)/min(r['apiMs'] for r in rr)
        environment.append({'pairId':pair,'phase':one['phase'],'host':one['host'],'variant':one['variant'],'matrixId':one['matrixId'],
            'apiMs':[r['apiMs'] for r in rr],'maxToMinRatio':ratio,'alarm':ratio>1.1});continue
    variants={r['variant']:r for r in rr};assert set(variants)=={'R','A'};r=variants['R'];a=variants['A'];
    assert a['probe']['searchedStates']<=r['probe']['searchedStates'] and a['probe']['qualityVector']>=r['probe']['qualityVector'];state_pairs+=1
    pairdata.append({'pairId':pair,'matrixId':one['matrixId'],'phase':one['phase'],'host':one['host'],'repetition':one['repetition'],'kind':one['kind'],
        'aToRRatio':a['apiMs']/r['apiMs'],'aMinusRMs':a['apiMs']-r['apiMs'],'baselineApiMs':r['apiMs'],'candidateApiMs':a['apiMs']})
alarms={(e['phase'],e['host']) for e in environment if e['alarm']};inputs=[]
for record in selection['records']:
    if not record['selected']:continue
    id=record['matrixId'];pp=[p for p in pairdata if p['matrixId']==id];hostdata=[]
    for host in range(5):
        hh=[p for p in pp if p['host']==host]
        hostdata.append({'host':host,'pairs':len(hh),'ratio':statistics.median(p['aToRRatio'] for p in hh) if len(hh)==2 else None,
            'absoluteDeltaMedianMs':statistics.median(p['aMinusRMs'] for p in hh) if len(hh)==2 else None,'environmentAlarm':(record['phase'],host) in alarms})
    complete=len(pp)==10 and all(h['pairs']==2 for h in hostdata);ratio=statistics.median(p['aToRRatio'] for p in pp) if complete else None
    slower=sum(h['ratio']>1.1 for h in hostdata if h['ratio'] is not None);direction=sum((h['ratio']<1 if record['ratio']<1 else h['ratio']>1) for h in hostdata if h['ratio'] is not None)
    sensitive=any(h['environmentAlarm'] for h in hostdata)
    signs={h['ratio']>1 for h in hostdata if h['ratio'] is not None}
    replicated=complete and not sensitive and direction>=4
    regression=replicated and ratio>1.1 and slower>=4
    classification='INCOMPLETE' if not complete else 'REGRESSION_THRESHOLD_REPLICATED' if regression else 'ENVIRONMENT_SENSITIVE' if sensitive or len(signs)>1 else 'DIRECTION_REPLICATED' if replicated else 'NOT_REPLICATED_OR_UNCERTAIN'
    variation={};within_host_variation={};between_host_variation={}
    for v in ['R','A']:
        times=[r['apiMs'] for r in rows if r['matrixId']==id and r['variant']==v and r['kind']!='ENVIRONMENT_CONTROL'];variation[v]=max(times)/min(times) if times else None
        host_times=[[r['apiMs'] for r in rows if r['matrixId']==id and r['variant']==v and r['host']==host and r['kind']!='ENVIRONMENT_CONTROL'] for host in range(5)]
        within_host_variation[v]=[max(t)/min(t) if len(t)==2 else None for t in host_times]
        host_medians=[statistics.median(t) for t in host_times if len(t)==2]
        between_host_variation[v]=max(host_medians)/min(host_medians) if len(host_medians)==5 else None
    inputs.append({'matrixId':id,'phase':record['phase'],'selectionReasons':record['selectionReasons'],'isControl':record['selectedAsControl'],
        'originalPairMedianRatio':record['ratio'],'legacyOriginalRatioOfMedians':record['legacyRatioOfMedians'],
        'complete10Pairs':complete,'pairRatios':[p['aToRRatio'] for p in pp],'medianRatio':ratio,'hostResults':hostdata,
        'hostsSameDirectionAsScreening':direction,'hostsSlowdownAbove1_10':slower,'directionReplicated':replicated,'regressionThresholdReplicated':regression,
        'environmentSensitive':sensitive or len(signs)>1,'classification':classification,'variantVariation':variation,
        'withinHostVariantVariation':within_host_variation,'betweenHostMedianVariantVariation':between_host_variation,
        'baselineMedianMs':statistics.median(p['baselineApiMs'] for p in pp) if pp else None,'candidateMedianMs':statistics.median(p['candidateApiMs'] for p in pp) if pp else None})
report={'status':'COMPLETE_INDEPENDENTLY_AUDITED' if len(rows)==2460 and len(outcomes)==2460 and all(o['status']=='VERIFIED' for o in outcomes) else 'PRESERVED_PARTIAL',
    'runId':RUN,'sourceCommit':run['headSha'],'originRunId':37115091562,'origin':proof['origin'],'proofRunId':proof['runId'],'independentExactProofVerified':True,
    'expectedCalls':2460,'verifiedCalls':len(rows),'outcomeCounts':dict(collections.Counter(o['status'] for o in outcomes)),
    'probeStatusCounts':dict(collections.Counter(r['status'] for r in rows)),'inputsExpected':121,'inputsComplete10Pairs':sum(i['complete10Pairs'] for i in inputs),
    'sourceBlobsVerified':sourcefiles,'resultFilesVerified':resultfiles,'rawRecordsVerified':raw_count,'weightedQualityRecalculations':len(rows)+len(entryby),
    'seedComparisons':len(rows),'freshProcessCalls':sum(pids_by_host.values()),'stateQualityPairsVerified':state_pairs,
    'oldProbeDeterminismAllVariantsMatched':True,'summaries':summaries,'environmentControls':environment,'environmentAlarmCount':sum(e['alarm'] for e in environment),
    'classificationCounts':dict(collections.Counter(i['classification'] for i in inputs)),'regressionThresholdReplicatedCount':sum(i['regressionThresholdReplicated'] for i in inputs),
    'directionReplicatedCount':sum(i['directionReplicated'] for i in inputs),'inputs':inputs,'pairs':pairdata,
    'oldReservedP95FailureStillValid':True,'wholePopulationGateRecomputed':False,'originalValuesReplaced':False,
    'actualPrimaryPcThresholdCallsInRetests':0,'productChanged':False,
    'limits':'Selected121 of168, not untouched holdout/population score.5independent runner jobs, not5guaranteed distinct physical hosts. Host2pairs not10independent hosts. No tier/profiling. No formal statistical significance claimed.'}
with (HERE/'RETEST_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['inputs','pairs','environmentControls']},indent=2))
print(json.dumps({'regressionReplicatedInputs':[i for i in inputs if i['regressionThresholdReplicated']]},indent=2))
