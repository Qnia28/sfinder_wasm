"""Prepare immutable launch ZIP from existing fixtures. No solver invocation."""
import argparse
import hashlib
import json
import subprocess
import sqlite3
import shutil
import zipfile
from pathlib import Path

def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def canonical(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))

def normalized_hash(path, product):
    data=path.read_bytes()
    if product and b'\0' not in data:
        try:
            if data.decode('utf-8').encode('utf-8')==data:data=data.replace(b'\r\n',b'\n')
        except UnicodeDecodeError:pass
    return hashlib.sha256(data).hexdigest()

def audit_original_all_witnesses(base, archive):
    """Read original DB/raw bytes, never run a solver or rewrite evidence."""
    db=base/'minimals-all/ALL.sqlite';c=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
    grouped={}
    for row in c.execute("SELECT fixtureId,rawFile,rawLine,rawFileSha256,rawLineSha256,exactWitnessSha256 FROM calls WHERE status='EXACT'"):
        grouped.setdefault(row['rawFile'],[]).append(dict(row))
    c.close();count=0;consensus={}
    with zipfile.ZipFile(archive) as z:
        for name,rows in grouped.items():
            data=z.read(name);assert hashlib.sha256(data).hexdigest()==rows[0]['rawFileSha256'];lines=data.decode('utf-8').splitlines()
            for row in rows:
                line=lines[row['rawLine']-1];assert hashlib.sha256(line.encode()).hexdigest()==row['rawLineSha256'];raw=json.loads(line)
                assert raw['inputId']==row['fixtureId'];record=raw['execution']['result'];v=record['verified']
                assert v['qualityVector']==record['result']['qualityVector']
                h=hashlib.sha256(json.dumps(dict(selected=v['selected'],quality=v['qualityVector']),separators=(',',':')).encode()).hexdigest()
                assert h==row['exactWitnessSha256'];assert consensus.setdefault(row['fixtureId'],h)==h;count+=1
    return dict(status='PASS',contract='INSERTION_SELECTED_QUALITY',exactRecordsChecked=count,rawFilesChecked=len(grouped),
        fixtures=len(consensus),databaseSha256=sha(db),solverCalls=0,originalEvidenceUnmodified=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--analysis',default=r'D:\AI\sfinder-wasm\triage-analysis\Astra')
    parser.add_argument('--out',required=True);parser.add_argument('--activation-recovery');parser.add_argument('--startup-continuation')
    parser.add_argument('--common-continuation');args=parser.parse_args()
    work=Path.cwd();analysis=Path(args.analysis);out=Path(args.out);out.mkdir(parents=True,exist_ok=False)
    design=json.loads((analysis/'next-experiment/PLAN.json').read_text(encoding='utf-8'))
    targets=[json.loads(s) for s in (analysis/'next-experiment/TARGETS.jsonl').read_text(encoding='utf-8').splitlines()]
    templates=(analysis/'next-experiment/TASKS.jsonl').read_bytes()
    snapshot=work/'benchmark-results/triage-preparation/baseline'
    sources={'product':{},'harness':{}}
    for dirname in ['src','wasm']:
        for p in sorted((work/dirname).rglob('*')):
            if p.is_file():sources['product'][p.relative_to(work).as_posix()]=normalized_hash(p,True)
    for name in ['package.json','package-lock.json']:
        sources['product'][name]=normalized_hash(work/name,True)
    paths=list((work/'tools/secondary-bench/common').rglob('*'))
    paths += [work/'tools/secondary-bench'/name for name in ['contracts.mjs','followup-scope.mjs','followup-storage.mjs','followup-extract.py','isolation.mjs','run.mjs','schedule.mjs','template.mjs','download-artifacts.mjs','source-lock.mjs','artifact-action/package.json','artifact-action/package-lock.json']]
    paths += [work/name for name in ['.gitattributes','tests/triage-bench.test.mjs','tests/triage-independent-audit.test.py','.github/workflows/secondary-triage-campaign.yml','.github/workflows/secondary-triage-stage.yml']]
    for p in sorted(set(paths)):
        if p.is_file() and not any(part in ['node_modules','__pycache__'] for part in p.parts):
            sources['harness'][p.relative_to(work).as_posix()]=normalized_hash(p,False)
    # Common contracts use recursively-sorted canonical hashing; Node validates the final value.
    profile=dict(id='triage-cold-v1',lifecycle='fresh-process-cold',exactHumanQuality='true',
        timingContract='post-primary-policy-settled-v1',memoryScope='policy-process-tree',memoryMaxBytes=3221225472,swapMaxBytes=0,
        threads=dict(rustPrimary=1,highsPrimary=1,cpsatPrimary=2,rustSecondary=1,cpsatSecondary=1),cpDelayMs=60000,cpLimitMs=120000,probeStateBudget=100000)
    job=dict(parts=3,jobMs=125*60000,reserveMs=5*60000,setupMs=10*60000,checkpointMs=2*60000,
        finalTransportMs=15*60000,transportAuditMs=3*60000,jobMinutes=150,scopeOverheadMs=20000)
    refs=[dict(id=f['id'],sha256=f['fixture_sha256'],member=f"fixtures/{f['fixture_sha256']}.json",metadata={k:v for k,v in f.items() if k not in ['source_locator','original_source_exists','fixture_bytes_reverified_for_launch']}) for f in targets]
    base=Path(r'D:\AI\sfinder-wasm\files\triage-database')
    expected={}
    for rel,query,contract in [
        ('minimals-all/ALL.sqlite',"SELECT fixtureId,exactWitnessSha256 FROM calls WHERE status='EXACT'",'INSERTION_SELECTED_QUALITY'),
        ('per-save/per-save.sqlite',"SELECT fixture_id,witness_sha256 FROM calls WHERE status='EXACT'",'INSERTION_SELECTED_QUALITY')]:
        c=sqlite3.connect((base/rel).as_uri()+'?mode=ro',uri=True)
        for fid,h in c.execute(query):
            if h:
                value=dict(contract=contract,sha256=h)
                assert fid not in expected or expected[fid]==value,'historical exact witness disagreement'
                expected[fid]=value
        c.close()
    for ref in refs:ref['expectedWitness']=expected.get(ref['id'])
    baseline=[dict(member='baseline/'+p.name,destination='src/'+p.name,sha256=sha(p)) for p in sorted(snapshot.glob('*.mjs'))]
    assert len(baseline)==2
    manifest=dict(schemaVersion=1,campaignId=design['id'],purpose='development-policy-ab',freshValidation=False,profile=profile['id'],profileContract=profile,
        maxParallel=16,maxCalls=8479,maxRunnerHours=1400,overallMs=120*3600000,job=job,inputs=refs,baselineFiles=baseline,
        sourceFiles=sources,tasksHash=hashlib.sha256(templates).hexdigest(),design=design,
        provenance=dict(role='development',head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            branch=subprocess.check_output(['git','branch','--show-current'],text=True).strip(),inputDbHashes=design['input_sha256'],
            historicalTimingsPooled=False,approval='USER_PREPARE_ONLY_EXECUTION_CONFIRMATION_REQUIRED'),
        runtime=dict(os='ubuntu-24.04',node='24.13.0',wasmBuiltFromFrozenAsset=True))
    manifest['auditContract']=dict(id='independent-python-evidence-v1',runtime='Python3-stdlib',solverReplay=False,
        prerequisiteJobs=['CANARY','CALIBRATION'],finalDedicatedVm=True,performancePass=False,independentOptimality=False)
    manifest['cpPreflightContract']=dict(id='scoped-cpsat-weighted-tie-v1',activationCalls=1,maxCanaryVmCalls=3,
        callMs=30000,populationCalls=0)
    if args.activation_recovery:
        manifest['activationRecovery']=json.loads(Path(args.activation_recovery).read_text(encoding='utf-8'))
        assert manifest['activationRecovery']['populationCalls']==0
    if args.startup_continuation:
        manifest['startupContinuation']=json.loads(Path(args.startup_continuation).read_text(encoding='utf-8'))
    if args.common_continuation:
        assert not args.startup_continuation,'do not mix dedicated r4 repair with common continuation'
        prior=Path(args.common_continuation)
        shutil.copytree(prior,out/'continuation');prior=out/'continuation'
        manifest.update(revision=5,approval='USER_ASTRA_ANALYSIS_FIX_AND_RESUME',analysis='DEVELOPMENT_KEEP_HOLD_REJECT',
            measurement=dict(adapter='triage-fixture',variants=['BASELINE','A','B']),
            budget=dict(maxParallel=16,overallMs=manifest['overallMs'],maxCalls=8479,job=job),
            evidence=dict(schemaVersion=1,retentionDays=30,retries=2,diskReserveBytes=4*1024**3),
            continuation=dict(parentLock='config/continuation/PARENT_LOCK.json',parentLockSha256=sha(prior/'PARENT_LOCK.json'),
                history='config/continuation/history',historyIndexSha256=sha(prior/'history/HISTORY_INDEX.json')))
        backend=json.loads((prior/'PARENT_BACKEND.json').read_text(encoding='utf-8'))
        manifest['provenance'].update(parentLockArtifact=dict(id=backend['id'],digest=backend['digest']),
            priorReservedRunnerHours=14,priorCpSyntheticCalls=4,priorEvidencePooled=False,measurementEpoch=5,
            approval='USER_ASTRA_ANALYSIS_FIX_AND_RESUME',exposures=['ALL','PER_SAVE','FAILED_CANARY_R3'])
        proof=audit_original_all_witnesses(base,Path(r'D:\AI\sfinder-wasm\files\evidence\A_ASTRA_HANDOFF_37280034634.zip'))
        (out/'ORIGINAL_WITNESS_AUDIT.json').write_text(canonical(proof)+'\n',encoding='utf-8')
        manifest['provenance']['originalWitnessAuditSha256']=sha(out/'ORIGINAL_WITNESS_AUDIT.json')
    manifest['design']['budget']['max_parallel_vm']=16
    manifest['design']['budget']['runtime_reserved_control_jobs']=36
    manifest['design']['state']='PREPARED_REMOTE_GATES_REQUIRED'
    manifest['design']['retest']['implementation']='Conservative superset: all changed inputs, status/coverage discordance, tails, variability and near fast gates'
    (out/'MANIFEST.json').write_text(canonical(manifest)+'\n',encoding='utf-8')
    (out/'TASKS.jsonl').write_bytes(templates)
    # Bytes-only archive transfer: streaming avoids a second JSON exporter or matrix population run.
    archive=out/'TRIAGE_16VM_INPUTS.zip';written=set();total=0
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
        z.write(out/'MANIFEST.json','MANIFEST.json');z.write(out/'TASKS.jsonl','TASKS.jsonl')
        if args.common_continuation:
            z.write(out/'ORIGINAL_WITNESS_AUDIT.json','ORIGINAL_WITNESS_AUDIT.json')
            for p in sorted(prior.rglob('*')):
                if p.is_file():z.write(p,'continuation/'+p.relative_to(prior).as_posix())
        for ref in baseline:z.write(snapshot/Path(ref['member']).name,ref['member'])
        for f in targets:
            source=work/f['source_locator'];expected=f['fixture_sha256']
            assert sha(source)==expected,'fixture bytes changed: '+f['id']
            if expected in written:continue
            written.add(expected);total+=source.stat().st_size;z.write(source,f'fixtures/{expected}.json')
    manifest_hash=subprocess.check_output(['node','--input-type=module','-e',
        "import {digest,readJson} from './tools/secondary-bench/common/contracts.mjs'; console.log(digest(readJson(process.argv[1])))",str(out/'MANIFEST.json')],text=True).strip()
    entry=dict(state='PREPARED_NOT_ACTIVATED',confirm=None,assetId=None,bundleSha256=sha(archive),manifestHash=manifest_hash)
    (out/'START.json').write_text(json.dumps(entry,indent=2)+'\n',encoding='utf-8')
    (out/'PACKAGE.json').write_text(json.dumps(dict(archive=archive.name,sha256=entry['bundleSha256'],bytes=archive.stat().st_size,
        uniqueFixtureFiles=len(written),fixtureBytes=total,manifestHash=entry['manifestHash'],sourceFiles=sum(map(len,sources.values())),
        newSolverCalls=0),indent=2)+'\n',encoding='utf-8')
    print((out/'PACKAGE.json').read_text())

if __name__=='__main__':main()
