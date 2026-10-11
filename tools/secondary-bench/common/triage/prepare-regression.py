"""Materialize exact product commits and boundary-only diagnostic patches; no solver."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
COMMITS={'DEV':'7ef62d18e1d155b6479e00d651c851ff3baa7112','RC':'2c406b98cadc186bfaf4490f4b8568535a60ea01'}
def sha(data):return hashlib.sha256(data).hexdigest()
def prepare():
    changes=[]
    for arm,commit in COMMITS.items():
        root=Path('dev-product' if arm=='DEV' else 'rc-product');root.mkdir(exist_ok=False)
        archive=root.with_suffix('.zip');subprocess.run(['git','archive','--format=zip','--output='+str(archive),commit],check=True)
        with zipfile.ZipFile(archive) as z:z.extractall(root)
        source={p.relative_to(root).as_posix():sha(p.read_bytes()) for p in root.rglob('*') if p.is_file()}
        trace=Path('tools/secondary-bench/common/triage/regression-trace.mjs').read_bytes();(root/'src/regression-trace.mjs').write_bytes(trace)
        def patch(name,old,new):
            file=root/'src'/name;text=file.read_text(encoding='utf8');assert text.count(old)==1,(arm,name,old,text.count(old))
            file.write_text(text.replace(old,new),encoding='utf8',newline='\n')
        def imports(name):
            file=root/'src'/name;file.write_text("import {diagnostic,seedDiagnostic} from './regression-trace.mjs';\n"+file.read_text(encoding='utf8'),encoding='utf8',newline='\n')
        for name in ['min-cover-adaptive.mjs','min-cover-exact-secondary.mjs','min-cover-three-engine.mjs','secondary-engine-runner.mjs','per-save-minimals-core.mjs','exact-secondary.worker.mjs']:imports(name)
        patch('exact-secondary.worker.mjs','    const { keys, offsets, ids, qualities, context } = message.payload;',"    const { keys, offsets, ids, qualities, context } = message.payload;\n    diagnostic('secondary-worker-task',{taskId:message.id,K:context.primary?.count});seedDiagnostic('worker-primary-seed',context.primaryKeys);")
        patch('per-save-minimals-core.mjs','    const group = groups.get(piece), activeRows = group.rows.filter(Boolean);',"    diagnostic('piece-start',{piece});\n    const group = groups.get(piece), activeRows = group.rows.filter(Boolean);")
        patch('min-cover-adaptive.mjs','  const primary = resolved === "ortools"',"  diagnostic('primary-start',{resolved,primaryHard,kernelStats});\n  const primary = resolved === \"ortools\"")
        patch('min-cover-adaptive.mjs','  const primaryKeys = primary.selected.map((id) => prepared.keys[id]);',"  const primaryKeys = primary.selected.map((id) => prepared.keys[id]);\n  diagnostic('primary-end',{K:primary.count,backend:primary.backend});seedDiagnostic('primary-seed',primaryKeys);")
        patch('min-cover-exact-secondary.mjs',"    const { result: trivial, structure } = inspectTrivialSecondary(coverage, options.primary.count, options.qualityFor);","    const { result: trivial, structure } = inspectTrivialSecondary(coverage, options.primary.count, options.qualityFor);\n    diagnostic('secondary-structure',{structure,primaryHard:options.primaryHard,trivial:!!trivial});")
        patch('min-cover-exact-secondary.mjs','      const integrated = integratedProbe ?? search({',"      diagnostic('probe-start');\n      const integrated = integratedProbe ?? search({")
        patch('min-cover-exact-secondary.mjs','      if (integrated?.completed &&',"      diagnostic('probe-end',{completed:integrated?.completed,states:integrated?.searchedStates});seedDiagnostic('probe-seed',integrated?.keys);\n      if (integrated?.completed &&")
        patch('min-cover-three-engine.mjs','    const seedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;',"    const seedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;\n    seedDiagnostic('threshold-seed',seedKeys);diagnostic('threshold-dispatch',{seedSource:probe?.keys?.length===primary.count?'probe':'primary',K:primary.count});")
        patch('secondary-engine-runner.mjs',"  let worker, ended = false, rejectPromise, abort, deadline;","  diagnostic('engine-start',{engine,limitMs});\n  let worker, ended = false, rejectPromise, abort, deadline;")
        patch('secondary-engine-runner.mjs','      const fail = error => {',"      const fail = error => { diagnostic('engine-error',{engine,error:String(error)});")
        patch('secondary-engine-runner.mjs','        if (ended || data.started) return;',"        if (data.started) diagnostic('engine-ready',{engine});\n        if (ended || data.started) return;\n        diagnostic('engine-message',{engine,completed:data.result?.completed,error:data.error??null});")
        patch('per-save-minimals-core.mjs','function finishPieceResult(args) {',"function finishPieceResult(args) {\n  diagnostic('piece-submitted',{piece:args.piece,pending:!!(args.minimal?.filterPending??args.minimal?.secondaryPending)});")
        patch('per-save-minimals-core.mjs','  const success = successOverride ?? coverage.size;',"  diagnostic('piece-completed',{piece,K:minimal?.count,backend:minimal?.qualityBackend});\n  const success = successOverride ?? coverage.size;")
        after={p.relative_to(root).as_posix():sha(p.read_bytes()) for p in root.rglob('*') if p.is_file()}
        changes.append(dict(arm=arm,commit=commit,before=source,after=after,changed=[n for n,h in after.items() if source.get(n)!=h]))
    Path('PRODUCT_PATCHES.json').write_text(json.dumps(changes,sort_keys=True,indent=2)+'\n',encoding='utf8')
if __name__=='__main__':prepare()
