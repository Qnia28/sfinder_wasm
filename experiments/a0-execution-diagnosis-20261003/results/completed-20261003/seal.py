"""Seal final evidence once; verify without changing earlier seals."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
REPO='C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-execution-diagnosis-20261003'
MANIFEST=ROOT/'SEAL.json';sha=lambda b:hashlib.sha256(b).hexdigest()
old=ROOT.parent/'a0-tier-diagnosis-20261003';old_manifest=json.loads((old/'SEAL.json').read_text(encoding='utf-8'))
for f in old_manifest['files']:
    b=(old/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
if '--verify' in sys.argv:
    s=json.loads(MANIFEST.read_text(encoding='utf-8'))
    for f in s['files']:
        b=(ROOT/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
    print(json.dumps({'status':'EXECUTION_DIAGNOSIS_SEAL_VERIFIED','files':len(s['files']),'previousTierSealVerified':True,'devApplied':False}))
else:
    assert not MANIFEST.exists(),'Refusing overwrite'
    assert subprocess.check_output(['git','-C',REPO,'status','--porcelain'])==b''
    head=subprocess.check_output(['git','-C',REPO,'rev-parse','HEAD'],text=True).strip()
    d=json.loads((ROOT/'DECISION.json').read_text(encoding='utf-8'));assert d['nativeCalls']==16 and not d['productChanged']
    files=[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(ROOT.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p!=MANIFEST]
    manifest={'schema':'a0-execution-diagnosis-final-seal-v1','status':d['status'],'runId':d['runId'],'sourceCommit':d['sourceCommit'],'evidenceCommit':head,
        'nativeCalls':16,'nativeRetries':0,'campaignClockReset':False,'productChanged':False,'devApplied':False,
        'previousTierSealSha256':sha((old/'SEAL.json').read_bytes()),'files':files}
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'EXECUTION_DIAGNOSIS_EVIDENCE_SEALED','files':len(files),'bytes':sum(f['bytes'] for f in files),'evidenceCommit':head}))
