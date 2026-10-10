"""Independent product-command schedule, transport, scope and weighted witness audit."""
import argparse,collections,datetime,importlib.util,json,sqlite3
from pathlib import Path
spec=importlib.util.spec_from_file_location('common_audit',Path(__file__).with_name('independent-audit.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
read=base.read;sha=base.sha;digest=base.digest;require=base.require;encode=base.encode
PHASES=['RC_INITIAL_1','RC_INITIAL_2','RC_INITIAL_3','RC_CONFIRMATION_1','RC_CONFIRMATION_2']
def compile_calls(m,templates,phase,selected=None):
    refs={r['id']:r for r in m['inputs']};tasks=[]
    for t in templates:
        if t['phase']!=phase or t['conditional'] and t['fixture_ids'][0] not in (selected or []):continue
        fid=t['fixture_ids'][0];require(len(t['fixture_ids'])==1 and t['block'] in [1,2] and sorted(t['arms'])==['DEV','RC'],'task contract')
        calls=[]
        for position,variant in enumerate(t['arms']):
            identity=dict(campaignId=m['campaignId'],phase=phase,taskId=t['task_id'],inputId=fid,inputHash=refs[fid]['sha256'],variant=variant,
                repeat=t['block'],block=t['block'],position=position,role=refs[fid]['metadata']['dataset'],measurementEpoch=15)
            calls.append(dict(**identity,callId=digest(identity),limits=dict(startupMs=10000,callMs=600000,reapMs=5000)))
        tasks.append(calls)
    return tasks
def chunks(tasks,job):
    return [c for block in [1,2] for c in base.chunks([t for t in tasks if t[0]['block']==block],job)]
def med(xs):
    s=sorted(xs);return (s[(len(s)-1)//2]+s[len(s)//2])/2 if s else None
def selection(m,rows):
    initial=[r for r in rows if r['phase'].startswith('RC_INITIAL_')];require(len(initial)==13176,'initial selection population incomplete')
    selected=set(m['integration']['mandatoryConfirmation']);metrics=[]
    for f in m['inputs']:
        rs=[r for r in initial if r['inputId']==f['id']];require(len(rs)==12,'input repeats')
        times={'DEV':[],'RC':[]};ratios=[];deltas=[]
        for phase in PHASES[:3]:
            for block in [1,2]:
                pair=[r for r in rs if r['phase']==phase and r['block']==block];require(len(pair)==2,'pair incomplete')
                b=next(r for r in pair if r['variant']=='DEV');c=next(r for r in pair if r['variant']=='RC')
                require(b['runnerId']==c['runnerId'],'unpaired runner')
                for r in pair:
                    if r['status']=='EXACT':times[r['variant']].append(r['ms'])
                if b['status']!=c['status']:selected.add(f['id'])
                if b['status']==c['status']=='EXACT':
                    require(b['execution']['result']['verified']==c['execution']['result']['verified'],'pair witness mismatch')
                    ratios.append(c['ms']/b['ms']);deltas.append(c['ms']-b['ms'])
        if len({r['status'] for r in rs})>1:selected.add(f['id'])
        if any(len(v)>1 and max(v)/min(v)>1.1 for v in [times['DEV'],times['RC'],ratios]):selected.add(f['id'])
        metrics.append(dict(inputId=f['id'],population=f['metadata']['dataset'],ratio=med(ratios) if len(ratios)==6 else None,deltaMs=med(deltas) if len(deltas)==6 else None))
    import math
    for pop in ['ALL','PER_SAVE']:
        for metric in ['deltaMs','ratio']:
            ordered=sorted([r for r in metrics if r['population']==pop and r[metric] is not None],key=lambda r:(r[metric],r['inputId']))
            n=math.ceil(len(ordered)*.1)
            selected.update(r['inputId'] for r in ordered[:n]+(ordered[-n:] if n else []))
    return selected
def audit(config,history,out):
    out.mkdir(parents=True,exist_ok=False);errors=[];missing=[];normal=[]
    def error(where,e):errors.append(dict(where=where,error=str(e)))
    lock=read(config/'LOCK.json');m=read(config/'MANIFEST.json')
    require(m==lock['manifest'] and digest(m)==lock['manifestHash'],'manifest binding')
    require(lock['endMs']==lock['originMs']+21*86400000,'new authorized RC clock')
    require(m['integration']['id']=='rc-dev-product-v1' and m['maxCalls']==21960 and m['maxParallel']==16,'authorized RC scope')
    require(m['maxRunnerHours']==5381 and 920*350/60+13.5<=5381,'runner hour reserve')
    require(sha(config/'PRIOR_ACCOUNTING.json')==m['integration']['priorAccountingSha256'],'prior accounting bytes')
    require(sha(config/'TASKS.jsonl')==m['tasksHash'],'template hash');templates=[json.loads(l) for l in (config/'TASKS.jsonl').read_text().splitlines()]
    require(len(templates)==10980,'full five-round templates')
    refs={r['id']:r for r in m['inputs']};require(len(refs)==1098,'population uniqueness')
    require(collections.Counter(r['metadata']['dataset'] for r in refs.values())=={'ALL':548,'PER_SAVE':550},'named populations')
    for phase in PHASES:
        for block in [1,2]:
            ts=[t for t in templates if t['phase']==phase and t['block']==block]
            require(len(ts)==1098 and {t['fixture_ids'][0] for t in ts}==set(refs),'full per-round census')
            require(all(t['conditional']==phase.startswith('RC_CONFIRMATION') for t in ts),'conditional phase identity')
        first={t['fixture_ids'][0]:t for t in templates if t['phase']==phase and t['block']==1}
        require(all(t['arms']==first[t['fixture_ids'][0]]['arms'][::-1] for t in templates if t['phase']==phase and t['block']==2),'AB/BA counterbalance')
    for group in ['product','harness']:
        for name,h in m['sourceFiles'][group].items():
            data=base.member(Path.cwd(),name).read_bytes()
            if name.startswith(('src/','wasm/')) or name in ['package.json','package-lock.json']:
                if b'\0' not in data:
                    try:data.decode();data=data.replace(b'\r\n',b'\n')
                    except UnicodeDecodeError:pass
            import hashlib
            require(hashlib.sha256(data).hexdigest()==h,'source hash '+name)
    commands={};fixtures={}
    for fid,ref in refs.items():
        file=base.member(config,ref['member']);require(sha(file)==ref['sha256'],'command hash')
        c=read(file);commands[fid]=c;require(c['command']['id']==fid,'command identity')
        require(c['command']['queueLength']==c['command']['piecesNeeded']+1 and c['command']['queueLength']!=11,'N+1 and 11P exclusion')
        require(c['command']['useHold'] is True and c['command']['clear']==4,'original hold/clear')
        for f in c['fixtures']:
            if f['sha256'] in fixtures:continue
            file=base.member(config,f['member']);require(sha(file)==f['sha256'],'original fixture bytes');v=read(file)
            require(v['id']==f['id'] and v['cardinalityProof']['status']=='PROVEN','original K proof')
            require(v['origin']['command']['id']==fid and v['origin']['filter']==f['filter'],'fixture command membership')
            require(len(v['keys'])==len(set(v['keys'])) and v['keys']==sorted(v['keys']),'stable keys')
            base.vector(v,v['seed']);fixtures[f['sha256']]=v
    base.snapshot(config)
    db=sqlite3.connect(out/'AUDIT_INDEX.sqlite');db.executescript('CREATE TABLE records(call_id TEXT PRIMARY KEY,input_id TEXT,phase TEXT,raw TEXT,checkpoint TEXT);CREATE TABLE starts(attempt TEXT PRIMARY KEY,raw TEXT,checkpoint TEXT);')
    snaps={};dirs={};plans={};selections={};receipts=[];environments={}
    if not (history/'DOWNLOAD_COMPLETE.json').is_file():missing.append('DOWNLOAD_COMPLETE.json')
    else:
        d=read(history/'DOWNLOAD_COMPLETE.json')
        if d['errors'] or d['downloaded']!=d['selected']:missing.append('partial download')
    inventory={a['id']:a for a in read(history/'DOWNLOAD_INDEX.json')['artifacts']} if (history/'DOWNLOAD_INDEX.json').exists() else {}
    for file in sorted(history.rglob('SNAPSHOT.json')):
        try:
            s=base.snapshot(file.parent);require(s['identity']['campaignId']==m['campaignId'],'foreign campaign snapshot')
            require(s['identity'].get('invocationId')==lock['invocationId'],'foreign invocation snapshot')
            snaps[s['checkpointId']]=s;dirs[s['checkpointId']]=file.parent
            for name,table,key in [('raw.jsonl','records','callId'),('starts.jsonl','starts','executionAttemptId')]:
                p=file.parent/name
                if not p.exists():continue
                require(not p.stat().st_size or p.read_bytes().endswith(b'\n'),'torn append')
                for line in p.read_text().splitlines(keepends=True):
                    r=json.loads(line);column='call_id' if table=='records' else 'attempt'
                    old=db.execute(f'SELECT raw,checkpoint FROM {table} WHERE {column}=?',(r[key],)).fetchone()
                    if old:require(old==(line,s['checkpointId']),'conflicting duplicate');continue
                    if table=='records':db.execute('INSERT INTO records VALUES(?,?,?,?,?)',(r[key],r['inputId'],r['phase'],line,s['checkpointId']))
                    else:db.execute('INSERT INTO starts VALUES(?,?,?)',(r[key],line,s['checkpointId']))
            for name,target,key in [('STAGE_PLAN.json',plans,'phase'),('SELECTION.json',selections,'phase'),('ENVIRONMENT.json',environments,'runnerId')]:
                if (file.parent/name).exists():
                    v=read(file.parent/name);require(v[key] not in target,'duplicate '+name);target[v[key]]=v
            if (file.parent/'TRANSPORT_COMPLETE.json').exists():receipts.append(read(file.parent/'TRANSPORT_COMPLETE.json'))
        except Exception as e:error(str(file),e)
    db.commit();rows=[json.loads(t) for (t,) in db.execute('SELECT raw FROM records')];expected={};locations={}
    for phase in PHASES:
        if phase not in plans:missing.append('plan/'+phase);continue
        try:
            plan=plans[phase];require(plan['manifestHash']==lock['manifestHash'],'stage owner')
            selected=None
            if phase.startswith('RC_CONFIRMATION'):
                selected=selection(m,rows);require(set(selections[phase]['selected'])==selected,'independent selection differs')
            tasks=compile_calls(m,templates,phase,selected);calls=[c for t in tasks for c in t]
            require(plan['expectedCalls']==calls,'independent schedule mismatch');cs=chunks(tasks,m['job'])
            require(plan['chunks']==len(cs)==len(plan['matrix']),'matrix count')
            for index,chunk in enumerate(cs):
                for part,task in enumerate(chunk):
                    for c in task:expected[c['callId']]=c;locations[c['callId']]=dict(phase=phase,chunk=index,part=part)
        except Exception as e:error('plan/'+phase,e)
    statuses=collections.Counter();witnesses=0;observed=set();consensus={};not_run=[]
    for text,checkpoint in db.execute('SELECT raw,checkpoint FROM records'):
        r=json.loads(text);statuses[r['status']]+=1
        try:
            c=expected[r['callId']];loc=locations[r['callId']];require(all(r.get(k)==v for k,v in c.items()),'call identity/limits')
            require(r['manifestHash']==lock['manifestHash'] and r['profileHash']==lock['profileHash'] and r['invocationId']==lock['invocationId'],'execution lock')
            require(r['condition']==m['profileContract'] and r['metadata']==refs[r['inputId']]['metadata'],'conditions/metadata')
            require(all(snaps[checkpoint]['identity'].get(k)==v for k,v in loc.items()),'checkpoint ownership')
            env=environments[r['runnerId']];require(env['node']=='v24.13.0' and env['platform']=='linux' and env['commit']==lock['commit'] and env['sourceVerified'] is True,'runtime/source')
            require(env['phase']==r['phase'] and env['chunk']==loc['chunk'],'runner chunk')
            if r['executionAttemptId'] is None:
                not_run.append(r['callId']);require(r['ms'] is None,'not-run time')
                if r['status']=='NOT_RUN_AFTER_OOM':
                    require(any(p['callId'] in locations and base.oom_skip_cause(r,p,loc,locations[p['callId']]) for p in rows),'unexplained OOM skip')
                    require(not db.execute('SELECT 1 FROM starts WHERE attempt=?',(digest(dict(invocation=lock['invocationId'],call=r['callId'])),)).fetchone(),'skip has durable start')
                    normal.append(r['callId'])
                continue
            attempt=digest(dict(invocation=lock['invocationId'],call=r['callId']));require(r['executionAttemptId']==attempt,'attempt identity')
            start=db.execute('SELECT raw FROM starts WHERE attempt=?',(attempt,)).fetchone();require(bool(start),'durable start missing')
            require(all(r.get(k)==v for k,v in json.loads(start[0]).items()),'start/raw mismatch');observed.add(attempt)
            e=r['execution'];require(e['reaped'] is True,'unreclaimed process');scope=e['memoryScope']
            require(scope['memoryMax']==3221225472 and scope['swapMax']==0,'scope limits')
            require(r['status'] in ['EXACT','INCOMPLETE','TIMEOUT_CALL','TIMEOUT_STARTUP','OOM'],'invalid/unsafe result')
            directory=dirs[checkpoint]/attempt;request=read(directory/'REQUEST.json')
            require(read(directory/'SCOPE_COMPLETE.json')==e,'scope/raw parity')
            require(scope['properties']['ActiveState'] in ['inactive','failed'],'scope still active')
            started=datetime.datetime.fromisoformat(r['startedUtc'].replace('Z','+00:00')).timestamp()*1000
            require(lock['originMs']<=started<lock['endMs'],'execution outside authorized clock')
            require(request['callId']==attempt and request['limits']==c['limits'],'scope request identity')
            require(request['job']['action']=='product-command' and request['job']['variant']==r['variant'] and request['job']['commandSha256']==c['inputHash'],'scope request arm/input')
            require(request['job']['productRoot'].endswith('/'+('dev-product' if r['variant']=='DEV' else 'rc-product')),'product root arm')
            if r['status']!='EXACT':require(r['ms'] is None,'censored time imputation');continue
            result=e['result'];require(r['ms']==result['policySettledMs'] and r['ms']>0,'product timing')
            require(result['proof']['witnessAudit']=='PASS' and result['proof']['engineExact'] is True,'product proof flags')
            command=commands[r['inputId']];require(set(result['verified'])==set(command['filters']),'filter coverage')
            for filter,v in result['verified'].items():
                ref=next((f for f in command['fixtures'] if f['filter']==filter),None)
                require(result['outcomes'][filter]['humanQualityExact'] is True,'exact quality flag')
                if ref:
                    f=fixtures[ref['sha256']];index={k:i for i,k in enumerate(f['keys'])};require(v['keys']==sorted(set(v['keys'])),'canonical selected keys')
                    require(v['count']==f['K'] and v['qualityVector']==base.vector(f,[index[k] for k in v['keys']]),'original weighted witness')
                else:require(v==dict(keys=[],qualityVector=[],count=0) and result['outcomes'][filter]['success']==0,'empty save result')
            signature=digest(result['verified']);require(consensus.setdefault(r['inputId'],signature)==signature,'cross-arm/repetition witness mismatch')
            events=[json.loads(l) for l in (directory/'events.jsonl').read_text().splitlines()]
            returned=[v['record'] for v in events if v.get('event')=='result'];require(len(returned)==1 and returned[0]==result,'IPC result parity')
            require(sum(v.get('event')=='ready' for v in events)==1,'IPC ready missing');witnesses+=1
        except Exception as e:error(r.get('callId','raw'),e)
    missing.extend('result/'+cid for cid in expected if not any(r['callId']==cid for r in rows))
    missing.extend('unresolved-start/'+a for (a,) in db.execute('SELECT attempt FROM starts') if a not in observed)
    delivered=set()
    for report in receipts:
        for r in report.get('receipts',[]):
            try:
                require(r['status']=='UPLOADED' and r['checkpointId'] in snaps,'receipt checkpoint')
                backend=inventory[r['artifactId']];require(backend['digest']==r['artifactDigest'],'backend receipt digest')
                require(r['identity']==snaps[r['checkpointId']]['identity'],'receipt identity');delivered.add(r['checkpointId'])
            except Exception as e:error('receipt',e)
    for (checkpoint,) in db.execute('SELECT DISTINCT checkpoint FROM records'):
        if checkpoint not in delivered:missing.append('receipt/'+checkpoint)
    status=base.evidence_status(errors,missing,not_run,normal)
    report=dict(schemaVersion=1,status=status,role='INDEPENDENT_PYTHON_PRODUCT_COMMAND_AUDIT',phase='ALL',
        fixtureFilesChecked=len(fixtures),witnessRecordsChecked=witnesses,observedCalls=len(rows),scheduledCalls=len(expected),
        statusCounts=dict(statuses),errors=errors,missing=missing,notRun=not_run,normalOomSkips=normal,solverCalls=0,
        executionCompleteness='COMPLETE' if status=='PASS' else 'INCOMPLETE',performancePass=False,decisionStatus='AUTHORED_REVIEW_REQUIRED',
        phaseCompleteness=[dict(phase=p,planned=p in plans,scheduled=len([c for c in expected.values() if c['phase']==p]),observed=len([r for r in rows if r['phase']==p])) for p in PHASES])
    db.close();(out/'INDEPENDENT_AUDIT.json').write_text(encode(report)+'\n',encoding='utf8');(out/'REPORT.json').write_text(encode(report)+'\n',encoding='utf8')
    print(encode(report));return report
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['config','history','out']:p.add_argument('--'+n,type=Path,required=True)
    a=p.parse_args();r=audit(a.config,a.history,a.out);raise SystemExit(0 if r['status']=='PASS' else 1)
