from pathlib import Path
import datetime
import hashlib
import json
import subprocess
HERE=Path(__file__).resolve().parent;REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-four-arm-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
first=HERE/'github-run-37134128882';run=load(first/'RUN.json');artifact=first/'a0-four-build'
assert load(artifact/'BASELINE_GATE.json')['status']==load(artifact/'CONTROL_GATE.json')['status']=='PASS'
tests={}
for p in (artifact/'preflight').glob('rust-*.log'):
 assert '29 passed; 0 failed' in p.read_text();tests[p.stem]=29
assert len(tests)==6
assert all(j['conclusion']=='skipped' for j in run['jobs'] if j['name']!='build')
stamp=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
prior=sum((stamp(j['completedAt'])-stamp(j['startedAt'])).total_seconds()/3600 for j in run['jobs'] if j['startedAt'] and j['completedAt'])
commit=subprocess.check_output(['git','-C',str(REPO),'rev-parse','HEAD']).decode().strip();assert commit=='f4716e1f2686fa25c4e844e47b51e88835a980da'
assert prior+6<64
s=load(HERE/'STATUS.json');s.update({'status':'CORRECTED_PREFLIGHT_ACTIONS_IN_PROGRESS','runId':37134463920,'url':'https://github.com/Qnia28/sfinder_wasm/actions/runs/37134463920',
 'sourceCommit':commit,'firstSourceCommit':'1c26726a0b5b3d47be2da667154e39cc9e050343','linuxOriginalAndControlByteGateFirstRun':'PASS',
 'linuxRustDebugReleaseTestsFirstRun':tests,'priorActualInputCalls':0,'priorRunnerHours':prior,'runnerHoursUpperIncludingPrior':prior+6,
 'correction':'Selection identity fixture uses canonical JSON instead of Windows raw CRLF hash; historical byte hash retained. Input/records/schedule/reference/Rust unchanged.',
 'originRunId':37134128882,'originUnchanged':True,'clockResetWithinCampaign':False,
 'next':'Wait for watcher; corrected preflight must pass, then actual timing + separate work diagnostics. No original actual-input performance calls to repeat.'})
(HERE/'STATUS.json').write_text(json.dumps(s,indent=2)+'\n',encoding='utf-8')
snap=HERE/'CORRECTION_SOURCE';snap.mkdir()
for name in ['SELECTION.json','CAMPAIGN.json','contracts.test.mjs','origin.mjs','launch.json']:
 b=subprocess.check_output(['git','-C',str(REPO),'show',f'{commit}:experiments/a0-four-arm-20261003/{name}']);(snap/name).write_bytes(b)
subprocess.check_call(['git','-C',str(REPO),'bundle','create',str(HERE/'SOURCE-CORRECTED.bundle'),'validation/a0-four-arm-20261003'])
print(json.dumps(s,indent=2))
