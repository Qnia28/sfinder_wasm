"""Freeze read-only audit results and archive downloaded evidence; never invoke a solver."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-four-arm-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda repo,*a:subprocess.check_output(['git','-C',str(repo),*a])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write_new(p,v):
 with p.open('x',encoding='utf-8') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')

if '--seal' in sys.argv:
 assert not (HERE/'SEAL.json').exists()
 assert load(HERE/'STATUS.json')['campaignClosed'] and load(HERE/'DECISION.json')['productIntegration']=='HOLD'
 with zipfile.ZipFile(HERE/'NAVIGATION_SNAPSHOT.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
  for name in ['NEXT_WORK_KO.md','tools/validation/README_KO.md']:z.write(ROOT/name,name)
 files=[{'file':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(HERE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
 seal={'schema':'a0-four-arm-completed-seal-v1','sourceCommit':'f4716e1f2686fa25c4e844e47b51e88835a980da',
  'successfulRunId':37134463920,'firstFailedPreflightRunId':37134128882,'callsVerified':4980,
  'status':'COMPLETE_AUDITED_SELECTED_SET_ONLY_PRODUCT_HOLD','productChanged':False,'files':files}
 write_new(HERE/'SEAL.json',seal)
 print(json.dumps({'sealedFiles':len(files),'bytes':sum(f['bytes'] for f in files),'sealSha256':sha(HERE/'SEAL.json')}));sys.exit()

assert not (HERE/'DECISION.json').exists() and not (HERE/'PACKED').exists()
s=load(HERE/'STATUS.json');summary=load(HERE/'COMPARISON_SUMMARY.json')
assert s['status']=='COMPLETE_AUDITED_SELECTED_SET_ONLY' and s['actualInputNativeCalls']==4980
assert git(REPO,'status','--porcelain')==b'' and git(REPO,'rev-parse','HEAD').decode().strip()==summary['sourceCommit']
dev=ROOT/'dev-branch';assert git(dev,'status','--porcelain')==b''
protected={'devHead':git(dev,'rev-parse','HEAD').decode().strip(),'localMain':git(dev,'rev-parse','main').decode().strip(),
 'remoteMain':git(dev,'ls-remote','origin','refs/heads/main').decode().split()[0]}
assert protected=={'devHead':'c0cb2a048e7275bfea587d176b1954efff0a8a08','localMain':'187fbf954ad0749e697b4e7f1252683b318d696e','remoteMain':'03b637730c5b541f4f2934be613498fbe65327fd'}
old_seals=[]
for name in ['a0-four-arm-preparation-20261003','a0-proof-retest-completed-20261003']:
 p=HERE.parent/name;seal=load(p/'SEAL.json')
 for f in seal['files']:assert (p/f['file']).stat().st_size==f['bytes'] and sha(p/f['file'])==f['sha256']
 old_seals.append({'directory':name,'sealSha256':sha(p/'SEAL.json'),'verifiedFiles':len(seal['files'])})
final=HERE/'FINAL_SOURCE';final.mkdir()
for name in git(REPO,'ls-tree','-r','--name-only','HEAD','--','experiments/a0-four-arm-20261003','.github/workflows/a0-four-arm.yml').decode().splitlines():
 (final/Path(name).name).write_bytes(git(REPO,'show',f"{summary['sourceCommit']}:{name}"))
decision={**protected,'status':'COMPLETE_AUDITED_SELECTED_SET_ONLY_PRODUCT_HOLD','sourceCommit':summary['sourceCommit'],
 'runId':37134463920,'priorRunId':37134128882,'originRunId':37134128882,'clockReset':False,
 'callsVerified':4980,'timingCalls':4960,'diagnosticCalls':20,'complete10BlockInputs':122,'stateQualitySeedIdsPreserved':True,
 'actualPrimaryPcThresholdCalls':0,'missingTimeoutOomErrorCalls':0,'rawRecordsVerified':14940,
 'environmentAlarms':summary['environmentAlarms'],'environmentSensitiveJointComparisonInputs':88,
 'environmentClearJointImprovementCounts':{'M1':18,'M2':5},'environmentClearM2OverA0Improvements':16,
 'm2OverA0NewMagnitudeSlowdowns':[c for c in summary['comparisons']['M2/A0']['worst10'] if c['ratio']>1.1 and c['slowdownAbove1_10Hosts']>=4],
 'workReductionVerifiedFiveInputs':True,'preferredFurtherResearchCandidate':'M1_ONLY_NOT_PROMOTED',
 'productIntegration':'HOLD','originalReservedP95':1.197846065695026,'gate':1.10,'originalGateRecomputed':False,
 'productApplyMergeDeploy':False,'combinedArm':False,'automaticFurtherNativeCalls':0,'automatic232Or675Campaign':False,
 'favorableHostReplacement':False,'successfulTimingRerunSubstitution':False,'searchBudgetIncreased':False,
 'runnerHoursIncludingFailedPreflight':summary['runnerHoursIncludingFailedPreflight'],'completedAt':summary['completedAt'],
 'campaignClosed':True,'oldSealsReverified':old_seals,
 'limit':summary['statisticalLimit']+' '+summary['causalLimit']}
write_new(HERE/'DECISION.json',decision)
packed=HERE/'PACKED';packed.mkdir();archives=[]
for run in sorted(HERE.glob('github-run-*')):
 for artifact in sorted(p for p in run.iterdir() if p.is_dir()):
  target=packed/f'{run.name}-{artifact.name}.zip';source=[p for p in sorted(artifact.rglob('*')) if p.is_file()]
  with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for p in source:z.write(p,p.relative_to(HERE).as_posix())
  assert target.stat().st_size<90*2**20,'Archive requires explicit splitting before publication'
  with zipfile.ZipFile(target) as z:
   assert z.testzip() is None
   for p in source:assert hashlib.sha256(z.read(p.relative_to(HERE).as_posix())).hexdigest()==sha(p)
  archives.append({'file':target.relative_to(HERE).as_posix(),'bytes':target.stat().st_size,'sha256':sha(target),'files':len(source),'source':artifact.relative_to(HERE).as_posix()})
 # Metadata and read-only audit reports stay separate from raw runner artifacts.
 target=packed/f'{run.name}-metadata.zip';source=[p for p in sorted(run.iterdir()) if p.is_file()]
 with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p in source:z.write(p,p.relative_to(HERE).as_posix())
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  for p in source:assert hashlib.sha256(z.read(p.relative_to(HERE).as_posix())).hexdigest()==sha(p)
 archives.append({'file':target.relative_to(HERE).as_posix(),'bytes':target.stat().st_size,'sha256':sha(target),'files':len(source),'source':run.relative_to(HERE).as_posix()+' (metadata)'})
write_new(HERE/'ARCHIVES.json',{'schema':'a0-four-arm-archive-v1','archives':archives,'rawOriginalsPreservedLocally':True,'allArchivedBytesVerified':True})
print(json.dumps({'decisionStatus':decision['status'],'archives':archives,'protected':protected,'oldSeals':old_seals},indent=2))
