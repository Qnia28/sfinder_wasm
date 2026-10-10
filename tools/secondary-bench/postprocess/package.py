"""Triage result collection/portable packaging, independent of frozen execution sources.

Uses GitHub CLI credentials. Never imports or invokes a solver.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import sqlite3
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from ledger import append, digest, encode, projection


def read(file):
    return json.loads(Path(file).read_text(encoding='utf-8-sig'))


def write(file, value):
    Path(file).parent.mkdir(parents=True, exist_ok=True)
    with Path(file).open('x', encoding='utf-8') as stream:
        stream.write(encode(value)+'\n')


def sha(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def api(repository, endpoint, paged=False):
    command = ['gh', 'api'] + (['--paginate', '--slurp'] if paged else [])
    return json.loads(subprocess.check_output(command+[f'repos/{repository}/{endpoint}'], timeout=120))


def role(name):
    if name.startswith('triage-lock-'): return 'activation'
    if name.startswith('triage-data-'): return 'evidence'
    if name.startswith('triage-final-'): return 'report'
    if name.startswith('triage-independent-'): return 'audit'
    return 'excluded'


def members(bundle):
    found = set()
    for entry in bundle.infolist():
        name = entry.filename
        parts = name.rstrip('/').split('/')
        if (not name or '\\' in name or ':' in name or name.startswith('/')
                or any(p in ['', '.', '..'] for p in parts) or name in found
                or stat.S_ISLNK(entry.external_attr >> 16) or entry.flag_bits & 1):
            raise ValueError('unsafe/duplicate ZIP member: '+name)
        found.add(name)
    return {i.filename for i in bundle.infolist() if not i.is_dir()}


def validate_snapshots(bundle):
    names = members(bundle)
    snapshots = [n for n in names if PurePosixPath(n).name == 'SNAPSHOT.json']
    if not snapshots: raise ValueError('artifact has no sealed snapshot')
    for name in snapshots:
        s = json.loads(bundle.read(name)); prefix = name[:-len('SNAPSHOT.json')]
        if digest(dict(identity=s['identity'], members=s['members'])) != s['checkpointId']:
            raise ValueError('snapshot identity mismatch: '+name)
        expected = {prefix+m['path'] for m in s['members']}
        if len(expected) != len(s['members']) or expected != {n for n in names if n.startswith(prefix)}-{name}:
            raise ValueError('snapshot member set mismatch: '+name)
        for m in s['members']:
            target = prefix+m['path']
            with bundle.open(target) as stream: h = hashlib.file_digest(stream, 'sha256').hexdigest()
            if h != m['sha256'] or bundle.getinfo(target).file_size != m['bytes']:
                raise ValueError('snapshot bytes mismatch: '+target)
    return names


def timeout_map(text):
    """Read only top-level job IDs and numeric job timeouts; unknown remains unknown."""
    result = {}; job = None; in_jobs = False
    for line in text.splitlines():
        if line == 'jobs:': in_jobs = True; continue
        if not in_jobs: continue
        match = re.fullmatch(r'  ([\w-]+):', line)
        if match: job = match[1]
        match = re.fullmatch(r'    timeout-minutes: (\d+)\s*', line)
        if match and job: result[job] = int(match[1])
    return result


def job_accounting(jobs, workflows):
    prefix='secondary-rc' if '.github/workflows/secondary-rc-campaign.yml' in workflows else 'secondary-triage'
    campaign = timeout_map(workflows.get(f'.github/workflows/{prefix}-campaign.yml', ''))
    stage = timeout_map(workflows.get(f'.github/workflows/{prefix}-stage.yml', ''))
    details = []; unknown = []; seen = {}
    for job in jobs:
        if job.get('conclusion') == 'skipped': continue
        # GitHub clones retained successful jobs with new IDs on a partial rerun.
        # Only identical finished execution metadata on an assigned runner aliases.
        alias = (job['name'], job.get('started_at'), job.get('completed_at'), job.get('runner_id'))
        retained = job.get('conclusion') == 'success' and all(alias[1:])
        if retained and alias in seen:
            seen[alias].setdefault('retainedJobAliases', []).append(job['id'])
            continue
        name = job['name']
        key = 'plan' if name.endswith(' / plan') else 'run' if ' / run (' in name else None
        minutes = stage.get(key) if key else campaign.get(name)
        details.append(dict(id=job['id'], name=name, status=job['status'], conclusion=job.get('conclusion'), reservedMinutes=minutes))
        if retained: seen[alias] = details[-1]
        if minutes is None: unknown.append(job['id'])
    return dict(jobs=details, unknownReservationJobs=unknown,
                reservedHours=sum(j['reservedMinutes'] for j in details)/60 if not unknown else None)


def inspect_artifacts(root, inventory, run, workflows):
    locks = {}; plans = []; raw = {}; starts = {}; cp_ids = set(); errors = []; analysis_files = []
    reports = []; audits = []; dbs = []; environments = []
    # Reruns retain original final artifacts. Select the newest version of each
    # exact final artifact name, while retaining every version in the archive.
    selected_finals = set()
    final_groups = {}
    for a in inventory:
        if role(a['name']) == 'report' or (a['name'].startswith('triage-independent-') and a['name'].endswith('-FINAL')):
            final_groups.setdefault(a['name'], []).append(a)
    for name, versions in final_groups.items():
        if len(versions) == 1:
            selected_finals.add(versions[0]['id'])
        elif run.get('run_attempt', 1) > 1 and all(a.get('created_at') for a in versions):
            newest = max(a['created_at'] for a in versions)
            candidates = [a for a in versions if a['created_at'] == newest]
            if len(candidates) == 1: selected_finals.add(candidates[0]['id'])
            else: errors.append(dict(error='AMBIGUOUS_FINAL_ARTIFACT_VERSION', name=name))
        else:
            errors.append(dict(error='AMBIGUOUS_FINAL_ARTIFACT_VERSION', name=name))
    for a in inventory:
        if role(a['name']) == 'excluded': continue
        if not re.fullmatch(r'sha256:[a-f0-9]{64}',a.get('digest') or ''):
            errors.append(dict(artifactId=a['id'],error='MISSING_ARTIFACT_DIGEST'));continue
        file = root/'objects'/(a['digest'].removeprefix('sha256:')+'.zip')
        if not file.exists(): errors.append(dict(artifactId=a['id'], error='MISSING_ARTIFACT')); continue
        if 'sha256:'+sha(file) != a['digest']: raise ValueError('artifact digest mismatch')
        try:
            with zipfile.ZipFile(file) as z:
                names = validate_snapshots(z)
                for name in sorted(names):
                    leaf = PurePosixPath(name).name
                    pointer = dict(artifactId=a['id'], artifactDigest=a['digest'], member=name)
                    if leaf in ['LOCK.json', 'PARENT_LOCK.json', 'ANCESTOR_LOCK.json']:
                        value = json.loads(z.read(name))
                        if value['manifestHash'] != digest(value['manifest']): raise ValueError('lock manifest hash')
                        old = locks.setdefault(value['manifestHash'], value)
                        if old != value: raise ValueError('conflicting lock')
                    if leaf == 'STAGE_PLAN.json': plans.append((json.loads(z.read(name)), pointer))
                    if leaf in ['raw.jsonl', 'starts.jsonl']:
                        with z.open(name) as stream:
                            for number, line in enumerate(stream, 1):
                                if not line.strip(): continue
                                if not line.endswith(b'\n'): raise ValueError('torn evidence append')
                                value = json.loads(line); campaign = value['campaignId']; invocation = value['invocationId']
                                key = (campaign, invocation, value['callId'] if leaf == 'raw.jsonl' else value['executionAttemptId'])
                                target = raw if leaf == 'raw.jsonl' else starts
                                record = dict(value=value, rawHash=hashlib.sha256(line.rstrip(b'\r\n')).hexdigest(), pointer=dict(**pointer, line=number))
                                if key in target and target[key]['rawHash'] != record['rawHash']: raise ValueError('conflicting duplicate raw/start')
                                target.setdefault(key, record)
                    if leaf == 'REQUEST.json':
                        value = json.loads(z.read(name))
                        if value.get('job', {}).get('action') == 'cp-preflight' and (role(a['name']) == 'evidence'
                                or role(a['name']) == 'activation' and name.startswith('cp-preflight/')):
                            cp_ids.add(value['callId'])
                    if leaf == 'ENVIRONMENT.json': environments.append(pointer)
                    if leaf == 'REPORT.json' and role(a['name']) == 'report': reports.append((json.loads(z.read(name)), pointer))
                    if leaf == 'INDEPENDENT_AUDIT.json' and a['name'].endswith('-FINAL'): audits.append((json.loads(z.read(name)), pointer))
                    if leaf == 'AUDIT_INDEX.sqlite' and a['name'].endswith('-FINAL'): dbs.append(pointer)
                    if leaf in ['MANIFEST.json','TASKS.jsonl','LOCK.json','PARENT_LOCK.json','ANCESTOR_LOCK.json',
                                'STAGE_PLAN.json','SELECTION.json','ENVIRONMENT.json','REPORT.json','INDEPENDENT_AUDIT.json',
                                'GATE.json','PREREQUISITE_REUSE.json','ORIGINAL_WITNESS_AUDIT.json','PARENT_VALIDATION.json',
                                'CP_PREFLIGHT.json','PARENT_CP_PREFLIGHT.json','PRIOR_JOBS.json','PRIOR_RUN.json',
                                'PARENT_BACKEND.json','ANCESTOR_BACKEND.json','PRIOR_ARTIFACTS.json','HISTORY_INDEX.json',
                                'DOWNLOAD_INDEX.json','DOWNLOAD_COMPLETE.json','TRANSPORT_COMPLETE.json'] or pointer in dbs:
                        analysis_files.append(pointer)
        except (ValueError, KeyError, zipfile.BadZipFile) as exc:
            errors.append(dict(artifactId=a['id'], error=str(exc)))
    historical_reports = [dict(report=v,pointer=p) for v,p in reports if p['artifactId'] not in selected_finals]
    historical_audits = [dict(report=v,pointer=p) for v,p in audits if p['artifactId'] not in selected_finals]
    historical_dbs = [p for p in dbs if p['artifactId'] not in selected_finals]
    reports = [(v,p) for v,p in reports if p['artifactId'] in selected_finals]
    audits = [(v,p) for v,p in audits if p['artifactId'] in selected_finals]
    dbs = [p for p in dbs if p['artifactId'] in selected_finals]
    current = [l for l in locks.values() if str(l['invocationId']) == str(run['id'])]
    if len(current) != 1: errors.append(dict(error='CURRENT_ACTIVATION_LOCK_MISSING_OR_AMBIGUOUS'))
    lock = current[0] if len(current) == 1 else None
    if lock and lock.get('commit')!=run['head_sha']:
        errors.append(dict(error='ACTIVATION_COMMIT_MISMATCH'))
    calls = {}
    for plan, pointer in plans:
        owner = locks.get(plan['manifestHash'])
        if not owner: errors.append(dict(**pointer, error='PLAN_LOCK_MISSING')); continue
        for c in plan['expectedCalls']:
            key = (owner['manifest']['campaignId'], str(owner['invocationId']), c['callId'])
            value = dict(campaignId=key[0], invocationId=key[1], callId=key[2], phase=c['phase'],
                         manifestHash=plan['manifestHash'], planned=True, planPointer=pointer)
            if key in calls and calls[key]['manifestHash'] != value['manifestHash']: errors.append(dict(error='PLAN_IDENTITY_CONFLICT'))
            calls[key] = value
    for key, record in raw.items():
        r = record['value']; c = calls.setdefault(key, dict(campaignId=key[0], invocationId=key[1], callId=key[2], phase=r['phase'], planned=False))
        c.update(status=r['status'], rawHash=record['rawHash'], rawPointer=record['pointer'], executionAttemptId=r.get('executionAttemptId'))
        if not c['planned']: errors.append(dict(error='UNPLANNED_RAW', callId=key[2]))
        owner=locks.get(r.get('manifestHash'))
        if not owner or owner['invocationId']!=r['invocationId'] or owner['manifest']['campaignId']!=r['campaignId']:
            errors.append(dict(error='RAW_LOCK_IDENTITY_MISMATCH',callId=key[2]))
    start_rows = [dict(campaignId=k[0], invocationId=k[1], executionAttemptId=k[2], callId=v['value']['callId'], pointer=v['pointer']) for k,v in starts.items()]
    jobs = job_accounting(run.get('priorAttemptJobs', []) + run['jobs'], workflows)
    current_plans=[plan for plan,_ in plans if lock and plan['manifestHash']==lock['manifestHash']]
    planned_matrix=sum(plan.get('chunks',0) for plan in current_plans)
    allocated_matrix=sum(' / run (' in j['name'] for j in jobs['jobs'])
    unallocated=max(0,planned_matrix-allocated_matrix)
    prefix='secondary-rc' if '.github/workflows/secondary-rc-campaign.yml' in workflows else 'secondary-triage'
    matrix_minutes=timeout_map(workflows.get(f'.github/workflows/{prefix}-stage.yml','')).get('run')
    jobs.update(scheduledMatrixJobs=planned_matrix,unmaterializedScheduledJobs=unallocated)
    if unallocated:
        jobs['reservedHours']=jobs['reservedHours']+unallocated*matrix_minutes/60 if jobs['reservedHours'] is not None and matrix_minutes is not None else None
    m = lock['manifest'] if lock else {}
    prior_hours = m.get('provenance', {}).get('priorReservedRunnerHours', 0)
    prior_cp = m.get('provenance', {}).get('priorCpSyntheticCalls', 0)
    current_cp = len(cp_ids) if lock and not errors else None
    database_check = 'MISSING'
    if len(dbs) == 1 and lock:
        pointer = dbs[0]
        try:
            # Original auditor DB is compared with original JSONL, not trusted merely because it exists.
            expected = {k:v for k,v in raw.items() if k[1] == str(run['id'])}
            eligible = {lock['manifestHash']}
            if m.get('prerequisiteReuse'):
                # Bind to parent bytes via the continuation hash, rather than revision proximity.
                parent_hash = None
                for a in inventory:
                    if role(a['name']) != 'activation': continue
                    file = root/'objects'/(a['digest'][7:]+'.zip')
                    if not file.exists(): continue
                    with zipfile.ZipFile(file) as z:
                        member = 'continuation/PARENT_LOCK.json'
                        if member in z.namelist() and hashlib.sha256(z.read(member)).hexdigest()==m['continuation']['parentLockSha256']:
                            parent_hash = json.loads(z.read(member))['manifestHash']
                if not parent_hash: raise ValueError('reused parent lock bytes missing')
                eligible.add(parent_hash)
                expected.update({k:v for k,v in raw.items() if v['value']['manifestHash']==parent_hash
                                 and v['value']['phase'] in m['prerequisiteReuse']['phases']})
            with tempfile.TemporaryDirectory(prefix='index-check-', dir=root) as temp:
                dbfile=Path(temp)/'index.sqlite'
                with zipfile.ZipFile(root/'objects'/(pointer['artifactDigest'][7:]+'.zip')) as z, z.open(pointer['member']) as source, dbfile.open('wb') as target:
                    shutil.copyfileobj(source,target)
                db=sqlite3.connect(dbfile.as_uri()+'?mode=ro',uri=True)
                try:
                    db.execute('PRAGMA trusted_schema=OFF');db.execute('PRAGMA query_only=ON')
                    if db.execute('PRAGMA quick_check').fetchone()!=('ok',): raise ValueError('SQLite integrity check')
                    observed=set()
                    for (text,) in db.execute('SELECT raw FROM records'):
                        r=json.loads(text);key=(r['campaignId'],r['invocationId'],r['callId'])
                        if key in observed or key not in expected or r!=expected[key]['value']: raise ValueError('SQLite/raw evidence disagreement')
                        observed.add(key)
                    if observed!=set(expected): raise ValueError('SQLite missing raw records')
                    expected_starts={k:v for k,v in starts.items() if v['value'].get('manifestHash') in eligible}
                    observed_starts=set()
                    for (text,) in db.execute('SELECT raw FROM starts'):
                        s=json.loads(text);key=(s['campaignId'],s['invocationId'],s['executionAttemptId'])
                        if key in observed_starts or key not in expected_starts or s!=expected_starts[key]['value']: raise ValueError('SQLite/start disagreement')
                        observed_starts.add(key)
                    if observed_starts!=set(expected_starts): raise ValueError('SQLite missing start records')
                    database_check='PASS'
                finally: db.close()
        except (ValueError, KeyError, sqlite3.Error) as exc:
            errors.append(dict(error=str(exc), artifactId=pointer['artifactId']));database_check='FAIL'
    budget = dict(originMs=lock['originMs'], endMs=lock['endMs'], maxCalls=m['maxCalls'], maxRunnerHours=m['maxRunnerHours'],
                  maxParallel=m['maxParallel']) if lock else None
    return dict(campaignId=m.get('campaignId'), errors=errors, analysisFiles=analysis_files,
        reports=[dict(report=v, pointer=p) for v,p in reports], audits=[dict(report=v, pointer=p) for v,p in audits], rawDatabases=dbs,
        rawDatabaseParity=database_check,
        finalArtifactSelection=dict(rule='LATEST_CREATED_PER_EXACT_NAME_ON_RERUN',
            selectedArtifactIds=sorted(selected_finals), historicalReports=historical_reports,
            historicalAudits=historical_audits, historicalRawDatabases=historical_dbs),
        accounting=dict(calls=list(calls.values()), starts=start_rows, budget=budget, runnerAllocation=jobs,
            **(dict(priorReservedCalls=m['largeRun']['priorCalls'],priorCampaignId=m['provenance']['priorCampaignId']) if m.get('largeRun') else {}),
            priorReservedRunnerHours=prior_hours, cumulativeReservedRunnerHours=prior_hours+jobs['reservedHours'] if jobs['reservedHours'] is not None else None,
            priorCpSyntheticCalls=prior_cp, currentCpSyntheticCalls=current_cp,
            cumulativeCpSyntheticCalls=prior_cp+current_cp if current_cp is not None else None))


def collect(repository, run_id, out, allow_active=False):
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repository): raise ValueError('invalid repository')
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    if (out/'PACKAGE.json').exists(): raise ValueError('sealed package exists; use a new output directory')
    run = api(repository, f'actions/runs/{run_id}')
    if run['status'] != 'completed' and not allow_active: raise ValueError('run still active; collect after completion or explicitly use --allow-active')
    identity = dict(repository=repository, runId=run_id, runAttempt=run['run_attempt'])
    if (out/'IDENTITY.json').exists():
        if read(out/'IDENTITY.json') != identity: raise ValueError('collection identity changed')
    else: write(out/'IDENTITY.json', identity)
    artifacts = [a for p in api(repository, f'actions/runs/{run_id}/artifacts?per_page=100', True) for a in p['artifacts']]
    jobs = [j for p in api(repository, f'actions/runs/{run_id}/attempts/{run["run_attempt"]}/jobs?per_page=100', True) for j in p['jobs']]
    run['jobs'] = jobs
    if run['run_attempt'] > 1:
        run['priorAttemptJobs'] = [j for attempt in range(1, run['run_attempt'])
            for page in api(repository, f'actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100', True)
            for j in page['jobs']]
    objects = out/'objects'; objects.mkdir(exist_ok=True); failures = []
    if not allow_active:
        handoffs=[a for a in artifacts if a['name']==f'triage-handoff-{run_id}' and not a['expired']]
        if len(handoffs)==1:
            a=handoffs[0];archive=out/'REMOTE_HANDOFF.zip'
            try:
                with archive.open('wb') as stream:
                    subprocess.run(['gh','api',f'repos/{repository}/actions/artifacts/{a["id"]}/zip'],stdout=stream,check=True,timeout=600)
                if 'sha256:'+sha(archive)!=a['digest']:raise ValueError('handoff digest mismatch')
                with zipfile.ZipFile(archive) as z:
                    names=members(z);descriptor=json.loads(z.read('PACKAGE.json'))
                    if descriptor['runId']!=run_id or descriptor['repository']!=repository:raise ValueError('foreign handoff')
                    for item in descriptor['files']:
                        with z.open(item['path']) as stream:
                            if hashlib.file_digest(stream,'sha256').hexdigest()!=item['sha256']:raise ValueError('handoff member hash')
                    with tempfile.TemporaryDirectory(prefix='handoff-',dir=out) as temp:
                        evidence=Path(temp)/'EVIDENCE.zip'
                        with z.open('EVIDENCE.zip') as src,evidence.open('wb') as dst:shutil.copyfileobj(src,dst)
                        with zipfile.ZipFile(evidence) as raw:
                            known={x['digest'][7:]+'.zip':x for x in artifacts if role(x['name'])!='excluded' and re.fullmatch(r'sha256:[a-f0-9]{64}',x.get('digest') or '')}
                            for name in members(raw):
                                if not name.startswith('objects/') or name[8:] not in known:continue
                                dest=objects/name[8:]
                                with raw.open(name) as src,dest.with_suffix('.pending').open('wb') as dst:shutil.copyfileobj(src,dst)
                                pending=dest.with_suffix('.pending')
                                if sha(pending)!=name[8:-4]:raise ValueError('handoff object hash')
                                os.replace(pending,dest)
            except (ValueError,KeyError,OSError,zipfile.BadZipFile,subprocess.SubprocessError) as exc:
                # A partial/missing bundle must not prevent ordinary artifact recovery.
                print('Remote handoff cache unavailable:',str(exc),file=__import__('sys').stderr)
    for a in artifacts:
        if role(a['name']) == 'excluded': continue
        try:
            if a['expired'] or not re.fullmatch(r'sha256:[a-f0-9]{64}', a.get('digest') or ''): raise ValueError('expired or missing digest')
            file = objects/(a['digest'][7:]+'.zip')
            if file.exists():
                if sha(file) != a['digest'][7:]: raise ValueError('cached bytes changed')
                continue
            if shutil.disk_usage(out).free < a['size_in_bytes']*3+4*1024**3: raise ValueError('insufficient disk space')
            pending = file.with_suffix('.pending')
            with pending.open('wb') as stream:
                subprocess.run(['gh','api',f'repos/{repository}/actions/artifacts/{a["id"]}/zip'], stdout=stream, check=True, timeout=300)
            if sha(pending) != a['digest'][7:]: raise ValueError('download hash mismatch')
            os.replace(pending, file)
        except (ValueError, OSError, subprocess.SubprocessError) as exc:
            failures.append(dict(artifactId=a['id'], error=str(exc)))
    workflows = {}
    prefix='secondary-rc' if run.get('path','').split('@')[0]=='.github/workflows/secondary-rc-campaign.yml' else 'secondary-triage'
    for name in [f'.github/workflows/{prefix}-campaign.yml',f'.github/workflows/{prefix}-stage.yml']:
        value = api(repository, f'contents/{name}?ref={run["head_sha"]}')
        workflows[name] = base64.b64decode(value['content']).decode()
    final = api(repository, f'actions/runs/{run_id}')
    after = [a for p in api(repository, f'actions/runs/{run_id}/artifacts?per_page=100', True) for a in p['artifacts']]
    if {(a['id'],a.get('digest')) for a in artifacts} != {(a['id'],a.get('digest')) for a in after} or final['run_attempt'] != run['run_attempt']:
        failures.append(dict(error='REMOTE_INVENTORY_CHANGED_DURING_COLLECTION'))
    captured = dict(schemaVersion=1, **identity, run=run, inventory=artifacts, workflows=workflows, downloadErrors=failures,
                    activeSnapshot=run['status']!='completed', solverCalls=0)
    # Collection metadata is a resumable observation, not the immutable final package.
    temporary = out/'COLLECTION.pending'; temporary.write_text(encode(captured)+'\n', encoding='utf-8')
    os.replace(temporary, out/'COLLECTION.json')
    return captured


def bundle_active(repository, run_id, out):
    """Final workflow job: snapshot completed measurement jobs, never claim run completion."""
    captured = collect(repository, run_id, out, allow_active=True)
    if captured['downloadErrors']:
        # One cache-preserving transport retry, no measurement retries.
        captured = collect(repository, run_id, out, allow_active=True)
    package(out)
    summary = read(Path(out)/'SUMMARY.json')
    print(encode(dict(state='BUNDLED_WORKFLOW_SNAPSHOT',runId=run_id,
        executionCompleteness=summary['executionCompleteness'],evidenceValidity=summary['evidenceValidity'],
        rawDatabaseParity=summary['rawDatabaseParity'],downloadErrors=captured['downloadErrors'],solverCalls=0)))
    return 1 if captured['downloadErrors'] else 0


def package(out):
    out = Path(out); capture = read(out/'COLLECTION.json')
    if (out/'PACKAGE.json').exists(): raise ValueError('package already sealed')
    result = inspect_artifacts(out, capture['inventory'], capture['run'], capture['workflows'])
    errors = capture['downloadErrors']+result['errors']
    ready = (not errors and not capture['activeSnapshot'] and len(result['reports'])==1 and len(result['audits'])==1
             and len(result['rawDatabases'])==1)
    # Presence/readiness is distinct from a valid/complete experiment.
    validity = result['audits'][0]['report'].get('status') if len(result['audits'])==1 else 'MISSING'
    completeness = result['reports'][0]['report'].get('executionCompleteness') if len(result['reports'])==1 else 'MISSING'
    summary = dict(schemaVersion=1, repository=capture['repository'], runId=capture['runId'], runAttempt=capture['runAttempt'],
        campaignId=result['campaignId'], collectionState='COMPLETE' if not errors and not capture['activeSnapshot'] else 'INCOMPLETE',
        analysisMaterials='AVAILABLE' if ready else 'PARTIAL', evidenceValidity=validity, executionCompleteness=completeness,
        errors=errors, accounting=result['accounting'], rawDatabaseParity=result['rawDatabaseParity'], decision='LLM_REVIEW_REQUIRED', solverCalls=0,
        reportFiles=[r['pointer'] for r in result['reports']], auditFiles=[r['pointer'] for r in result['audits']],
        rawDatabaseFiles=result['rawDatabases'],
        finalArtifactSelection=result['finalArtifactSelection'],
        artifactIndex=[dict(**a, collectionRole=role(a['name']), object='objects/'+a['digest'][7:]+'.zip'
                            if role(a['name'])!='excluded' and re.fullmatch(r'sha256:[a-f0-9]{64}', a.get('digest') or '') and (out/'objects'/(a['digest'][7:]+'.zip')).exists() else None)
                       for a in capture['inventory']],
        scope='Selected triage activation/data/final/independent artifacts; payload duplicates excluded. Source code is referenced by commit/hashes, not archived.',
        sourceCommit=capture['run']['head_sha'])
    objects_bytes=sum(f.stat().st_size for f in (out/'objects').glob('*.zip'))
    analysis_bytes=0
    for pointer in result['analysisFiles']:
        with zipfile.ZipFile(out/'objects'/(pointer['artifactDigest'][7:]+'.zip')) as z:
            analysis_bytes+=z.getinfo(pointer['member']).file_size
    if shutil.disk_usage(out).free<objects_bytes+analysis_bytes+4*1024**3:
        raise ValueError('insufficient disk space for portable archives')
    write(out/'SUMMARY.json', summary)
    instructions = ('# Collected experiment evidence\n\n'
        'Read SUMMARY.json first: collection completeness, execution completeness, evidence validity and candidate decision are separate.\n'
        'reports/ contains original reports, raw SQLite, plans, selection and locks under artifact/member paths.\n'
        'EVIDENCE.zip retains original artifact ZIP bytes indexed by SHA256; activation includes fixtures and indexed parent history.\n'
        'The package collector verifies bytes/snapshots; it does not independently rerun the witness auditor or solver.\n'
        'Use the LLM review instructions in tools/secondary-bench/postprocess/README_KO.md. No automatic candidate decision.\n')
    for filename in ['ANALYSIS.zip','EVIDENCE.zip']:
        if (out/filename).exists(): raise ValueError('archive exists; refusing overwrite')
    with zipfile.ZipFile(out/'ANALYSIS.zip', 'x', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as target:
        target.write(out/'SUMMARY.json','SUMMARY.json'); target.write(out/'COLLECTION.json','COLLECTION.json')
        target.writestr('README.md', instructions)
        for p in result['analysisFiles']:
            file = out/'objects'/(p['artifactDigest'][7:]+'.zip')
            with zipfile.ZipFile(file) as source, source.open(p['member']) as stream:
                with target.open(f'reports/{p["artifactId"]}/{p["member"]}', 'w', force_zip64=True) as destination:
                    shutil.copyfileobj(stream, destination)
    with zipfile.ZipFile(out/'EVIDENCE.zip','x',compression=zipfile.ZIP_STORED,allowZip64=True) as target:
        target.write(out/'SUMMARY.json','SUMMARY.json'); target.write(out/'COLLECTION.json','COLLECTION.json')
        target.writestr('README.md', instructions)
        selected={a['object'] for a in summary['artifactIndex'] if a['object']}
        for name in sorted(selected): target.write(out/name,name)
    descriptor = dict(schemaVersion=1, repository=summary['repository'], runId=summary['runId'],runAttempt=summary['runAttempt'],
        files=[dict(path=name,sha256=sha(out/name),bytes=(out/name).stat().st_size) for name in ['SUMMARY.json','COLLECTION.json','ANALYSIS.zip','EVIDENCE.zip']],
        solverCalls=0, performanceDecision='LLM_REVIEW_REQUIRED')
    write(out/'PACKAGE.json',descriptor)
    verify(out)
    return summary


def verify(out):
    out=Path(out); descriptor=read(out/'PACKAGE.json')
    expected={'SUMMARY.json','COLLECTION.json','ANALYSIS.zip','EVIDENCE.zip'}
    if {m['path'] for m in descriptor['files']}!=expected or len(descriptor['files'])!=4: raise ValueError('package member contract')
    for m in descriptor['files']:
        file=out/m['path']
        if sha(file)!=m['sha256'] or file.stat().st_size!=m['bytes']: raise ValueError('package bytes changed: '+m['path'])
    summary=read(out/'SUMMARY.json')
    with zipfile.ZipFile(out/'EVIDENCE.zip') as evidence:
        names=members(evidence)
        if evidence.read('SUMMARY.json')!=(out/'SUMMARY.json').read_bytes() or evidence.read('COLLECTION.json')!=(out/'COLLECTION.json').read_bytes():
            raise ValueError('evidence metadata mismatch')
        for a in summary['artifactIndex']:
            if a['object']:
                if a['object'] not in names: raise ValueError('missing evidence object')
                with evidence.open(a['object']) as stream: h=hashlib.file_digest(stream,'sha256').hexdigest()
                if 'sha256:'+h!=a['digest']: raise ValueError('evidence object mismatch')
    with zipfile.ZipFile(out/'ANALYSIS.zip') as analysis:
        members(analysis)
        if analysis.read('SUMMARY.json')!=(out/'SUMMARY.json').read_bytes(): raise ValueError('analysis summary mismatch')
    return summary


def ingest(out, ledger):
    out=Path(out).resolve(); summary=verify(out)
    payload={k:summary[k] for k in ['repository','runId','runAttempt','campaignId','collectionState','analysisMaterials',
                                   'evidenceValidity','executionCompleteness','accounting','errors']}
    payload.update(packagePath=str(out), packageSha256=sha(out/'PACKAGE.json'))
    return append(ledger,'COLLECTION',payload)


def refresh(ledger):
    # Convenience projection only. The append-only DB remains authoritative.
    target=Path(ledger).with_suffix('.CURRENT.json'); pending=target.with_suffix('.pending')
    pending.write_text(encode(projection(ledger))+'\n',encoding='utf-8');os.replace(pending,target)


def main():
    p=argparse.ArgumentParser(description=__doc__); commands=p.add_subparsers(dest='command',required=True)
    c=commands.add_parser('collect'); c.add_argument('--repo',required=True); c.add_argument('--run',required=True,type=int)
    c.add_argument('--out',required=True); c.add_argument('--ledger',required=True); c.add_argument('--allow-active',action='store_true')
    c=commands.add_parser('bundle'); c.add_argument('--repo',required=True); c.add_argument('--run',required=True,type=int); c.add_argument('--out',required=True)
    c=commands.add_parser('pack'); c.add_argument('--out',required=True); c.add_argument('--ledger',required=True)
    c=commands.add_parser('verify'); c.add_argument('--out',required=True)
    c=commands.add_parser('ingest'); c.add_argument('--out',required=True); c.add_argument('--ledger',required=True)
    c=commands.add_parser('status'); c.add_argument('--ledger',required=True); c.add_argument('--out',required=True)
    c=commands.add_parser('record-analysis'); c.add_argument('--ledger',required=True); c.add_argument('--package',required=True)
    c.add_argument('--file',required=True); c.add_argument('--author',required=True)
    c=commands.add_parser('register'); c.add_argument('--ledger',required=True); c.add_argument('--launch',required=True); c.add_argument('--manifest',required=True)
    c=commands.add_parser('observe'); c.add_argument('--ledger',required=True); c.add_argument('--repo',required=True); c.add_argument('--run',required=True,type=int)
    args=p.parse_args()
    if args.command=='bundle': return bundle_active(args.repo,args.run,args.out)
    if args.command=='collect':
        try:
            capture=collect(args.repo,args.run,args.out,args.allow_active)
        except (ValueError,OSError,subprocess.SubprocessError) as exc:
            append(args.ledger,'COLLECTION_ATTEMPT',dict(repository=args.repo,runId=args.run,
                collectionPath=str(Path(args.out).resolve()),errors=[dict(error=str(exc))],solverCalls=0))
            refresh(args.ledger)
            raise
        if capture['downloadErrors']:
            append(args.ledger,'COLLECTION_ATTEMPT',dict(repository=args.repo,runId=args.run,
                runAttempt=capture['runAttempt'],collectionPath=str(Path(args.out).resolve()),
                inventorySha256=digest(capture['inventory']),errors=capture['downloadErrors'],solverCalls=0))
            refresh(args.ledger)
            print(encode(dict(state='DOWNLOAD_INCOMPLETE_RETRY_SAME_DIRECTORY',errors=capture['downloadErrors'],solverCalls=0)))
            return 1
        package(args.out); ingest(args.out,args.ledger)
    elif args.command=='pack': package(args.out); ingest(args.out,args.ledger)
    elif args.command=='verify': verify(args.out)
    elif args.command=='ingest': ingest(args.out,args.ledger)
    elif args.command=='status':
        state=projection(args.ledger); write(args.out,state)
    elif args.command=='record-analysis':
        summary=verify(args.package); file=Path(args.file)
        append(args.ledger,'LLM_ANALYSIS',dict(repository=summary['repository'],runId=summary['runId'],campaignId=summary['campaignId'],
            packageSha256=sha(Path(args.package)/'PACKAGE.json'),author=args.author,documentSha256=sha(file),
            document=file.read_text(encoding='utf-8'),role='HUMAN_OR_LLM_AUTHORED_NOT_AUTOMATIC_PERFORMANCE_PASS'))
    elif args.command=='register':
        launch=read(args.launch);manifest=read(args.manifest)
        if launch['manifestHash']!=digest(manifest):raise ValueError('launch/manifest mismatch')
        append(args.ledger,'RUN_REGISTERED',dict(repository=launch['repository'],runId=launch['runId'],
            campaignId=manifest['campaignId'],manifestHash=digest(manifest),launchSha256=sha(args.launch),
            originalLaunch=launch,manifest=manifest,role='DECLARED_LAUNCH_NOT_REMOTE_COMPLETION_PROOF'))
    elif args.command=='observe':
        if not re.fullmatch(r'[\w.-]+/[\w.-]+',args.repo):raise ValueError('invalid repository')
        run=api(args.repo,f'actions/runs/{args.run}')
        jobs=[j for page in api(args.repo,f'actions/runs/{args.run}/attempts/{run["run_attempt"]}/jobs?per_page=100',True) for j in page['jobs']]
        append(args.ledger,'RUN_OBSERVED',dict(repository=args.repo,runId=args.run,runAttempt=run['run_attempt'],
            run=run,jobs=jobs,role='REMOTE_OPERATIONAL_STATE_NOT_EVIDENCE_OR_PERFORMANCE_PASS'))
    if hasattr(args,'ledger'): refresh(args.ledger)
    print(encode(dict(state='DONE',command=args.command,solverCalls=0)))
    return 0


if __name__=='__main__': raise SystemExit(main())
