"""Synthetic corruption tests for the independent auditor; solver invocations=0."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('independent', ROOT/'tools/secondary-bench/common/triage/independent-audit.py')
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)

def write(p, v):
    p.parent.mkdir(parents=True,exist_ok=True); p.write_text(audit.encode(v)+'\n',encoding='utf-8')
def seal(p, identity):
    members=[dict(path=f.relative_to(p).as_posix(),bytes=f.stat().st_size,sha256=audit.sha(f))
             for f in sorted(p.rglob('*')) if f.is_file() and f.name!='SNAPSHOT.json']
    s=dict(schemaVersion=1,identity=identity,members=members);s['checkpointId']=audit.digest(dict(identity=identity,members=members))
    write(p/'SNAPSHOT.json',s);return s
def preflight():
    return dict(status='EXACT',reaped=True,memoryScope=dict(memoryMax=3221225472,swapMax=0),
        result=dict(cpPreflight='PASS',qualityComplete=True,tieComplete=True,result=dict(completed=True,
            qualityComplete=True,tieComplete=True,count=1,keys=['b'],qualityVector=[2])))

def campaign(base, gate_contract=None):
    config=base/'config';history=base/'history';config.mkdir();history.mkdir()
    job=dict(parts=3,jobMs=7500000,reserveMs=300000,setupMs=600000,checkpointMs=120000,finalTransportMs=900000,
        transportAuditMs=180000,jobMinutes=150,scopeOverheadMs=20000)
    profile=dict(id='triage-cold-v1',exactHumanQuality='true')
    refs=[]
    for i in range(580):
        f=dict(schema=1,id=f'f{i}',keys=['a','b'],K=1,seed=[0],rows=[[[0,1],[1,2]]],primaryHard=False,
            cardinalityProof=dict(status='PROVEN',backend='rust'),origin=dict(command=dict(clear=4,useHold=True,
            exactHumanQuality='true',queueLength=2,piecesNeeded=1,savedPieceCount=1,pattern='*!',family='bag')))
        temp=config/'fixtures'/f'{i}.json';write(temp,f);h=audit.sha(temp);temp.rename(temp.parent/f'{h}.json')
        refs.append(dict(id=f'f{i}',sha256=h,member=f'fixtures/{h}.json',metadata=dict(K=1,n=2,R=1,
            pattern='*!',family='bag',primary_hard=False,d=1,mirror_group=f'g{i}')))
    templates=[]
    def task(phase,fids,pairs=None,trials=None,variants=None,conditional=False):
        t=dict(phase=phase,task_id=phase+'/'+fids[0],fixture_ids=fids,conditional=conditional)
        if pairs:t['pairs']=pairs;t['calls']=2*len(pairs)
        elif trials:t['trials']=trials;t['calls']=sum(len(trial['order']) for trial in trials)
        else:t['variants']=variants;t['calls']=len(fids)*len(variants)
        templates.append(t)
    for phase in audit.PHASES:
        if phase=='CANARY':
            for i in range(8):task(phase,[f'f{i}'],variants=['PRECHANGE_BASELINE','BASELINE','A','B'])
        elif phase=='TRIVIAL_CONTRACT':
            for i in range(483,580,7):task(phase,[f'f{k}' for k in range(i,min(i+7,580))],variants=['BASELINE','A','B'])
        elif phase=='SEED_DIAGNOSTIC':
            for i in range(98):task(phase,[f'f{i}'],trials=[dict(repeat=r,order=['I100K_SEED_CAPTURE','T_PRIMARY_SEED','T_PROBE_SEED']) for r in [1,2]])
        else:
            population=range(24) if phase=='CALIBRATION' else range(451,483) if phase.startswith('PER_SAVE') else range(451)
            comps=['TRACE_ON_BASELINE'] if phase=='CALIBRATION' else ['A'] if phase.startswith('PER_SAVE') else ['A','B']
            for i in population:
                task(phase,[f'f{i}'],pairs=[dict(pair_id=f'{phase}/f{i}/{c}/{r}',comparator=c,repeat=r,
                    order=['BASELINE',c] if r==1 else [c,'BASELINE']) for c in comps for r in ([3,4] if phase.endswith('CONFIRMATION') else [1,2])],
                    conditional=phase.endswith('CONFIRMATION'))
                if phase=='CALIBRATION':templates[-1]['baseline_variant']='TRACE_OFF_BASELINE'
    tasks_file=config/'TASKS.jsonl';tasks_file.write_text(''.join(json.dumps(t)+'\n' for t in templates),encoding='utf-8')
    m=dict(schemaVersion=1,campaignId='synthetic',inputs=refs,job=job,profileContract=profile,maxCalls=8479,
        maxParallel=16,maxRunnerHours=1400,overallMs=120*3600000,tasksHash=audit.sha(tasks_file),sourceFiles=dict(product={},harness={}),baselineFiles=[])
    m['auditContract']=dict(id='independent-python-evidence-v1',runtime='Python3-stdlib',solverReplay=False,
        prerequisiteJobs=['CANARY','CALIBRATION'],finalDedicatedVm=True,performancePass=False,independentOptimality=False)
    m['cpPreflightContract']=dict(id='scoped-cpsat-weighted-tie-v1',activationCalls=1,maxCanaryVmCalls=3,callMs=30000,populationCalls=0)
    if gate_contract:m.update(gateContract=gate_contract,revision=6,measurement=dict(adapter='triage-fixture'))
    lock=dict(manifest=m,manifestHash=audit.digest(m),profileHash=audit.digest(profile),originMs=0,endMs=m['overallMs'],invocationId='1',commit='abc')
    write(config/'MANIFEST.json',m);write(config/'LOCK.json',lock);write(config/'CP_PREFLIGHT.json',preflight());seal(config,dict(campaignId='synthetic',runId='1',name='activation'))
    cs=audit.chunks(audit.compile_calls(m,templates,'CANARY'),job);expected=[c for chunk in cs for task in chunk for c in task]
    write(history/'plan/STAGE_PLAN.json',dict(phase='CANARY',chunks=len(cs),matrix=[dict(index=i) for i in range(len(cs))],
        manifestHash=lock['manifestHash'],expectedCalls=expected));seal(history/'plan',dict(campaignId='synthetic',runId='1',name='plan'))
    inventory=[];backend=100
    for ci,chunk in enumerate(cs):
        receipts=[]
        env=history/f'env-{ci}';write(env/'ENVIRONMENT.json',dict(node='v24.13.0',platform='linux',commit='abc'))
        write(env/'CP_PREFLIGHT.json',preflight());seal(env,dict(campaignId='synthetic',runId='1',name='environment'))
        for part,calls in enumerate(chunk):
            directory=history/f'part-{ci}-{part}';directory.mkdir();raw=[];starts=[]
            for c in calls:
                attempt=audit.digest(dict(invocation='1',call=c['callId']));ref=next(f for f in refs if f['id']==c['inputId'])
                start=dict(**c,logicalCallId=c['callId'],manifestHash=lock['manifestHash'],profileHash=lock['profileHash'],
                    invocationId='1',metadata=ref['metadata'],condition=profile,executionAttemptId=attempt,startedUtc='2026-10-06T00:00:00Z')
                record=dict(variant=c['variant'],fixtureSha256=ref['sha256'],primarySeedHash=audit.digest([0]),policySettledMs=10,
                    result=dict(completed=True,count=1,keys=['b'],qualityVector=[2],qualitySearchedStates=2),
                    verified=dict(selected=[1],qualityVector=[2],qualityHash=audit.digest([2]),completed=True))
                e=dict(status='EXACT',reaped=True,result=record,memoryScope=dict(memoryMax=3221225472,swapMax=0))
                write(directory/attempt/'REQUEST.json',dict(callId=attempt,limits=c['limits'],job=dict(variant=c['variant'],fixtureSha256=ref['sha256'],exactHumanQuality='true')))
                write(directory/attempt/'SCOPE_COMPLETE.json',e)
                (directory/attempt/'events.jsonl').write_text(audit.encode(dict(event='ready'))+'\n'+
                    audit.encode(dict(event='result',record=record))+'\n',encoding='utf-8')
                starts.append(start);raw.append(dict(**start,status='EXACT',ms=10,execution=e))
            (directory/'raw.jsonl').write_text(''.join(audit.encode(r)+'\n' for r in raw),encoding='utf-8')
            (directory/'starts.jsonl').write_text(''.join(audit.encode(r)+'\n' for r in starts),encoding='utf-8')
            identity=dict(campaignId='synthetic',invocationId='1',phase='CANARY',chunk=ci,part=part);s=seal(directory,identity)
            backend+=1;h='sha256:'+'a'*64;inventory.append(dict(id=backend,digest=h))
            receipts.append(dict(status='UPLOADED',checkpointId=s['checkpointId'],identity=identity,attempts=[dict(status='UPLOADED',artifactId=backend,digest=h)]))
        write(history/f'transport-{ci}/TRANSPORT_COMPLETE.json',dict(status='ALL_DURABLE',solverCallsInTransport=0,receipts=receipts))
        seal(history/f'transport-{ci}',dict(campaignId='synthetic',runId='1',name='transport'))
    write(history/'DOWNLOAD_COMPLETE.json',dict(errors=[],downloaded=30,selected=30));write(history/'DOWNLOAD_INDEX.json',dict(artifacts=inventory))
    return config,history

class IndependentAudit(unittest.TestCase):
    def test_compact_preflight_requires_weighted_vector_and_multiple_quality_stages(self):
        p=preflight()
        with self.assertRaises(ValueError):audit.cp_check(p,compact=True)
        p['result']['syntheticCase']='COMPACT_OR_MULTIBATCH_WEIGHTED_TIE'
        p['result']['result'].update(qualityVector=[2,5,6,6],stages=[dict(phase='quality'),dict(phase='quality'),dict(phase='tie')])
        audit.cp_check(p,compact=True)
        with self.assertRaises(ValueError):audit.cp_check(p)
        p['result']['result']['stages'].pop(0)
        with self.assertRaises(ValueError):audit.cp_check(p,compact=True)

    def setUp(self):
        temp=Path(os.environ['LOCALAPPDATA'])/'Temp/opencode' if os.name=='nt' else None
        self.tmp=tempfile.TemporaryDirectory(prefix='triage-independent-',dir=temp);self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def test_synthetic_remote_canary_and_exact_witness_without_solver(self):
        config,history=campaign(self.root)
        result=audit.audit(config,history,self.root/'audit','CANARY')
        self.assertEqual(result['status'],'PASS',result['errors']);self.assertEqual(result['witnessRecordsChecked'],32)
        self.assertEqual(result['solverCalls'],0);self.assertFalse(result['independentOptimality'])
    def test_v2_full_audit_separates_valid_evidence_from_candidate_promotion(self):
        config,history=campaign(self.root,audit.GATE_CONTRACT)
        result=audit.audit(config,history,self.root/'audit','CANARY')
        self.assertEqual(result['status'],'PASS',result['errors']);self.assertEqual(result['evidenceStatus'],'PASS')
        self.assertTrue(result['collectionAllowed']);self.assertFalse(result['performancePass'])
        self.assertEqual(result['decisionStatus'],'REVIEW_REQUIRED')
        self.assertEqual(result['prerequisiteAssessments']['CANARY']['evidenceStatus'],'PASS')
    def test_resealed_false_weighted_witness_is_rejected(self):
        config,history=campaign(self.root);directory=history/'part-0-0';rows=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()]
        rows[2]['execution']['result']['result']['qualityVector']=[1]
        write(directory/rows[2]['executionAttemptId']/'SCOPE_COMPLETE.json',rows[2]['execution'])
        (directory/rows[2]['executionAttemptId']/'events.jsonl').write_text(audit.encode(dict(event='ready'))+'\n'+
            audit.encode(dict(event='result',record=rows[2]['execution']['result']))+'\n',encoding='utf-8')
        (directory/'raw.jsonl').write_text(''.join(audit.encode(r)+'\n' for r in rows),encoding='utf-8')
        seal(directory,read_identity(directory))
        r=audit.audit(config,history,self.root/'audit','CANARY');self.assertEqual(r['status'],'FAIL')
        self.assertTrue(any('weighted' in e['error'] for e in r['errors']))
    def test_transport_member_tamper_and_partial_campaign_are_not_pass(self):
        config,history=campaign(self.root);(history/'part-0-0/raw.jsonl').write_text('{}\n',encoding='utf-8')
        r=audit.audit(config,history,self.root/'audit','CANARY');self.assertEqual(r['status'],'FAIL')
        self.assertTrue(any('snapshot member bytes' in e['error'] for e in r['errors']))
    def test_independent_gate_rejects_oom_and_cp_failure_even_with_rust_exact(self):
        import sqlite3
        db=sqlite3.connect(':memory:');db.execute('CREATE TABLE records(phase TEXT,raw TEXT)')
        for variant in ['PRECHANGE_BASELINE','BASELINE','A','B']:
            r=dict(inputId='f',variant=variant,status='OOM' if variant=='A' else 'EXACT',ms=10,
                execution=dict(reaped=True,result=dict(verified={},result={})))
            db.execute('INSERT INTO records VALUES(?,?)',('CANARY',json.dumps(r)))
        with self.assertRaisesRegex(ValueError,'OOM'):audit.phase_gate(db,'CANARY')
        self.assertTrue(audit.cp_failure(dict(execution=dict(result=dict(result=dict(secondaryCpFailure='Error: CP initialization failed'))))))
        self.assertTrue(audit.cp_failure(dict(execution=dict(policyTrace=[dict(name='cp-end',kind='ERROR')]))))
        self.assertFalse(audit.cp_failure(dict(execution=dict(result=dict(result=dict(secondaryCpFailure='Error: CP secondary time limit reached'))))))
        db.close()
    def test_v2_screen_is_diagnostic_legacy_verdict_and_integrity_checks_remain(self):
        import sqlite3
        db=sqlite3.connect(':memory:');self.addCleanup(db.close);db.execute('CREATE TABLE records(phase TEXT,raw TEXT)')
        for i in range(17):
            for repeat in [1,2]:
                for variant in ['TRACE_OFF_BASELINE','TRACE_ON_BASELINE']:
                    ms=30+((10.505 if repeat==1 else 1.303) if i==0 and variant=='TRACE_ON_BASELINE' else 0)
                    r=dict(inputId=f'c{i}',variant=variant,status='EXACT',ms=ms,repeat=repeat,
                        pairId=f'CALIBRATION/c{i}/TRACE_ON_BASELINE/{repeat}',
                        execution=dict(reaped=True,result=dict(verified={},result=dict(qualitySearchedStates=3))))
                    db.execute('INSERT INTO records VALUES(?,?)',('CALIBRATION',json.dumps(r)))
        with self.assertRaisesRegex(ValueError,'per-input overhead'):audit.phase_gate(db,'CALIBRATION')
        result=audit.phase_gate(db,'CALIBRATION',audit.GATE_CONTRACT)
        self.assertTrue(result['collectionAllowed']);cal=result['calibration'];self.assertEqual(cal['status'],'REVIEW_REQUIRED')
        self.assertFalse(cal['confirmedOverhead']);self.assertEqual(cal['automaticExtraCalls'],0)
        signal=next(r for r in cal['observations'] if r['exceedsScreen'])
        self.assertEqual(signal['inputId'],'c0');self.assertAlmostEqual(signal['addedMedianMs'],5.904);self.assertEqual(signal['limitMs'],5)
        text=db.execute('SELECT raw FROM records WHERE rowid=2').fetchone()[0];row=json.loads(text)
        row['execution']['result']['result']['qualitySearchedStates']=4
        db.execute('UPDATE records SET raw=? WHERE rowid=2',(json.dumps(row),))
        with self.assertRaisesRegex(ValueError,'states drift'):audit.phase_gate(db,'CALIBRATION',audit.GATE_CONTRACT)
        db.execute('DELETE FROM records WHERE rowid=2')
        with self.assertRaisesRegex(ValueError,'partial pair'):audit.phase_gate(db,'CALIBRATION',audit.GATE_CONTRACT)
    def test_v2_canary_censored_outcomes_are_data_but_reclamation_and_witness_are_mandatory(self):
        import sqlite3
        db=sqlite3.connect(':memory:');self.addCleanup(db.close);db.execute('CREATE TABLE records(phase TEXT,raw TEXT)')
        for variant in ['PRECHANGE_BASELINE','BASELINE','A','B']:
            r=dict(inputId='f',variant=variant,status='OOM' if variant=='A' else 'EXACT',ms=None if variant=='A' else 10,
                execution=dict(reaped=True,memoryScope=dict(memoryMax=3221225472,swapMax=0),result=dict(verified={},result={})))
            db.execute('INSERT INTO records VALUES(?,?)',('CANARY',json.dumps(r)))
        self.assertTrue(audit.phase_gate(db,'CANARY',audit.GATE_CONTRACT)['collectionAllowed'])
        r['execution']['reaped']=False;db.execute('UPDATE records SET raw=? WHERE rowid=4',(json.dumps(r),))
        with self.assertRaisesRegex(ValueError,'execution'):audit.phase_gate(db,'CANARY',audit.GATE_CONTRACT)
        with self.assertRaisesRegex(ValueError,'unsupported gate'):audit.phase_gate(db,'CANARY',dict(id='unknown'))
    def test_schedule_independently_binds_pair_order_and_disallows_unknown_ids(self):
        m=dict(campaignId='x',inputs=[dict(id='f',sha256='a'*64)])
        t=dict(phase='ALL_INITIAL',task_id='task',fixture_ids=['f'],conditional=False,calls=4,pairs=[
            dict(pair_id='p1',comparator='A',repeat=1,order=['BASELINE','A']),
            dict(pair_id='p2',comparator='B',repeat=1,order=['B','BASELINE'])])
        calls=audit.compile_calls(m,[t],'ALL_INITIAL')[0];self.assertEqual(len({c['callId'] for c in calls}),4)
        swapped=copy.deepcopy(t);swapped['pairs'][0]['order'].reverse()
        self.assertNotEqual(calls[0]['callId'],audit.compile_calls(m,[swapped],'ALL_INITIAL')[0][1]['callId'])
    def test_actual_cp_proof_and_reaping_required(self):
        cp=preflight();audit.cp_check(cp);cp['result']['result']['tieComplete']=False
        with self.assertRaises(ValueError):audit.cp_check(cp)
    def test_continuation_conservatively_debits_all_prior_canary_slots(self):
        c=dict(id='canary-witness-serialization-repair-v1',reservedCalls=32,reservedCpSyntheticCalls=4,reservedRunnerHours=14,
            originUtc='2026-10-06T11:51:03Z',priorEvidencePooled=False,priorEvidenceReclassified=False)
        m=dict(startupContinuation=c,activationRecovery=dict(originUtc=c['originUtc']))
        self.assertEqual(audit.continuation_check(m),32)
        c['reservedCalls']=0
        with self.assertRaisesRegex(ValueError,'reservation'):audit.continuation_check(m)
    def test_continuation_independently_binds_sealed_prior_lock_plan_source_and_clock(self):
        config,_=campaign(self.root);m=audit.read(config/'MANIFEST.json')
        m['sourceFiles']=dict(product={});m['baselineFiles']=[]
        previous=dict(manifest=copy.deepcopy(m),manifestHash=audit.digest(m),profileHash=audit.digest(m['profileContract']),
            originMs=0,endMs=m['overallMs'],invocationId='99',commit='abc')
        templates=[json.loads(l) for l in (config/'TASKS.jsonl').read_text().splitlines()]
        plan=dict(phase='CANARY',chunks=3,manifestHash=previous['manifestHash'],
            expectedCalls=[v for task in audit.compile_calls(m,templates,'CANARY') for v in task])
        c=dict(id='canary-witness-serialization-repair-v1',reservedCalls=32,reservedCpSyntheticCalls=4,reservedRunnerHours=14,
            originUtc='1970-01-01T00:00:00Z',priorEvidencePooled=False,priorEvidenceReclassified=False,priorRunId=99,
            priorLock=dict(artifactId=10,digest='sha256:'+'a'*64),priorPlan=dict(artifactId=11,digest='sha256:'+'b'*64))
        m['startupContinuation']=c;m['activationRecovery']=dict(originUtc=c['originUtc'])
        for filename,snapname,original,value in [('CONTINUATION_PRIOR_LOCK.json','CONTINUATION_LOCK_SNAPSHOT.json','LOCK.json',previous),
                ('CONTINUATION_PRIOR_PLAN.json','CONTINUATION_PLAN_SNAPSHOT.json','STAGE_PLAN.json',plan)]:
            directory=self.root/original;write(directory/original,value);s=seal(directory,dict(campaignId='synthetic',runId='99',name=original))
            (config/filename).write_bytes((directory/original).read_bytes());write(config/snapname,s)
        validation=dict(status='PASS',solverCalls=0,priorRun=dict(id=99,status='completed',conclusion='failure',run_attempt=1,head_sha='abc'),
            priorArtifacts=[dict(id=r['artifactId'],digest=r['digest'],expired=False,name='prior-CANARY') for r in [c['priorLock'],c['priorPlan']]],
            priorJobs=[dict(name='canary / run (0)',conclusion='failure')])
        write(config/'CONTINUATION_VALIDATION.json',validation)
        lock=dict(originMs=0,endMs=m['overallMs'])
        self.assertEqual(audit.continuation_check(m,config,lock),32)
        with self.assertRaisesRegex(ValueError,'clock'):audit.continuation_check(m,config,dict(originMs=1,endMs=m['overallMs']+1))
        m['sourceFiles']['product']={'changed':'solver'}
        with self.assertRaisesRegex(ValueError,'solver/product'):audit.continuation_check(m,config,lock)
    def test_standard_common_parent_preserves_all_bytes_statuses_schedule_and_new_epoch(self):
        import shutil
        config,history=campaign(self.root);old=audit.read(config/'MANIFEST.json');parent=audit.read(config/'LOCK.json')
        root=config/'continuation';root.mkdir();shutil.copytree(history,root/'history')
        write(root/'PARENT_LOCK.json',parent);h=root/'history'
        members=[dict(path=p.relative_to(h).as_posix(),sha256=audit.sha(p),bytes=p.stat().st_size) for p in sorted(h.rglob('*')) if p.is_file()]
        write(h/'HISTORY_INDEX.json',dict(schemaVersion=1,campaignId=old['campaignId'],members=members))
        proof=dict(status='PASS',contract='INSERTION_SELECTED_QUALITY',exactRecordsChecked=2508,solverCalls=0)
        write(config/'ORIGINAL_WITNESS_AUDIT.json',proof)
        m=copy.deepcopy(old);m.update(revision=5,continuation=dict(parentLock='config/continuation/PARENT_LOCK.json',
            parentLockSha256=audit.sha(root/'PARENT_LOCK.json'),history='config/continuation/history',historyIndexSha256=audit.sha(h/'HISTORY_INDEX.json')),
            provenance=dict(originalWitnessAuditSha256=audit.sha(config/'ORIGINAL_WITNESS_AUDIT.json'),priorReservedRunnerHours=14,
                parentLockArtifact=dict(id=10,digest='sha256:'+'a'*64)))
        self.assertEqual(audit.common_parent_check(m,config),32)
        validation=dict(status='PASS',solverCalls=0,reservedCalls=32,priorStatuses=dict(EXACT=32),priorUnknown=[],
            parentArtifact=dict(id=10,digest='sha256:'+'a'*64,workflow_run=dict(id=1)),
            parentRun=dict(status='completed',conclusion='failure',head_sha='abc'))
        write(config/'PARENT_VALIDATION.json',validation)
        lock=dict(originMs=0,endMs=m['overallMs'],createdUtc='2026-10-06T00:00:00Z')
        self.assertEqual(audit.common_parent_check(m,config,lock),32)
        templates=[json.loads(l) for l in (config/'TASKS.jsonl').read_text().splitlines()]
        before={v['callId'] for task in audit.compile_calls(old,templates,'CANARY') for v in task}
        after={v['callId'] for task in audit.compile_calls(m,templates,'CANARY') for v in task}
        self.assertFalse(before&after)
        with self.assertRaisesRegex(ValueError,'clock'):audit.common_parent_check(m,config,dict(lock,originMs=1))
        (h/'part-0-0/raw.jsonl').write_text('{}\n')
        with self.assertRaisesRegex(ValueError,'history changed'):audit.common_parent_check(m,config)
    def test_final_empty_remaining_phases_never_earns_pass(self):
        config,history=campaign(self.root);r=audit.audit(config,history,self.root/'audit')
        self.assertEqual(r['status'],'INCOMPLETE');self.assertIn('plan/ALL_INITIAL',r['missing'])
    def test_independent_retest_requires_changed_hard_and_status_discordance(self):
        import sqlite3
        db=sqlite3.connect(':memory:');db.execute('CREATE TABLE records(phase TEXT,raw TEXT)')
        m=dict(design=dict(selection_seed='fixed',retest=dict(always_include_fixture_ids=['hard'])))
        for fid,hard,d,delta in [('hard',True,10,0),('high',False,17,0),('other',False,2,20)]:
            for variant,ms in [('BASELINE',10),('A',10+delta)]:
                db.execute('INSERT INTO records VALUES(?,?)',('ALL_INITIAL',json.dumps(dict(inputId=fid,variant=variant,
                    comparator='A',pairId=fid+'/A/1',status='EXACT',ms=ms,metadata=dict(primary_hard=hard,d=d)))))
        self.assertEqual(audit.required_confirmation(db,m,'ALL_INITIAL'),{'hard','high','other'});db.close()

def read_identity(directory):return json.loads((directory/'SNAPSHOT.json').read_text())['identity']
if __name__=='__main__':unittest.main()
