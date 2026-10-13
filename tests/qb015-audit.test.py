"""Sixteen synthetic calls, then a resealed wrong witness. Solver0."""
import hashlib,importlib.util,json,os,shutil,sqlite3,subprocess,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit',ROOT/'tools/secondary-bench/common/triage/qb015-audit.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
base=a.base
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(base.encode(v)+'\n',encoding='utf8')
def seal(p):
    ms=[dict(path=f.relative_to(p).as_posix(),bytes=f.stat().st_size,sha256=base.sha(f)) for f in sorted(p.rglob('*')) if f.is_file() and f!=p/'SNAPSHOT.json']
    s=dict(identity=dict(name=p.name),members=ms);s['checkpointId']=base.digest(s);write(p/'SNAPSHOT.json',s);return s
class Tests(unittest.TestCase):
    def test_full_then_resealed_bad_witness(self):
        preferred=Path('C:/Users/2004a/AppData/Local/Temp/opencode')
        with tempfile.TemporaryDirectory(dir=preferred if preferred.exists() else None) as tmp:
            root=Path(tmp);activation=root/'download'/('triage-lock-'+a.CAMPAIGN);activation.mkdir(parents=True)
            f=dict(K=1,keys=['a','b'],rows=[[[0,1],[1,2]]]);fb=base.encode(f).encode();c=dict(filters=['I'],fixtures=[dict(filter='I',member='f.json',sha256=hashlib.sha256(fb).hexdigest())]);cb=base.encode(c).encode()
            ref=dict(id='c7-2plus2-qb-row-015/restricted-split',sha256=hashlib.sha256(cb).hexdigest(),member='c.json')
            with zipfile.ZipFile(activation/'INPUTS.zip','w') as z:z.writestr('c.json',cb);z.writestr('f.json',fb)
            write(activation/'QB015_PATCHES.json',[])
            m=dict(maxCalls=16,maxParallel=2,maxRunnerHours=6,inputs=[ref],inputZipSha256=base.sha(activation/'INPUTS.zip'),productPatchSha256=base.sha(activation/'QB015_PATCHES.json'),profileContract={'synthetic':True})
            lock=dict(manifest=m,manifestHash=base.digest(m));write(activation/'LOCK.json',lock);blocks=[];allcalls=[];first=None
            for chunk in [0,1]:
                calls=a.expected(ref,chunk+1);allcalls+=calls;block=dict(index=chunk,repeat=chunk+1,tasks=[dict(id=c['taskId'],calls=[c]) for c in calls]);blocks.append(block)
                worker=root/'download'/f'triage-data-{a.CAMPAIGN}-worker-{chunk}';write(worker/'LOCK.json',lock);write(worker/'BLOCK.json',block);write(worker/'QB015_PATCHES.json',[]);write(worker/'ENVIRONMENT.json',dict(node='v24.13.0'))
                for position,task in enumerate(block['tasks']):
                    c=task['calls'][0];directory=worker/f'part-{position}';start=dict(**c,executionAttemptId=c['callId']);result=dict(proof=dict(engineExact=True),qualityResolved='true',policySettledMs=10,verified=dict(I=dict(count=1,keys=['b'],qualityVector=[2])))
                    e=dict(reaped=True,memoryScope=dict(memoryMax=3*1024**3,swapMax=0),result=result)
                    r=dict(**start,status='EXACT',ms=10,condition=m['profileContract'],execution=e)
                    write(directory/'TASK.json',task);write(directory/'raw.jsonl',r);write(directory/'starts.jsonl',start);write(directory/c['callId']/'SCOPE_COMPLETE.json',e);write(directory/'diagnostic-traces/events.jsonl',dict(event='synthetic'))
                    snap=seal(directory);name=f'triage-data-{a.CAMPAIGN}-{chunk}-{position}';remote=root/'download'/name;shutil.copytree(directory,remote)
                    receipt=worker/f'transport/part-{position}.json';write(receipt,dict(status='UPLOADED',checkpointId=snap['checkpointId'],attempts=[dict(name=name)]))
                    if first is None:first=(worker,directory,remote,receipt,c['callId'])
                seal(worker)
            write(activation/'BLOCKS.json',blocks);write(activation/'STAGE_PLAN.json',dict(expectedCalls=allcalls));seal(activation)
            cmd=['python','-B',str(ROOT/'tools/secondary-bench/common/triage/qb015-audit.py')];subprocess.run(cmd,cwd=root,check=True,capture_output=True)
            self.assertEqual(base.read(root/'audit/INDEPENDENT_AUDIT.json')['calls'],16)
            shutil.rmtree(root/'audit');worker,directory,remote,receipt,id=first;r=base.read(directory/'raw.jsonl');r['execution']['result']['verified']['I']['qualityVector']=[1];write(directory/'raw.jsonl',r);write(directory/id/'SCOPE_COMPLETE.json',r['execution'])
            snap=seal(directory);shutil.rmtree(remote);shutil.copytree(directory,remote);v=base.read(receipt);v['checkpointId']=snap['checkpointId'];write(receipt,v);seal(worker)
            result=subprocess.run(cmd,cwd=root,capture_output=True);self.assertNotEqual(result.returncode,0);self.assertEqual(base.read(root/'audit/INDEPENDENT_AUDIT.json')['errors'][0]['error'],'weighted witness')
if __name__=='__main__':unittest.main()
