"""Close completed proof/retest campaign, freeze evidence, never run a solver."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import zipfile
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
EX=REPO/'experiments/a0-proof-retest-20261003'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda root,*args:subprocess.check_output(['git','-C',str(root),*args])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
write=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
proof=load(HERE/'PROOF_AUDIT.json');audit=load(HERE/'RETEST_AUDIT.json');analysis=load(HERE/'ANALYSIS.json')
assert proof['status']=='INDEPENDENT_EXACT_VERIFIED' and audit['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
assert audit['verifiedCalls']==2460 and audit['inputsComplete10Pairs']==121
if '--seal' in sys.argv:
    assert not (HERE/'SEAL.json').exists() and git(REPO,'status','--porcelain')==b''
    files=[{'file':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(HERE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
    seal={'schema':'a0-proof-retest-complete-seal-v1','status':load(HERE/'DECISION.json')['status'],
          'evidenceCommit':git(REPO,'rev-parse','HEAD').decode().strip(),'proofRunId':proof['runId'],'retestRunId':audit['runId'],
          'actualNativeThresholdCalls':1,'verifiedRetestCalls':2460,'productChanged':False,'files':files}
    write(HERE/'SEAL.json',seal)
    for f in files:assert sha(HERE/f['file'])==f['sha256']
    print(json.dumps({'sealedFiles':len(files),'bytes':sum(f['bytes'] for f in files),'evidenceCommit':seal['evidenceCommit']}))
    sys.exit()
assert not (HERE/'DECISION.json').exists()
dev=ROOT/'dev-branch';assert git(dev,'status','--porcelain')==b''
head=git(dev,'rev-parse','HEAD').decode().strip();local=git(dev,'rev-parse','main').decode().strip()
remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0]
assert head=='c0cb2a048e7275bfea587d176b1954efff0a8a08' and local=='187fbf954ad0749e697b4e7f1252683b318d696e' and remote=='03b637730c5b541f4f2934be613498fbe65327fd'
repository=json.loads(subprocess.check_output(['gh','api','repos/Qnia28/sfinder_wasm']))
assert not repository['private'] and repository['default_branch']=='main'
alarms=[]
for r in audit['inputs']:
    if r['medianRatio']>1.1 and r['hostsSlowdownAbove1_10']>=4:
        alarms.append({'matrixId':r['matrixId'],'medianPairRatio':r['medianRatio'],'aboveThresholdHosts':r['hostsSlowdownAbove1_10'],
                       'medianPairDeltaMs':analysis['retimingAbsoluteDeltaMedianMs'][r['matrixId']],
                       'sameScreeningDirection':r['directionReplicated'],'regressionThresholdReplicated':r['regressionThresholdReplicated'],
                       'hostDirectionMixed':r['environmentSensitive'],'originalPairMedianRatio':r['originalPairMedianRatio']})
assert len(alarms)==3 and sum(r['regressionThresholdReplicated'] for r in alarms)==2
oldgates=analysis['groups']['INPUT_SLOWDOWN_GATE_1_10'];assert oldgates['inputs']==10 and oldgates['regressionThresholdReplicated']==0
d={'status':'EXACT_VERIFIED_RETEST_COMPLETE_KEEP_PRODUCT_HELD','proofRunId':proof['runId'],'proofSourceCommit':proof['sourceCommit'],
   'retestRunId':audit['runId'],'retestSourceCommit':audit['sourceCommit'],'independentExactVerified':True,
   'sameFullWeightedQualityAndStableIds':True,'candidateExactWitnessesVerified':4,'proofK':35,'proofStates':proof['searchedStates'],'proofApiMs':proof['apiMs'],
   'actualNativeThresholdCalls':1,'searchBudgetRetries':0,'retestNativeCalls':2460,'verifiedRetestCalls':2460,'retestInputs':121,'retestPairsPerInput':10,
   'actualPrimaryPcCalls':0,'thresholdCallsDuringRetests':0,'timeoutOomErrorMissingCalls':0,'stateQualityStatusRegressions':0,
   'sameVariantEnvironmentAlarms':0,'hostDirectionMixedInputs':analysis['hostsDirectionMixedInputs'],
   'oldInputGateAlarmCount':10,'oldGateThresholdReplicatedCount':0,'improvementTailDirectionReplicated':'8/10','regressionTailThresholdReplicated':'0/9',
   'retimingMedianPairRatioAbove1_10Inputs':sum(r['medianRatio']>1.1 for r in audit['inputs']),
   'retimingAboveThresholdIn4HostsAndOverall':alarms,'strictSameDirectionRegressionReplicatedCount':2,
   'newAdverseDirectionChangeCount':1,'originalReservedP95':1.197846065695026,'originalReservedP95Gate':1.1,'oldReservedP95FailureStillValid':True,
   'wholePopulationGateRecomputed':False,'originalValuesReplaced':False,'untouchedHoldoutClaimed':False,
   'causeConclusion':'Timing/environment sensitivity supported, not proof old anomaly was all noise/JIT/CPU-model causation. Three short-ms adverse magnitude alarms retained; no algorithm-causal claim.',
   'response':{'promoteA0':False,'applyDev':False,'mergeMain':False,'deploy':False,'addWarmupEagerCompilation':False,
               'addIdCpuExceptions':False,'changeSearchBudget':False,'relaxGates':False,'blindTrailOptimization':False,
               'automaticFurtherNativeCalls':0,'automatic232Or675Confirmation':False,
               'nextIfSeparatelyAuthorized':'Pre-register full fixed-population confirmation with unchanged gates; investigate three new short-call alarms without changing production lifecycle. No favorable-host replacement.'},
   'campaignOriginRunId':37115091562,'origin':proof['origin'],'clockReset':False,'runnerHours':analysis['totalRunnerHours'],
   'lastNativeJobCompletedAt':analysis['lastJobCompletedAt'],'campaignClosed':True,'productChanged':False,'devHead':head,'localMain':local,
   'remoteMain':remote,'defaultBranch':'main','repositoryPublic':True,
   'limits':'Selected121 of168, not formal population revalidation.5runner jobs not5guaranteed distinct physical hosts;2pairs/job not10independent hosts. Shared proof helpers. Control0alarms not proof all inputs noise-free.'}
write(HERE/'DECISION.json',d);write(HERE/'STATUS.json',d)
snapshot=HERE/'FROZEN_MANIFESTS';snapshot.mkdir()
for name in ['CAMPAIGN.json','INPUT.json','EXPECTED.json','PROOF_AUDIT.json','RETEST_INPUTS.json','RETEST_SELECTION.json','RETEST_SCHEDULE.json','RETEST_BUDGET.json','retest-launch.json','TESTING_RULES_KO.md']:
    (snapshot/name).write_bytes(git(REPO,'show',f"{audit['sourceCommit']}:experiments/a0-proof-retest-20261003/{name}"))
with zipfile.ZipFile(HERE/'PROOF_RETEST_ARTIFACTS.zip','x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for base in sorted(HERE.glob('github-run-*')):
        for p in sorted(base.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(HERE).as_posix())
with zipfile.ZipFile(HERE/'PROOF_RETEST_ARTIFACTS.zip') as z:
    assert z.testzip() is None
    for name in z.namelist():assert z.read(name)==(HERE/name).read_bytes()
print(json.dumps(d,indent=2))
