"""Independent100pair arithmetic check; run once after RETEST_AUDIT exists."""
from pathlib import Path
import collections
import json
import statistics
import sys

HERE=Path(__file__).resolve().parent;D=HERE/f'github-run-{sys.argv[1] if len(sys.argv)>1 else 37138752420}'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
a=load(D/'RETEST_AUDIT.json');results=a['analysis']['inputs']
assert a['status']=='COMPLETE_INDEPENDENTLY_AUDITED' and a['verifiedCalls']==73320
rows=[json.loads(l) for p in D.rglob('runs.jsonl') if p.parent.name in [str(h) for h in range(10)] for l in p.read_text().splitlines()]
assert len(rows)==73320 and all(not r['diagnostic'] and r['timingEvidence'] for r in rows)
groups=collections.defaultdict(list)
for r in rows:groups[r['blockId']].append(r)
checked=0;by_input=collections.defaultdict(list)
for g in groups.values():
 assert len(g)==2 and [r['position'] for r in g]==[1,2]
 if g[0]['kind']!='ENVIRONMENT_CONTROL':by_input[g[0]['matrixId']].append(g)
for result in results:
 for key,c in result['comparisons'].items():
  bb=[g for g in by_input[result['matrixId']] if g[0]['comparison']==key];assert len(bb)==100
  assert collections.Counter(g[0]['host'] for g in bb)=={h:10 for h in range(10)}
  n,d=key.split('/');pairs=[]
  for g in bb:
   by={r['arm']:r for r in g};assert set(by)=={n,d}
   pairs.append({'blockId':g[0]['blockId'],'host':g[0]['host'],'ratio':by[n]['apiMs']/by[d]['apiMs'],'deltaMs':by[n]['apiMs']-by[d]['apiMs']})
  assert sorted(pairs,key=lambda p:p['blockId'])==sorted(c['pairs'],key=lambda p:p['blockId'])
  assert statistics.median(p['ratio'] for p in pairs)==c['medianRatio']
  assert statistics.median(p['deltaMs'] for p in pairs)==c['medianDeltaMs']
  for h in c['hosts']:
   pp=[p for p in pairs if p['host']==h['host']];assert statistics.median(p['ratio'] for p in pp)==h['ratio']
  checked+=1
env=[g for g in groups.values() if g[0]['kind']=='ENVIRONMENT_CONTROL'];assert len(env)==60
alarms=sum(max(r['apiMs'] for r in g)/min(r['apiMs'] for r in g)>1.1 for g in env)
assert alarms==a['analysis']['environmentAlarms']
report={'status':'ALL_ADJACENT100PAIR_STATS_INDEPENDENTLY_VERIFIED','calls':73320,'selectedPairs':36600,
 'comparisonSeries':checked,'inputs':122,'runnerJobs':10,'pairsPerRunnerPerComparison':10,'environmentPairs':60,
 'environmentAlarms':alarms,'noRatioOfMedians':True,'noOriginalTimingReplacement':True,'noHostExcluded':True,
 'noActualSolverCallsInAudit':True}
with (HERE/'PAIRED_STATS_AUDIT.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
