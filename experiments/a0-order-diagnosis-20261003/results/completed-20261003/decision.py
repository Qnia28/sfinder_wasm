"""Close the fixed single-input diagnosis without expanding or rerunning it."""
from pathlib import Path
import datetime
import json
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-order-diagnosis-20261003')
DEV=Path('D:/AI/sfinder-wasm/dev-branch')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
a=load(HERE/'ANALYSIS.json');assert a['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
assert a['observedBaseCalls']==24 and a['observedProfileCalls']==0 and not a['profileRequiredByFrozenRule']
assert git(DEV,'status','--porcelain')==b''
dev=git(DEV,'rev-parse','HEAD').decode().strip();assert dev=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
localmain=git(DEV,'rev-parse','main').decode().strip();assert localmain=='187fbf954ad0749e697b4e7f1252683b318d696e'
remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0];assert remote=='03b637730c5b541f4f2934be613498fbe65327fd'
assert 'ref: refs/heads/main\tHEAD' in git(REPO,'ls-remote','--symref','origin','HEAD').decode()
assert git(REPO,'diff','--name-only','edc4f2547207a509176a3e79dabf8a4995112220','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003')==b''
download=HERE/'github-run-37099783258';run=load(download/'RUN.json');initial=load(download/'INITIAL_RUN.json')
date=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
wall=(max(date(j['completedAt']) for j in run['jobs'])-date(initial['created_at'])).total_seconds()/60
runner=sum((date(j['completedAt'])-date(j['startedAt'])).total_seconds() for j in run['jobs'])/3600
decision={'status':'ORDER_DIAGNOSIS_COMPLETE_KEEP_PRODUCT_UNCHANGED','runId':37099783258,'runConclusion':run['conclusion'],
  'sourceCommit':a['sourceCommit'],'matrixId':'board-028--restricted-split--ordinary','nativeIntegratedCalls':24,'conditionalProfileCalls':0,
  'missingTimeoutOomErrors':0,'independentAudit':'PASS','runtime':a['runtime'],'contrasts':a['contrasts'],
  'findings':[
    {'claim':'On this 9V74 host, standalone R/A first calls differ by only +0.070 percent','confidence':'DIRECT_OBSERVATION','productPerformanceClaim':False},
    {'claim':'On this 9V74 host, preceding opposite-variant execution changes API time by less than 1 percent in ratio-of-medians','confidence':'DIRECT_OBSERVATION','globalRefutation':False},
    {'claim':'A general large cross-variant warming effect is not supported by this experiment','confidence':'LIMITED_TO_TESTED_HOST_AND_LIFECYCLE'},
    {'claim':'Earlier 9V45 cold anomaly remains real recorded evidence but its mechanism is unresolved','confidence':'UNRESOLVED_NO_TRACE','discardEarlierFailure':False},
    {'claim':'Pinning eliminated the anomaly is not established because the host changed too','confidence':'CAUSAL_ATTRIBUTION_NOT_AVAILABLE'},
    {'claim':'Thread CPU closely matches wall time here; a seconds-scale IPC or off-CPU delay is not supported','confidence':'DIRECT_OBSERVATION_NOT_PRIOR_HOST_PROOF'}],
  'response':{'modifySiblingTrailNow':False,'addProductWarmup':False,'addIdOrCpuExceptions':False,'relaxGate':False,
    'broadBenchmark':False,'retryForFavorableHost':False,'promoteA0':False,'furtherAutomaticCalls':0,
    'nextProposal':'If further cause work is authorized, predeclare engine-tier trace/control on the same single input without successful-host selection. Do not infer tier causation without trace; do not expand to populations.'},
  'oldReservedP95FailureStillValid':True,'independentExactProofStillPending':'board-111--restricted-split--ordinary',
  'nativeThresholdCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0,'confirmationCalls':0,
  'productChanged':False,'devApplied':False,'mainMerged':False,'deployed':False,'devHead':dev,'localMain':localmain,'remoteMain':remote,'defaultBranch':'main',
  'wallMinutes':wall,'observedRunnerHours':runner,'artifactCompressedBytes':sum(r['size_in_bytes'] for r in load(download/'ARTIFACTS.json')['artifacts'])}
with (HERE/'DECISION.json').open('x',encoding='utf-8') as f:json.dump(decision,f,indent=2);f.write('\n')
(HERE/'STATUS.json').write_text(json.dumps(decision,indent=2)+'\n',encoding='utf-8')
print(json.dumps(decision,indent=2))
