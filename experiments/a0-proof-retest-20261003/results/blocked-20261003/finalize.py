"""Persist final blocker decision and seal, no native calls."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from datetime import datetime

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
if '--seal' not in sys.argv:
 proof=load(HERE/'PROOF_FAILURE_REANALYSIS.json');selection=load(HERE/'SELECTION_AUDIT.json');origin=load(HERE/'ORIGIN_RUN.json')
 dev=Path('D:/AI/sfinder-wasm/dev-branch');assert git(dev,'status','--porcelain')==b''
 head=git(dev,'rev-parse','HEAD').decode().strip();assert head=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
 local=git(dev,'rev-parse','main').decode().strip();remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0]
 assert local=='187fbf954ad0749e697b4e7f1252683b318d696e' and remote=='03b637730c5b541f4f2934be613498fbe65327fd'
 run=load(HERE/'github-run-37115091562/RUN.json');D=lambda v:datetime.fromisoformat(v.replace('Z','+00:00'))
 d={'status':'PROOF_PENDING_PRE_NATIVE_HARNESS_FAILURE_RETEST_SELECTION_READY','proofRunId':37115091562,'proofSourceCommit':proof['sourceCommit'],
  'independentExactVerified':False,'wrapperAttempts':1,'actualNativeThresholdSearchCalls':0,'proofRetries':0,'actualIntegratedSearchCalls':0,'actualPrimaryPcCalls':0,'retestCalls':0,
  'cause':proof['cause'],'rawFailurePreserved':True,'initialAccountingCorrectionPreserved':True,
  'selectedInputsIncludingControls':121,'mainSelected':115,'unselectedControls':6,'plannedRetestCalls':2460,'plannedRunnerJobs':5,
  'uniqueVariationInputs':113,'selectionVerified':True,'conditionalRetestNotLaunched':True,'preparedScheduleTestsPassed':3,
  'proofPendingBlocksPerformanceConfirmation':True,'oldReservedP95FailureStillValid':True,
  'campaignOrigin':origin['created_at'],'campaignOriginRunId':37115091562,'oldCampaignNotReset':True,'withinNewCampaignClockReset':False,
  'observedProofRunnerHours':sum((D(j['completedAt'])-D(j['startedAt'])).total_seconds() for j in run['jobs'])/3600,
  'productChanged':False,'devApplied':False,'mainMerged':False,'deployed':False,'devHead':head,'localMain':local,'remoteMain':remote,
  'next':'Explicit harness correction with required qualityFor and direct numeric-threshold synthetic fixture; one first native proof at unchanged budgets. No automatic retry performed.'}
 for name in ['DECISION.json','STATUS.json']:
  with (HERE/name).open('x',encoding='utf-8') as f:json.dump(d,f,indent=2);f.write('\n')
 print(json.dumps(d,indent=2))
else:
 assert not (HERE/'SEAL.json').exists();assert git(REPO,'status','--porcelain')==b''
 commit=git(REPO,'rev-parse','HEAD').decode().strip();files=[{'file':str(p.relative_to(HERE)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(HERE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
 manifest={'schema':'a0-proof-retest-blocked-seal-v1','status':load(HERE/'DECISION.json')['status'],'evidenceCommit':commit,'proofRunId':37115091562,
  'wrapperAttempts':1,'actualNativeThresholdSearchCalls':0,'retestCalls':0,'productChanged':False,'files':files}
 with (HERE/'SEAL.json').open('x',encoding='utf-8') as f:json.dump(manifest,f,indent=2);f.write('\n')
 for f in files:assert sha(HERE/f['file'])==f['sha256']
 print(json.dumps({'status':'PROOF_FAILURE_AND_SELECTION_EVIDENCE_SEALED','files':len(files),'bytes':sum(f['bytes'] for f in files),'evidenceCommit':commit}))
