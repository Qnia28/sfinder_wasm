"""Close one retest and seal evidence after a separately written decision; no native calls."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-m1-retest-20261004')
D=HERE/'github-run-37138752420';load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
assert not (HERE/'SEAL.json').exists()
decision=load(HERE/'DECISION.json');status=load(HERE/'STATUS.json')
assert decision['oneRetestFinished'] and not decision['integrationImplemented'] and not decision['automaticSecondRetest']
assert status['campaignClosed'] and load(D/'RETEST_AUDIT.json')['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
assert load(HERE/'PAIRED_STATS_AUDIT.json')['calls']==73320
assert load(HERE/'PROVENANCE_AUDIT.json')['status']=='SAME_FROZEN_BINARY_RUNTIME_SOURCE_AND_SEALED_SCREENING_VERIFIED'
assert load(HERE/'ARCHIVES.json')['allArchivedBytesVerified']
dev=ROOT/'dev-branch';assert git(dev,'status','--porcelain')==b''
protected={'devHead':git(dev,'rev-parse','HEAD').decode().strip(),'localMain':git(dev,'rev-parse','main').decode().strip(),
 'remoteMain':git(dev,'ls-remote','origin','refs/heads/main').decode().split()[0]}
assert protected=={'devHead':'c0cb2a048e7275bfea587d176b1954efff0a8a08','localMain':'187fbf954ad0749e697b4e7f1252683b318d696e','remoteMain':'03b637730c5b541f4f2934be613498fbe65327fd'}
old=[]
for name in ['a0-four-arm-execution-20261004','a0-four-arm-preparation-20261003','a0-proof-retest-completed-20261003']:
 p=HERE.parent/name;s=load(p/'SEAL.json')
 for f in s['files']:assert (p/f['file']).stat().st_size==f['bytes'] and sha(p/f['file'])==f['sha256']
 old.append({'directory':name,'sealSha256':sha(p/'SEAL.json'),'filesReverified':len(s['files'])})
with (HERE/'PROTECTED_STATE.json').open('x',encoding='utf-8',newline='\n') as f:json.dump({'protected':protected,'oldSeals':old},f,indent=2);f.write('\n')
# Preserve metadata including the post-run audit, separately from original runner artifacts.
source=[p for p in sorted(D.iterdir()) if p.is_file()];target=HERE/'PACKED/run-metadata-and-audit.zip'
with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in source:z.write(p,p.relative_to(HERE).as_posix())
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 for p in source:assert z.read(p.relative_to(HERE).as_posix())==p.read_bytes()
with zipfile.ZipFile(HERE/'NAVIGATION_SNAPSHOT.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
 for name in ['NEXT_WORK_KO.md','tools/validation/README_KO.md']:z.write(ROOT/name,name)
files=[{'file':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(HERE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
seal={'schema':'m1-one100pair-retest-completed-seal-v1','runId':37138752420,'sourceCommit':'c6554bce7356fe226693074610e8c7a2177335cb',
 'callsVerified':73320,'inputs':122,'runnerJobs':10,'pairsPerComparison':100,'decision':decision['status'],
 'productChanged':False,'files':files}
with (HERE/'SEAL.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(seal,f,indent=2);f.write('\n')
print(json.dumps({'sealedFiles':len(files),'bytes':sum(f['bytes'] for f in files),'sealSha256':sha(HERE/'SEAL.json'),'protected':protected,'oldSeals':old},indent=2))
