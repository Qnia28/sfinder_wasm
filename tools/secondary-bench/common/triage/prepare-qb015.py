"""Pinned DEV/RC2 diagnostics, selective probe budgets and seed-discard control. Solver0."""
import importlib.util,json,shutil,difflib
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('anchor',HERE/'prepare-regression.py');anchor=importlib.util.module_from_spec(spec);spec.loader.exec_module(anchor)
ARMS=['R19_DEV','R19_RC2','R19_PROBE100K','R19_PROBE10K','R19_PROBE1K','R19_DISCARD100K','R19_CP120','R19_PROBE100K_CP120']
def prepare():
    anchor.COMMITS['RC']='8b021b465ba91232c3505598add0b697a5b0da96'
    anchor.prepare();records=[]
    for arm in ARMS:
        root=Path('qb015-products')/arm;shutil.copytree('dev-product' if arm=='R19_DEV' else 'rc-product',root)
        before={f.relative_to(root).as_posix():anchor.sha(f.read_bytes()) for f in root.rglob('*') if f.is_file()};patches=[]
        def change(name,old,new):
            file=root/'src'/name;text=file.read_text(encoding='utf8');assert text.count(old)==1,(arm,name,old)
            updated=text.replace(old,new);file.write_text(updated,encoding='utf8',newline='\n')
            patches.extend(difflib.unified_diff(text.splitlines(True),updated.splitlines(True),fromfile=name,tofile=name))
        if 'PROBE' in arm or 'DISCARD' in arm:
            change('min-cover-triage-experiment.mjs',"DEFAULT_SECONDARY_TRIAGE_POLICY = 'P15'","DEFAULT_SECONDARY_TRIAGE_POLICY = 'baseline'")
        budget=1000 if arm=='R19_PROBE1K' else 10000 if arm=='R19_PROBE10K' else 100000
        if budget!=100000:change('min-cover-exact-secondary.mjs','FAST_EXACT_STATE_BUDGET = 100000',f'FAST_EXACT_STATE_BUDGET = {budget}')
        if arm.endswith('CP120'):change('min-cover-three-engine.mjs','SECONDARY_CP_LIMIT_MS = null','SECONDARY_CP_LIMIT_MS = 120000')
        if arm=='R19_DISCARD100K':
            change('min-cover-three-engine.mjs','const seedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;','const seedKeys = primaryKeys;')
            change('min-cover-three-engine.mjs',"seedSource:probe?.keys?.length===primary.count?'probe':'primary'","seedSource:'primary-discard-probe'")
        # Keep all arms on the same coarse stage trace contract, including DEV.
        change('secondary-engine.worker.mjs',"import { WasmPcSolver }", "import {diagnostic} from './regression-trace.mjs';\nglobalThis.__secondaryMemoryTrace=(event,details={})=>{\n  if(['model-begin','quality-batch-begin','stage-model-ready','stage-solve-return','native-solve-enter','native-solve-return'].includes(event)) diagnostic('cp-'+event,details);\n};\nimport { WasmPcSolver }")
        after={f.relative_to(root).as_posix():anchor.sha(f.read_bytes()) for f in root.rglob('*') if f.is_file()}
        assert all(after[n]==h for n,h in before.items() if n.endswith('.wasm'))
        records.append(dict(arm=arm,commit=anchor.COMMITS['DEV' if arm=='R19_DEV' else 'RC'],probeBudget=budget,before=before,after=after,changed=sorted(n for n,h in after.items() if h!=before[n]),patch=''.join(patches)))
    Path('QB015_PATCHES.json').write_text(json.dumps(records,sort_keys=True,indent=2)+'\n',encoding='utf8',newline='\n')
if __name__=='__main__':prepare()
