"""Full independent audit on synthetic evidence; no product/solver invocation."""
import copy,importlib.util,json,os,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('productaudit',Path(__file__).resolve().parents[1]/'tools/secondary-bench/common/triage/product-audit.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(a.encode(v)+'\n',encoding='utf8')
def seal(p,identity):
    members=[dict(path=f.relative_to(p).as_posix(),bytes=f.stat().st_size,sha256=a.sha(f)) for f in sorted(p.rglob('*')) if f.is_file() and f.name!='SNAPSHOT.json']
    v=dict(identity=identity,members=members);v['checkpointId']=a.digest(v);write(p/'SNAPSHOT.json',v);return v
class ProductAudit(unittest.TestCase):
    def build(self,root):
        config=root/'config';history=root/'history';config.mkdir();history.mkdir();refs=[]
        f=dict(schema=1,id='input-0000/ALL',keys=['a','b'],rows=[[[0,2],[1,1]]],K=1,seed=[0],cardinalityProof=dict(status='PROVEN'),origin=dict(command=dict(id='input-0000'),filter='ALL'))
        write(config/'fixtures/f.json',f);fh=a.sha(config/'fixtures/f.json')
        for i in range(1098):
            fid=f'input-{i:04}';c=dict(command=dict(id=fid,queueLength=7,piecesNeeded=6,clear=4,useHold=True),filters=['ALL'],fixtures=[dict(id=f['id'],filter='ALL',sha256=fh,member='fixtures/f.json')] if i==0 else [])
            file=config/f'commands/{fid}.json';write(file,c)
            refs.append(dict(id=fid,sha256=a.sha(file),member=f'commands/{fid}.json',metadata=dict(dataset='ALL' if i<548 else 'PER_SAVE')))
        templates=[dict(phase=p,block=b,task_id=f'{p}-{b}-{r["id"]}',fixture_ids=[r['id']],conditional=p.startswith('RC_CONFIRMATION'),arms=['DEV','RC'] if b==1 else ['RC','DEV']) for p in a.PHASES for b in [1,2] for r in refs]
        (config/'TASKS.jsonl').write_text(''.join(a.encode(t)+'\n' for t in templates),encoding='utf8');write(config/'PRIOR_ACCOUNTING.json',dict(prior='preserved'))
        (root/'source.txt').write_text('source')
        job=dict(parts=12,jobMs=325*60000,reserveMs=5*60000,setupMs=10*60000,checkpointMs=2*60000,finalTransportMs=15*60000,transportAuditMs=3*60000,jobMinutes=350,scopeOverheadMs=20000)
        m=dict(campaignId='synthetic',inputs=refs,maxCalls=21960,maxParallel=16,maxRunnerHours=5381,job=job,
            integration=dict(id='rc-dev-product-v1',priorAccountingSha256=a.sha(config/'PRIOR_ACCOUNTING.json'),mandatoryConfirmation=[]),
            tasksHash=a.sha(config/'TASKS.jsonl'),sourceFiles=dict(product={'source.txt':a.sha(root/'source.txt')},harness={'source.txt':a.sha(root/'source.txt')}),profileContract=dict(test='synthetic'))
        write(config/'MANIFEST.json',m);origin=1791676800000
        lock=dict(manifest=m,manifestHash=a.digest(m),profileHash=a.digest(m['profileContract']),invocationId='test',commit='test',originMs=origin,endMs=origin+21*86400000)
        write(config/'LOCK.json',lock);seal(config,dict(campaignId='synthetic',invocationId='test',name='activation'))
        phase=a.PHASES[0];tasks=a.compile_calls(m,templates,phase);chunks=a.chunks(tasks,job)
        write(history/'plan/STAGE_PLAN.json',dict(phase=phase,manifestHash=lock['manifestHash'],expectedCalls=[c for t in tasks for c in t],chunks=len(chunks),matrix=[{} for _ in chunks]))
        seal(history/'plan',dict(campaignId='synthetic',invocationId='test',name='plan'))
        env=dict(runnerId='runner',node='v24.13.0',platform='linux',commit='test',sourceVerified=True,phase=phase,chunk=0)
        write(history/'env/ENVIRONMENT.json',env);seal(history/'env',dict(campaignId='synthetic',invocationId='test',name='env'))
        rows=[];starts=[];part=history/'part';part.mkdir()
        for call in tasks[0]:
            attempt=a.digest(dict(invocation='test',call=call['callId']))
            start=dict(call,manifestHash=lock['manifestHash'],profileHash=lock['profileHash'],invocationId='test',condition=m['profileContract'],metadata=refs[0]['metadata'],runnerId='runner',executionAttemptId=attempt,startedUtc='2026-10-11T00:00:00Z')
            starts.append(start);result=dict(policySettledMs=10,proof=dict(witnessAudit='PASS',engineExact=True),verified=dict(ALL=dict(keys=['a'],qualityVector=[2],count=1)),outcomes=dict(ALL=dict(humanQualityExact=True)))
            e=dict(reaped=True,result=result,memoryScope=dict(memoryMax=3221225472,swapMax=0,properties=dict(ActiveState='inactive')))
            rows.append(dict(start,status='EXACT',ms=10,execution=e));directory=part/attempt
            write(directory/'REQUEST.json',dict(callId=attempt,limits=call['limits'],job=dict(action='product-command',variant=call['variant'],commandSha256=call['inputHash'],productRoot='/'+('dev-product' if call['variant']=='DEV' else 'rc-product'))))
            write(directory/'SCOPE_COMPLETE.json',e);(directory/'events.jsonl').write_text(a.encode(dict(event='ready'))+'\n'+a.encode(dict(event='result',record=result))+'\n',encoding='utf8')
        (part/'raw.jsonl').write_text(''.join(a.encode(r)+'\n' for r in rows),encoding='utf8');(part/'starts.jsonl').write_text(''.join(a.encode(s)+'\n' for s in starts),encoding='utf8')
        identity=dict(campaignId='synthetic',invocationId='test',phase=phase,chunk=0,part=0);s=seal(part,identity)
        write(history/'receipt/TRANSPORT_COMPLETE.json',dict(receipts=[dict(status='UPLOADED',checkpointId=s['checkpointId'],artifactId=1,artifactDigest='sha256:synthetic',identity=identity)]));seal(history/'receipt',dict(campaignId='synthetic',invocationId='test',name='receipt'))
        write(history/'DOWNLOAD_COMPLETE.json',dict(errors=[],downloaded=4,selected=4));write(history/'DOWNLOAD_INDEX.json',dict(artifacts=[dict(id=1,digest='sha256:synthetic')]))
        return config,history,rows
    def test_valid_partial_evidence_is_incomplete_not_pass_and_corruption_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);old=Path.cwd()
            try:
                os.chdir(root);config,history,rows=self.build(root)
                from contextlib import redirect_stdout
                import io
                with redirect_stdout(io.StringIO()):r=a.audit(config,history,root/'audit1')
                self.assertEqual(r['status'],'INCOMPLETE');self.assertEqual(r['errors'],[]);self.assertEqual(r['witnessRecordsChecked'],2)
                rows[0]['execution']['result']['verified']['ALL']['qualityVector']=[99]
                (history/'part/raw.jsonl').write_text(''.join(a.encode(r)+'\n' for r in rows),encoding='utf8')
                seal(history/'part',dict(campaignId='synthetic',invocationId='test',phase=a.PHASES[0],chunk=0,part=0))
                with redirect_stdout(io.StringIO()):r=a.audit(config,history,root/'audit2')
                self.assertEqual(r['status'],'FAIL');self.assertTrue(any('scope/raw parity' in e['error'] for e in r['errors']))
            finally:os.chdir(old)
if __name__=='__main__':unittest.main()
