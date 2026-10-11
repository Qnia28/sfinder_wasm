"""Independent saved-evidence audit for R16 anchor stage. No solver replay."""
import collections,importlib.util,json,sqlite3,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('independent-audit.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
read=base.read;require=base.require
out=Path('audit');out.mkdir();errors=[];rows=[];seen=set();witnesses={}
try:
    activation=Path('download/r16-activation');base.snapshot(activation);lock=read(activation/'LOCK.json')
    require(base.digest(lock['manifest'])==lock['manifestHash'],'manifest');require(lock['manifest']['maxParallel']==12,'VM cap')
    with zipfile.ZipFile('tools/secondary-bench/common/triage/regression-inputs-r16.zip') as z:
        commands={r['id']:json.loads(z.read(r['member'])) for r in lock['manifest']['inputs']}
        fixtures={f['sha256']:json.loads(z.read(f['member'])) for c in commands.values() for f in c['fixtures']}
    for worker in range(8):
        candidates=list(Path(f'download/r16-worker-{worker}').rglob('TASK.json'));require(len(candidates)==1,'worker evidence '+str(worker));root=candidates[0].parent
        base.snapshot(root);task=read(root/'TASK.json');require(read(root/'LOCK.json')==lock,'worker lock')
        raw=[json.loads(l) for l in (root/'part/raw.jsonl').read_text().splitlines()];starts={r['executionAttemptId']:r for r in map(json.loads,(root/'part/starts.jsonl').read_text().splitlines())}
        require(len(raw)==len(task['calls'])==2,'paired calls');require([r['variant'] for r in raw]==[c['variant'] for c in task['calls']],'order')
        require(list((root/'diagnostic-traces').glob('*.jsonl')),'missing boundary traces')
        for r,c in zip(raw,task['calls']):
            rows.append(r)
            try:
                require(all(r.get(k)==v for k,v in c.items()),'call identity');require(r['callId'] not in seen,'duplicate');seen.add(r['callId'])
                require(all(r.get(k)==v for k,v in starts[r['executionAttemptId']].items()),'durable start')
                e=r['execution'];require(e==read(root/'part'/r['executionAttemptId']/'SCOPE_COMPLETE.json'),'scope parity');require(e['reaped'],'reclamation')
                require(e['memoryScope']['memoryMax']==3*1024**3 and e['memoryScope']['swapMax']==0,'scope limit')
                require(r['status'] in ['EXACT','OOM','TIMEOUT_CALL'],'safe status')
                if r['status']=='EXACT':
                    v=e['result']['verified'];command=commands[r['inputId']];require(set(v)==set(command['filters']),'filter coverage')
                    for filter,value in v.items():
                        ref=next((f for f in command['fixtures'] if f['filter']==filter),None)
                        if ref:
                            f=fixtures[ref['sha256']];index={k:i for i,k in enumerate(f['keys'])};require(value['qualityVector']==base.vector(f,[index[k] for k in value['keys']]),'weighted witness')
                        else:require(value==dict(keys=[],qualityVector=[],count=0),'empty result')
                    h=base.digest(v);require(witnesses.setdefault(r['inputId'],h)==h,'cross-arm/repeat witness')
                else:require(r['ms'] is None,'censored time')
            except Exception as e:errors.append(dict(callId=r['callId'],error=str(e)))
    require(len(rows)==16,'stage completeness')
except Exception as e:errors.append(dict(error=str(e)))
db=sqlite3.connect(out/'RAW.sqlite');db.execute('CREATE TABLE records(raw TEXT)');db.executemany('INSERT INTO records VALUES(?)',[(base.encode(r),) for r in rows]);db.commit();db.close()
report=dict(status='FAIL' if errors else 'PASS',errors=errors,calls=len(rows),statuses=dict(collections.Counter(r['status'] for r in rows)),scope='R16_ANCHOR_ONLY',solverCalls=0,performanceDecision='AUTHORED_REVIEW_REQUIRED',factorialAutoDispatch=False)
(out/'AUDIT.json').write_text(base.encode(report)+'\n',encoding='utf8');print(base.encode(report));raise SystemExit(bool(errors))
