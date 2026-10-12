"""Independent P/C/M schedule, receipt, scope and weighted witness audit. Solver0."""
import collections,importlib.util,json,sqlite3,zipfile,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('independent-audit.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
read=base.read;require=base.require
CAMPAIGN='RC_REGRESSION_R17_FACTORIAL_20261012';PHASE='R17_FACTORIAL'
out=Path('audit');out.mkdir();errors=[];rows=[];seen=set();witnesses={}
try:
    activation=Path('download')/('triage-lock-'+CAMPAIGN);base.snapshot(activation);lock=read(activation/'LOCK.json');m=lock['manifest']
    require(base.digest(m)==lock['manifestHash'],'manifest');require(m['maxParallel']==12 and m['maxCalls']==64,'budget')
    require(base.sha(Path('tools/secondary-bench/common/triage/regression-inputs-r16.zip'))==m['inputZipSha256'],'input archive')
    blocks=read(activation/'BLOCKS.json');require(len(blocks)==8,'block count')
    with zipfile.ZipFile('tools/secondary-bench/common/triage/regression-inputs-r16.zip') as z:
        commands={};fixtures={}
        for ref in m['inputs']:
            require(base.hashlib.sha256(z.read(ref['member'])).hexdigest()==ref['sha256'],'command bytes');c=json.loads(z.read(ref['member']));commands[ref['id']]=c
            for f in c['fixtures']:
                require(base.hashlib.sha256(z.read(f['member'])).hexdigest()==f['sha256'],'fixture bytes');fixtures[f['sha256']]=json.loads(z.read(f['member']))
    for chunk,block in enumerate(blocks):
        require(block['index']==chunk and block['input']==chunk//2 and block['repeat']==chunk%2+1,'VM block')
        ref=m['inputs'][block['input']]
        order=sorted(m['arms'],key=lambda a:base.digest(dict(seed='r17-pcm-v1',inputId=ref['id'],arm=a)))
        if block['repeat']==2:order.reverse()
        root=Path('download')/f'triage-data-{CAMPAIGN}-worker-{chunk}';base.snapshot(root)
        require(read(root/'LOCK.json')==lock and read(root/'BLOCK.json')==block,'worker provenance')
        require(base.sha(root/'FACTOR_PATCHES.json')==m['factorPatchSha256'],'product patch hashes')
        environment=read(root/'ENVIRONMENT.json');require(environment['node']=='v24.13.0','node version')
        for position,(task,arm) in enumerate(zip(block['tasks'],order)):
            require(len(task['calls'])==1 and task['calls'][0]['variant']==arm,'arm order')
            c=task['calls'][0];require(c['inputId']==ref['id'] and c['inputHash']==ref['sha256'] and c['repeat']==block['repeat'],'input/repeat')
            identity={k:v for k,v in c.items() if k not in ['callId','limits']};require(base.digest(identity)==c['callId'],'call hash')
            directory=root/f'part-{position}';snap=base.snapshot(directory);require(read(directory/'TASK.json')==task,'task')
            receipt=read(root/f'transport/part-{position}.json');require(receipt['status']=='UPLOADED' and receipt['checkpointId']==snap['checkpointId'],'receipt')
            # Native SDK receipt points to the durable per-call checkpoint, independently downloaded below.
            attempt=receipt['attempts'][-1];checkpoint=Path('download')/attempt['name'];require(base.snapshot(checkpoint)==snap,'remote checkpoint parity')
            raw=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()];starts=[json.loads(l) for l in (directory/'starts.jsonl').read_text().splitlines()]
            require(len(raw)==len(starts)==1,'one durable execution');r=raw[0];rows.append(r)
            require(all(r.get(k)==v for k,v in c.items()),'call identity');require(r['callId'] not in seen,'duplicate');seen.add(r['callId'])
            require(all(r.get(k)==v for k,v in starts[0].items()),'start parity')
            e=r['execution'];require(e==read(directory/r['executionAttemptId']/'SCOPE_COMPLETE.json'),'scope parity');require(e['reaped'],'reclamation')
            require(e['memoryScope']['memoryMax']==3*1024**3 and e['memoryScope']['swapMax']==0,'scope limit')
            require(r['status'] in ['EXACT','OOM','TIMEOUT_CALL'],'safe status')
            require(list((directory/'diagnostic-traces').glob('*.jsonl')),'boundary traces')
            if r['status']=='EXACT':
                v=e['result']['verified'];command=commands[r['inputId']];require(set(v)==set(command['filters']),'filter coverage')
                for filter,value in v.items():
                    fref=next((f for f in command['fixtures'] if f['filter']==filter),None)
                    if fref:
                        f=fixtures[fref['sha256']];index={k:i for i,k in enumerate(f['keys'])};require(value['qualityVector']==base.vector(f,[index[k] for k in value['keys']]),'weighted witness')
                    else:require(value==dict(keys=[],qualityVector=[],count=0),'empty result')
                h=base.digest(v);require(witnesses.setdefault(r['inputId'],h)==h,'cross-arm/repeat exact witness')
            else:require(r['ms'] is None,'censoring')
    require(len(rows)==64,'completeness')
    require({r['callId'] for r in rows}=={c['callId'] for c in read(activation/'STAGE_PLAN.json')['expectedCalls']},'frozen plan parity')
except Exception as e:errors.append(dict(error=str(e)))
db=sqlite3.connect(out/'RAW.sqlite');db.execute('CREATE TABLE records(raw TEXT)');db.executemany('INSERT INTO records VALUES(?)',[(base.encode(r),) for r in rows]);db.commit();db.close()
report=dict(status='FAIL' if errors else 'PASS',errors=errors,calls=len(rows),statuses=dict(collections.Counter(r['status'] for r in rows)),scope=PHASE,solverCalls=0,performanceDecision='AUTHORED_REVIEW_REQUIRED',automaticPromotion=False)
(out/'INDEPENDENT_AUDIT.json').write_text(base.encode(report)+'\n',encoding='utf8');print(base.encode(report))
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf8') as stream:stream.write('## R17 independent audit\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n')
raise SystemExit(bool(errors))
