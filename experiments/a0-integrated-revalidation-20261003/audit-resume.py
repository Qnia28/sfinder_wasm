"""Auditor-order correction only. Preserve the original auditor and measurements."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

here=Path(__file__).resolve().parent;root=here.parent.parent
original=here/'audit.py'
blob=subprocess.check_output(['git','-C',str(root),'show','13b274ef91a2debe07121f7b4a0e670ed39e034f:experiments/a0-integrated-revalidation-20261003/audit.py'])
assert original.read_bytes().replace(b'\r\n',b'\n')==blob
source=blob.decode('utf-8')
changes=[
    ("folders=[d for d in download.glob(f'a0i-{phase}-*') if (d/'SHARD.json').exists()]", "folders=sorted(d for d in download.glob(f'a0i-{phase}-*') if (d/'SHARD.json').exists())"),
    ('for id,v in grouped.items():', "for id in dict.fromkeys(r['matrixId'] for r in rows):\n    v=grouped[id]")
]
for before,after in changes:
    assert source.count(before)==1
    source=source.replace(before,after)
out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
correction={'status':'AUDITOR_ORDER_CORRECTION_NO_MEASUREMENT_RERUN','originalAuditorSha256':hashlib.sha256(blob).hexdigest(),
            'correctedExecutedAuditorSha256':hashlib.sha256(source.encode()).hexdigest(),
            'wrapperSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'changes':[{'before':a,'after':b} for a,b in changes],
            'reason':'Match fixed-seed cluster index order to the already-sealed JS aggregator: lexical shard folders then first matrix occurrence; keep sorted witness verification for cache efficiency',
            'gateThresholdsChanged':False,'summaryRecomputedOrReplaced':False,'nativeSolverCalls':0,'originalFailedRunPreserved':37039906398,'devApplied':False}
(out/'AUDIT_CORRECTION.json').write_text(json.dumps(correction,indent=2)+'\n',encoding='utf-8')
exec(compile(source,str(original),'exec'),{'__file__':str(original),'__name__':'__main__'})
