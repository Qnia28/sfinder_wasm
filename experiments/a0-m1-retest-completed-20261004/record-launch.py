from pathlib import Path
import datetime
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent;REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-m1-retest-20261004')
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
commit=git('rev-parse','HEAD').decode().strip();assert commit=='c6554bce7356fe226693074610e8c7a2177335cb' and git('status','--porcelain')==b''
run=json.loads(subprocess.check_output(['gh','api','repos/Qnia28/sfinder_wasm/actions/runs/37138752420']));assert run['head_sha']==commit
origin=datetime.datetime.fromisoformat(run['created_at'].replace('Z','+00:00'))
def write(p,v):
 with p.open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,indent=2);f.write('\n')
frozen=HERE/'FROZEN_SOURCE';frozen.mkdir()
names=git('ls-tree','-r','--name-only','HEAD','--','experiments/a0-m1-retest-20261004','.github/workflows/a0-m1-retest.yml').decode().splitlines();files=[]
for name in names:
 b=git('show',f'{commit}:{name}');files.append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 if '__pycache__' not in name:(frozen/Path(name).name).write_bytes(b)
write(HERE/'SOURCE_LOCK.json',{'sourceCommit':commit,'files':files,'actualRuntimeLockPending':True})
write(HERE/'ORIGIN_RUN.json',run)
status={'status':'AUTHORIZED100PAIRS10RUNNERS_ACTIONS_PREFLIGHT','sourceCommit':commit,'runId':37138752420,
 'url':run['html_url'],'originRunId':37138752420,'origin':run['created_at'],'clockReset':False,
 'computeDeadline':(origin+datetime.timedelta(minutes=160)).isoformat(),'cancelDeadline':(origin+datetime.timedelta(minutes=175)).isoformat(),
 'overallDeadline':(origin+datetime.timedelta(minutes=180)).isoformat(),'branch':'validation/a0-m1-retest-20261004','localRepo':str(REPO),
 'inputs':122,'selectionPopulation':122,'original168PopulationRevalidation':False,'comparisons':['A0/R','M1/R','M1/A0'],
 'pairsPerInputPerComparison':100,'runnerJobs':10,'maxParallel':10,'maxParallelAuthorized':12,'pairsPerRunnerPerComparison':10,
 'selectedCalls':73200,'environmentCalls':120,'nativeCallCap':73320,'actualNativeCalls':'NOT_YET_AUDITED',
 'runnerHoursUpper':10+1/3,'runnerHoursCap':64,'oneRetestOnly':True,'automaticSecondRetest':False,
 'frozenPriorArtifactRunId':37134463920,'searchBudgetUnchanged100K':True,'freshWorker':True,
 'selectionContractsLocalTestsPassed':3,'analysisLocalTestsPassed':5,'linuxPreflight':'PENDING',
 'actualPrimaryPcThresholdCalls':0,'m2ActualInputCalls':0,'instrumentedActualInputCalls':0,
 'integrationImplemented':False,'devMainDeploymentChanged':False,'nativeBelow1_10IsIntegrationRequirement':False,
 'next':'Wait for watcher completion, audit immutable raw/source/results. One result decision, not automatic integration or another retest.'}
write(HERE/'STATUS.json',status);print(json.dumps(status,indent=2))
