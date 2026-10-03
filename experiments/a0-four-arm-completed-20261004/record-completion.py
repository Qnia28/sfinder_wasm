"""Summarize audited fixed selection only, without population gates or native calls."""
from pathlib import Path
import collections
import csv
import datetime
import json
import statistics

HERE=Path(__file__).resolve().parent;D=HERE/'github-run-37134463920'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
write=lambda p,v:p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
a=load(D/'FOUR_ARM_AUDIT.json');w=load(D/'WORK_DIAGNOSTIC_AUDIT.json');extra=load(HERE/'SUPPLEMENTAL_AUDIT.json')
assert a['status']=='COMPLETE_INDEPENDENTLY_AUDITED' and w['status']=='COMPLETE_WORK_COUNTS_AUDITED'
assert a['verifiedCalls']==4960 and w['calls']==20 and a['analysis']['completeInputs']==122
results=a['analysis']['inputs'];comparisons={}
for key in results[0]['comparisons']:
 cc=[r['comparisons'][key] for r in results]
 comparisons[key]={'selectedInputCount':len(cc),'medianOfInputWithinBlockMedianRatios':statistics.median(c['medianRatio'] for c in cc),
  'directionBelow1AndAtLeast4FasterHosts':sum(c['medianRatio']<1 and c['fasterHosts']>=4 for c in cc),
  'magnitudeBelow0_9AndAtLeast4Hosts':sum(c['medianRatio']<.9 and sum(h['ratio']<.9 for h in c['hosts'])>=4 for c in cc),
  'magnitudeAbove1_1AndAtLeast4Hosts':sum(c['medianRatio']>1.1 and c['slowdownAbove1_10Hosts']>=4 for c in cc),
  'unfilteredDescriptiveNumbersNotPerformancePass':True,
  'environmentClearInputCount':sum(not c['environmentAlarm'] and not c['environmentMissing'] for c in cc),
  'environmentClearDirectionalImprovementCount':sum(not c['environmentAlarm'] and not c['environmentMissing'] and c['medianRatio']<1 and c['fasterHosts']>=4 for c in cc),
  'environmentClearMagnitudeSlowdownCount':sum(not c['environmentAlarm'] and not c['environmentMissing'] and c['medianRatio']>1.1 and c['slowdownAbove1_10Hosts']>=4 for c in cc),
  'worst10':[{'matrixId':r['matrixId'],'ratio':r['comparisons'][key]['medianRatio'],'deltaMs':r['comparisons'][key]['medianDeltaMs'],
    'slowdownAbove1_10Hosts':r['comparisons'][key]['slowdownAbove1_10Hosts'],'environmentAlarm':r['comparisons'][key]['environmentAlarm']}
    for r in sorted(results,key=lambda r:r['comparisons'][key]['medianRatio'],reverse=True)[:10]]}
highlights=[]
for r in results:
 diag=next((d for d in w['results'] if d['matrixId']==r['matrixId']),None)
 if diag:
  highlights.append({'matrixId':r['matrixId'],'timing':{k:{x:c[x] for x in ['medianRatio','medianDeltaMs','fasterHosts','slowdownAbove1_10Hosts','environmentAlarm','environmentMissing']} for k,c in r['comparisons'].items()},
   'verdicts':r['verdicts'],'workCounts':diag})
origin=datetime.datetime.fromisoformat(load(HERE/'STATUS.json')['origin'].replace('Z','+00:00'))
runs=[load(HERE/f'github-run-{id}/RUN.json') for id in [37134128882,37134463920]]
dt=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
runner_hours=sum((dt(j['completedAt'])-dt(j['startedAt'])).total_seconds()/3600 for run in runs for j in run['jobs'] if j['startedAt'] and j['completedAt'])
completed=max(dt(j['completedAt']) for j in runs[-1]['jobs']);assert (completed-origin).total_seconds()<160*60 and runner_hours<64
report={'status':'COMPLETE_AUDITED_SELECTED_SET_ONLY','runId':37134463920,'originRunId':37134128882,'sourceCommit':runs[-1]['headSha'],
 'verifiedTimingCalls':4960,'verifiedDiagnosticCalls':20,'completeInputs':122,'blocksPerInput':10,'runnerJobs':5,
 'environmentAlarmCount':a['analysis']['environmentAlarms'],'environmentAlarms':[e for e in a['analysis']['environmentControls'] if e['alarm']],
 'environmentSensitiveJointComparisonInputs':sum(any(r['verdicts'][arm]['classification']=='ENVIRONMENT_SENSITIVE' for arm in ['M1','M2']) for r in results),'comparisons':comparisons,
 'verdictCounts':{arm:dict(collections.Counter(r['verdicts'][arm]['classification'] for r in results)) for arm in ['M1','M2']},
 'diagnosticHighlights':highlights,'priorFailedRunActualCalls':0,'origin':origin.isoformat(),'completedAt':completed.isoformat(),
 'wallMinutes':(completed-origin).total_seconds()/60,'runnerHoursIncludingFailedPreflight':runner_hours,
 'originalReservedP95':1.197846065695026,'originalReservedGateLimit':1.10,'originalPopulationGateRecomputed':False,
 'productIntegration':'HOLD','noProductApplyMergeDeployment':True,'automaticFurtherCampaign':False,
 'causalLimit':'Active M1/M2 WASM code layout differs. Work counters confirm targeted reductions only on five fixed diagnostics; timing attribution is not exclusive.',
 'statisticalLimit':'Selected 122 inputs; ten blocks on five runners, not ten independent hosts. Descriptive paired ratios, no population PASS or significance claim.'}
write(HERE/'COMPARISON_SUMMARY.json',report)
with (HERE/'COMPARISON_BY_INPUT.csv').open('w',newline='',encoding='utf-8-sig') as f:
 fields=['matrixId','phase','control']+[f'{key}_{name}' for key in comparisons for name in ['ratio','deltaMs','fasterHosts','above1_10Hosts']]+['M1_verdict','M2_verdict']
 writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
 for r in results:
  row={k:r[k] for k in ['matrixId','phase','control']}
  for key,c in r['comparisons'].items():
   row.update({f'{key}_ratio':c['medianRatio'],f'{key}_deltaMs':c['medianDeltaMs'],f'{key}_fasterHosts':c['fasterHosts'],f'{key}_above1_10Hosts':c['slowdownAbove1_10Hosts']})
  row.update({f'{arm}_verdict':r['verdicts'][arm]['classification'] for arm in ['M1','M2']});writer.writerow(row)
s=load(HERE/'STATUS.json');s.update({'status':report['status'],'linuxBuildTestsStatus':'PASS','linuxControlByteEqualityStatus':'PASS',
 'actualInputNativeCalls':4980,'timingCallsVerified':4960,'diagnosticCallsVerified':20,'missingCalls':0,'errorTimeoutOomCalls':0,
 'complete10BlockInputs':122,'rawRecordsAudited':a['rawRecordsVerified']+extra['diagnosticRawRecords'],
 'weightedQualitySeedChecks':a['fullWeightedQualitySeedChecks']+w['weightedQualitySeedRecalculations'],
 'completedAt':report['completedAt'],'runnerHoursIncludingFailedPreflight':runner_hours,'campaignClosed':True,'activeWatchers':0,
 'benchmarkPromotionClaim':False,'environmentAlarms':report['environmentAlarmCount'],
 'next':'No further automatic run. Review paired comparison and independent work counts; product remains HOLD under original reserved p95 failure.'})
write(HERE/'STATUS.json',s)
print(json.dumps({k:v for k,v in report.items() if k not in ['comparisons','diagnosticHighlights']},indent=2))
for key,c in comparisons.items():print(key,json.dumps({k:v for k,v in c.items() if k!='worst10'}))
for r in highlights:
 print(r['matrixId'],json.dumps({'ratios':{k:v['medianRatio'] for k,v in r['timing'].items()},'work':{k:r['workCounts'][k] for k in ['m1BoundWordRatio','m2TrailPushRatio']}}))
