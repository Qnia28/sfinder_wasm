"""Independent paired arithmetic check against every measured row, no solver calls."""
from pathlib import Path
import collections
import json
import statistics

HERE=Path(__file__).resolve().parent;D=HERE/'github-run-37134463920'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
a=load(D/'FOUR_ARM_AUDIT.json')['analysis']
rows=[json.loads(l) for p in D.rglob('runs.jsonl') if p.parent.name in ['0','1','2','3','4'] for l in p.read_text().splitlines()]
assert len(rows)==4960 and all(not r['diagnostic'] and r['timingEvidence'] for r in rows)
group=collections.defaultdict(list)
for r in rows:group[r['blockId']].append(r)
checked=0
for result in a['inputs']:
 blocks=[g for g in group.values() if g[0]['matrixId']==result['matrixId'] and g[0]['kind']!='ENVIRONMENT_CONTROL']
 assert len(blocks)==10 and collections.Counter(g[0]['host'] for g in blocks)=={h:2 for h in range(5)}
 assert all(len(g)==4 and {r['arm'] for r in g}=={'R','A0','M1','M2'} for g in blocks)
 for key,c in result['comparisons'].items():
  n,d=key.split('/');pairs=[]
  for g in blocks:
   by={r['arm']:r for r in g};pairs.append({'host':g[0]['host'],'blockId':g[0]['blockId'],
    'ratio':by[n]['apiMs']/by[d]['apiMs'],'deltaMs':by[n]['apiMs']-by[d]['apiMs']})
  assert sorted(pairs,key=lambda p:p['blockId'])==sorted(c['pairs'],key=lambda p:p['blockId'])
  assert statistics.median(p['ratio'] for p in pairs)==c['medianRatio'] and statistics.median(p['deltaMs'] for p in pairs)==c['medianDeltaMs']
  for host in c['hosts']:
   pp=[p for p in pairs if p['host']==host['host']]
   assert statistics.median(p['ratio'] for p in pp)==host['ratio']
  checked+=1
env=[g for g in group.values() if g[0]['kind']=='ENVIRONMENT_CONTROL'];assert len(env)==40 and all(len(g)==2 for g in env)
alarms=sum(max(r['apiMs'] for r in g)/min(r['apiMs'] for r in g)>1.1 for g in env);assert alarms==2==a['environmentAlarms']
report={'status':'ALL_MEASURED_ROWS_PAIRED_ARITHMETIC_VERIFIED','timingRows':4960,'inputs':122,'completeBlocks':1220,
 'comparisonSeriesChecked':checked,'environmentPairs':40,'environmentAlarms':2,'noHistoricalTimingUsed':True,
 'noRatioOfMedians':True,'noHostExcluded':True,'noDiagnosticTimesIncluded':True}
with (HERE/'PAIRED_STATS_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
