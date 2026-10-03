"""Read-only cross-stage provenance and diagnostic IPC-contract audit; no solver calls."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-four-arm-20261003')
EX=REPO/'experiments/a0-four-arm-20261003';D=HERE/'github-run-37134463920'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
build=D/'a0-four-build';timing_summaries=[load(p) for p in D.rglob('SUMMARY.json') if p.parent.name in ['0','1','2','3','4']]
assert len(timing_summaries)==5 and all(s['status']=='COMPLETE' for s in timing_summaries)
wp=next(D.rglob('work-results/SUMMARY.json'));work=load(wp);lock=work['lock']
assert all(s['lock']==lock and s['lockSha256']==work['lockSha256'] for s in timing_summaries)
assert lock['diagnosticBuild']==load(build/'DIAGNOSTIC_BUILD.json') and lock['build']==load(build/'BUILD.json')
assert lock['commit']=='f4716e1f2686fa25c4e844e47b51e88835a980da'
source_count=runtime_count=0
for f in lock['files']:
 assert sha(subprocess.check_output(['git','-C',str(REPO),'show',f"{lock['commit']}:{f['file']}"]))==f['sha256'];source_count+=1
for f in lock['runtimeFiles']:
 assert sha((build/f['file'].removeprefix('.a0/four/')).read_bytes())==f['sha256'];runtime_count+=1
assert load(build/'BASELINE_GATE.json')['status']==load(build/'CONTROL_GATE.json')['status']=='PASS'
assert lock['origin']['runId']==37134128882 and lock['origin']['origin']=='2026-10-03T15:41:25Z'
assert not lock['origin']['clockResetWithinCampaign'] and not work['clockReset']
schedule=load(EX/'DIAGNOSTIC_SCHEDULE.json')['runs'];rows=[json.loads(l) for l in (wp.parent/'runs.jsonl').read_text().splitlines()]
outcomes=[json.loads(l) for l in (wp.parent/'outcomes.jsonl').read_text().splitlines()]
assert len(rows)==len(outcomes)==len(schedule)==20 and work['status']=='COMPLETE'
assert [r['runId'] for r in rows]==[r['runId'] for r in outcomes]==[r['runId'] for r in schedule]
assert all(r['status']=='VERIFIED' for r in outcomes)
inputs={}
for e in load(EX/'INPUTS.json')['entries']:
 if e['id'] not in {r['matrixId'] for r in schedule}:continue
 with (REPO/'experiments/a0-integrated-revalidation-20261003'/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
 assert sha(b)==e['sha256'];inputs[e['id']]=json.loads(gzip.decompress(b))
names={'boundCalls','boundCandidates','boundWords','cutoffHits','prunes','trailPushes','avoidedTrailPushes'}
for r,expected in zip(rows,schedule):
 assert all(r[k]==v for k,v in expected.items())
 m=inputs[r['matrixId']];p=r['probe'];raw=[json.loads(l) for l in (wp.parent/r['rawFile']).read_text().splitlines()]
 assert r['profile'] is None and r['worker']['callCount']==1 and r['worker']['cpu']=='UNPINNED'
 assert set(r['counters'])==names and all(type(v) is int and v>=0 for v in r['counters'].values())
 assert r['primaryProofSha256']==sha(canon(m['primary'])) and r['seedKeysSha256']==sha(canon(m['seedKeys']))
 assert r['options']['seedKeys']==m['seedKeys'] and r['options']['stateBudget']==100000 and r['options']['integrated']
 assert bool(r['options'].get('partitioned'))==(r['arm']!='R') and not r['options'].get('dominance')
 assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
 assert all(v['runId']==r['runId'] for v in raw)
 assert raw[0]['hostMs']<raw[1]['hostMs'] and raw[1]['diagnostic'] and not raw[1]['timingEvidence']
 for k in ['options','apiMs','worker','wasmSha256','counters']:assert raw[1][k]==r[k]
 assert raw[2]['contract']==r['contract']
 if not p['completed']:
  c=r['contract'];assert c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p)) and len(c['calls'])==2
  assert all(call=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for call in c['calls'])
 assert r['wasmSha256']==sha((build/lock['diagnosticBuild']['outputs'][r['arm']]['runtime'].removeprefix('.a0/four/')/'wasm/pc_wasm.wasm').read_bytes())
assert len({r['worker']['pid'] for r in rows})==20
all_rows=[json.loads(l) for p in D.rglob('runs.jsonl') if p.parent.name in ['0','1','2','3','4','work-results'] for l in p.read_text().splitlines()]
assert len(all_rows)==4980 and sum(r['diagnostic'] for r in all_rows)==20
report={'status':'CROSS_STAGE_PROVENANCE_AND_DIAGNOSTIC_CONTRACT_PASS','sourceBlobsVerified':source_count,
 'runtimeFilesVerified':runtime_count,'identicalLockAcrossTimingAndWork':True,'diagnosticCalls':20,'diagnosticRawRecords':60,
 'actualInputCalls':4980,'probeStatusCounts':dict(collections.Counter(r['status'] for r in all_rows)),
 'originalInputCallsOnFailedRun':0,'noClockReset':True,'noSolverInvocationInAudit':True,'workTimeNotPerformanceEvidence':True}
with (HERE/'SUPPLEMENTAL_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
