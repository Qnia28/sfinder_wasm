"""Read-only evidence summary; integration remains a separate decision/action."""
from pathlib import Path
import collections
import csv
import datetime
import json
import statistics
import sys

HERE=Path(__file__).resolve().parent;id=int(sys.argv[1]) if len(sys.argv)>1 else 37138752420
D=HERE/f'github-run-{id}';load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):
 with p.open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')
a=load(D/'RETEST_AUDIT.json');analysis=a['analysis'];results=analysis['inputs'];run=load(D/'RUN.json')
complete=a['status']=='COMPLETE_INDEPENDENTLY_AUDITED' and analysis['completeInputs']==122
highlights=[r for r in results if r['matrixId'] in {
 'board-106--restricted-split--J','board-119--restricted-split--L','board-115--bag--ordinary',
 'board-111--restricted-split--ordinary','board-028--restricted-split--ordinary',
 'board-119--restricted-split--T','board-116--restricted-split--ordinary'}]
tails={}
for key in ['A0/R','M1/R','M1/A0']:
 rr=[r for r in results if r['comparisons'][key]['complete100Pairs']]
 tails[key]={'improvements':[{'id':r['matrixId'],**{k:r['comparisons'][key][k] for k in ['medianRatio','medianDeltaMs','fasterHosts','environmentAlarm','directionReplicated']}}
  for r in sorted(rr,key=lambda r:r['comparisons'][key]['medianRatio'])[:12]],
  'slowdowns':[{'id':r['matrixId'],**{k:r['comparisons'][key][k] for k in ['medianRatio','medianDeltaMs','slowdownAbove1_10Hosts','environmentAlarm','directionReplicated']}}
  for r in sorted(rr,key=lambda r:r['comparisons'][key]['medianRatio'],reverse=True)[:12]]}
rows=[json.loads(l) for p in D.rglob('runs.jsonl') if p.parent.name in [str(h) for h in range(10)] for l in p.read_text().splitlines()]
arm_times=collections.defaultdict(list)
for r in rows:
 if r['kind']!='ENVIRONMENT_CONTROL':arm_times[(r['matrixId'],r['comparison'],r['arm'])].append(r['apiMs'])
descriptive={}
for key in ['A0/R','M1/R','M1/A0']:
 n,d=key.split('/');totaln=totald=0;ids=[]
 for r in results:
  nt=arm_times[(r['matrixId'],key,n)];dt=arm_times[(r['matrixId'],key,d)]
  if len(nt)==len(dt)==100:totaln+=statistics.median(nt);totald+=statistics.median(dt);ids.append(r['matrixId'])
 descriptive[key]={'inputs':len(ids),'sumInputMedianNumeratorMs':totaln,'sumInputMedianDenominatorMs':totald,
  'selectedInputSumRatio':totaln/totald if totald else None,'notGate':True,'notPairedMedianRatio':True,
  'notWholeProductLatency':True,'incompleteSubsetNeverPerformancePass':len(ids)!=122}
dt=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
status=load(HERE/'STATUS.json');origin=dt(status['origin'])
jobs=[j for j in run['jobs'] if j['startedAt'] and j['completedAt']];hours=sum((dt(j['completedAt'])-dt(j['startedAt'])).total_seconds()/3600 for j in jobs)
done=max(dt(j['completedAt']) for j in jobs)
report={'status':'COMPLETE100PAIR_RETEST_SUMMARIZED' if complete else 'PRESERVED_PARTIAL_RETEST_NO_SUCCESS_SUBSET_PROMOTION',
 'runId':id,'sourceCommit':run['headSha'],'verifiedCalls':a['verifiedCalls'],'expectedCalls':a['expectedCalls'],'completeInputs':analysis['completeInputs'],
 'outcomes':a['outcomes'],'probeStatusCounts':dict(collections.Counter(r['status'] for r in rows)),
 'comparisons':analysis['summary'],'environmentAlarms':[e for e in analysis['environmentControls'] if e['alarm']],
 'descriptiveSelectedCosts':descriptive,'timingHighlights':highlights,'tails':tails,
 'runnerHours':hours,'completedAt':done.isoformat(),'wallMinutes':(done-origin).total_seconds()/60,
 'oneRetestFinished':True,'automaticSecondRetest':False,'inputSlowdownAbove1_10IsIntegrationVeto':False,
 'newProduct5PercentGate':False,'wholePopulationRecomputed':False,'oldReservedP95':1.197846065695026,
 'originalPerformanceValuesReplaced':False,'productIntegrationImplemented':False}
write(HERE/'COMPARISON_SUMMARY.json',report)
with (HERE/'COMPARISON_BY_INPUT.csv').open('x',encoding='utf-8-sig',newline='') as f:
 fields=['matrixId','phase']+[f'{key}_{k}' for key in ['A0/R','M1/R','M1/A0'] for k in ['medianRatio','medianDeltaMs','fasterHosts','slowdownAbove1_10Hosts','environmentAlarm','classification']]
 writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
 for r in results:
  row={k:r[k] for k in ['matrixId','phase']}
  for key,c in r['comparisons'].items():
   for k in ['medianRatio','medianDeltaMs','fasterHosts','slowdownAbove1_10Hosts','environmentAlarm','classification']:row[f'{key}_{k}']=c[k]
  writer.writerow(row)
status.update({'status':report['status'],'linuxPreflight':'PASS' if any(j['name']=='preflight' and j['conclusion']=='success' for j in jobs) else 'FAILED_OR_UNOBSERVED',
 'actualNativeCalls':a['verifiedCalls'],'actualNativeCallsAuditComplete':complete,'complete100PairInputs':analysis['completeInputs'],
 'rawRecordsAudited':a['rawRecordsVerified'],'weightedQualitySeedChecks':a['weightedQualitySeedChecks'],
 'sourceCommit':run['headSha'],'runnerHours':hours,'completedAt':report['completedAt'],'campaignClosed':True,'activeWatchers':0,
 'next':'Evaluate once using contract/operational results, replicated benefits and absolute losses. No extra retest or actual integration authorized.'})
(HERE/'STATUS.json').write_text(json.dumps(status,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['timingHighlights','tails']},indent=2))
