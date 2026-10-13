"""Independent saved-evidence audit of the QB015 intervention blocks. Solver0."""
import collections,importlib.util,json,os,sqlite3,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('independent-audit.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
CAMPAIGN='QB015_CAUSAL_R19_20261013';PHASE='QB015_CAUSAL_R19'
ARMS=['R19_DEV','R19_RC2','R19_PROBE100K','R19_PROBE10K','R19_PROBE1K','R19_DISCARD100K','R19_CP120','R19_PROBE100K_CP120']
read=base.read;require=base.require
def expected(ref,repeat):
    order=sorted(ARMS,key=lambda arm:base.digest(dict(seed='qb015-r19-v1',arm=arm)))
    if repeat==2:order.reverse()
    calls=[]
    for position,variant in enumerate(order):
        identity=dict(campaignId=CAMPAIGN,phase=PHASE,taskId=f'{PHASE}-{repeat}-{position}',inputId=ref['id'],inputHash=ref['sha256'],variant=variant,repeat=repeat,block=repeat,position=position,role='PER_SAVE',measurementEpoch=19)
        calls.append(dict(**identity,callId=base.digest(identity),limits=dict(startupMs=10000,callMs=600000,reapMs=5000)))
    return calls
def audit():
    out=Path('audit');out.mkdir();errors=[];rows=[];starts=[];seen=set();witnesses={}
    try:
        activation=Path('download')/('triage-lock-'+CAMPAIGN);base.snapshot(activation);lock=read(activation/'LOCK.json');m=lock['manifest']
        require(base.digest(m)==lock['manifestHash'],'manifest');require(m['maxCalls']==16 and m['maxParallel']==2 and m['maxRunnerHours']==6,'budget')
        require(base.sha(activation/'INPUTS.zip')==m['inputZipSha256'],'input zip')
        require(base.sha(activation/'QB015_PATCHES.json')==m['productPatchSha256'],'activation products')
        ref=m['inputs'][0];require(len(m['inputs'])==1 and ref['id']=='c7-2plus2-qb-row-015/restricted-split','population')
        with zipfile.ZipFile(activation/'INPUTS.zip') as z:
            require(base.hashlib.sha256(z.read(ref['member'])).hexdigest()==ref['sha256'],'command hash');command=json.loads(z.read(ref['member']));fixtures={}
            for f in command['fixtures']:
                data=z.read(f['member']);require(base.hashlib.sha256(data).hexdigest()==f['sha256'],'fixture hash');fixtures[f['filter']]=json.loads(data)
        blocks=read(activation/'BLOCKS.json');require(len(blocks)==2,'blocks');expected_all=[]
        for chunk,block in enumerate(blocks):
            calls=expected(ref,chunk+1);expected_all+=calls
            require(block['index']==chunk and block['repeat']==chunk+1,'block identity')
            require([t['calls'][0] for t in block['tasks']]==calls and all(len(t['calls'])==1 for t in block['tasks']),'schedule')
            root=Path('download')/f'triage-data-{CAMPAIGN}-worker-{chunk}';base.snapshot(root)
            require(read(root/'LOCK.json')==lock and read(root/'BLOCK.json')==block,'worker provenance')
            require(base.sha(root/'QB015_PATCHES.json')==m['productPatchSha256'],'worker products')
            require(read(root/'ENVIRONMENT.json')['node']=='v24.13.0','node')
            for position,(task,c) in enumerate(zip(block['tasks'],calls)):
                directory=root/f'part-{position}';snap=base.snapshot(directory);require(read(directory/'TASK.json')==task,'task')
                receipt=read(root/f'transport/part-{position}.json');require(receipt['status']=='UPLOADED' and receipt['checkpointId']==snap['checkpointId'],'receipt')
                require(base.snapshot(Path('download')/receipt['attempts'][-1]['name'])==snap,'remote parity')
                raw=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()];ss=[json.loads(l) for l in (directory/'starts.jsonl').read_text().splitlines()]
                require(len(raw)==len(ss)==1,'one call');r=raw[0];rows.append(r);starts+=ss
                require(all(r.get(k)==v for k,v in c.items()) and all(r.get(k)==v for k,v in ss[0].items()),'identity')
                require(r['callId'] not in seen,'duplicate');seen.add(r['callId']);require(r['condition']==m['profileContract'],'profile')
                e=r['execution'];require(e==read(directory/r['executionAttemptId']/'SCOPE_COMPLETE.json') and e['reaped'],'scope parity/reap')
                require(e['memoryScope']['memoryMax']==3*1024**3 and e['memoryScope']['swapMax']==0,'memory')
                require(r['status'] in ['EXACT','OOM','TIMEOUT_CALL'],'status');require(list((directory/'diagnostic-traces').glob('*.jsonl')),'traces')
                if r['status']=='EXACT':
                    result=e['result'];require(result['proof']['engineExact'] and result['qualityResolved']=='true','proof')
                    v=result['verified'];require(set(v)==set(command['filters']),'piece coverage')
                    for piece,value in v.items():
                        f=fixtures[piece];index={k:i for i,k in enumerate(f['keys'])}
                        require(value['count']==f['K'] and len(value['keys'])==len(set(value['keys']))==f['K'],'cardinality')
                        require(value['qualityVector']==base.vector(f,[index[k] for k in value['keys']]),'weighted witness')
                    h=base.digest(v);require(witnesses.setdefault(ref['id'],h)==h,'stable-ID witness parity')
                    require(r['ms']==result['policySettledMs'] and r['ms']>0,'timing')
                else:require(r['ms'] is None,'censored')
        require(read(activation/'STAGE_PLAN.json')['expectedCalls']==expected_all and len(seen)==16,'coverage')
    except Exception as e:errors.append(dict(error=str(e),type=type(e).__name__))
    with sqlite3.connect(out/'AUDIT_INDEX.sqlite') as db:
        for name,values in [('records',rows),('starts',starts)]:
            db.execute(f'CREATE TABLE {name}(raw TEXT)');db.executemany(f'INSERT INTO {name} VALUES(?)',[(base.encode(r),) for r in values])
    report=dict(status='FAIL' if errors else 'PASS',errors=errors,calls=len(rows),statuses=dict(collections.Counter(r['status'] for r in rows)),scope=PHASE,solverCalls=0,automaticPromotion=False,performanceDecision='AUTHORED_REVIEW_REQUIRED')
    (out/'INDEPENDENT_AUDIT.json').write_text(base.encode(report)+'\n',encoding='utf8')
    (out/'REPORT.json').write_text(base.encode(dict(executionCompleteness='INCOMPLETE' if errors else 'COMPLETE',decision='AUTHORED_REVIEW_REQUIRED'))+'\n',encoding='utf8')
    print(base.encode(report))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf8') as stream:stream.write('## QB015 independent audit\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n')
    return bool(errors)
if __name__=='__main__':raise SystemExit(audit())
