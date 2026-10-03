"""Descriptive selected-set analysis; does not recompute any population gate."""
from pathlib import Path
import collections
import datetime
import json
import statistics
import subprocess
HERE=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
a=load(HERE/'RETEST_AUDIT.json');assert a['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
inputs=a['inputs'];pairs=a['pairs']
stamp=lambda t:datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
groups={}
for name in ['IMPROVEMENT_TAIL','REGRESSION_TAIL','INPUT_SLOWDOWN_GATE_1_10','VARIATION_10_PERCENT_R','VARIATION_10_PERCENT_A','EXACT_STATUS_TRANSITION','HASH_STRATIFIED_UNSELECTED_CONTROL']:
    rows=[r for r in inputs if name in r['selectionReasons']]
    groups[name]={'inputs':len(rows),'directionReplicated':sum(r['directionReplicated'] for r in rows),
        'regressionThresholdReplicated':sum(r['regressionThresholdReplicated'] for r in rows),
        'hostDirectionMixed':sum(len({h['ratio']>1 for h in r['hostResults']})>1 for r in rows),
        'retimingMedianRatio':statistics.median(r['medianRatio'] for r in rows) if rows else None,
        'records':[{'matrixId':r['matrixId'],'originalPairMedianRatio':r['originalPairMedianRatio'],
            'originalRatioOfMedians':r['legacyOriginalRatioOfMedians'],'newMedianPairRatio':r['medianRatio'],
            'hostRatios':[h['ratio'] for h in r['hostResults']],'baselineMedianMs':r['baselineMedianMs'],
            'candidateMedianMs':r['candidateMedianMs'],'classification':r['classification']} for r in rows]}
runid=a['runId'];run=load(HERE/f'github-run-{runid}'/'RUN.json')
prior=load(Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003/experiments/a0-proof-retest-20261003/RETEST_BUDGET.json'))
jobseconds=sum((stamp(j['completedAt'])-stamp(j['startedAt'])).total_seconds() for j in run['jobs'])
totalhours=prior['priorRunnerHours']+jobseconds/3600
assert totalhours<64 and max(stamp(j['completedAt']) for j in run['jobs'])<stamp(prior['computeDeadline'])
global_variation={v:sum(r['variantVariation'][v]>=1.1 for r in inputs) for v in ['R','A']}
within_variation={v:sum(any(t>=1.1 for t in r['withinHostVariantVariation'][v]) for r in inputs) for v in ['R','A']}
withindiff=[r for r in inputs if not r['environmentSensitive']]
env=a['environmentControls']
report={'status':'DESCRIPTIVE_SELECTED_SET_ONLY','runId':runid,'inputs':121,'pairs':1210,'complete':True,'groups':groups,
    'globalVariantVariationInputs':global_variation,'withinHostVariantVariationInputs':within_variation,
    'hostsDirectionMixedInputs':sum(r['environmentSensitive'] for r in inputs),'sameVariantControlAlarms':0,
    'environmentMaxToMinRange':[min(e['maxToMinRatio'] for e in env),max(e['maxToMinRatio'] for e in env)],
    'allHostCandidateSlowerInputs':sum(all(h['ratio']>1 for h in r['hostResults']) for r in inputs),
    'allHostCandidateFasterInputs':sum(all(h['ratio']<1 for h in r['hostResults']) for r in inputs),
    'directionReplicated':a['directionReplicatedCount'],'regressionThresholdReplicated':a['regressionThresholdReplicatedCount'],
    'retimingAbsoluteDeltaMedianMs':{r['matrixId']:statistics.median(p['aMinusRMs'] for p in pairs if p['matrixId']==r['matrixId']) for r in inputs},
    'slowestBaselineInputs':sorted(inputs,key=lambda r:r['baselineMedianMs'],reverse=True)[:10],
    'largestAbsolutePairSlowdowns':sorted([{'matrixId':r['matrixId'],'medianRatio':r['medianRatio'],
        'medianPairDeltaMs':statistics.median(p['aMinusRMs'] for p in pairs if p['matrixId']==r['matrixId']),
        'baselineMedianMs':r['baselineMedianMs'],'candidateMedianMs':r['candidateMedianMs'],'hostRatios':[h['ratio'] for h in r['hostResults']]} for r in inputs],key=lambda r:r['medianPairDeltaMs'],reverse=True)[:10],
    'priorRunnerHours':prior['priorRunnerHours'],'retestJobSeconds':jobseconds,'retestRunnerHours':jobseconds/3600,
    'totalRunnerHours':totalhours,'lastJobCompletedAt':max(j['completedAt'] for j in run['jobs']),
    'originUnchanged':True,'budgetExpired':False,'originalGateRecomputed':False,'promotionAllowed':False,
    'interpretation':'Timing varied and mixed directions were common; algorithm-causal/CPU-model/JIT assertions are not established. Short-ms inputs can exceed relative alarms. Exact proof gap closed, original reserved p95 gate remains failed. Selected-set retiming is not population confirmation.'}
with (HERE/'ANALYSIS.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['groups','retimingAbsoluteDeltaMedianMs','slowestBaselineInputs']},indent=2))
print(json.dumps({k:{kk:vv for kk,vv in v.items() if kk!='records'} for k,v in groups.items()},indent=2))
print(json.dumps(groups['INPUT_SLOWDOWN_GATE_1_10']['records'],indent=2))
