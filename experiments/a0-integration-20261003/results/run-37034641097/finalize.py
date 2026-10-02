"""Seal the completed attempt, disclose failed gates, never modify product refs."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess

here=Path(__file__).resolve().parent
repo=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-integration-20261003')
dev=Path('D:/AI/sfinder-wasm/dev-branch')
run_dir=here/'github-run-37034641097'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args])
def utc(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
run=load(run_dir/'RUN.json');initial=load(run_dir/'INITIAL_RUN.json');build=load(run_dir/'a0-build-tests/BUILD.json')
jobs=[j for j in run['jobs'] if j['conclusion']!='skipped']
elapsed=(max(utc(j['completedAt']) for j in jobs)-utc(initial['created_at'])).total_seconds()
runner_seconds=sum((utc(j['completedAt'])-utc(j['startedAt'])).total_seconds() for j in jobs)
artifacts=load(run_dir/'ARTIFACTS.json')['artifacts']
tests=(run_dir/'a0-build-tests/product-tests.log').read_text(encoding='utf-8')
cp=(run_dir/'a0-build-tests/cp-tests.log').read_text(encoding='utf-8')
assert 'ℹ tests 193' in tests and 'ℹ pass 186' in tests and 'ℹ skipped 7' in tests and 'ℹ fail 0' in tests
assert 'ℹ tests 13' in cp and 'ℹ pass 13' in cp and 'ℹ skipped 0' in cp and 'ℹ fail 0' in cp
skip_names={s.split(' (')[0] for s in re.findall(r'^﹣ (.*)$',tests,re.M)}
# Hosted CP invocation recovers five skips; the two remaining tests ran locally.
pass_names={s.split(' (')[0] for s in re.findall(r'^✔ (.*)$',cp,re.M)}
supp_bytes=(here/'SUPPLEMENTAL_REGRESSION.log').read_bytes()
supp=supp_bytes.decode('utf-16' if supp_bytes.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig')
supp_names={s.split(' (')[0] for s in re.findall(r'^✔ (.*)$',supp,re.M)}
assert len(skip_names)==7 and len(skip_names & pass_names)==5 and skip_names<=pass_names|supp_names
assert 'ℹ tests 2' in supp and 'ℹ pass 2' in supp and 'ℹ fail 0' in supp and 'ℹ skipped 0' in supp
baseline='c0cb2a048e7275bfea587d176b1954efff0a8a08';candidate=build['candidateCommit']
assert git(dev,'status','--porcelain')==b'' and git(dev,'rev-parse','HEAD').decode().strip()==baseline
local_main=git(dev,'rev-parse','refs/heads/main').decode().strip()
remote_main=git(repo,'ls-remote','origin','refs/heads/main').decode().split()[0]
assert local_main=='187fbf954ad0749e697b4e7f1252683b318d696e'
assert remote_main=='03b637730c5b541f4f2934be613498fbe65327fd'
remote_head=git(repo,'ls-remote','--symref','origin','HEAD').decode()
assert 'ref: refs/heads/main\tHEAD' in remote_head
patch=git(repo,'diff','--binary',baseline,candidate,'--','src/min-cover-exact-secondary.mjs','wasm/pc_wasm.wasm')
(here/'PRODUCT_ONLY_DO_NOT_APPLY.patch').write_bytes(patch)
status={'status':'STOPPED_BEFORE_DEV_CONNECTION_SMOKE_GATE_FAILED','branch':'integration/a0-minimal-20261003',
        'candidateCommit':candidate,'baselineCommit':baseline,'runId':37034641097,'runConclusion':run['conclusion'],
        'wasmSha256':build['wasmSha256'],'rebuildMatchesPriorHostedBaseline':True,
        'uniqueProductTestsPassed':193,'hostedUniqueProductTestsPassed':191,'localSupplementalUniqueProductTestsPassed':2,
        'standardInvocation':{'passed':186,'skipped':7,'failed':0},
        'cpEnabledInvocation':{'passed':13,'skipped':0,'failed':0,'recoversFiveStandardSkips':True},
        'localSupplementalInvocation':{'passed':2,'skipped':0,'failed':0,'recoversRemainingTwoStandardSkips':True,'node':'v24.13.0','platform':'win32','baselineRoot':'D:/AI/sfinder-wasm/dev-branch'},
        'nativeMinCoverUniqueTests':26,'nativeDebugPassed':26,'nativeReleasePassed':26,'harnessTestsPassed':2,
        'browserSynthetic':'PASS','smallParityCalls':27,'smoke':{'scheduled':128,'observed':128,'exact':56,'inconclusive':16,'timeoutApi':56,
        'timeoutPhase':'threshold','timeoutStatusAndOutcomeSymmetricBetweenRAndA':True,'promotable':False},
        'reserved':{'scheduled':832,'observed':0,'tinyDispatchPlanned':115,'tinyDispatchObserved':0,'reason':'Freeze gate failed; no bypass'},
        'campaignWallMinutes':elapsed/60,'observedJobRunnerHours':runner_seconds/3600,
        'uploadedArtifactCompressedBytes':sum(a['size_in_bytes'] for a in artifacts),
        'actualInputPrimaryCalls':0,'actualInputPcCalls':0,'prior675EffectBenchmarkRepeated':False,
        'protectedDevClean':True,'devHead':baseline,'localMain':local_main,'remoteMain':remote_main,'defaultBranch':'main',
        'devApplied':False,'mainMerged':False,'deployed':False,'retrySubstitution':False,
        'partialTraceLimitation':'56 threshold-killed rows preserve phase events but not earlier integrated incumbents; comparison scope restricted to persisted traces',
        'resourceMeasurementLimitation':'3GiB cgroup/swap0 enforced and OOM/reap guards active; per-call RSS/peak cgroup bytes were not persisted',
        'productOnlyPatchSha256':hashlib.sha256(patch).hexdigest(),'productOnlyPatchApplied':False}
(here/'STATUS.json').write_text(json.dumps(status,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps(status,indent=2,ensure_ascii=False))
