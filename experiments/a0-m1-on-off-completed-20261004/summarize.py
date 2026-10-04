"""Summarize audited partial outcomes without further solver or Actions calls."""
from pathlib import Path
import collections
import csv
import datetime
import hashlib
import json
import statistics

HERE=Path(__file__).resolve().parent
DOWNLOAD=HERE/'github-run-37181392879'
audit=json.loads((DOWNLOAD/'AUDIT.json').read_text())
assert audit['nativeSolverCallsFromAudit']==0
analysis=audit['analysis'];inputs=analysis['inputs']
summaries=[json.loads(p.read_text()) for p in DOWNLOAD.rglob('SUMMARY.json')]
assert len(summaries)==10 and all(s['status']=='BUDGET_EXHAUSTED_WITH_PARTIAL_RESULTS' for s in summaries)
assert all(s['stopReason']=='PAIR_ADMISSION_DEADLINE' for s in summaries)
outcomes=[json.loads(line) for p in DOWNLOAD.rglob('outcomes.jsonl') for line in p.read_text().splitlines()]
rows=[json.loads(line) for p in DOWNLOAD.rglob('runs.jsonl') for line in p.read_text().splitlines()]
assert len(outcomes)==4774 and len(rows)==4538
assert collections.Counter(o['status'] for o in outcomes)=={'VERIFIED':4538,'TIMEOUT_API':236}
policy_counts={p:dict(collections.Counter(o['status'] for o in outcomes if o['policy']==p)) for p in ['reference','a0-m1']}
timeouts_by_input=collections.Counter(o['matrixId'] for o in outcomes if o['status'].startswith('TIMEOUT_'))
assert sum(s['resumedAttemptedCalls'] for s in summaries)==130 and sum(s['newAttemptedCalls'] for s in summaries)==4644
dt=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
jobs=[j for p in HERE.glob('JOBS_*.json') for j in json.loads(p.read_text())]
end=max(dt(j['completed_at']) for j in jobs)
origin=dt('2026-10-04T05:03:42Z')
runner_hours=sum((dt(j['completed_at'])-dt(j['started_at'])).total_seconds() for j in jobs)/3600
assert runner_hours<64 and (end-origin).total_seconds()<180*60
timed_inputs=[r for r in inputs if r['medianRatio'] is not None]
finite_pairs=sum(len(r['pairs']) for r in inputs)
observed_pair_count=sum(o['kind']=='FULL_REQUEST' for o in outcomes)//2
episode_counts=collections.Counter(o.get('executionEpisodeRunId',37180176960) for o in outcomes)
probe_statuses={p:dict(collections.Counter(r['exactProbeTrace']['status'] for r in rows if r['policy']==p)) for p in ['reference','a0-m1']}
result={
 'status':'BOUNDED_ON_OFF_FINISHED_PARTIAL_BUDGET_NO_DEFAULT_PROMOTION',
 'runId':37181392879,'url':'https://github.com/Qnia28/sfinder_wasm/actions/runs/37181392879',
 'sourceCommit':'b19ea7e1db7786af0e82ff6f9e66156c5e73ceaf','actionsConclusion':'success',
 'originRunId':37178792683,'origin':origin.isoformat(),'lastJobCompletedAt':end.isoformat(),
 'wallMinutesAllAttempts':(end-origin).total_seconds()/60,'runnerHoursAllThreeAttempts':runner_hours,
 'runnerJobsCompletedSuccessfully':10,'runnerJobsBudgetStopped':10,'perJob':[{
   k:s[k] for k in ['host','attemptedCalls','verifiedCalls','timeoutCalls','stopReason','resumedAttemptedCalls','newAttemptedCalls']
 } for s in sorted(summaries,key=lambda s:s['host'])],
 'plannedRequests':24480,'correctedScheduledRequestsAttempted':len(outcomes),'verifiedRequests':len(rows),
 'timeoutRequests':236,'unattemptedRequests':24480-len(outcomes),'malformedRequestsBeforeCorrection':10,
 'actualRequestsAllAttemptsNoReplay':len(outcomes)+10,'newRequestsInLatestEpisode':4644,
 'previousConsumedRequestsRetained':130,'duplicateSuccessfulOrTimeoutReplays':0,
 'policyOutcomeCounts':policy_counts,'attemptedInputCount':len(set(o['matrixId'] for o in outcomes)),
 'finiteTimingInputCount':len(timed_inputs),'complete100VerifiedPairInputs':analysis['completeInputs'],
 'complete100OutcomePairInputsIncludingTimeout':analysis['completeOutcomeInputsIncludingTimeout'],
 'selectedOutcomePairs':observed_pair_count,'verifiedSameEpisodeAdjacentPairs':finite_pairs,
 'censoredPairs':len(analysis['censoredPairs']),'timeoutByInput':dict(sorted(timeouts_by_input.items())),
 'fullyCompletedProbeStatusCounts':probe_statuses,
 'conditionalCompletedInputMedians':{
   'candidateFasterInputs':sum(r['medianRatio']<1 for r in timed_inputs),
   'candidateSlowerInputs':sum(r['medianRatio']>1 for r in timed_inputs),
   'medianOfInputPairedRequestRatios':statistics.median(r['medianRatio'] for r in timed_inputs),
   'interpretation':'Only inputs/pairs where both requests completed exactly; excludes censored and unattempted outcomes. Descriptive, not all-input/product-frequency-weighted effect or promotion proof.'
 },
 'sourceAndRuntimeLocksIdenticalWithinLatestEpisode':True,'originalWeightedInputAndWitnessAudit':'PASS_FOR_VERIFIED_REQUESTS',
 'rawRecordsAudited':audit['rawRecords'],'nativeSolverCallsFromAudit':0,
 'oomOrIntegrityFailures':sum(o['status'] not in ['VERIFIED','TIMEOUT_API'] for o in outcomes),
 'timeoutDidNotFailJobOrRemoveInput':True,'searchStateBudget':100000,'apiDeadlineMs':210000,
 'nodeRuntimeORToolsSupported':audit['lock']['ortoolsSupported'],'clockAndBudgetsReset':False,
 'logicalRunnerGroupsNotPersistentPhysicalHostClaim':True,'executionEpisodeCounts':dict(episode_counts),
 'newVmEnvironmentControlsNotMeasured':True,'missingEnvironmentInputs':sum(r['missingEnvironment'] for r in inputs),
 'performancePass':False,'performanceFailAgainstCandidateEstablished':False,
 'decision':'Keep selectable A0+M1 implementation and R default. Partial/censored Node fallback evidence does not settle default policy. No automatic further campaign, budget increase, merge or deployment.',
 'activeActionsJobs':0,'activeWatchers':0,'productDefault':'reference','devMainMergeDeployment':False,
}
with (HERE/'SUMMARY.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(result,f,indent=2);f.write('\n')
with (HERE/'BY_INPUT.csv').open('x',encoding='utf-8',newline='') as f:
 fields=['id','phase','verifiedPairs','medianRatio','medianDeltaMs','referenceVerified','candidateVerified','referenceTimeout','candidateTimeout','censoredPairs','missingEnvironment','complete100VerifiedPairs']
 writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
 for r in inputs:
  counts=r['requestOutcomeCounts'];writer.writerow({'id':r['id'],'phase':r['phase'],'verifiedPairs':len(r['pairs']),
    'medianRatio':r['medianRatio'],'medianDeltaMs':r['medianDeltaMs'],
    'referenceVerified':counts['reference'].get('VERIFIED',0),'candidateVerified':counts['a0-m1'].get('VERIFIED',0),
    'referenceTimeout':counts['reference'].get('TIMEOUT_API',0),'candidateTimeout':counts['a0-m1'].get('TIMEOUT_API',0),
    'censoredPairs':r['censoredPairCount'],'missingEnvironment':r['missingEnvironment'],'complete100VerifiedPairs':r['complete100Pairs']})
print(json.dumps({k:v for k,v in result.items() if k not in ['perJob','timeoutByInput']},indent=2))
