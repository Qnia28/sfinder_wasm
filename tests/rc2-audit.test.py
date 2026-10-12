"""Full 1560-call synthetic archive plus resealed invalid-witness rejection. Solver0."""
import copy,hashlib,importlib.util,json,os,shutil,subprocess,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit',ROOT/'tools/secondary-bench/common/triage/rc2-audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
base=audit.base
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(base.encode(v)+'\n',encoding='utf8')
def seal(p):
    members=[dict(path=f.relative_to(p).as_posix(),bytes=f.stat().st_size,sha256=base.sha(f)) for f in sorted(p.rglob('*')) if f.is_file() and f!=p/'SNAPSHOT.json']
    v=dict(identity=dict(name=p.name),members=members);v['checkpointId']=base.digest(v);write(p/'SNAPSHOT.json',v);return v
class AuditTest(unittest.TestCase):
    def test_complete_and_resealed_bad_witness(self):
        preferred=Path('C:/Users/2004a/AppData/Local/Temp/opencode')
        with tempfile.TemporaryDirectory(prefix='rc2-audit-',dir=preferred if preferred.exists() else None) as tmp:
            root=Path(tmp);download=root/'download';activation=download/('triage-lock-'+audit.CAMPAIGN);activation.mkdir(parents=True)
            fixture=dict(K=1,keys=['a','b'],rows=[[[0,1],[1,2]],[[0,1],[1,2]]]);fb=base.encode(fixture).encode();fh=hashlib.sha256(fb).hexdigest()
            command=dict(filters=['ALL'],fixtures=[dict(filter='ALL',member='fixture.json',sha256=fh)]);cb=base.encode(command).encode();ch=hashlib.sha256(cb).hexdigest()
            inputs=[dict(id=f'input-{i}',sha256=ch,member='command.json',metadata=dict(dataset='ALL')) for i in range(130)]
            with zipfile.ZipFile(activation/'INPUTS.zip','w') as z:z.writestr('command.json',cb);z.writestr('fixture.json',fb)
            write(activation/'PRODUCTS.json',[]);m=dict(inputs=inputs,maxParallel=12,maxCalls=1560,diagnosticPatches=0,inputZipSha256=base.sha(activation/'INPUTS.zip'),productsSha256=base.sha(activation/'PRODUCTS.json'),profileContract=dict(test=True))
            lock=dict(manifest=m,manifestHash=base.digest(m));blocks=audit.expected_blocks(inputs);write(activation/'LOCK.json',lock);write(activation/'BLOCKS.json',blocks);write(activation/'STAGE_PLAN.json',dict(expectedCalls=[c for b in blocks for t in b['tasks'] for c in t['calls']]));seal(activation)
            first=None
            for b in blocks:
                worker=download/f"triage-data-{audit.CAMPAIGN}-worker-{b['round']}-{b['index']}";write(worker/'LOCK.json',lock);write(worker/'BLOCK.json',b);write(worker/'PRODUCTS.json',[]);write(worker/'ENVIRONMENT.json',dict(node='v24.13.0'))
                for part,t in enumerate(b['tasks']):
                    directory=worker/f'part-{part}';write(directory/'TASK.json',t);raw=[];starts=[]
                    for c in t['calls']:
                        start=dict(**c,executionAttemptId=c['callId'],runnerId=worker.name);starts.append(start)
                        result=dict(verified=dict(ALL=dict(keys=['b'],qualityVector=[2,2],count=1)),proof=dict(engineExact=True),qualityResolved='true',policySettledMs=10)
                        scope=dict(reaped=True,memoryScope=dict(memoryMax=3*1024**3,swapMax=0),result=result)
                        write(directory/c['callId']/'SCOPE_COMPLETE.json',scope)
                        raw.append(dict(**start,execution=scope,status='EXACT',ms=10,condition=m['profileContract']))
                    (directory/'raw.jsonl').write_text(''.join(base.encode(r)+'\n' for r in raw),encoding='utf8');(directory/'starts.jsonl').write_text(''.join(base.encode(r)+'\n' for r in starts),encoding='utf8')
                    snapshot=seal(directory);name=f"triage-data-{audit.CAMPAIGN}-{b['round']}-{b['index']}-{part}";shutil.copytree(directory,download/name)
                    receipt=worker/f'transport/part-{part}.json';write(receipt,dict(status='UPLOADED',checkpointId=snapshot['checkpointId'],attempts=[dict(name=name)]))
                    if first is None:first=(worker,directory,download/name,receipt)
                seal(worker)
            command=['python','-B',str(ROOT/'tools/secondary-bench/common/triage/rc2-audit.py')]
            subprocess.run(command,cwd=root,check=True,capture_output=True);report=base.read(root/'audit/INDEPENDENT_AUDIT.json');self.assertEqual(report['calls'],1560);self.assertEqual(report['status'],'PASS')
            shutil.rmtree(root/'audit');worker,directory,remote,receipt=first
            rows=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()];r=rows[0];r['execution']['result']['verified']['ALL']['qualityVector']=[1,1]
            write(directory/r['executionAttemptId']/'SCOPE_COMPLETE.json',r['execution']);(directory/'raw.jsonl').write_text(''.join(base.encode(r)+'\n' for r in rows),encoding='utf8')
            snapshot=seal(directory);shutil.rmtree(remote);shutil.copytree(directory,remote);v=base.read(receipt);v['checkpointId']=snapshot['checkpointId'];write(receipt,v);seal(worker)
            result=subprocess.run(command,cwd=root,capture_output=True);self.assertNotEqual(result.returncode,0);report=base.read(root/'audit/INDEPENDENT_AUDIT.json');self.assertEqual(report['errors'][0]['error'],'weighted witness')
if __name__=='__main__':unittest.main()
