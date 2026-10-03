"""Read-only cross-campaign source/runtime and original sealed screening provenance."""
from pathlib import Path
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent;D=HERE/'github-run-37138752420'
OLD=HERE.parent/'a0-four-arm-execution-20261004'
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-m1-retest-20261004')
EX=REPO/'experiments/a0-m1-retest-20261004'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
preflight=D/'m1-retest-preflight';gate=load(preflight/'PREFLIGHT_GATE.json');lock=load(preflight/'LOCK.json')
assert gate['status']=='PASS_FROZEN_LINUX_BYTES_SOURCE_INPUTS_LOCKED' and gate['actualInputCalls']==0
assert gate['commit']==lock['commit']=='c6554bce7356fe226693074610e8c7a2177335cb'
assert gate['controlByteEqual'] and gate['measuredRuntimesUnchanged']
prior=OLD/'github-run-37134463920/a0-four-build';frozen=load(EX/'FROZEN_BUILD.json')
assert load(prior/'BUILD.json')==frozen['build']==lock['build']
assert frozen['baselineGate']==load(prior/'BASELINE_GATE.json') and frozen['controlGate']==load(prior/'CONTROL_GATE.json')
assert frozen['baselineGate']['status']==frozen['controlGate']['status']=='PASS'
assert frozen['runtimeFiles']==lock['runtimeFiles']
for f in lock['runtimeFiles']:assert sha(prior/f['file'].removeprefix('.a0/four/'))==f['sha256']
summaries=[load(p) for p in D.rglob('SUMMARY.json') if p.parent.name in [str(h) for h in range(10)]]
assert len(summaries)==10 and {s['host'] for s in summaries}==set(range(10))
assert all(s['status']=='COMPLETE' and s['expectedCalls']==s['verifiedCalls']==s['attemptedCalls']==7332 and s['lock']==lock for s in summaries)
origin=load(preflight/'ORIGIN.json');assert origin==lock['origin'] and origin['runId']==37138752420
assert origin['origin']=='2026-10-03T16:57:31Z' and not origin['clockResetWithinCampaign']
assert all(s['origin']==origin and not s['clockReset'] for s in summaries)
assert load(D/'WATCH_DECISION.json')['watchExit']==0 and not load(D/'WATCH_DECISION.json')['cancelledAtWallDeadline']
screen=load(EX/'SCREENING.json');assert sha(OLD/'SEAL.json')==screen['originalSealSha256']
oldseal=load(OLD/'SEAL.json')
for f in screen['sourceFiles']:
 b=next(v for v in oldseal['files'] if v['file']==f['file']);assert b==f and sha(OLD/f['file'])==f['sha256']
for name,expected in [('selection.log','Ran 3 tests'),('analysis.log','Ran 5 tests'),('harness.log','pass 4')]:
 assert expected in (preflight/'preflight'/name).read_text(encoding='utf-8')
assert subprocess.check_output(['git','-C',str(REPO),'diff','--name-only','f4716e1f2686fa25c4e844e47b51e88835a980da',lock['commit'],'--',
 'src','rust','wasm','package.json','package-lock.json','experiments/a0-four-arm-20261003','experiments/a0-diagnosis-20261003'])==b''
report={'status':'SAME_FROZEN_BINARY_RUNTIME_SOURCE_AND_SEALED_SCREENING_VERIFIED','runId':37138752420,'sourceCommit':lock['commit'],
 'runtimeFilesVerified':len(lock['runtimeFiles']),'originalScreeningFilesReverified':len(screen['sourceFiles']),
 'identicalLockOn10Runners':True,'referenceControlByteEqual':True,'noSolverRebuildOrOptimizationChange':True,
 'inputsSelectionAndPairedScheduleTests':3,'analysisTests':5,'workerAndWatchdogTests':4,'syntheticWorkerNativeCalls':16,
 'clockReset':False,'nativeSolverCallsFromThisAudit':0}
with (HERE/'PROVENANCE_AUDIT.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
