"""RC-pinned P/C/M interventions and identical boundary traces. No solver."""
import importlib.util,json,shutil,difflib
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('anchor',HERE/'prepare-regression.py');anchor=importlib.util.module_from_spec(spec);spec.loader.exec_module(anchor)
ARMS=[f'P{p}C{c}M{m}' for p in range(2) for c in range(2) for m in range(2)]
def prepare():
    anchor.prepare()
    records=[]
    for arm in ARMS:
        p,c,m=map(int,[arm[1],arm[3],arm[5]])
        root=Path('factor-products')/arm;shutil.copytree('rc-product',root)
        before={f.relative_to(root).as_posix():anchor.sha(f.read_bytes()) for f in root.rglob('*') if f.is_file()}
        patches=[]
        def change(name,old,new):
            f=root/'src'/name;text=f.read_text(encoding='utf8');assert text.count(old)==1,(arm,name,old)
            updated=text.replace(old,new);f.write_text(updated,encoding='utf8',newline='\n')
            patches.extend(difflib.unified_diff(text.splitlines(True),updated.splitlines(True),fromfile=name,tofile=name))
        if p==0:change('min-cover-triage-experiment.mjs',"DEFAULT_SECONDARY_TRIAGE_POLICY = 'P15'","DEFAULT_SECONDARY_TRIAGE_POLICY = 'baseline'")
        if c==0:change('min-cover-three-engine.mjs','SECONDARY_CP_LIMIT_MS = null','SECONDARY_CP_LIMIT_MS = 120000')
        if m==0:
            change('cpsat-secondary-model.mjs',"      model.addBoolOr(ids.map(id => x[id])).onlyEnforceIf(variable);\n      model.addBoolAnd(ids.map(id => x[id].not())).onlyEnforceIf(variable.not());","      model.addMaxEquality(variable, ids.map(id => x[id]));")
        # Same coarse CP stage markers for all eight arms. No native callbacks/search-loop logging.
        change('secondary-engine.worker.mjs',"import { WasmPcSolver }", "import {diagnostic} from './regression-trace.mjs';\nglobalThis.__secondaryMemoryTrace=(event,details={})=>{\n  if(['model-begin','quality-batch-begin','stage-model-ready','stage-solve-return','native-solve-enter','native-solve-return'].includes(event)) diagnostic('cp-'+event,details);\n};\nimport { WasmPcSolver }")
        after={f.relative_to(root).as_posix():anchor.sha(f.read_bytes()) for f in root.rglob('*') if f.is_file()}
        changed=[n for n,h in after.items() if before[n]!=h]
        assert set(changed)<=set(['src/min-cover-triage-experiment.mjs','src/min-cover-three-engine.mjs','src/cpsat-secondary-model.mjs','src/secondary-engine.worker.mjs'])
        assert all(after[n]==h for n,h in before.items() if n.endswith('.wasm'))
        records.append(dict(arm=arm,P=p,C=c,M=m,commit=anchor.COMMITS['RC'],before=before,after=after,changed=changed,patch=''.join(patches)))
    Path('FACTOR_PATCHES.json').write_text(json.dumps(records,sort_keys=True,indent=2)+'\n',encoding='utf8')
if __name__=='__main__':prepare()
