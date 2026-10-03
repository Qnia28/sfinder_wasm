"""Seal all tier evidence and verify nested failure seals without overwrite."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root=Path(__file__).resolve().parent;manifest=root/'SEAL.json';sha=lambda b:hashlib.sha256(b).hexdigest()
for name in ['FIRST_RUN_SEAL.json','PREFLIGHT_RUN_SEAL.json']:
    for f in json.loads((root/name).read_text(encoding='utf-8'))['files']:
        b=(root/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
if '--verify' in sys.argv:
    s=json.loads(manifest.read_text(encoding='utf-8'))
    for f in s['files']:
        b=(root/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
    print(json.dumps({'status':'TIER_FINAL_SEAL_VERIFIED','files':len(s['files']),'nestedFailureSealsVerified':2,'devApplied':False}))
else:
    assert not manifest.exists(),'Refusing overwrite'
    repo='C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-tier-diagnosis-20261003'
    assert subprocess.check_output(['git','-C',repo,'status','--porcelain'])==b''
    head=subprocess.check_output(['git','-C',repo,'rev-parse','HEAD'],text=True).strip()
    d=json.loads((root/'DECISION.json').read_text(encoding='utf-8'));assert d['verifiedNativeIntegratedCalls']==24 and not d['productChanged']
    files=[{'file':str(p.relative_to(root)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(root.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p!=manifest]
    data={'schema':'a0-tier-diagnosis-final-seal-v1','status':d['status'],'finalRunId':37101642194,'failedRunsPreserved':[37101047698,37101472741],
        'sourceCommit':d['sourceCommit'],'evidenceCommit':head,'nativeIntegratedCalls':24,'successfulCallsReexecuted':0,'campaignClockReset':False,
        'productChanged':False,'devApplied':False,'files':files}
    manifest.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'TIER_EVIDENCE_SEALED','files':len(files),'bytes':sum(f['bytes'] for f in files),'evidenceCommit':head}))
