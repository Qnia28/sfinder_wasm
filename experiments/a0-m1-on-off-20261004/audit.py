"""Post-campaign original weighted-row/raw/lock audit; never invokes a solver."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import sys
from analyze import analyze
EX=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def audit(download):
 inputs=load(EX/'INPUTS.json')['entries'];matrices={}
 for e in inputs:
  b=(EX/e['file']).read_bytes();assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b));assert m['identitySha256']==e['identitySha256'];matrices[e['id']]=m
 expected={r['runId']:r for r in load(EX/'SCHEDULE.json')['runs']};rows=[];outcomes=[];seen=set();locks=[];raw_records=0
 by_host={h:[r for r in expected.values() if r['host']==h] for h in range(10)}
 for summary in download.rglob('SUMMARY.json'):
  if summary.parent.name not in [str(h) for h in range(10)]:continue
  s=load(summary);locks.append(s['lock']);out=summary.parent
  for f in s['files']:
   b=(out/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
  rr=[json.loads(l) for l in (out/'runs.jsonl').read_text().splitlines()] if (out/'runs.jsonl').exists() else []
  oo=[json.loads(l) for l in (out/'outcomes.jsonl').read_text().splitlines()] if (out/'outcomes.jsonl').exists() else []
  assert len(rr)==s['verifiedCalls'];assert len(oo)==s['attemptedCalls'];outcomes+=oo
  assert len({o['runId'] for o in oo})==len(oo)
  for i,o in enumerate(oo):
   assert all(o[k]==v for k,v in expected[o['runId']].items())
   assert o['runId']==by_host[s['host']][i]['runId']
   if o['status'].startswith('TIMEOUT_'):
    resources=o['resources'];assert resources['killToCloseMs']<2000
    assert resources['resources']['memoryMaxBytes']==3221225472 and resources['resources']['swapMaxBytes']==0
    assert not resources['resources']['cgroupEvents']['oom_kill']
    p=out/'raw'/f'{o["runId"]}.jsonl'
    partial=[json.loads(l) for l in p.read_text().splitlines()] if p.exists() else []
    assert all(v['runId']==o['runId'] for v in partial);raw_records+=len(partial)
    for v in partial:
     if v['type']!='probe-result':continue
     probe=v['probe'];m=matrices[o['matrixId']];assert probe['K']==m['K']
     chosen={m['keys'].index(k) for k in probe['keys']};assert len(chosen)==m['K']
     vector=sorted(max([q for id,q in row if id in chosen],default=0) for row in m['rows'])
     assert vector[0]>0 and vector==probe['qualityVector']
  if s.get('priorRunId'):
   prior=load(out/'PRIOR_SUMMARY.json');prior_lock=load(out/'PRIOR_LOCK.json');assert prior['lock']==prior_lock
   assert prior_lock['inputs']==s['lock']['inputs']
   for key in ['referenceWasm','candidateWasm','batchWasm']:assert prior_lock[key]==s['lock'][key]
   assert prior['attemptedCalls']==s['resumedAttemptedCalls']
   assert sha((out/'PRIOR_SUMMARY.json').read_bytes())==next(h for h in load(EX/'RESUME.json')['hosts'] if h['host']==s['host'])['summarySha256']
   for f in prior['files']:
    if f['file']=='LOCK.json':assert sha((out/'PRIOR_LOCK.json').read_bytes())==f['sha256'];continue
    if f['file'] in ['runs.jsonl','outcomes.jsonl','starts.jsonl']:
     prefix=(out/f['file']).read_bytes()[:f['bytes']];assert len(prefix)==f['bytes'] and sha(prefix)==f['sha256'];continue
    b=(out/f['file']).read_bytes();assert sha(b)==f['sha256'] and len(b)==f['bytes']
  for r in rr:
   assert r['runId'] not in seen;seen.add(r['runId']);assert all(r[k]==v for k,v in expected[r['runId']].items())
   raw=[json.loads(l) for l in (out/r['rawFile']).read_text().splitlines()];assert [v['type'] for v in raw]==['phase-start','probe-start','probe-result','phase-result','audit-result'];raw_records+=len(raw)
   for key,value in raw[3]['raw'].items():assert r[key]==value
   assert raw[2]['probe']==r['calls'][0] and raw[1]['stateBudget']==100000
   m=matrices[r['matrixId']];assert r['minimalCount']==m['K'] and len(set(r['keys']))==m['K'] and r['humanQualityExact']
   normalized=sorted([[str(c.get('sourceCaseId',c['caseId'])),sorted(row,key=lambda e:e[0])] for c,row in zip(m['cases'],m['rows'])],key=lambda e:e[0])
   assert r['regeneratedMatrixSha256']==sha(json.dumps([m['keys'],normalized],ensure_ascii=False,separators=(',',':')).encode())
   ids=[m['keys'].index(k) for k in r['keys']];assert len(ids)==m['K']
   vector=sorted(max([q for id,q in row if id in ids],default=0) for row in m['rows']);assert vector[0]>0 and vector==r['humanQualityVector']
   assert sha(json.dumps(vector,separators=(',',':')).encode())==r['witness']['qualitySha256']
   assert sha(json.dumps(sorted(ids),separators=(',',':')).encode())==r['witness']['stableIdsSha256']
   seed=r['calls'][0]['seedKeys'];assert len(seed)==m['K'] and len(set(seed))==m['K'];seedids={m['keys'].index(k) for k in seed}
   assert all(any(id in seedids for id,q in row) for row in m['rows'])
   assert r['witness']['originalIdentity']==m['identitySha256'] and raw[4]['witness']==r['witness']
   assert r['rawResources']['memoryMaxBytes']==3221225472 and r['rawResources']['swapMaxBytes']==0
   assert not r['rawResources']['cgroupEvents']['oom_kill']
   assert len([c for c in r['calls'] if c['integrated']])==1
   rows.append(r)
 assert locks and all(l==locks[0] for l in locks)
 preflight=next(download.glob('*preflight'))
 assert load(preflight/'.a0-m1-comparison/LOCK.json')==locks[0]
 for name,key in [('pc_wasm.wasm','referenceWasm'),('pc_a0_m1.wasm','candidateWasm'),('batch_wasm.wasm','batchWasm')]:assert sha((preflight/'wasm'/name).read_bytes())==locks[0][key]
 outcome_counts=collections.Counter(r['status'] for r in outcomes)
 assert outcome_counts['VERIFIED']==len(rows)
 result={'status':('ALL_SCHEDULED_OUTCOMES_AUDITED_WITH_TIMEOUTS' if outcome_counts.total()==24480 and len(locks)==10 and any(k.startswith('TIMEOUT_') for k in outcome_counts)
    else 'COMPLETE_INDEPENDENTLY_AUDITED' if len(rows)==24480 and len(locks)==10 else 'PARTIAL_BUDGET_OUTCOMES_AUDITED_NO_SUBSET_PASS'),
   'expectedCalls':24480,'attemptedCalls':outcome_counts.total(),'verifiedCalls':len(rows),'outcomes':dict(outcome_counts),'rawRecords':raw_records,'lock':locks[0],
   'analysis':analyze(rows,inputs,outcomes),'nativeSolverCallsFromAudit':0,'productDefaultChanged':False}
 with (download/'AUDIT.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(result,f,indent=2);f.write('\n')
 return {k:v for k,v in result.items() if k not in ['analysis','lock']}
if __name__=='__main__':print(json.dumps(audit(Path(sys.argv[1])),indent=2))
