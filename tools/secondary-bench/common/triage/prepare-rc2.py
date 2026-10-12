"""Exact committed DEV/RC2 products. No diagnostic patches, no solver."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
COMMITS={'DEV':'7ef62d18e1d155b6479e00d651c851ff3baa7112','RC2':'8b021b465ba91232c3505598add0b697a5b0da96'}
RC1='2c406b98cadc186bfaf4490f4b8568535a60ea01'
def prepare():
    changed=subprocess.check_output(['git','diff','--name-only',RC1,COMMITS['RC2'],'--','src'],text=True).splitlines()
    assert changed==['src/cpsat-secondary-model.mjs'],changed
    result=[]
    for arm,commit in COMMITS.items():
        root=Path('dev-product' if arm=='DEV' else 'rc-product');root.mkdir(exist_ok=False)
        archive=root.with_suffix('.zip')
        subprocess.run(['git','-c','core.autocrlf=false','-c','core.eol=lf','archive','--format=zip','--output='+str(archive),commit],check=True)
        with zipfile.ZipFile(archive) as z:z.extractall(root)
        hashes={f.relative_to(root).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(root.rglob('*')) if f.is_file() and f.relative_to(root).parts[0] in ['src','wasm']}
        assert not (root/'src/regression-trace.mjs').exists()
        result.append(dict(arm=arm,commit=commit,files=hashes,diagnosticPatches=0))
    model=Path('rc-product/src/cpsat-secondary-model.mjs').read_text(encoding='utf8')
    assert 'model.addMaxEquality(variable, ids.map(id => x[id]));' in model
    assert 'model.addBoolAnd' not in model
    assert "DEFAULT_SECONDARY_TRIAGE_POLICY = 'P15'" in Path('rc-product/src/min-cover-triage-experiment.mjs').read_text()
    assert 'SECONDARY_CP_LIMIT_MS = null' in Path('rc-product/src/min-cover-three-engine.mjs').read_text()
    Path('PRODUCTS.json').write_text(json.dumps(result,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
if __name__=='__main__':prepare()
