"""Final response and budget accounting; no solver execution."""
from pathlib import Path
import datetime
import json
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-execution-diagnosis-20261003')
DEV=Path('D:/AI/sfinder-wasm/dev-branch')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
a=load(HERE/'ANALYSIS.json');h=load(HERE/'HOTSPOT.json');runid=a['runId']
assert a['status']=='COMPLETE_INDEPENDENTLY_AUDITED' and a['nativeCallsVerified']==16
assert a['classification']=='NO_REPEATED_LARGE_DIFFERENCE' and not a['controlAlarm']
assert a['capability']=='FUNCTION_ONLY' and not a['executionTierIdentified']
assert all(p['sampleQuality']=='SUFFICIENT_FOR_COARSE_LOCATION' for p in a['profiles'])
assert git(DEV,'status','--porcelain')==b'';dev=git(DEV,'rev-parse','HEAD').decode().strip();assert dev=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
localmain=git(DEV,'rev-parse','main').decode().strip();assert localmain=='187fbf954ad0749e697b4e7f1252683b318d696e'
remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0];assert remote=='03b637730c5b541f4f2934be613498fbe65327fd'
assert 'ref: refs/heads/main\tHEAD' in git(REPO,'ls-remote','--symref','origin','HEAD').decode()
assert git(REPO,'diff','--name-only','da27c892595e5755dbc8a939add7cd8d5c1dca8a','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json')==b''
selfrun=json.loads(subprocess.check_output(['gh','api',f'repos/Qnia28/sfinder_wasm/actions/runs/{runid}']))
with (HERE/'SELF_RUN.json').open('x',encoding='utf-8') as f:json.dump(selfrun,f,indent=2);f.write('\n')
r=load(HERE/f'github-run-{runid}/RUN.json');assert selfrun['head_sha']==r['headSha']==a['sourceCommit']
D=lambda v:datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
end=max(D(j['completedAt']) for j in r['jobs'])
runner=sum((D(j['completedAt'])-D(j['startedAt'])).total_seconds() for j in r['jobs'])/3600
elapsed=(end-D(a['campaign']['originCreated'])).total_seconds()/60
assert elapsed<160 and runner<=1/3
artifacts=load(HERE/f'github-run-{runid}/ARTIFACTS.json')
d={'status':'EXECUTION_DIAGNOSIS_COMPLETE_COMMON_HOTSPOT_KEEP_PRODUCT_UNCHANGED','runId':runid,'sourceCommit':a['sourceCommit'],
    'nativeCalls':16,'plainCalls':12,'profileCalls':4,'nativeRetries':0,'newHarnessFailures':0,
    'classification':a['classification'],'controlAlarm':False,'capability':'FUNCTION_ONLY','executionTierIdentified':False,
    'currentRuntime':a['runtime'],'plainPairCandidateRatios':[p['aToRRatio'] for p in a['pairs'] if not p['instrumented'] and p['pair'] in ['RA','AR']],
    'controlMaxMinRatios':[p['maxToMinRatio'] for p in a['pairs'] if not p['instrumented'] and p['pair'] in ['RR','AA']],
    'commonHotFunction':359,'hotFunctionSelfFractionRange':[min(p['common359']['selfFraction'] for p in h['profiles']),max(p['common359']['selfFraction'] for p in h['profiles'])],
    'sourceCorrespondence':'lower_bound: strong structural correspondence, not Rust debug-symbol proof',
    'response':{'modifySiblingTrail':False,'addProductWarmup':False,'addEagerCompilation':False,'addIdOrCpuExceptions':False,'changeStateBudget':False,
        'relaxPerformanceGates':False,'promoteA0':False,'autoFurtherNativeCalls':0,
        'priorityIfSeparatelyAuthorized':'Investigate common lower-bound/popcount/max-gain path and code-generation/CPU behavior; not blind A-only trail optimization. Browser lifecycle or diagnostic Rust timers require a new measurement contract.',
        'stopReason':'Fixed schedule complete; no large R/A difference reproduced; calibrated profiler cannot identify actual frame tier.'},
    'old9V45Mechanism':'UNRESOLVED','oldReservedP95FailureStillValid':True,'independentExactProofStillPending':'board-111--restricted-split--ordinary',
    'weightedQualitySeedChecks':32,'rawRecordsVerified':48,'sourceBlobsVerified':203,'artifactResultFilesVerified':28,
    'productChanged':False,'devApplied':False,'mainMerged':False,'deployed':False,'devHead':dev,'localMain':localmain,'remoteMain':remote,'defaultBranch':'main',
    'performanceConfirmationCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0,'nativeThresholdCalls':0,
    'campaign':a['campaign'],'clockReset':False,'finishedAt':end.isoformat(),'elapsedCampaignMinutes':elapsed,
    'runWallMinutes':(end-D(selfrun['created_at'])).total_seconds()/60,'runnerHours':runner,
    'totalDiagnosisRunnerHoursIncludingPrior':runner+load(HERE.parent/'a0-tier-diagnosis-20261003/DECISION.json')['totalDiagnosisObservedRunnerHoursIncludingPrior'],
    'artifactCompressedBytes':sum(x['size_in_bytes'] for x in artifacts['artifacts']),
    'limits':'One new Intel host; prior AMD cohorts separate. Two controls are not a noise estimate. Profiled time not ordinary time. Inclusive/self costs not added. No claim old anomaly was JIT, CPU model, or all noise.'}
with (HERE/'DECISION.json').open('x',encoding='utf-8') as f:json.dump(d,f,indent=2);f.write('\n')
with (HERE/'STATUS.json').open('x',encoding='utf-8') as f:json.dump(d,f,indent=2);f.write('\n')
print(json.dumps(d,indent=2))
