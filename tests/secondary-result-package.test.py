"""Offline transport/package/ledger fault tests. No population or solver execution."""
import copy
import os
import hashlib
import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from pathlib import Path

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/secondary-bench/postprocess'))
spec=importlib.util.spec_from_file_location('result_package',ROOT/'tools/secondary-bench/postprocess/package.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
import ledger


def fixture(root, bad_db=False, missing_start=False, censored=False):
    root.mkdir();(root/'objects').mkdir()
    manifest=dict(campaignId='test',maxCalls=10,maxRunnerHours=100,maxParallel=16,provenance={},screen=5.0)
    h=p.digest(manifest); lock=dict(manifest=manifest,manifestHash=h,invocationId='10',originMs=100,endMs=200,commit='frozen')
    row=dict(campaignId='test',invocationId='10',callId='call',manifestHash=h,phase='ALL_INITIAL',
             status='TIMEOUT_CALL' if censored else 'EXACT',ms=None if censored else 3,executionAttemptId='attempt')
    start={k:v for k,v in row.items() if k not in ['status','ms']}
    raw=(p.encode(row)+'\n').encode(); start_bytes=(p.encode(start)+'\n').encode()
    plan=dict(phase='ALL_INITIAL',manifestHash=h,expectedCalls=[dict(callId='call',phase='ALL_INITIAL'),dict(callId='not-run',phase='ALL_INITIAL')])
    artifacts=[]
    def artifact(name,files):
        identity=dict(campaignId='test',invocationId='10')
        ms=[dict(path=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in files.items()]
        snapshot=dict(identity=identity,members=ms,checkpointId=p.digest(dict(identity=identity,members=ms)))
        tmp=root/'artifact.zip'
        with zipfile.ZipFile(tmp,'w') as z:
            for n,b in files.items():z.writestr(n,b)
            z.writestr('SNAPSHOT.json',p.encode(snapshot))
        digest=p.sha(tmp);dest=root/'objects'/(digest+'.zip');tmp.rename(dest)
        artifacts.append(dict(id=len(artifacts)+1,name=name,digest='sha256:'+digest,size_in_bytes=dest.stat().st_size,expired=False))
    artifact('triage-lock-test',{'LOCK.json':p.encode(lock).encode(),'MANIFEST.json':p.encode(manifest).encode(),
        'TASKS.jsonl':b'{}\n','fixtures/original.json':b'{"weightedRows":[1,2]}\n'})
    artifact('triage-data-test-plan',{'STAGE_PLAN.json':p.encode(plan).encode()})
    artifact('triage-data-test-raw',{'raw.jsonl':raw,'starts.jsonl':start_bytes,'scope/events.jsonl':b'{"event":"ready"}\n'})
    artifact('triage-final-test',{'REPORT.json':p.encode(dict(executionCompleteness='INCOMPLETE')).encode()})
    dbfile=root/'index.sqlite';db=sqlite3.connect(dbfile)
    db.executescript('CREATE TABLE records(raw TEXT); CREATE TABLE starts(raw TEXT);')
    db.execute('INSERT INTO records VALUES(?)',(p.encode({**row,'ms':99} if bad_db else row),))
    if not missing_start:db.execute('INSERT INTO starts VALUES(?)',(p.encode(start),))
    db.commit();db.close()
    artifact('triage-independent-test-FINAL',{'INDEPENDENT_AUDIT.json':p.encode(dict(status='INCOMPLETE')).encode(),'AUDIT_INDEX.sqlite':dbfile.read_bytes()})
    dbfile.unlink()
    workflows={'.github/workflows/secondary-triage-campaign.yml':'jobs:\n  activate:\n    timeout-minutes: 30\n',
        '.github/workflows/secondary-triage-stage.yml':'jobs:\n  run:\n    timeout-minutes: 150\n'}
    run=dict(id=10,run_attempt=1,head_sha='frozen',status='completed',conclusion='failure',jobs=[
        dict(id=1,name='activate',status='completed',conclusion='success'),
        dict(id=2,name='all-initial / run (0, 42)',status='completed',conclusion='failure')])
    capture=dict(repository='owner/repo',runId=10,runAttempt=1,run=run,inventory=artifacts,workflows=workflows,downloadErrors=[],activeSnapshot=False)
    p.write(root/'COLLECTION.json',capture)
    return capture


class PackageTests(unittest.TestCase):
    def setUp(self):
        approved=Path(os.environ.get('LOCALAPPDATA',''))/'Temp/opencode'
        self.temp=tempfile.TemporaryDirectory(dir=approved if approved.is_dir() else None)
        self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)

    def test_portable_package_roundtrip_preserves_negative_results_and_original_bytes(self):
        root=self.root/'result';fixture(root,censored=True)
        s=p.package(root)
        self.assertEqual(s['collectionState'],'COMPLETE');self.assertEqual(s['analysisMaterials'],'AVAILABLE')
        self.assertEqual(s['executionCompleteness'],'INCOMPLETE');self.assertEqual(s['rawDatabaseParity'],'PASS')
        self.assertEqual(s['accounting']['calls'][0]['status'],'TIMEOUT_CALL')
        db=self.root/'LEDGER.sqlite';first=p.ingest(root,db);second=p.ingest(root,db)
        self.assertEqual(first['eventHash'],second['eventHash'])
        state=ledger.projection(db);c=state['campaigns'][0]
        self.assertEqual(c['reservedCalls'],2);self.assertEqual(c['remainingCallCap'],8)
        self.assertEqual(c['cumulativeReservedRunnerHours'],3);self.assertEqual(c['statusCounts']['PLANNED_WITHOUT_RESULT'],1)
        incomplete=copy.deepcopy(first['payload']);incomplete['accounting']['calls']=[];incomplete['accounting']['starts']=[]
        incomplete['collectionState']='INCOMPLETE';incomplete['packageSha256']='later-partial-observation'
        ledger.append(db,'COLLECTION',incomplete)
        self.assertEqual(ledger.projection(db)['campaigns'][0]['reservedCalls'],2,'later partial view cannot erase prior evidence')
        with zipfile.ZipFile(root/'EVIDENCE.zip') as z:
            for a in s['artifactIndex']:self.assertEqual(hashlib.sha256(z.read(a['object'])).hexdigest(),a['digest'][7:])
        # Verification depends only on portable package, not staging caches.
        import shutil
        shutil.rmtree(root/'objects');p.verify(root)
        con=sqlite3.connect(db)
        try:
            with self.assertRaises(sqlite3.IntegrityError):con.execute('DELETE FROM events')
        finally:con.close()

    def test_db_missing_or_forged_records_is_not_analysis_ready(self):
        for name,kwargs in [('wrong',dict(bad_db=True)),('missing',dict(missing_start=True))]:
            root=self.root/name;fixture(root,**kwargs);s=p.package(root)
            self.assertEqual(s['rawDatabaseParity'],'FAIL');self.assertEqual(s['analysisMaterials'],'PARTIAL')
            self.assertEqual(s['collectionState'],'INCOMPLETE')

    def test_rerun_selects_newest_final_preserving_old_failure_and_checks_new_db(self):
        root=self.root/'result';capture=fixture(root)
        newer=self.root/'newer';new=fixture(newer,bad_db=True)
        for a in capture['inventory']:a['created_at']='2026-10-07T00:00:00Z'
        for a in new['inventory']:
            if not a['name'].startswith(('triage-final-', 'triage-independent-')):continue
            b=copy.deepcopy(a);b.update(id=a['id']+100,created_at='2026-10-08T00:00:00Z')
            file=b['digest'][7:]+'.zip'
            (root/'objects'/file).write_bytes((newer/'objects'/file).read_bytes())
            capture['inventory'].append(b)
        capture['run']['run_attempt']=2;capture['runAttempt']=2
        (root/'COLLECTION.json').write_text(p.encode(capture)+'\n',encoding='utf-8')
        s=p.package(root)
        self.assertEqual(s['auditFiles'][0]['artifactId'],105)
        self.assertEqual(s['evidenceValidity'],'INCOMPLETE')
        self.assertEqual(s['rawDatabaseParity'],'FAIL','never fall back to the older passing DB')
        self.assertEqual(s['finalArtifactSelection']['historicalAudits'][0]['pointer']['artifactId'],5)
        with zipfile.ZipFile(root/'ANALYSIS.zip') as z:
            self.assertIn('reports/5/AUDIT_INDEX.sqlite',z.namelist())
            self.assertIn('reports/105/AUDIT_INDEX.sqlite',z.namelist())

    def test_ambiguous_final_versions_are_not_silently_selected(self):
        root=self.root/'result';capture=fixture(root)
        duplicate=copy.deepcopy(capture['inventory'][-1]);duplicate['id']=99
        capture['inventory'].append(duplicate);capture['run']['run_attempt']=2
        r=p.inspect_artifacts(root,capture['inventory'],capture['run'],capture['workflows'])
        self.assertTrue(any(e['error']=='AMBIGUOUS_FINAL_ARTIFACT_VERSION' for e in r['errors']))
        self.assertEqual(r['rawDatabaseParity'],'MISSING')

    def test_retry_reservations_include_failed_jobs_but_not_retained_success_clones(self):
        wf={'.github/workflows/secondary-triage-stage.yml':'jobs:\n  run:\n    timeout-minutes: 350\n'}
        old=dict(id=1,name='large-run / run (0)',status='completed',conclusion='success',
                 started_at='2026-10-07T00:00:00Z',completed_at='2026-10-07T00:01:00Z',runner_id=100)
        failed={**old,'id':2,'name':'large-run / run (1)','conclusion':'failure','runner_id':0}
        retained={**old,'id':3}
        retry={**failed,'id':4,'conclusion':'success','runner_id':101,'started_at':'2026-10-08T00:00:00Z',
               'completed_at':'2026-10-08T00:01:00Z'}
        a=p.job_accounting([old,failed,retained,retry],wf)
        self.assertEqual(a['reservedHours'],17.5)
        self.assertEqual(a['jobs'][0]['retainedJobAliases'],[3])

    def test_archive_tampering_and_unsafe_zip_refused(self):
        root=self.root/'result';fixture(root);p.package(root)
        with (root/'ANALYSIS.zip').open('ab') as f:f.write(b'tamper')
        with self.assertRaisesRegex(ValueError,'bytes changed'):p.verify(root)
        bad=self.root/'unsafe.zip'
        with zipfile.ZipFile(bad,'w') as z:z.writestr('../escape',b'x')
        with zipfile.ZipFile(bad) as z:
            with self.assertRaisesRegex(ValueError,'unsafe'):p.members(z)

    def test_unknown_reservation_and_unknown_start_are_preserved(self):
        root=self.root/'result';capture=fixture(root)
        capture['run']['jobs'].append(dict(id=3,name='new-unmapped-job',status='queued',conclusion=None))
        s=p.inspect_artifacts(root,capture['inventory'],capture['run'],capture['workflows'])
        self.assertIsNone(s['accounting']['cumulativeReservedRunnerHours'])
        self.assertEqual(s['accounting']['runnerAllocation']['unknownReservationJobs'],[3])
        p.package(root);db=self.root/'LEDGER.sqlite';event=p.ingest(root,db)
        value=copy.deepcopy(event['payload']);value['runId']=11
        value['accounting']['starts'].append(dict(campaignId='test',invocationId='11',executionAttemptId='lost',callId='lost-call'))
        value['accounting']['cumulativeReservedRunnerHours']=8
        ledger.append(db,'COLLECTION',value)
        state=ledger.projection(db)['campaigns'][0]
        self.assertEqual(state['reservedCalls'],3,'inherited calls charged once; unknown start also reserves a slot')
        self.assertEqual(len(state['unknownStarts']),1)
        self.assertEqual(state['cumulativeReservedRunnerHours'],8,'cumulative reservations are not summed twice')

    def test_collect_retries_only_missing_downloads_and_records_inventory(self):
        source=self.root/'remote';capture=fixture(source);out=self.root/'download'
        calls=[];broken={capture['inventory'][0]['id']}
        def api(repo,endpoint,paged=False):
            if endpoint.endswith('/artifacts?per_page=100'):return [dict(artifacts=capture['inventory'])]
            if endpoint.endswith('/jobs?per_page=100'):return [dict(jobs=capture['run']['jobs'])]
            if endpoint.startswith('contents/'):
                import base64
                name=endpoint[len('contents/'):].split('?')[0]
                return dict(content=base64.b64encode(capture['workflows'][name].encode()).decode())
            return copy.deepcopy(capture['run'])
        def download(command,stdout,**kwargs):
            aid=int(command[-1].split('/')[-2]);calls.append(aid)
            a=next(a for a in capture['inventory'] if a['id']==aid)
            stdout.write(b'bad' if aid in broken else (source/'objects'/(a['digest'][7:]+'.zip')).read_bytes())
        with patch.object(p,'api',api),patch.object(p.subprocess,'run',download):
            first=p.collect('owner/repo',10,out);self.assertEqual(len(first['downloadErrors']),1)
            broken.clear();second=p.collect('owner/repo',10,out)
            self.assertFalse(second['downloadErrors']);self.assertEqual(len(calls),len(capture['inventory'])+1)
        self.assertEqual(p.package(out)['rawDatabaseParity'],'PASS')

    def test_offline_cli_pack_verify_and_authored_analysis_registration(self):
        root=self.root/'cli';fixture(root);db=self.root/'LEDGER.sqlite'
        tool=ROOT/'tools/secondary-bench/postprocess/package.py'
        def cli(*args):
            return subprocess.run([sys.executable,'-B',str(tool),*map(str,args)],capture_output=True,text=True,check=True)
        cli('pack','--out',root,'--ledger',db);cli('verify','--out',root)
        document=self.root/'ANALYSIS.md';document.write_text('Explicit LLM analysis: insufficient evidence; no policy decision.\n',encoding='utf-8')
        cli('record-analysis','--ledger',db,'--package',root,'--file',document,'--author','synthetic reviewer')
        view=p.read(db.with_suffix('.CURRENT.json'))
        self.assertEqual(len(view['analyses']),1);self.assertEqual(view['analyses'][0]['documentSha256'],p.sha(document))
        self.assertEqual(view['performanceDecision'],'LLM_REVIEW_REQUIRED')

    def test_single_remote_handoff_populates_original_artifact_cache(self):
        source=self.root/'remote';capture=fixture(source);p.package(source)
        handoff=self.root/'handoff.zip'
        with zipfile.ZipFile(handoff,'w') as z:
            for name in ['PACKAGE.json','ANALYSIS.zip','EVIDENCE.zip','SUMMARY.json','COLLECTION.json']:z.write(source/name,name)
        a=dict(id=99,name='triage-handoff-10',digest='sha256:'+p.sha(handoff),expired=False,size_in_bytes=handoff.stat().st_size)
        inventory=capture['inventory']+[a];downloads=[]
        def api(repo,endpoint,paged=False):
            if endpoint.endswith('/artifacts?per_page=100'):return [dict(artifacts=inventory)]
            if endpoint.endswith('/jobs?per_page=100'):return [dict(jobs=capture['run']['jobs'])]
            if endpoint.startswith('contents/'):
                import base64
                return dict(content=base64.b64encode(capture['workflows'][endpoint[9:].split('?')[0]].encode()).decode())
            return copy.deepcopy(capture['run'])
        def download(command,stdout,**kwargs):
            downloads.append(command[-1]);self.assertIn('/99/zip',command[-1]);stdout.write(handoff.read_bytes())
        out=self.root/'download'
        with patch.object(p,'api',api),patch.object(p.subprocess,'run',download):result=p.collect('owner/repo',10,out)
        self.assertFalse(result['downloadErrors']);self.assertEqual(len(downloads),1)
        self.assertEqual(p.package(out)['rawDatabaseParity'],'PASS')

    def test_linked_budget_amendment_debits_prior_slots_without_population_pooling(self):
        root=self.root/'result';fixture(root);p.package(root);db=self.root/'LEDGER.sqlite'
        old=p.ingest(root,db)['payload'];new=copy.deepcopy(old)
        new.update(campaignId='amended',runId=11,packageSha256='amended')
        new['accounting']['calls']=[];new['accounting']['starts']=[]
        new['accounting'].update(priorReservedCalls=2,priorCampaignId='test')
        ledger.append(db,'COLLECTION',new)
        c=next(c for c in ledger.projection(db)['campaigns'] if c['campaignId']=='amended')
        self.assertEqual(c['reservedCalls'],2);self.assertEqual(c['currentCampaignCalls'],0)
        self.assertEqual(c['remainingCallCap'],8);self.assertEqual(c['statusCounts'],{})

    def test_reused_parent_records_keep_original_identity_and_are_not_double_charged(self):
        parent=self.root/'parent';capture=fixture(parent)
        root=self.root/'continued';root.mkdir();(root/'objects').mkdir()
        parent_artifact=capture['inventory'][0]
        with zipfile.ZipFile(parent/'objects'/(parent_artifact['digest'][7:]+'.zip')) as z:
            parent_lock=z.read('LOCK.json');old=json.loads(parent_lock)
        manifest={**old['manifest'], 'revision':6,'provenance':dict(priorReservedRunnerHours=3,priorCpSyntheticCalls=8),
            'continuation':dict(parentLockSha256=hashlib.sha256(parent_lock).hexdigest()),
            'prerequisiteReuse':dict(phases=['ALL_INITIAL'])}
        lock=dict(manifest=manifest,manifestHash=p.digest(manifest),invocationId='11',originMs=100,endMs=200,commit='frozen')
        files={'LOCK.json':p.encode(lock).encode(),'MANIFEST.json':p.encode(manifest).encode(),
               'continuation/PARENT_LOCK.json':parent_lock,'TASKS.jsonl':b'{}\n'}
        for a in capture['inventory']:
            if p.role(a['name'])!='evidence':continue
            with zipfile.ZipFile(parent/'objects'/(a['digest'][7:]+'.zip')) as z:
                for name in z.namelist():files[f'continuation/history/{a["id"]}/{name}']=z.read(name)
        identity=dict(campaignId='test',invocationId='11')
        ms=[dict(path=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in files.items()]
        snapshot=dict(identity=identity,members=ms,checkpointId=p.digest(dict(identity=identity,members=ms)))
        archive=root/'activation.zip'
        with zipfile.ZipFile(archive,'w') as z:
            for name,b in files.items():z.writestr(name,b)
            z.writestr('SNAPSHOT.json',p.encode(snapshot))
        h=p.sha(archive);archive.rename(root/'objects'/(h+'.zip'))
        artifacts=[dict(id=10,name='triage-lock-test',digest='sha256:'+h,expired=False)]
        import shutil
        for a in capture['inventory']:
            if p.role(a['name']) not in ['report','audit']:continue
            artifacts.append(a);shutil.copy2(parent/'objects'/(a['digest'][7:]+'.zip'),root/'objects'/(a['digest'][7:]+'.zip'))
        run={**capture['run'],'id':11,'jobs':[dict(id=12,name='activate',status='completed',conclusion='success')]}
        capture2={**capture,'runId':11,'run':run,'inventory':artifacts}
        p.write(root/'COLLECTION.json',capture2)
        s=p.package(root);self.assertEqual(s['rawDatabaseParity'],'PASS',s['errors'])
        self.assertEqual({c['invocationId'] for c in s['accounting']['calls']},{'10'})
        self.assertEqual(s['accounting']['cumulativeCpSyntheticCalls'],8)
        self.assertEqual(s['accounting']['cumulativeReservedRunnerHours'],3.5)
        p.package(parent);db=self.root/'LEDGER.sqlite';p.ingest(parent,db);p.ingest(root,db)
        state=ledger.projection(db)['campaigns'][0]
        self.assertEqual(state['reservedCalls'],2)
        self.assertEqual(state['cumulativeReservedRunnerHours'],3.5)


if __name__=='__main__':unittest.main()
