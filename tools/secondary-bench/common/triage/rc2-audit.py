"""Independent saved-evidence audit of all RC2 rounds. No solver replay."""
import collections,importlib.util,json,os,sqlite3,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('independent-audit.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
read=base.read;require=base.require
CAMPAIGN='RC2_LINMAX_RELEASE_VALIDATION_R18_20261012'

def expected_blocks(inputs):
    blocks=[]
    for round in [1,2,3]:
        phase=f'RC2_VALIDATION_{round}'
        for repeat in [1,2]:
            refs=sorted(inputs,key=lambda f:base.digest(dict(seed='r18-order-v1',round=round,id=f['id'])))
            tasks=[]
            for ref in refs:
                id=f"{phase}-{repeat}-{base.digest(ref['id'])[:24]}"
                first=int(base.digest(dict(seed='r18-arms-v1',round=round,id=ref['id']))[:2],16)%2
                arms=['DEV','RC2'] if first==repeat-1 else ['RC2','DEV'];calls=[]
                for position,variant in enumerate(arms):
                    identity=dict(campaignId=CAMPAIGN,phase=phase,taskId=id,inputId=ref['id'],inputHash=ref['sha256'],variant=variant,repeat=repeat,block=repeat,position=position,role=ref['metadata']['dataset'],measurementEpoch=18)
                    calls.append(dict(**identity,callId=base.digest(identity),limits=dict(startupMs=10000,callMs=600000,reapMs=5000)))
                tasks.append(dict(id=id,phase=phase,adapter='triage-fixture',calls=calls,worstMs=1280000))
            for start in range(0,130,10):blocks.append(dict(round=round,repeat=repeat,index=(repeat-1)*13+start//10,tasks=tasks[start:start+10]))
    return blocks

def audit():
    out=Path('audit');out.mkdir();errors=[];seen=set();witnesses={};statuses=collections.Counter();pairs=0
    db=sqlite3.connect(out/'RAW.sqlite');db.execute('CREATE TABLE records(call_id TEXT PRIMARY KEY,input_id TEXT,phase TEXT,raw TEXT)')
    try:
        activation=Path('download')/('triage-lock-'+CAMPAIGN);base.snapshot(activation);lock=read(activation/'LOCK.json');m=lock['manifest']
        require(base.digest(m)==lock['manifestHash'],'manifest');require(m['maxParallel']==12 and m['maxCalls']==1560,'budget')
        require(m['diagnosticPatches']==0,'uninstrumented');require(base.sha(activation/'INPUTS.zip')==m['inputZipSha256'],'archive hash')
        blocks=read(activation/'BLOCKS.json');require(blocks==expected_blocks(m['inputs']),'independent schedule')
        expected=[c for b in blocks for t in b['tasks'] for c in t['calls']]
        require(read(activation/'STAGE_PLAN.json')['expectedCalls']==expected,'plan parity');require(len(expected)==1560,'expected count')
        with zipfile.ZipFile(activation/'INPUTS.zip') as z:
            commands={}
            for ref in m['inputs']:
                data=z.read(ref['member']);require(base.hashlib.sha256(data).hexdigest()==ref['sha256'],'command hash');commands[ref['id']]=json.loads(data)
            for block in blocks:
                round,index=block['round'],block['index'];root=Path('download')/f'triage-data-{CAMPAIGN}-worker-{round}-{index}'
                base.snapshot(root);require(read(root/'LOCK.json')==lock and read(root/'BLOCK.json')==block,'worker identity')
                require(base.sha(root/'PRODUCTS.json')==m['productsSha256'],'product hashes')
                environment=read(root/'ENVIRONMENT.json');require(environment['node']=='v24.13.0','node runtime')
                for position,task in enumerate(block['tasks']):
                    directory=root/f'part-{position}';snap=base.snapshot(directory);require(read(directory/'TASK.json')==task,'task parity')
                    receipt=read(root/f'transport/part-{position}.json');require(receipt['status']=='UPLOADED' and receipt['checkpointId']==snap['checkpointId'],'receipt')
                    remote=Path('download')/receipt['attempts'][-1]['name'];require(base.snapshot(remote)==snap,'remote checkpoint parity')
                    raw=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()];starts=[json.loads(l) for l in (directory/'starts.jsonl').read_text().splitlines()]
                    require(len(raw)==len(starts)==2,'pair completeness')
                    require(raw[0]['runnerId']==raw[1]['runnerId'],'same VM pair');pairs+=1
                    for r,start,c in zip(raw,starts,task['calls']):
                        require(all(r.get(k)==v for k,v in c.items()),'call identity');require(r['callId'] not in seen,'duplicate call');seen.add(r['callId'])
                        require(all(r.get(k)==v for k,v in start.items()),'start parity')
                        e=r['execution'];require(e==read(directory/r['executionAttemptId']/'SCOPE_COMPLETE.json'),'scope parity');require(e['reaped'],'reclamation')
                        require(e['memoryScope']['memoryMax']==3*1024**3 and e['memoryScope']['swapMax']==0,'scope memory')
                        require(r['status'] in ['EXACT','TIMEOUT_CALL','OOM'],'valid execution status');statuses[r['status']]+=1
                        require(r['condition']==m['profileContract'],'profile identity')
                        if r['status']=='EXACT':
                            result=e['result'];v=result['verified'];command=commands[r['inputId']];require(set(v)==set(command['filters']),'filter coverage')
                            require(result['proof']['engineExact'] is True and result['qualityResolved']=='true','exact proof')
                            for filter,value in v.items():
                                fref=next((f for f in command['fixtures'] if f['filter']==filter),None)
                                if fref:
                                    data=z.read(fref['member']);require(base.hashlib.sha256(data).hexdigest()==fref['sha256'],'fixture hash')
                                    f=json.loads(data);indexKeys={k:i for i,k in enumerate(f['keys'])}
                                    require(value['count']==f['K'] and value['qualityVector']==base.vector(f,[indexKeys[k] for k in value['keys']]),'weighted witness')
                                else:require(value==dict(keys=[],qualityVector=[],count=0),'empty result')
                            h=base.digest(v);require(witnesses.setdefault(r['inputId'],h)==h,'cross-arm/round/repeat witness')
                            require(r['ms']==result['policySettledMs'] and r['ms']>0,'product timing')
                        else:require(r['ms'] is None,'censored time')
                        db.execute('INSERT INTO records VALUES(?,?,?,?)',(r['callId'],r['inputId'],r['phase'],base.encode(r)))
            require(seen=={c['callId'] for c in expected},'call coverage')
    except Exception as error:errors.append(dict(error=str(error),type=type(error).__name__))
    db.commit();db.close()
    report=dict(status='FAIL' if errors else 'PASS',errors=errors,calls=len(seen),pairs=pairs,statuses=dict(statuses),solverCalls=0,automaticPromotion=False,performanceDecision='AUTHORED_REVIEW_REQUIRED',scope='RC2_VALIDATION_1_2_3')
    (out/'INDEPENDENT_AUDIT.json').write_text(base.encode(report)+'\n',encoding='utf8')
    (out/'REPORT.json').write_text(base.encode(dict(executionCompleteness='COMPLETE' if not errors and len(seen)==1560 else 'INCOMPLETE',decision='AUTHORED_REVIEW_REQUIRED',calls=len(seen),performancePass=None))+'\n',encoding='utf8')
    print(base.encode(report))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf8') as stream:stream.write('## RC2 independent audit\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n')
    return bool(errors)
if __name__=='__main__':raise SystemExit(audit())
