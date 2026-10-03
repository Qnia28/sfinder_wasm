"""Record local preparation, protected branch checks, and immutable source bundle."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import zipfile
ROOT=Path('D:/AI/sfinder-wasm');REPO=Path(__file__).resolve().parents[2]
EX=REPO/'experiments/a0-four-arm-20261003';OUT=ROOT/'tools/validation/a0-four-arm-preparation-20261003'
def text(p):
    b=p.read_bytes()
    return b.decode('utf-16' if b.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig')
load=lambda p:json.loads(text(p))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
write=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
if '--seal' in sys.argv:
    assert not (OUT/'SEAL.json').exists()
    files=[{'file':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(OUT.rglob('*')) if p.is_file()]
    write(OUT/'SEAL.json',{'schema':'four-arm-preparation-seal-v1','status':'PREPARED_NOT_PUSHED_NOT_LAUNCHED',
        'sourceCommit':load(OUT/'STATUS.json')['sourceCommit'],'actualInputNativeCalls':0,'files':files})
    for f in files:assert sha(OUT/f['file'])==f['sha256']
    print(json.dumps({'sealedFiles':len(files),'bytes':sum(f['bytes'] for f in files)}));sys.exit()
OUT.mkdir(exist_ok=True)
assert git(REPO,'status','--porcelain')==b''
commit=git(REPO,'rev-parse','HEAD').decode().strip();branch=git(REPO,'branch','--show-current').decode().strip()
assert branch=='validation/a0-four-arm-20261003' and not (EX/'launch.json').exists()
assert git(REPO,'diff','--name-only','f0bc2647d67353edb7e78bb54afeadb6c9817444','HEAD','--','src','wasm','tests','scripts','package.json','package-lock.json')==b''
dev=ROOT/'dev-branch';assert git(dev,'status','--porcelain')==b''
assert git(dev,'rev-parse','HEAD').decode().strip()=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
assert git(dev,'rev-parse','main').decode().strip()=='187fbf954ad0749e697b4e7f1252683b318d696e'
remote_main=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0];assert remote_main=='03b637730c5b541f4f2934be613498fbe65327fd'
assert git(REPO,'ls-remote','origin',f'refs/heads/{branch}')==b'','Preparation branch unexpectedly published'
local=REPO/'.a0/four';synthetic=load(local/'preflight/synthetic-final.json');diag=load(local/'DIAGNOSTIC_SYNTHETIC-final.json')
assert synthetic['status']=='SYNTHETIC_FOUR_ARM_ORACLE_PASS' and synthetic['samples']==122 and synthetic['syntheticNativeCalls']==4148
assert diag['status']=='DIAGNOSTIC_SYNTHETIC_WORK_REDUCTION_PASS' and diag['actualInputCalls']==0
assert 'pass 4' in text(local/'preflight/harness-final.log')
assert 'Ran 4 tests' in text(local/'preflight/analysis-final.log')
snapshot=OUT/'FROZEN';snapshot.mkdir()
files=git(REPO,'ls-tree','-r','--name-only','HEAD','--','rust','experiments/a0-four-arm-20261003','.github/workflows/a0-four-arm.yml').decode().strip().splitlines()
locked=[]
for name in files:
    b=git(REPO,'show',f'{commit}:{name}');locked.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
    if name.startswith('experiments/a0-four-arm-20261003/') or name=='.github/workflows/a0-four-arm.yml':
        target=snapshot/Path(name).name;target.write_bytes(b)
write(OUT/'SOURCE_LOCK.json',{'commit':commit,'base':'f0bc2647d67353edb7e78bb54afeadb6c9817444','files':locked,
    'note':'Local preparation source freeze, not Linux runtime/source lock. Future workflow locks actual built WASM and native inputs before calls.'})
passing=OUT/'LOCAL_CHECKS';passing.mkdir()
for name in ['BUILD.json','DIAGNOSTIC_SYNTHETIC-final.json','preflight/synthetic-final.json','preflight/diagnostic-final.json','preflight/harness-final.log','preflight/analysis-final.log','preflight/combined-rejected.log']:
    (passing/Path(name).name).write_bytes((local/name).read_bytes())
with zipfile.ZipFile(OUT/'LOCAL_SYNTHETIC_BINARIES.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
    for arm in ['R','A0','M1','M2','control']:
        p=local/f'runtime/{arm}/wasm/pc_wasm.wasm';z.write(p,f'{arm}/pc_wasm.wasm')
git(REPO,'bundle','create',str(OUT/'SOURCE.bundle'),branch);git(REPO,'bundle','verify',str(OUT/'SOURCE.bundle'))
status={'status':'PREPARED_NOT_PUSHED_NOT_LAUNCHED','branch':branch,'sourceCommit':commit,'localRepo':str(REPO),
    'arms':['R','A0','M1','M2'],'independentFixes':True,'inputs':122,'comparisonCallsPlanned':4880,'environmentCallsPlanned':80,'totalActualInputCallsPlanned':4960,
    'runnerJobsPlanned':5,'callsPerJob':992,'campaignNotStarted':True,'launchFileAbsent':True,'githubPushes':0,'githubWorkflowRuns':0,'actualInputNativeCalls':0,
    'syntheticOracleSamples':122,'finalSyntheticWasmCalls':4148,'workerSyntheticCalls':8,'diagnosticSyntheticCalls':3,'fixtureCallsPerFutureBuildExpected':4159,
    'harnessTestsPassed':4,'analysisTestsPassed':4,'rustTestCompileModes':3,'combinedFeaturesRejected':True,
    'm1SyntheticBoundWords':'9->4','m2SyntheticTrailPushes':'5->2','syntheticStatesQualityIdsPreserved':True,
    'linuxBaselineReproductionPending':True,'linuxRustDebugReleaseExecutionPending':True,'hostedCgroupArtifactPreflightPending':True,
    'localRustNativeExecution':'NOT_VALIDATED: local Windows native test harness could not run successfully. Do not report debug/release execution PASS. Linux mandatory gate prepared.',
    'windowsBinariesBenchmarkEligible':False,'defaultSourceControlByteDiffers':not load(local/'BUILD.json')['sourceDefaultControlMatchesOriginal'],
    'layoutCausationLimit':'Different independent binaries can change layout/compiler behavior; timing alone not sole-algorithm attribution.',
    'productChanged':False,'devMainDeploymentChanged':False,'originalReservedP95FailureStillValid':True,
    'next':'Only after explicit launch authorization: create status=AUTHORIZED_EXECUTION launch.json, commit/push isolated branch, start absolute-wall watcher. Benchmark is gated by Linux build + all preflights.',
    'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
write(OUT/'STATUS.json',status);print(json.dumps(status,indent=2))
