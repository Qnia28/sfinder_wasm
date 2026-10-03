from pathlib import Path
import datetime
import hashlib
import json
import subprocess
HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-four-arm-20261003');EX=REPO/'experiments/a0-four-arm-20261003'
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
def text(p):
 b=p.read_bytes();return b.decode('utf-16' if b.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig')
load=lambda p:json.loads(text(p))
write=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
commit=git('rev-parse','HEAD').decode().strip();assert commit=='1c26726a0b5b3d47be2da667154e39cc9e050343' and git('status','--porcelain')==b''
local=REPO/'.a0/four';build=load(local/'BUILD.json');assert build['sourceDefaultControlMatchesOriginal']
assert load(local/'preflight/synthetic-reinforced.json')['syntheticNativeCalls']==4148
assert 'pass 4' in text(local/'preflight/harness-reinforced.log') and 'Ran 5 tests' in text(local/'preflight/analysis-reinforced.log')
checks=HERE/'LOCAL_CHECKS';checks.mkdir()
for name in ['BUILD.json','DIAGNOSTIC_BUILD.json','DIAGNOSTIC_SYNTHETIC-reinforced.json','preflight/synthetic-reinforced.json','preflight/harness-reinforced.log','preflight/analysis-reinforced.log','preflight/combined-rejected-v2.log']:
 (checks/Path(name).name).write_bytes((local/name).read_bytes())
frozen=HERE/'FROZEN';frozen.mkdir();files=[]
names=git('ls-tree','-r','--name-only','HEAD','--','rust','src','wasm','experiments/a0-four-arm-20261003','.github/workflows/a0-four-arm.yml').decode().strip().splitlines()
for name in names:
 b=git('show',f'HEAD:{name}');files.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 if name.startswith('experiments/a0-four-arm-20261003/') or name=='.github/workflows/a0-four-arm.yml':(frozen/Path(name).name).write_bytes(b)
write(HERE/'SOURCE_LOCK.json',{'sourceCommit':commit,'files':files,'actualBuiltLinuxRuntimeLockPending':True})
run=json.loads(subprocess.check_output(['gh','api','repos/Qnia28/sfinder_wasm/actions/runs/37134128882']))
assert run['head_sha']==commit
origin=datetime.datetime.fromisoformat(run['created_at'].replace('Z','+00:00'))
d={'status':'ACTIONS_LINUX_PREFLIGHT_IN_PROGRESS','runId':37134128882,'url':run['html_url'],'sourceCommit':commit,
 'branch':'validation/a0-four-arm-20261003','localRepo':str(REPO),'origin':run['created_at'],'originRunId':37134128882,
 'computeDeadline':(origin+datetime.timedelta(minutes=160)).isoformat(),'cancelDeadline':(origin+datetime.timedelta(minutes=175)).isoformat(),
 'overallDeadline':(origin+datetime.timedelta(minutes=180)).isoformat(),'clockResetWithinCampaign':False,
 'reinforcements':['Feature-off control full-byte equality gate; original module unchanged + isolated active overlays','5fixed inputs x4arms=20diagnostic work calls separate from timing'],
 'inputs':122,'timingCallsPlanned':4960,'diagnosticCallsPlanned':20,'maxActualNativeCalls':4980,'runnerHoursUpper':6,'runnerHoursCap':64,
 'localControlByteEqual':True,'localSyntheticWasmOracleCalls':4148,'localWorkerFixtureCalls':16,'localDiagnosticFixtureCalls':3,
 'localHarnessTestsPassed':4,'localAnalysisTestsPassed':5,'linuxBuildTestsStatus':'PENDING','linuxControlByteEqualityStatus':'PENDING',
 'actualInputNativeCalls':'NOT_YET_AUDITED','benchmarkPromotionClaim':False,'diagnosticTimeInPerformanceStats':False,
 'originalReservedP95FailureStillValid':True,'productChanged':False,'devMainDeploymentChanged':False,
 'stopOnByteControlOrCorrectnessFailure':True,'automaticBudgetIncrease':False,
 'next':'Wait for absolute-wall watcher completion; preserve artifact. Run FROZEN/audit scripts against clone source if actual rows exist; if build gate fails, retain blocker and do not bypass.'}
write(HERE/'STATUS.json',d);write(HERE/'ORIGIN_RUN.json',run);print(json.dumps(d,indent=2))
