"""Reconcile original 24 slots without pooling clocks across hosted cohorts."""
from pathlib import Path
import hashlib
import json
import statistics

HERE=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
for name in ['FIRST_RUN_SEAL.json','PREFLIGHT_RUN_SEAL.json']:
    for f in load(HERE/name)['files']:
        b=(HERE/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
old=load(HERE/'ANALYSIS.json');new=load(HERE/'ANALYSIS_CONTINUATION.json')
def rows(run):
    folders=list((HERE/f'github-run-{run}').rglob('runs.jsonl'))
    folders=[p for p in folders if 'results' in p.parts];assert len(folders)==1
    return [json.loads(l) for l in folders[0].read_text().splitlines()]
first=rows(old['runId']);continued=rows(new['runId'])
all_rows=first+continued
original_ids=[r.get('originalRunId',r['runId']) for r in all_rows]
assert len(original_ids)==len(set(original_ids))
original_summary=load(next((HERE/f"github-run-{old['runId']}").rglob('SUMMARY.json')))
original_schedule={r['runId'] for r in original_summary['scheduled']}
assert set(original_ids)<=original_schedule
determinism={v:len({sha(json.dumps(r['probe'],ensure_ascii=False,separators=(',',':')).encode()) for r in all_rows if r['label']==v}) for v in ['R','A']}
assert all(n<=1 for n in determinism.values())
# Use only repetition2/3 in the continuation for matched within-host comparisons.
groups={}
for mode in ['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST']:
    for v in ['R','A']:
        rr=[r for r in continued if r['engineMode']==mode and r['label']==v and not r['trace'] and r['repetition'] in [2,3]]
        groups[f'{mode}:{v}']={'count':len(rr),'apiSamplesMs':[r['apiMs'] for r in rr],
            'medianApiMs':statistics.median(r['apiMs'] for r in rr) if rr else None,
            'medianInitMs':statistics.median(r['initMs'] for r in rr) if rr else None,
            'medianInitPlusApiMs':statistics.median(r['initMs']+r['apiMs'] for r in rr) if rr else None}
contrasts=[]
for v in ['R','A']:
    get=lambda mode:groups[f'{mode}:{v}']['medianApiMs']
    if all(get(mode) for mode in ['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST']):
        contrasts.append({'variant':v,'liftoffOnlyToDefault':get('LIFTOFF_ONLY')/get('DEFAULT'),'optimizedFirstToDefault':get('OPTIMIZED_FIRST')/get('DEFAULT'),'liftoffOnlyToOptimizedFirst':get('LIFTOFF_ONLY')/get('OPTIMIZED_FIRST')})
for mode in ['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST']:
    r=groups[f'{mode}:R']['medianApiMs'];a=groups[f'{mode}:A']['medianApiMs']
    if r and a:contrasts.append({'mode':mode,'candidateToBaselineRatio':a/r})
report={'status':'COMPLETE_NATIVE_SCHEDULE_WITH_PRESERVED_HARNESS_FAILURES' if set(original_ids)==original_schedule else 'PARTIAL_NATIVE_SCHEDULE',
    'firstRunId':old['runId'],'continuationRunId':new['runId'],'preflightFailureRunId':37101472741,
    'originalSlots':24,'verifiedNativeCalls':len(all_rows),'successfulNativeCallsReexecuted':0,'missingOriginalSlots':sorted(original_schedule-set(original_ids)),
    'combinedDeterminismCounts':determinism,'cohortsKeptSeparate':True,'firstCohortRuntime':old['runtime'],'continuationRuntime':new['runtime'],
    'matchedContinuationGroups':groups,'matchedContinuationContrasts':contrasts,
    'traceCompilerPolicyConfirmed':all(t['traceConfirmsRequestedCompilerPolicy'] for t in new['traces']) and len(new['traces'])==6,
    'originalStartupFailureStillPreserved':True,'preflightFailureStillPreserved':True,'clockReset':False,
    'productChanged':False,'performanceConfirmationCalls':0,'primaryPcThresholdCalls':0,
    'limitations':'Two repetitions in matched continuation cohort; trace separate from timings; compiler generation observed, not every executed frame; no claim past host mechanism proved'}
with (HERE/'COMBINED.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
