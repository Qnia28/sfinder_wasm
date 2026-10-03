"""Seal completed diagnosis evidence. No application, rerun or source reset."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root=Path(__file__).resolve().parent;manifest=root/'SEAL.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
if '--verify' in sys.argv:
    seal=json.loads(manifest.read_text(encoding='utf-8'))
    for f in seal['files']:
        b=(root/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
    print(json.dumps({'status':'DIAGNOSIS_EVIDENCE_SEAL_VERIFIED','files':len(seal['files']),'devApplied':False}))
else:
    assert not manifest.exists(),'Refusing to overwrite seal'
    repo='C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-diagnosis-20261003'
    assert subprocess.check_output(['git','-C',repo,'status','--porcelain'])==b''
    head=subprocess.check_output(['git','-C',repo,'rev-parse','HEAD'],text=True).strip()
    decision=json.loads((root/'DECISION.json').read_text(encoding='utf-8'));assert not decision['productChanged'] and decision['diagnosticCalls']==2560
    files=[{'file':str(f.relative_to(root)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())} for f in sorted(root.rglob('*')) if f.is_file() and '__pycache__' not in f.parts and f!=manifest]
    data={'schema':'a0-cause-diagnosis-final-seal-v1','status':decision['status'],'runId':37096100399,'sourceCommit':'9455ece132a3a82833e966790a827d173314ca68','evidenceCommit':head,
          'newPerformancePromotionCampaign':False,'productChanged':False,'devApplied':False,'files':files}
    manifest.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'DIAGNOSIS_EVIDENCE_SEALED','files':len(files),'bytes':sum(f['bytes'] for f in files),'evidenceCommit':head}))
