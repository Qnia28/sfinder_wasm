"""Seal completed original+continuation evidence; never change product refs."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root=Path(__file__).resolve().parent;manifest=root/'SEAL.json'
def sha(b):return hashlib.sha256(b).hexdigest()
if '--verify' in sys.argv:
    seal=json.loads(manifest.read_text(encoding='utf-8'))
    for f in seal['files']:
        b=(root/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['file']
    print(json.dumps({'status':'FINAL_EVIDENCE_SEAL_VERIFIED','files':len(seal['files']),'devApplied':False}))
else:
    assert not manifest.exists(),'Refusing to overwrite evidence seal'
    repo='C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-revalidation-20261003'
    assert not subprocess.check_output(['git','-C',repo,'status','--porcelain'])
    head=subprocess.check_output(['git','-C',repo,'rev-parse','HEAD'],text=True).strip()
    files=[{'file':str(f.relative_to(root)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())} for f in sorted(root.rglob('*')) if f.is_file() and '__pycache__' not in f.parts and f!=manifest]
    seal={'schema':'a0-integrated-revalidation-final-seal-v1','status':'SEALED_EXECUTION_COMPLETE_INTEGRATION_HOLD',
          'measurementCommit':'13b274ef91a2debe07121f7b4a0e670ed39e034f','auditorContinuationCommit':'8b2dcc1419518023ba95d5d660dc7f190a479d58',
          'finalEvidenceCommit':head,'runIds':[37039906398,37041073063],'priorFailure37034641097Rewritten':False,
          'scheduledActualInputProbes':1344,'observedActualInputProbes':1344,'developmentMeasurementReruns':0,
          'devApplied':False,'mainMerged':False,'deployed':False,'files':files,'excluded':'Generated __pycache__ only'}
    manifest.write_text(json.dumps(seal,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':seal['status'],'files':len(files),'bytes':sum(f['bytes'] for f in files),'finalEvidenceCommit':head}))
