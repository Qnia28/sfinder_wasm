"""Freeze conditional launch only after exact proof and residual-budget admission."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
HERE=Path(__file__).resolve().parent
EX=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003/experiments/a0-proof-retest-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
proof=load(HERE/'PROOF_AUDIT.json');assert proof['status']=='INDEPENDENT_EXACT_VERIFIED'
campaign=load(EX/'CAMPAIGN.json');selection=load(EX/'RETEST_SELECTION.json');schedule=load(EX/'RETEST_SCHEDULE.json')['runs']
assert selection['selectedInputs']==121 and len(schedule)==2460
assert all(sum(r['host']==h for r in schedule)==492 for h in range(5))
stamp=lambda t:datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
origin=stamp(proof['origin']);now=datetime.datetime.now(datetime.timezone.utc);compute=origin+datetime.timedelta(minutes=160)
assert now+datetime.timedelta(minutes=45)<compute
spent=0;prior=[]
for runid in [37115091562,proof['runId']]:
 data=json.loads(subprocess.check_output(['gh','api',f'repos/Qnia28/sfinder_wasm/actions/runs/{runid}/jobs?per_page=100']))
 seconds=sum((stamp(j['completed_at'])-stamp(j['started_at'])).total_seconds() for j in data['jobs'])
 spent+=seconds/3600;prior.append({'runId':runid,'jobSeconds':seconds,'runnerHours':seconds/3600})
assert spent+5*45/60<=campaign['runnerHoursCap']
budget={'status':'RETEST_ADMITTED_AFTER_EXACT_PROOF','checkedAt':now.isoformat(),'origin':proof['origin'],'originRunId':37115091562,
 'computeDeadline':compute.isoformat(),'cancelDeadline':(origin+datetime.timedelta(minutes=175)).isoformat(),
 'overallDeadline':(origin+datetime.timedelta(minutes=180)).isoformat(),'clockReset':False,'priorRuns':prior,
 'priorRunnerHours':spent,'retestRunnerHoursUpper':3.75,'totalRunnerHoursUpper':spent+3.75,'capRunnerHours':64,
 'runnerJobs':5,'maxParallel':5,'maxAllowedParallel':16,'inputsIncludingControls':121,'selectedAndControlCalls':2420,
 'environmentCalls':40,'nativeCalls':2460,'callsPerJob':492,'jobTimeoutMinutes':45,'jobComputeGuardMinutes':42,
 'perCallAdmissionSeconds':167,'perCallStateBudget':100000,'apiSeconds':10,'processSeconds':30,
 'childMemoryGiB':3,'swapBytes':0,'worstCaseAllCallsMayNotFit':True,'budgetStopStatus':'NOT_RUN_BUDGET',
 'selectionRulesSha256':selection['rulesSha256'],'executionRulesVersion':'1.1','selectionUnchanged':True,
 'wholePopulationGateReplacement':False,'originalReservedP95FailureStillValid':True}
launch={'status':'AUTHORIZED_PROOF_VERIFIED_BUDGET_ADMITTED','goal':'frozen symmetric10-pair retests','hosts':5,'nativeCalls':2460,
 'selectedInputsIncludingControls':121,'proofRunId':proof['runId'],'proofSha256':hashlib.sha256((HERE/'PROOF_AUDIT.json').read_bytes()).hexdigest(),
 'campaignOriginRunId':37115091562,'clockReset':False,'automaticRetries':0,'wholePopulationGateReplacement':False}
for name,data in [('RETEST_BUDGET.json',budget),('retest-launch.json',launch)]:
 with (EX/name).open('x',encoding='utf-8') as f:json.dump(data,f,indent=2);f.write('\n')
assert not (EX/'PROOF_AUDIT.json').exists();(EX/'PROOF_AUDIT.json').write_bytes((HERE/'PROOF_AUDIT.json').read_bytes())
print(json.dumps(budget,indent=2))
