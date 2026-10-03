"""Independent offline diagnosis audit/effect decomposition. No new native calls."""
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
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-diagnosis-20261003')
EXP=REPO/'experiments/a0-diagnosis-20261003'
DOWNLOAD=HERE/f'github-run-{sys.argv[1]}'
def load(f):return json.loads(f.read_text(encoding='utf-8-sig'))
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def med(v):return statistics.median(v) if v else None
def p95(v):return sorted(v)[math.ceil(len(v)*.95)-1] if v else None
inputs=load(EXP/'INPUTS.json');schedule=load(EXP/'SCHEDULE.json')['runs'];expected={r['runId']:r for r in schedule}
entries={e['id']:e for e in inputs['entries']}
groups={id:'F14' for id in inputs['diagnostic']['failed14']}
groups.update({m['matchId']:'M14' for m in inputs['diagnostic']['matched14']});groups.update({id:'C4' for id in inputs['diagnostic']['capped4']})
assert len(entries)==len(groups)==32
rows=[];shards=[];files=0;journal_count=0;raw_witnesses=0;lock=None
for d in sorted(DOWNLOAD.glob('a0d-h*-s*')):
    if not (d/'SHARD.json').exists():continue
    for f in load(d/'FILES.json')['files']:
        b=(d/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];files+=1
    s=load(d/'SHARD.json');shards.append(s)
    if lock is None:lock=s['lock']
    assert lock==s['lock'] and sha(canonical(lock))==s['lockSha256']
    starts=[json.loads(l) for l in (d/'starts.jsonl').read_text().splitlines()] if (d/'starts.jsonl').exists() else []
    rr=[json.loads(l) for l in (d/'runs.jsonl').read_text().splitlines()] if (d/'runs.jsonl').exists() else []
    assert len(rr)==s['observedRuns'] and len({r['runId'] for r in starts})==len(starts)
    assert [r['runId'] for r in starts]==[r['runId'] for r in s['scheduled'][:len(starts)]]
    for r in rr:
        assert r['runId'] in expected
        for k,v in expected[r['runId']].items():assert r[k]==v,(k,r['runId'])
        raw=[json.loads(l) for l in (d/r['rawFile']).read_text().splitlines()]
        assert [p['type'] for p in raw]==['phase-start','phase-result','audit-result'];journal_count+=len(raw)
        assert raw[1]['raw']==r['probe'] and raw[1]['options']==r['options'] and raw[1]['apiMs']==r['apiMs'] and raw[1]['profile']==r['profile']
        assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract'];raw_witnesses+=1
        assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
        assert 0<r['apiMs']<10000 and r['verificationMs']<30000
        res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
        assert r['options']['integrated'] and r['options']['stateBudget']==100000 and r['options'].get('partitioned',False)==(r['actualVariant']=='A')
    rows+=rr
assert len({r['runId'] for r in rows})==len(rows)
source_blobs=0
if lock:
    assert lock['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
    for f in lock['files']:
        b=subprocess.check_output(['git','-C',str(REPO),'show',f"{lock['commit']}:{f['file']}"])
        assert sha(b)==f['sha256'];source_blobs+=1
quality_checks=0;cached=None;m=None
for r in sorted(rows,key=lambda r:(r['matrixId'],r['runId'])):
    e=entries[r['matrixId']]
    if cached!=r['matrixId']:
        with (EXP/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
        assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b));cached=e['id']
        assert m['primary']['cardinalityProven'] and sha(canonical({k:m[k] for k in ['keys','rows','K','seedKeys']}))==e['identitySha256']
    index={k:i for i,k in enumerate(m['keys'])}
    def quality(keys):
        chosen={index[k] for k in keys};q=sorted(max((v for id,v in row if id in chosen),default=0) for row in m['rows']);assert q[0]>0;return q
    p=r['probe'];ids=sorted(index[k] for k in p['keys']);assert len(ids)==len(set(ids))==p['count']==m['K']
    q=quality(p['keys']);sq=quality(m['seedKeys']);quality_checks+=2
    assert q==p['qualityVector'] and q>=sq and r['options']['seedKeys']==m['seedKeys']
    assert sha(canonical(m['seedKeys']))==e['seedKeysSha256']==r['seedKeysSha256']
    assert sha(canonical(m['primary']))==r['primaryProofSha256']
    assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canonical(q)),'seedSha256':sha(canonical(m['seedKeys'])),'originalRowCount':len(q)}
    assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
    if not p['completed']:
        c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canonical(p))
        assert len(c['calls'])==2 and all(a=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for a in c['calls'])
    if r['profile']:
        pr=r['profile'];assert pr['coreEntries']==1 and pr['getterHooks'] is False
        assert abs(pr['preCoreWallMs']+pr['coreWallMs']+pr['postCoreWallMs']-r['apiMs'])<1e-6

by=collections.defaultdict(list)
for r in rows:by[r['stage'],r['hostBlock'],r['mode'],r['kind'],r['matrixId'],r['label']].append(r)
determinism=[];state_regressions=[];quality_regressions=[];pair_metrics=[]
for id in entries:
    for v in ['R','A']:
        r=[r for r in rows if r['matrixId']==id and r['actualVariant']==v]
        if len({sha(canonical(r['probe'])) for r in r})>1:determinism.append(f'{id}:{v}')
for key,rr in sorted(by.items()):
    stage,h,mode,kind,id,label=key
    if label not in ['R','X']:continue
    aa=by.get((stage,h,mode,kind,id,'A' if label=='R' else 'Y'),[])
    if len(rr)!=4 or len(aa)!=4:continue
    rm=med([r['apiMs'] for r in rr]);am=med([r['apiMs'] for r in aa])
    item={'stage':stage,'host':h,'mode':mode,'kind':kind,'matrixId':id,'group':groups[id],'baselineMs':rm,'candidateMs':am,'deltaMs':am-rm,'ratio':am/rm,
          'baselineStates':rr[0]['probe']['searchedStates'],'candidateStates':aa[0]['probe']['searchedStates'],
          'baselineSamplesMs':[r['apiMs'] for r in sorted(rr,key=lambda r:r['repetition'])],
          'candidateSamplesMs':[r['apiMs'] for r in sorted(aa,key=lambda r:r['repetition'])]}
    if kind=='measured' and stage=='profile':
        for field in ['preCoreWallMs','coreWallMs','postCoreWallMs','allocationAbiWallMs','jsAndOtherAbiResidualMs']:
            item['baseline_'+field]=med([r['profile'][field] for r in rr]);item['candidate_'+field]=med([r['profile'][field] for r in aa])
            item['delta_'+field]=item['candidate_'+field]-item['baseline_'+field]
    pair_metrics.append(item)
    for rep in range(1,5):
        r=next(r for r in rr if r['repetition']==rep);a=next(r for r in aa if r['repetition']==rep)
        if a['probe']['searchedStates']>r['probe']['searchedStates']:state_regressions.append(a['runId'])
        if a['probe']['qualityVector']<r['probe']['qualityVector']:quality_regressions.append(a['runId'])
        if r['probe']['completed'] and a['probe']['completed']:assert r['probe']['qualityVector']==a['probe']['qualityVector'] and r['witness']['selectedIDs']==a['witness']['selectedIDs']
summaries=[];aa_alarms=[]
for stage in ['diagnostic','aa-control','profile']:
    for h in [0,1]:
        for mode in ['COLD','COMPILED','WARM']:
            for group in ['ALL','F14','M14','C4']:
                pp=[p for p in pair_metrics if p['stage']==stage and p['host']==h and p['mode']==mode and p['kind']=='measured' and (group=='ALL' or p['group']==group)]
                if not pp:continue
                sr=sum(p['candidateMs'] for p in pp)/sum(p['baselineMs'] for p in pp)
                summary={'stage':stage,'host':h,'mode':mode,'group':group,'matrices':len(pp),'sumRatio':sr,'medianDeltaMs':med([p['deltaMs'] for p in pp]),'p95Ratio':p95([p['ratio'] for p in pp]),'maxDeltaMs':max(p['deltaMs'] for p in pp),'candidateSlowerMatrices':sum(p['deltaMs']>0 for p in pp)}
                if stage=='aa-control' and group=='ALL':
                    bid=p95([max(p['ratio'],1/p['ratio']) for p in pp]);alarm=sr<.95 or sr>1.05 or bid>1.10
                    summary.update({'bidirectionalP95':bid,'environmentAlarm':alarm})
                    if alarm:aa_alarms.append(summary)
                if stage=='profile':
                    for field in ['preCoreWallMs','coreWallMs','postCoreWallMs','allocationAbiWallMs','jsAndOtherAbiResidualMs']:
                        summary['median_delta_'+field]=med([p['delta_'+field] for p in pp])
                summaries.append(summary)
profile_progress=[]
for id in inputs['diagnostic']['controlAndProfile8']:
    for h in [0,1]:
        for v in ['R','A']:
            pp=[r for r in rows if r['stage']=='profile' and r['matrixId']==id and r['hostBlock']==h and r['actualVariant']==v and r['mode']=='WARM']
            pp.sort(key=lambda r:(r['kind']=='measured',r['repetition']))
            profile_progress.append({'matrixId':id,'host':h,'variant':v,'steps':[{'kind':r['kind'],'rep':r['repetition'],'apiMs':r['apiMs'],'coreMs':r['profile']['coreWallMs'],'preMs':r['profile']['preCoreWallMs'],'postMs':r['profile']['postCoreWallMs']} for r in pp]})
report={'status':'DIAGNOSIS_AUDITED_NOT_PROMOTION_EVIDENCE','expectedRuns':2560,'observedRuns':len(rows),'observedShards':len(shards),
    'missingRunIds':sorted(set(expected)-{r['runId'] for r in rows}),'statuses':dict(collections.Counter(r['status'] for r in rows)),
    'sourceGitBlobsVerified':source_blobs,'artifactFilesVerified':files,'phaseJournalRecordsVerified':journal_count,'durableRawWitnessesVerified':raw_witnesses,
    'weightedQualityAndSeedRecalculations':quality_checks,'determinismErrors':determinism,'stateRegressions':state_regressions,'qualityRegressions':quality_regressions,
    'summaries':summaries,'aaEnvironmentAlarms':aa_alarms,'pairs':pair_metrics,'warmProfileProgression':profile_progress,
    'newCandidateOnlyExactIndependentProofClaim':False,'nativeThresholdCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0,'confirmationCampaignCalls':0,
    'productChanged':False,'devApplied':False,'promotionDecisionMade':False}
out=HERE/'DIAGNOSIS.json'
with out.open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['pairs','warmProfileProgression']},indent=2))
