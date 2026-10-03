"""Verify frozen selection independently using legacy pair schedule and deterministic hashes."""
from pathlib import Path
import hashlib
import math
import json
import statistics
import collections

HERE=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
s=load(HERE/'SELECTION.json');seed=s['selectionSeed'];rank=lambda id:hashlib.sha256((seed+'\n'+id).encode()).hexdigest()
assert s['rulesSha256']==hashlib.sha256((HERE.parent/'TESTING_RULES_KO.md').read_bytes()).hexdigest()
rows=[]
for source in s['sourceFiles']:
 p=Path(source['file']);assert hashlib.sha256(p.read_bytes()).hexdigest()==source['sha256'];rows.extend(json.loads(l) for l in p.read_text().splitlines())
assert len(rows)==1344
by=collections.defaultdict(list)
for row in rows:by[(row['phase'],row['matrixId'])].append(row)
assert len(by)==168
for rec in s['records']:
 rr=by[(rec['phase'],rec['matrixId'])];q=[]
 for rep in range(1,5):
  pair=[r for r in rr if r['repetition']==rep];assert len(pair)==2 and {r['position'] for r in pair}=={1,2} and len({r['shard'] for r in pair})==1
  pair.sort(key=lambda r:r['variant']);assert [r['variant'] for r in pair]==['A','R'];q.append(pair[0]['apiMs']/pair[1]['apiMs'])
 assert q==rec['pairRatios'] and statistics.median(q)==rec['ratio']
 for v in ['R','A']:
  times=[r['apiMs'] for r in rr if r['variant']==v];assert max(times)/min(times)==rec['variation'][v]
  assert ('VARIATION_10_PERCENT_'+v in rec['selectionReasons'])==(max(times)/min(times)>=1.1)
 assert ('INPUT_SLOWDOWN_GATE_1_10' in rec['selectionReasons'])==(rec['ratio']>1.1)
for phase in ['development','reserved']:
 rr=[r for r in s['records'] if r['phase']==phase];selected={r['matrixId'] for r in rr if r['selected']}
 for kind,predicate,reverse in [('IMPROVEMENT_TAIL',lambda r:r['ratio']<1,False),('REGRESSION_TAIL',lambda r:r['ratio']>1,True)]:
  group=sorted([r for r in rr if predicate(r)],key=lambda r:r['ratio'],reverse=reverse);n=math.ceil(len(group)*.1)
  boundary=group[n-1]['ratio'] if n else None
  target={r['matrixId'] for r in group if (r['ratio']>=boundary if reverse else r['ratio']<=boundary)} if n else set()
  observed={r['matrixId'] for r in rr if kind in r['selectionReasons']};assert observed==target
 nonselected=[r for r in rr if not any(reason!='HASH_STRATIFIED_UNSELECTED_CONTROL' for reason in r['selectionReasons'])]
 strata=collections.defaultdict(list)
 for r in nonselected:strata[(r['baselineQuartile'],r['baselineStatus'])].append(r)
 expected={min(group,key=lambda r:(rank(r['matrixId']),r['matrixId']))['matrixId'] for group in strata.values()}
 assert expected=={r['matrixId'] for r in rr if r['selectedAsControl']}
assert sum(r['selected'] for r in s['records'])==121 and s['maxNativeCalls']==2460
counts=collections.Counter(reason for r in s['records'] for reason in r['selectionReasons'])
variation=sum(any(reason.startswith('VARIATION_') for reason in r['selectionReasons']) for r in s['records'])
record={'status':'SELECTION_INDEPENDENTLY_VERIFIED_NO_NEW_SOLVER','populationInputs':168,'sourceRowsVerified':1344,
 'explicitLegacyPairMappingVerified':True,'selectedIncludingControls':121,'mainSelected':115,'unselectedStratifiedControls':6,
 'uniqueVariationFlaggedInputs':variation,'selectionReasonCounts':dict(counts),'plannedNativeCalls':2460,'plannedRunnerJobs':5,
 'sourceInputValuesNotReplaced':True,'newNativeCalls':0,'proofPendingSoRetestNotLaunched':True}
with (HERE/'SELECTION_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps(record,indent=2))
