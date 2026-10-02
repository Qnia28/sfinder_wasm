"""Independent offline audit of every bounded product probe. No solver calls."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import math
import statistics
import subprocess
import sys

here=Path(__file__).resolve().parent;root=here.parent.parent
download=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve();phase=sys.argv[3]
assert phase in ['development','reserved']
def load(f):return json.loads(Path(f).read_text(encoding='utf-8-sig'))
def canonical(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
inputs=load(here/'INPUTS.json');population=load(here/'POPULATION.json');schedule=load(here/'SCHEDULE.json')['runs'];refs={r['matrixId']:r for r in load(here/'EXACT_REFERENCES.json')['references']}
expected={r['runId']:r for r in schedule if r['phase']==phase};entries={e['id']:e for e in inputs['entries']}
original={e['id']:e for e in population['entries']}
assert inputs['sourceIndexSha256']==sha(canonical(population))
for e in entries.values():assert {k:v for k,v in e.items() if k not in ['pack','offset','sourcePack','sourceOffset']}=={k:v for k,v in original[e['id']].items() if k not in ['pack','offset']}
if phase=='development':
    eligible=[e for e in population['entries'] if e['partition']=='development' and e['route']=='INTEGRATED_100K_PROBE_ELIGIBLE']
    selected=set(inputs['old16'])|{e['id'] for e in sorted(eligible,key=lambda e:(-e['E'],e['id']))[:16]}
    for e in sorted(eligible,key=lambda e:sha(f"a0-integrated-revalidation-20261003\0{e['id']}".encode())):
        if len(selected)==64:break
        selected.add(e['id'])
    assert selected=={r['matrixId'] for r in expected.values()}
for p in inputs['packs']:assert sha((here/p['file']).read_bytes())==p['sha256']
folders=[d for d in download.glob(f'a0i-{phase}-*') if (d/'SHARD.json').exists()]
assert len(folders)==(8 if phase=='development' else 16)
rows=[];build=None;sealed=0;raw_records=0
for d in folders:
    for f in load(d/'FILES.json')['files']:
        b=(d/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];sealed+=1
    s=load(d/'SHARD.json');assert s['phase']==phase
    if build is None:build=s['build']
    assert s['build']==build and s['scheduleSha256']==sha(canonical(s['scheduledRuns']))
    rr=[json.loads(l) for l in (d/'runs.jsonl').read_text().splitlines() if l.strip()];assert len(rr)==s['observedRuns']
    for r in rr:
        raw=[json.loads(l) for l in (d/r['rawFile']).read_text().splitlines() if l.strip()];raw_records+=len(raw)
        phases=[v for v in raw if v.get('type')=='phase-result']
        assert phases==[v for v in r['persisted'] if v.get('type')=='phase-result']
        if r['status'] in ['PROBE_EXACT','PROBE_CAPPED']:
            assert len(phases)==1 and phases[0]['raw']==r['probe'] and phases[0]['options']==r['options']
            assert raw.index(phases[0])<next(i for i,v in enumerate(raw) if v.get('type')=='audit-result')
        rows.append(r)
assert len({r['runId'] for r in rows})==len(rows)
assert build['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
assert build['changedProductSources']==['src/min-cover-exact-secondary.mjs'] and not build['nativeAlgorithmsChanged']
assert build['inputsSha256']==sha(canonical(inputs)) and build['scheduleSha256']==sha(canonical({'runs':schedule}))
assert build['populationSha256']==sha(canonical(population))
source_blobs=0
for f in build['sourceFiles']+build['harnessFiles']:
    blob=subprocess.check_output(['git','-C',str(root),'show',f"{build['candidateCommit']}:{f['file']}"])
    assert sha(blob)==f['sha256'];source_blobs+=1
    if f in build['sourceFiles'] and f['file']!='src/min-cover-exact-secondary.mjs':assert f['sha256']==f['baselineSha256']
if phase=='reserved':
    freeze_candidates=[root/'.a0/freeze/FREEZE.json',download/'a0i-frozen/FREEZE.json']
    freeze=load(next(f for f in freeze_candidates if f.exists()))
    assert freeze['status']=='FROZEN_INTEGRATED_SCOPE_NOT_DEV_APPROVAL' and freeze['buildSha256']==sha(canonical(build))
statuses=collections.Counter();grouped=collections.defaultdict(list);cached_id=None;m=None;quality_recomputations=0
for r in sorted(rows,key=lambda r:(r['matrixId'],r['variant'],r['repetition'])):
    assert r['runId'] in expected
    for k in ['phase','shard','matrixId','variant','repetition','position']:assert r[k]==expected[r['runId']][k]
    assert r['buildSha256']==sha(canonical(build))
    e=entries[r['matrixId']];assert (e['partition']=='reserved-validation')==(phase=='reserved')
    assert r['inputSha256']==e['sha256'] and r['identitySha256']==e['identitySha256']
    if cached_id!=r['matrixId']:
        with (here/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
        assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b));cached_id=r['matrixId']
        assert sha(canonical({k:m[k] for k in ['keys','rows','K','seedKeys']}))==e['identitySha256'] and m['primary']['cardinalityProven']
    statuses[r['status']]+=1;grouped[r['matrixId']].append(r)
    if r['status'] not in ['PROBE_EXACT','PROBE_CAPPED']:continue
    assert r['integratedCalls']==1 and r['nativeThresholdCalls']==r['actualInputPrimaryCalls']==r['actualInputPcCalls']==0
    o=r['options'];assert o['integrated'] and o['stateBudget']==100000 and o.get('partitioned',False)==(r['variant']=='A') and not o.get('dominance') and o['seedKeys']==m['seedKeys']
    p=r['probe'];assert p['completed']==(r['status']=='PROBE_EXACT') and 1<=p['searchedStates']<=100000
    index={k:i for i,k in enumerate(m['keys'])};ids=sorted(index[k] for k in p['keys']);assert len(ids)==len(set(ids))==m['K']==p['count']
    def quality(keys):
        chosen={index[k] for k in keys};q=sorted(max((v for id,v in row if id in chosen),default=0) for row in m['rows']);assert q and q[0]>0;return q
    q=quality(p['keys']);seedq=quality(m['seedKeys']);quality_recomputations+=2
    assert p['qualityVector']==q and q>=seedq
    assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canonical(q)),'seedSha256':sha(canonical(m['seedKeys'])),'originalRowCount':len(q)}
    if not p['completed']:
        c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==c['additionalIntegratedCalls']==0 and c['incomingProbeSha256']==sha(canonical(p))
        assert len(c['directAndDeferred'])==2
        for call in c['directAndDeferred']:assert call['K']==m['K'] and call['options']=={'seedKeys':p['keys'],'lockedPrefix':[]}
    res=r['resources'];assert 0<res['cgroupPeakBytes']<=res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0 and r['samplePeakRssBytes']>0 and r['wasmBytes']>0
metrics=[];exact={'R':0,'A':0};proof_unverified=[];state_regressions=[];quality_regressions=[]
for id,v in grouped.items():
    for variant in ['R','A']:
        normal=[r for r in v if r['variant']==variant and r.get('probe')]
        assert len({sha(canonical(r['probe'])) for r in normal})<=1
        if len(normal)==4 and all(r['probe']['completed'] for r in normal):exact[variant]+=1
    for rep in range(1,5):
        rr=next((r for r in v if r['variant']=='R' and r['repetition']==rep),None);aa=next((r for r in v if r['variant']=='A' and r['repetition']==rep),None)
        if not rr or not aa or not rr.get('probe') or not aa.get('probe'):continue
        if aa['probe']['searchedStates']>rr['probe']['searchedStates']:state_regressions.append(id)
        if aa['probe']['qualityVector']<rr['probe']['qualityVector']:quality_regressions.append(id)
        if aa['probe']['completed'] and rr['probe']['completed']:assert aa['witness']['selectedIDs']==rr['witness']['selectedIDs'] and aa['probe']['qualityVector']==rr['probe']['qualityVector']
        elif aa['probe']['completed']:
            ref=refs.get(id)
            if not ref or ref['selectedIDs']!=aa['witness']['selectedIDs'] or ref['qualitySha256']!=aa['witness']['qualitySha256']:proof_unverified.append(id)
    rr=[r for r in v if r['variant']=='R'];aa=[r for r in v if r['variant']=='A']
    if len(rr)==len(aa)==4 and all(r.get('probe') for r in rr+aa):
        rt=statistics.median(r['apiMs'] for r in rr);at=statistics.median(r['apiMs'] for r in aa)
        rm=statistics.median(r['resources']['cgroupPeakBytes'] for r in rr);am=statistics.median(r['resources']['cgroupPeakBytes'] for r in aa)
        metrics.append({'id':id,'mirrorGroup':entries[id]['mirrorGroup'],'r':rt,'a':at,'rm':rm,'am':am})
def percentile(a,p):return sorted(a)[math.ceil(len(a)*p)-1] if a else None
ratio=sum(m['a'] for m in metrics)/sum(m['r'] for m in metrics) if metrics else None
p95=percentile([m['a']/m['r'] for m in metrics],.95);memory_ratio=percentile([m['am']/m['rm'] for m in metrics],.95);memory_delta=percentile([m['am']-m['rm'] for m in metrics],.95)
clusters=collections.defaultdict(list)
for m in metrics:clusters[m['mirrorGroup']].append(m)
groups=list(clusters.values());state=20261003;boot=[]
def rand():
    global state
    state^=(state<<13)&0xffffffff;state^=state>>17;state^=(state<<5)&0xffffffff;state&=0xffffffff;return state/2**32
if groups:
    for _ in range(10000):
        sampled=[groups[int(rand()*len(groups))] for _ in groups];boot.append(sum(m['a'] for g in sampled for m in g)/sum(m['r'] for g in sampled for m in g))
ci=[percentile(boot,.025),percentile(boot,.975)] if boot else None
summary=load(output/'SUMMARY.json')
assert summary['observedRuns']==len(rows) and summary['probeExactMatrices']==exact
assert abs(summary['apiMedianSumRatio']-ratio)<1e-12 and abs(summary['p95ApiRatio']-p95)<1e-12 and all(abs(a-b)<1e-12 for a,b in zip(summary['cluster95CI'],ci))
assert bool(summary['errors']['states'])==bool(state_regressions)
assert bool(summary['errors']['quality'])==bool(quality_regressions)
assert abs(summary['peakMemoryP95Ratio']-memory_ratio)<1e-12 and summary['peakMemoryP95IncreaseBytes']==memory_delta
report={'status':'EVIDENCE_INDEPENDENTLY_AUDITED_NOT_PRODUCT_APPROVAL','phase':phase,'scheduledRuns':len(expected),'observedRuns':len(rows),'statuses':dict(statuses),
        'sourceGitBlobsVerified':source_blobs,'artifactFilesVerified':sealed,'rawJournalRecordsVerified':raw_records,'originalWeightedQualityRecomputations':quality_recomputations,
        'probeExactMatrices':exact,'pairedProbeMatrices':len(metrics),'apiSumRatio':ratio,'p95ApiRatio':p95,'cluster95CI':ci,'peakMemoryP95Ratio':memory_ratio,'peakMemoryP95IncreaseBytes':memory_delta,
        'stateRegressions':state_regressions,'qualityRegressions':quality_regressions,'unverifiedCandidateOnlyExactRows':proof_unverified,
        'boundedCappedIsCompleteProbeEvidence':True,'fullThresholdCompletionOrPerformanceProven':False,'actualInputPrimaryCalls':0,'actualInputPcCalls':0,'actualInputThresholdCalls':0,'devApplied':False,
        'summaryGateStatus':summary['status']}
(output/'INDEPENDENT_AUDIT.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
manifest={'files':[{'file':str(f.relative_to(output)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())} for f in sorted(output.rglob('*')) if f.is_file() and f.name!='FILES.json']}
with (output/'FILES.json').open('x',encoding='utf-8') as f:json.dump(manifest,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
