"""Copy sealed audit evidence to isolated validation branch; no workflow launch changes."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

HERE=Path(__file__).resolve().parent;REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-four-arm-20261003')
DEST=REPO/'experiments/a0-four-arm-completed-20261004'
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
seal=json.loads((HERE/'SEAL.json').read_text(encoding='utf-8'))
assert not DEST.exists() and git('status','--porcelain')==b''
assert git('branch','--show-current').decode().strip()=='validation/a0-four-arm-20261003'
assert git('rev-parse','HEAD').decode().strip()==seal['sourceCommit']
for f in seal['files']:
 p=HERE/f['file'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
DEST.mkdir();copied=[]
for p in sorted(HERE.rglob('*')):
 if not p.is_file() or '__pycache__' in p.parts:continue
 rel=p.relative_to(HERE)
 if rel.parts[0].startswith('github-run-'):continue
 assert p.stat().st_size<90*2**20
 target=DEST/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
 assert p.read_bytes()==target.read_bytes();copied.append(rel.as_posix())
subprocess.check_call(['git','-C',str(REPO),'add','-f','--',DEST.relative_to(REPO).as_posix()])
staged=git('diff','--cached','--name-only').decode().splitlines()
assert len(staged)==len(copied) and all(n.startswith('experiments/a0-four-arm-completed-20261004/') for n in staged)
assert not any(n.endswith('experiments/a0-four-arm-20261003/launch.json') for n in staged)
subprocess.check_call(['git','-C',str(REPO),'diff','--cached','--check'])
subprocess.check_call(['git','-C',str(REPO),'commit','-m','evidence: close audited R A0 M1 M2 campaign; retain environment alarms and product hold'])
commit=git('rev-parse','HEAD').decode().strip();assert git('status','--porcelain')==b''
subprocess.check_call(['git','-C',str(REPO),'push','origin','validation/a0-four-arm-20261003'])
assert git('ls-remote','origin','refs/heads/validation/a0-four-arm-20261003').decode().split()[0]==commit
receipt={'status':'SEALED_EVIDENCE_PUBLISHED_NO_NEW_NATIVE_LAUNCH','sourceCommit':seal['sourceCommit'],'evidenceCommit':commit,
 'branch':'validation/a0-four-arm-20261003','sealSha256':hashlib.sha256((HERE/'SEAL.json').read_bytes()).hexdigest(),
 'remotePath':'experiments/a0-four-arm-completed-20261004','publishedFileCount':len(copied),'workflowLaunchPathChanged':False,
 'productApplyMergeDeploy':False,'successfulRunId':37134463920}
with (HERE.parent/'a0-four-arm-publication-20261004.json').open('x',encoding='utf-8') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt,indent=2))
