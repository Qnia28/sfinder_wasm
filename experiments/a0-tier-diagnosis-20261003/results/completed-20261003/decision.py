"""Close tier diagnosis, preserving both failures and separate host cohorts."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-tier-diagnosis-20261003')
DEV=Path('D:/AI/sfinder-wasm/dev-branch')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
c=load(HERE/'COMBINED.json');a=load(HERE/'ANALYSIS_CONTINUATION.json');first=load(HERE/'ANALYSIS.json')
callgraph=load(HERE/'CALLGRAPH.json');assert callgraph['nativeCalls']==0 and callgraph['status']=='STATIC_CALLGRAPH_AND_EXISTING_TRACE_CORRELATION_COMPLETE'
assert c['verifiedNativeCalls']==24 and not c['missingOriginalSlots'] and c['successfulNativeCallsReexecuted']==0
assert c['traceCompilerPolicyConfirmed'] and a['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
assert git(DEV,'status','--porcelain')==b''
dev=git(DEV,'rev-parse','HEAD').decode().strip();assert dev=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
localmain=git(DEV,'rev-parse','main').decode().strip();assert localmain=='187fbf954ad0749e697b4e7f1252683b318d696e'
remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0];assert remote=='03b637730c5b541f4f2934be613498fbe65327fd'
assert 'ref: refs/heads/main\tHEAD' in git(REPO,'ls-remote','--symref','origin','HEAD').decode()
assert git(REPO,'diff','--name-only','eec895abc45107c892ccac4917775cfd09c6a17a','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json')==b''
date=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
budget=[]
for id in [37101047698,37101472741,37101642194]:
    r=load(HERE/f'github-run-{id}/RUN.json');self_run=load(HERE/f'SELF_RUN_{id}.json')
    assert self_run['head_sha']==r['headSha'] and self_run['conclusion']==r['conclusion']
    budget.append({'runId':id,'conclusion':r['conclusion'],'createdAt':self_run['created_at'],
        'wallMinutes':(max(date(j['completedAt']) for j in r['jobs'])-date(self_run['created_at'])).total_seconds()/60,
        'runnerHours':sum((date(j['completedAt'])-date(j['startedAt'])).total_seconds() for j in r['jobs'])/3600,
        'artifactCompressedBytes':sum(x['size_in_bytes'] for x in load(HERE/f'github-run-{id}/ARTIFACTS.json')['artifacts'])})
g=c['matchedContinuationGroups'];init_api=[]
for v in ['R','A']:
    d=g[f'DEFAULT:{v}']['medianInitPlusApiMs'];o=g[f'OPTIMIZED_FIRST:{v}']['medianInitPlusApiMs']
    init_api.append({'variant':v,'optimizedFirstToDefaultRatio':o/d,'increaseMs':o-d,'boundary':'init+API only, not full product route'})
final_run=load(HERE/'github-run-37101642194/RUN.json')
campaign_elapsed=(max(date(j['completedAt']) for j in final_run['jobs'])-date(a['campaign']['originCreated'])).total_seconds()/60
decision={'status':'TIER_DIAGNOSIS_COMPLETE_KEEP_PRODUCT_UNCHANGED','finalRunId':37101642194,'sourceCommit':a['sourceCommit'],
    'verifiedNativeIntegratedCalls':24,'untracedCalls':18,'tracedCalls':6,'successfulCallsReexecuted':0,
    'originalFailureRun':37101047698,'preflightFailureRun':37101472741,'failuresPreserved':True,'failureTypes':'Worker exit before native entry; synthetic watchdog preflight failure',
    'cohortsKeptSeparate':True,'matchedContinuationRuntime':a['runtime'],'matchedContinuationGroups':g,
    'matchedContinuationContrasts':c['matchedContinuationContrasts'],'initPlusApiComparisons':init_api,
    'findings':[
        {'claim':'Compiler/optimization policy causally changes this input cost under the tested same-host intervention','confidence':'SUPPORTED_BY_DIRECT_INTERVENTION_AND_COMPILER_TRACE','scope':'9V74, same WASM/input/seed/100K; Liftoff-only versus default/optimized-first'},
        {'claim':'The seconds-scale tier contrast is inside the core export, not predominantly JS packing/readback','confidence':'SUPPORTED_BY_SEPARATE_PROFILE_RUNS','limits':'Core includes Rust preprocessing/search/runtime; does not isolate DFS alone'},
        {'claim':'Fixed-tier A/R costs are close in this cohort; no large persistent A-specific 50 percent cost observed','confidence':'SMALL_SAMPLE_DIAGNOSIS_ONLY','absenceOfAllNativeOverheadProven':False},
        {'claim':'Eager optimized-first saves about 1 percent API time but init+API increases about 2.6-2.9 percent','confidence':'DIRECT_OBSERVATION_TWO_MATCHED_REPETITIONS','productRecommendation':'Do not adopt eager initialization on this evidence'},
        {'claim':'The old 9V45 Cold discrepancy and exposed reserved p95 failure are not retrospectively explained or cleared','confidence':'MECHANISM_STILL_UNRESOLVED','originalFailuresInvalidated':False}],
    'response':{'modifySiblingTrailNow':False,'addProductWarmup':False,'addEagerCompilation':False,'addIdOrCpuExceptions':False,
        'relaxPerformanceGates':False,'runBroadBenchmark':False,'promoteA0':False,'autoFurtherNativeCalls':0,
        'existingTraceCallgraphAnalysis':'COMPLETE_ZERO_ADDITIONAL_SOLVER_CALLS',
        'nextIfMoreCauseWorkIsNeeded':'Targeted browser lifecycle/function CPU diagnosis only under separately defined scope, not engine-flag product adoption or broad benchmarking.'},
    'staticCallgraphPaths':callgraph['confirmedPaths'],
    'independentExactProofStillPending':'board-111--restricted-split--ordinary','oldReservedP95FailureStillValid':True,
    'nativeThresholdCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0,'performanceConfirmationCalls':0,
    'productChanged':False,'devApplied':False,'mainMerged':False,'deployed':False,'devHead':dev,'localMain':localmain,'remoteMain':remote,'defaultBranch':'main',
    'campaign':a['campaign'],'clockReset':False,'campaignElapsedMinutes':campaign_elapsed,'tierRuns':budget,
    'tierObservedRunnerHours':sum(b['runnerHours'] for b in budget),'totalDiagnosisObservedRunnerHoursIncludingPrior':sum(b['runnerHours'] for b in budget)+.3458333333333333+.04833333333333333,
    'compilerTracePolicyConfirmed':True,'compilerCountsAreParsedNotExhaustive':True,'individualExecutionFrameTierClaimed':False}
with (HERE/'DECISION.json').open('x',encoding='utf-8') as f:json.dump(decision,f,indent=2);f.write('\n')
(HERE/'STATUS.json').write_text(json.dumps(decision,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in decision.items() if k not in ['matchedContinuationGroups','matchedContinuationContrasts']},indent=2))
