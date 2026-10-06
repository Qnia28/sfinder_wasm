"""Independent, stdlib-only evidence auditor. Never imports or executes a solver.

Reads one fixture/result at a time; raw records are indexed on disk in SQLite.
PASS means bytes/contracts/witnesses, NOT independent optimality or performance.
"""
import argparse
import collections
import hashlib
import json
import math
import sqlite3
import statistics
from pathlib import Path

PHASES = ['CANARY', 'CALIBRATION', 'ALL_INITIAL', 'PER_SAVE_INITIAL', 'SEED_DIAGNOSTIC',
          'TRIVIAL_CONTRACT', 'ALL_CONFIRMATION', 'PER_SAVE_CONFIRMATION']

def encode(v, sorted_keys=True):
    # Node JSON.stringify serializes integral floats without a decimal suffix.
    def numbers(x):
        if isinstance(x, float):
            assert math.isfinite(x), 'nonfinite JSON'
            return int(x) if x.is_integer() else x
        if isinstance(x, list): return [numbers(i) for i in x]
        if isinstance(x, dict): return {k: numbers(i) for k, i in x.items()}
        return x
    return json.dumps(numbers(v), sort_keys=sorted_keys, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

def digest(v): return hashlib.sha256(encode(v).encode()).hexdigest()
def sha(p):
    with p.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def member(root, name):
    assert isinstance(name, str) and '\\' not in name and not name.startswith('/')
    assert all(s not in ['', '.', '..'] for s in name.split('/'))
    p = (root / name).resolve(); assert root.resolve() in p.parents and not p.is_symlink(), 'unsafe member'
    return p
def require(ok, message):
    if not ok: raise ValueError(message)

def snapshot(directory):
    s = read(directory / 'SNAPSHOT.json')
    require(s['checkpointId'] == digest(dict(identity=s['identity'], members=s['members'])), 'snapshot identity hash')
    names = set()
    for m in s['members']:
        require(m['path'] not in names, 'duplicate snapshot member'); names.add(m['path'])
        p = member(directory, m['path'])
        require(p.stat().st_size == m['bytes'] and sha(p) == m['sha256'], 'snapshot member bytes: ' + m['path'])
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    require(actual == names | {'SNAPSHOT.json'}, 'snapshot unindexed/missing files')
    return s

def vector(f, selected):
    require(isinstance(selected, list) and len(selected) == f['K'] and len(set(selected)) == f['K'], 'witness cardinality/duplicates')
    require(all(type(i) is int and 0 <= i < len(f['keys']) for i in selected), 'unknown stable ID')
    chosen = set(selected); values = []
    for row in f['rows']:
        q = max((q for i, q in row if i in chosen), default=0)
        require(q > 0, 'witness misses original weighted row'); values.append(q)
    return sorted(values)

def fixture_check(f, ref):
    require(f['schema'] == 1 and f['id'] == ref['id'], 'fixture schema/identity')
    keys = f['keys']; require(all(isinstance(k, str) for k in keys) and keys == sorted(set(keys)), 'stable universe')
    require(type(f['K']) is int and 0 <= f['K'] <= len(keys), 'K range')
    require(f['cardinalityProof']['status'] == 'PROVEN' and isinstance(f['cardinalityProof']['backend'], str), 'K proof provenance')
    for row in f['rows']:
        require(bool(row) and len({e[0] for e in row}) == len(row), 'empty/duplicate original edge')
        require(all(len(e) == 2 and type(e[0]) is int and 0 <= e[0] < len(keys)
                    and type(e[1]) is int and 0 < e[1] <= 0xffffffff for e in row), 'weighted edge')
    vector(f, f['seed'])
    m = ref['metadata']; c = f['origin']['command']
    require(c['clear'] == 4 and c['useHold'] is True and c['exactHumanQuality'] == 'true', 'clear/hold/exact')
    require(c['queueLength'] == c['piecesNeeded'] + 1 and c['savedPieceCount'] == 1, 'N+1')
    require(c['pattern'] == m['pattern'] and c['family'] == m['family'], 'family/pattern')
    require(f['K'] == m['K'] and len(keys) == m['n'] and len(f['rows']) == m['R'], 'fixture dimensions')
    require(bool(f.get('primaryHard')) == m['primary_hard'], 'primaryHard provenance')

def compile_calls(m, templates, phase, selected=None):
    refs = {r['id']: r for r in m['inputs']}; tasks = []
    for t in templates:
        if t['phase'] != phase or t['conditional'] and t['fixture_ids'][0] not in (selected or set()): continue
        calls = []
        def add(fid, variant, repeat, extra=None):
            ident = dict(campaignId=m['campaignId'], phase=phase, taskId=t['task_id'], inputId=fid,
                         inputHash=refs[fid]['sha256'], variant=variant, repeat=repeat, **(extra or {}))
            if m.get('continuation'):ident['measurementEpoch']=m['revision']
            calls.append(dict(**ident, callId=digest(ident), limits=dict(startupMs=10000,
                callMs=30000 if phase == 'TRIVIAL_CONTRACT' else 300000, reapMs=5000)))
        if 'pairs' in t:
            for p in t['pairs']:
                for variant in p['order']:
                    add(t['fixture_ids'][0], t.get('baseline_variant', variant) if variant == 'BASELINE' else variant,
                        p['repeat'], dict(pairId=p['pair_id'], comparator=p['comparator'], order=p['order']))
        elif 'trials' in t:
            for trial in t['trials']:
                for variant in trial['order']: add(t['fixture_ids'][0], variant, trial['repeat'], dict(trialId=f"{t['task_id']}/{trial['repeat']}"))
        else:
            for fid in t['fixture_ids']:
                for variant in t['variants']: add(fid, variant, 1)
        require(len(calls) == t['calls'], 'template call count')
        tasks.append(calls)
    return tasks

def chunks(tasks, job):
    capacity = job['jobMs'] - job['reserveMs'] - job['setupMs'] - job['parts'] * job['checkpointMs']
    result = []; current = []; cost = 0
    for task in tasks:
        worst = sum(c['limits']['startupMs'] + c['limits']['callMs'] + 2*c['limits']['reapMs'] + job['scopeOverheadMs'] for c in task)
        require(worst <= capacity, 'task budget')
        if current and (len(current) == job['parts'] or cost + worst > capacity):
            result.append(current); current = []; cost = 0
        current.append(task); cost += worst
    if current: result.append(current)
    require(len(result) <= 256, 'matrix cap'); return result

def cp_check(e):
    require(e.get('status') == 'EXACT' and e.get('reaped') is True, 'CP preflight scope/result')
    r = e['result']; require(r.get('cpPreflight') == 'PASS' and r.get('qualityComplete') is True
        and r.get('tieComplete') is True and r['result']['keys'] == ['b'] and r['result']['qualityVector'] == [2], 'CP preflight quality/tie')
    require(r['result'].get('completed') is True and r['result'].get('qualityComplete') is True
        and r['result'].get('tieComplete') is True, 'CP native proof flags')
    require(e['memoryScope']['memoryMax'] == 3221225472 and e['memoryScope']['swapMax'] == 0, 'CP preflight scope')

def cp_failure(r):
    e = r.get('execution') or {}; record = e.get('result') or {}; native = record.get('result') or {}
    events = record.get('trace', []) + e.get('policyTrace', [])
    if any(t.get('name')=='cp-end' and t.get('kind') in ['ERROR','INVALID'] for t in events): return True
    failure = native.get('secondaryCpFailure')
    return bool(failure and failure not in ['Error: CP secondary time limit reached','CP secondary time limit reached',
        'TIMEOUT','UNKNOWN','FEASIBLE','incomplete CP proof'])

GATE_CONTRACT = dict(id='evidence-first-v2', execution='BLOCK_INVALID_EVIDENCE_OR_UNSAFE_RUNTIME',
    calibration='REPORT_UNCERTAINTY_WITHOUT_BLOCKING_COLLECTION',outcomes='RETAIN_CENSORED_AND_REGRESSING_CANDIDATES',
    promotion='SEPARATE_REVIEW_NO_AUTOMATIC_PASS',automaticExtraCalls=0)

def evidence_first(contract):
    if contract is None:return False
    require(contract==GATE_CONTRACT,'unsupported gate contract')
    return True

def phase_gate(db, phase, contract=None):
    collect=evidence_first(contract);require(phase in ['CANARY','CALIBRATION'],'unknown prerequisite phase')
    observations=[]
    pairs = collections.defaultdict(list); groups = collections.defaultdict(list)
    for (text,) in db.execute('SELECT raw FROM records WHERE phase=?', (phase,)):
        r = json.loads(text)
        require(r['status'] in ['EXACT','TIMEOUT_CALL','INCOMPLETE']+(['OOM'] if collect else [])
            and r['execution'].get('reaped') is True, 'gate execution/OOM/coverage')
        if r['status']=='OOM':
            scope=r['execution'].get('memoryScope') or {}
            require(scope.get('memoryMax')==3221225472 and scope.get('swapMax')==0,'unproven OOM scope')
        require(not cp_failure(r), 'gate CP runtime/proof failure')
        v = r.get('execution',{}).get('result') or {}
        summary = dict(inputId=r['inputId'],variant=r['variant'],status=r['status'],ms=r['ms'],verified=v.get('verified'),native=v.get('result'),
            repeat=r.get('repeat'),order=r.get('order'))
        groups[r['inputId']].append(summary)
        if 'pairId' in r: pairs[r['pairId']].append(summary)
    require(bool(groups), 'empty gate population')
    if phase == 'CANARY':
        for fid,group in groups.items():
            by_variant = {r['variant']:r for r in group}
            require(len(group)==4 and set(by_variant)=={'PRECHANGE_BASELINE','BASELINE','A','B'}, 'canary variant coverage')
            base = by_variant['BASELINE']
            if base['status']!=by_variant['PRECHANGE_BASELINE']['status']:
                require(collect,'baseline status drift');observations.append(dict(inputId=fid,reason='BASELINE_STATUS_DRIFT'))
            if base['status']=='EXACT' and any(r['status']!='EXACT' for r in group):
                require(collect,'canary completion regression');observations.append(dict(inputId=fid,reason='POSSIBLE_COMPLETION_REGRESSION'))
            require(len({digest(r['verified']) for r in group if r['status']=='EXACT'})<=1, 'canary witness drift')
    else:
        per_input = collections.defaultdict(list);details=collections.defaultdict(list);discordant=set()
        for pid, pair in pairs.items():
            require(len(pair)==2, 'calibration partial pair')
            off = next((r for r in pair if r['variant']=='TRACE_OFF_BASELINE'),None)
            on = next((r for r in pair if r['variant']=='TRACE_ON_BASELINE'),None)
            require(off and on and off['inputId']==on['inputId'], 'calibration variant/identity')
            fid=off['inputId']
            if off['status']!=on['status']:
                require(collect,'calibration variant/status');discordant.add(fid)
            complete=off['status']==on['status']=='EXACT'
            details[fid].append(dict(pairId=pid,repeat=off['repeat'],order=off['order'],offStatus=off['status'],onStatus=on['status'],
                offMs=off['ms'],onMs=on['ms'],deltaMs=on['ms']-off['ms'] if complete else None))
            if complete:
                require(off['verified']==on['verified'], 'calibration witness drift')
                if not off['native'].get('secondaryCpStarted') and not on['native'].get('secondaryCpStarted'):
                    require(off['native'].get('qualitySearchedStates')==on['native'].get('qualitySearchedStates'), 'calibration states drift')
                per_input[fid].append((off['ms'],on['ms']-off['ms']))
        if collect:
            inputs=[]
            for fid,ps in details.items():
                values=per_input[fid];b=statistics.median(v[0] for v in values) if values else None
                d=statistics.median(v[1] for v in values) if values else None;limit=max(5,.05*b) if b is not None else None
                inputs.append(dict(inputId=fid,completePairs=len(values),baseMedianMs=b,addedMedianMs=d,limitMs=limit,
                    exceedsScreen=d is not None and d>limit,issues=['STATUS_DISCORDANCE'] if fid in discordant else [],pairs=ps))
            valid=[i for i in inputs if i['completePairs']];reasons=[]
            delta=statistics.median(i['addedMedianMs'] for i in valid) if valid else None
            limit=max(2,.02*statistics.median(i['baseMedianMs'] for i in valid)) if valid else None
            if len(valid)<12:reasons.append('INSUFFICIENT_COMPLETE_CALIBRATION')
            if discordant:reasons.append('CALIBRATION_STATUS_DISCORDANCE')
            if valid and delta>limit:reasons.append('AGGREGATE_OVERHEAD_SCREEN')
            if any(i['exceedsScreen'] for i in inputs):reasons.append('PER_INPUT_OVERHEAD_SCREEN')
            return dict(evidenceStatus='PASS',collectionAllowed=True,calibration=dict(status='REVIEW_REQUIRED' if reasons else 'SCREEN_CLEAR',
                reasons=reasons,completedInputs=len(valid),aggregateDeltaMs=delta,aggregateLimitMs=limit,observations=inputs,
                confirmedOverhead=False,automaticExtraCalls=0,
                claimScope='Instrumented policy comparisons only; uninstrumented fast-path and promotion claims require separate review.'))
        require(len(per_input)>=12, 'calibration completed inputs <12')
        baselines = [statistics.median(v[0] for v in pairs) for pairs in per_input.values()]
        deltas = [statistics.median(v[1] for v in pairs) for pairs in per_input.values()]
        require(statistics.median(deltas)<=max(2,.02*statistics.median(baselines)), 'calibration aggregate overhead')
        require(all(d<=max(5,.05*b) for b,d in zip(baselines,deltas)), 'calibration per-input overhead')
    return dict(evidenceStatus='PASS',collectionAllowed=True,observations=observations)

def required_confirmation(db, m, phase):
    pairs = collections.defaultdict(list)
    for (text,) in db.execute('SELECT raw FROM records WHERE phase=?', (phase,)):
        r = json.loads(text)
        pairs[r['pairId']].append(dict(inputId=r['inputId'],variant=r['variant'],comparator=r['comparator'],
            status=r['status'],ms=r['ms'],metadata=r['metadata'],scope=(r.get('execution') or {}).get('memoryScope') or {}))
    inputs = {}
    for pair in pairs.values():
        head=pair[0];key=(head['inputId'],head['comparator'])
        if key not in inputs: inputs[key]=dict(id=head['inputId'],comp=head['comparator'],meta=head['metadata'],deltas=[],base=[],candidate=[],issues=False,resources=[])
        i=inputs[key];base=next((r for r in pair if r['variant']=='BASELINE'),None);candidate=next((r for r in pair if r['variant']!='BASELINE'),None)
        if len(pair)!=2 or not base or not candidate: i['issues']=True;continue
        if base['status']!=candidate['status']:i['issues']=True
        if base['status']==candidate['status']=='EXACT':
            i['deltas'].append(candidate['ms']-base['ms']);i['base'].append(base['ms']);i['candidate'].append(candidate['ms'])
        for resource in ['cpuUsec','peakBytes']:
            a=base['scope'].get(resource);b=candidate['scope'].get(resource)
            if a and a>0 and b is not None:i['resources'].append((resource,b/a))
    selected=set()
    for comp in {i['comp'] for i in inputs.values()}:
        valid=[i for i in inputs.values() if i['comp']==comp and i['deltas']];n=math.ceil(len(valid)*.1)
        tie=lambda i:hashlib.sha256((m['design']['selection_seed']+'|'+i['id']).encode()).hexdigest()
        ordered=sorted(valid,key=lambda i:(statistics.median(i['deltas']),tie(i)))
        if n:selected.update(i['id'] for i in ordered[:n]+ordered[-n:])
    for i in inputs.values():
        meta=i['meta'];changed=(not meta['primary_hard'] and meta['d']>=17) or (meta['primary_hard'] and meta['d']<=16)
        variability=any(v and min(v)>0 and max(v)/min(v)>=1.10 for v in [i['base'],i['candidate']])
        fast=i['deltas'] and statistics.median(i['deltas'])>=.95*max(5,.05*statistics.median(i['base']))
        resources=any(statistics.median([v for k,v in i['resources'] if k==resource])>=1.045
            for resource in ['cpuUsec','peakBytes'] if any(k==resource for k,_ in i['resources']))
        if changed or i['issues'] or variability or fast or resources:selected.add(i['id'])
    selected.update(fid for fid in m['design']['retest']['always_include_fixture_ids'] if any(i['id']==fid for i in inputs.values()))
    return selected

def continuation_check(m, config=None, lock=None):
    c=m.get('startupContinuation')
    if not c:return 0
    require(c['id']=='canary-witness-serialization-repair-v1', 'unsupported continuation')
    require(c['reservedCalls']==32 and c['reservedCpSyntheticCalls']==4 and c['reservedRunnerHours']==14, 'prior reservation changed')
    require(c['originUtc']==m['activationRecovery']['originUtc'], 'continuation origin reset')
    require(c['priorEvidencePooled'] is False and c['priorEvidenceReclassified'] is False, 'prior evidence pooled/reclassified')
    require(14+13*2.5<=36*2.5, 'prior runner reservation')
    if lock:
        old=read(config/'CONTINUATION_PRIOR_LOCK.json');plan=read(config/'CONTINUATION_PRIOR_PLAN.json')
        validation=read(config/'CONTINUATION_VALIDATION.json')
        for filename,snapshot_name,original_name in [('CONTINUATION_PRIOR_LOCK.json','CONTINUATION_LOCK_SNAPSHOT.json','LOCK.json'),
                ('CONTINUATION_PRIOR_PLAN.json','CONTINUATION_PLAN_SNAPSHOT.json','STAGE_PLAN.json')]:
            s=read(config/snapshot_name)
            require(s['checkpointId']==digest(dict(identity=s['identity'],members=s['members'])), 'prior snapshot identity')
            proof=next(v for v in s['members'] if v['path']==original_name)
            require(proof['sha256']==sha(config/filename) and proof['bytes']==(config/filename).stat().st_size, 'prior sealed lock/plan bytes')
        previous=old['manifest'];run=validation['priorRun']
        require(run['id']==c['priorRunId'] and run['status']=='completed' and run['conclusion']=='failure' and run['run_attempt']==1, 'prior failed run')
        require(old['invocationId']==str(c['priorRunId']) and old['manifestHash']==digest(previous) and old['commit']==run['head_sha'], 'prior lock/run binding')
        require(old['originMs']==lock['originMs'] and old['endMs']==lock['endMs'], 'original campaign clock not retained')
        require(not previous.get('startupContinuation'), 'recursive continuation forbidden')
        for k in ['profileContract','baselineFiles','tasksHash']:
            require(previous[k]==m[k], 'prior condition changed: '+k)
        require(previous['sourceFiles']['product']==m['sourceFiles']['product'], 'solver/product changed')
        before={f['id']:f for f in previous['inputs']}
        for f in m['inputs']:
            old_input=before[f['id']]
            require({k:v for k,v in f.items() if k!='expectedWitness'}=={k:v for k,v in old_input.items() if k!='expectedWitness'}, 'prior original fixture changed')
            require((f.get('expectedWitness') or {}).get('sha256')==(old_input.get('expectedWitness') or {}).get('sha256'), 'prior witness hash changed')
            if f.get('expectedWitness'):require(f['expectedWitness']['contract']=='INSERTION_SELECTED_QUALITY','corrected witness contract')
        require(plan['phase']=='CANARY' and plan['chunks']==3 and plan['manifestHash']==old['manifestHash'], 'prior phase/plan')
        require(len(plan['expectedCalls'])==32 and len({v['callId'] for v in plan['expectedCalls']})==32, 'prior conservative call debit')
        require(all(v['phase']=='CANARY' and v['limits']['callMs']==300000 for v in plan['expectedCalls']), 'prior non-canary execution')
        templates=[json.loads(l) for l in (config/'TASKS.jsonl').read_text(encoding='utf-8').splitlines()]
        require(plan['expectedCalls']==[v for task in compile_calls(previous,templates,'CANARY') for v in task], 'prior independent schedule')
        artifacts=validation['priorArtifacts']
        for receipt in [c['priorLock'],c['priorPlan']]:
            require(any(a['id']==receipt['artifactId'] and a['digest']==receipt['digest'] and not a['expired'] for a in artifacts), 'prior backend receipt')
        require(not any(any('-'+p+'-' in a['name'] for p in PHASES if p!='CANARY') for a in artifacts), 'prior post-canary artifacts')
        allocated=[j for j in validation['priorJobs'] if j['conclusion']!='skipped']
        require(len(allocated)<=7 and all(j['name'] in ['activate','canary / plan','audit','independent-audit'] or j['name'].startswith('canary / run (') for j in allocated), 'prior job reservation')
        require(validation['status']=='PASS' and validation['solverCalls']==0, 'continuation validation')
    return 32

def common_parent_check(m, config, lock=None):
    c=m.get('continuation')
    if not c:return 0
    require(not m.get('startupContinuation'),'dedicated r4 path mixed with common continuation')
    root=config/'continuation';p=root/'PARENT_LOCK.json';history=root/'history'
    require(sha(p)==c['parentLockSha256'],'parent lock bytes');parent=read(p);old=parent['manifest']
    if (root/'PARENT_LOCK_SNAPSHOT.json').exists():
        s=read(root/'PARENT_LOCK_SNAPSHOT.json');require(s['checkpointId']==digest(dict(identity=s['identity'],members=s['members'])),'parent lock snapshot')
        require(next(v for v in s['members'] if v['path']=='LOCK.json')['sha256']==sha(p),'parent original sealed lock')
    require(parent['manifestHash']==digest(old),'parent manifest hash')
    require(old['campaignId']==m['campaignId'] and old['profileContract']==m['profileContract'],'parent campaign/profile')
    require(old['sourceFiles']['product']==m['sourceFiles']['product'],'parent product changed')
    require(old['tasksHash']==m['tasksHash'] and old['baselineFiles']==m['baselineFiles'],'parent schedule/baseline changed')
    before={f['id']:f for f in old['inputs']};require(len(before)==len(m['inputs']),'parent input population')
    for f in m['inputs']:
        previous=before[f['id']]
        require({k:v for k,v in f.items() if k!='expectedWitness'}=={k:v for k,v in previous.items() if k!='expectedWitness'},'original input/seed metadata changed')
        require((f.get('expectedWitness') or {}).get('sha256')==(previous.get('expectedWitness') or {}).get('sha256'),'original witness hash changed')
        if f.get('expectedWitness'):require(f['expectedWitness']['contract']=='INSERTION_SELECTED_QUALITY','historical witness contract')
    require(sha(history/'HISTORY_INDEX.json')==c['historyIndexSha256'],'parent history index bytes')
    index=read(history/'HISTORY_INDEX.json');require(index['campaignId']==m['campaignId'],'parent history campaign')
    for v in index['members']:
        file=member(history,v['path']);require(sha(file)==v['sha256'] and file.stat().st_size==v['bytes'],'parent history changed')
    require({p.relative_to(history).as_posix() for p in history.rglob('*') if p.is_file()}=={v['path'] for v in index['members']}|{'HISTORY_INDEX.json'},'unindexed parent history')
    ids=set();locks={parent['manifestHash']:parent}
    if m.get('prerequisiteReuse'):
        ancestor=read(root/'ANCESTOR_LOCK.json')
        require(ancestor['manifestHash']==digest(ancestor['manifest']) and parent['parentHash']==sha(root/'ANCESTOR_LOCK.json'), 'ancestor lock binding')
        require(ancestor['originMs']==parent['originMs'] and ancestor['endMs']==parent['endMs'],'ancestor campaign clock')
        require(ancestor['manifest']['sourceFiles']['product']==m['sourceFiles']['product'],'ancestor product')
        locks[ancestor['manifestHash']]=ancestor
        require(m['provenance']['priorCpSyntheticCalls']==8,'cumulative synthetic CP reservation')
        require(m['prerequisiteReuse']==dict(id='adjudication-only-prerequisites-v1',phases=['CANARY','CALIBRATION']), 'prerequisite reuse contract')
        mutable={'tools/secondary-bench/common/README_KO.md','tests/triage-bench.test.mjs','tests/triage-independent-audit.test.py'}
        mutable.update('tools/secondary-bench/common/triage/'+f for f in ['action.mjs','analysis.mjs','gates.mjs','protocol.mjs','prepare.py','independent-audit.py','reuse.mjs'])
        for name in set(old['sourceFiles']['harness'])|set(m['sourceFiles']['harness']):
            if name not in mutable:require(old['sourceFiles']['harness'].get(name)==m['sourceFiles']['harness'].get(name),'reuse execution source changed: '+name)
        for name in ['inputs','profileContract','tasksHash','job','baselineFiles','runtime']:require(old[name]==m[name],'reuse condition changed: '+name)
    templates=[json.loads(l) for l in (config/'TASKS.jsonl').read_text(encoding='utf-8').splitlines()]
    for file in history.rglob('SNAPSHOT.json'):snapshot(file.parent)
    for file in history.rglob('STAGE_PLAN.json'):
        plan=read(file);require(plan['manifestHash'] in locks,'parent stage lock');owner=locks[plan['manifestHash']]['manifest']
        selected={f['id'] for f in owner['inputs']}
        expected=[call for task in compile_calls(owner,templates,plan['phase'],selected) for call in task]
        require(plan['expectedCalls']==expected,'parent independent schedule')
        ids.update(call['callId'] for call in expected)
    starts={};rows={}
    for file in history.rglob('starts.jsonl'):
        for line in file.read_text(encoding='utf-8').splitlines():
            row=json.loads(line);require(row['manifestHash'] in locks and row['invocationId']==locks[row['manifestHash']]['invocationId'],'parent start invocation/lock')
            ids.add(row['callId']);attempt=row['executionAttemptId']
            require(attempt not in starts or starts[attempt]==row,'different duplicate parent starts');starts[attempt]=row
    for file in history.rglob('raw.jsonl'):
        for line in file.read_text(encoding='utf-8').splitlines():
            row=json.loads(line);require(row['manifestHash'] in locks and row['invocationId']==locks[row['manifestHash']]['invocationId'],'parent raw invocation/lock')
            key=row['callId'];ids.add(key);require(key not in rows or rows[key]==row,'different duplicate parent raw');rows[key]=row
    statuses=dict(collections.Counter(r['status'] for r in rows.values()))
    finished={r['executionAttemptId'] for r in rows.values() if r.get('executionAttemptId')}
    unknown=set(starts)-finished
    proof=read(config/'ORIGINAL_WITNESS_AUDIT.json')
    require(sha(config/'ORIGINAL_WITNESS_AUDIT.json')==m['provenance']['originalWitnessAuditSha256'] and proof['status']=='PASS'
        and proof['contract']=='INSERTION_SELECTED_QUALITY' and proof['exactRecordsChecked']==2508 and proof['solverCalls']==0,'original witness bytes audit')
    require(m['provenance']['priorReservedRunnerHours']+13*2.5<=36*2.5,'cumulative runner allocation')
    if (root/'PRIOR_JOBS.json').exists():
        ledger=read(root/'PRIOR_JOBS.json');jobs=ledger['jobs'];reserved=ledger.get('ancestorReservedRunnerHours',(m.get('activationRecovery') or {}).get('priorActivationReservedHours',0))
        for j in jobs:
            if j['conclusion']=='skipped':continue
            name=j['name'];reserved+=.5 if name=='activate' else 1.5 if name=='audit' or name.endswith(' / plan') else 2 if 'audit' in name else 2.5
        require(reserved<=m['provenance']['priorReservedRunnerHours'],'prior runner-hours underreserved')
    if lock:
        require(lock['originMs']==parent['originMs'] and lock['endMs']==parent['endMs'],'original campaign clock reset')
        require(lock['originMs']<int(__import__('datetime').datetime.fromisoformat(lock['createdUtc'].replace('Z','+00:00')).timestamp()*1000),'fresh invocation reset origin')
        validation=read(config/'PARENT_VALIDATION.json');backend=m['provenance']['parentLockArtifact']
        require(validation['status']=='PASS' and validation['solverCalls']==0 and validation['reservedCalls']==len(ids),'parent reservation validation')
        require(validation['priorStatuses']==statuses and {v['executionAttemptId'] for v in validation['priorUnknown']}==unknown,'parent censored/unknown statuses not retained')
        require(validation['parentArtifact']['id']==backend['id'] and validation['parentArtifact']['digest']==backend['digest']
            and validation['parentArtifact']['workflow_run']['id']==int(parent['invocationId']),'parent backend receipt')
        require(validation['parentRun']['status']=='completed' and validation['parentRun']['conclusion']=='failure'
            and validation['parentRun']['head_sha']==parent['commit'],'parent failed run/source')
    return len(ids)

def audit(config, history, output, phase=None, inputs_only=False):
    output.mkdir(parents=True, exist_ok=False)
    errors = []; missing = []; statuses = collections.Counter(); checked = 0; fixtures = 0
    def error(where, exc): errors.append(dict(where=where, error=str(exc)))
    m = read(config / 'MANIFEST.json'); lock = read(config / 'LOCK.json') if (config / 'LOCK.json').exists() else None
    collect=evidence_first(m.get('gateContract'))
    if collect:
        require(isinstance(m.get('revision'),int) and m['revision']>=6 and (m.get('measurement') or {}).get('adapter')=='triage-fixture',
            'new gate contract requires a new explicit performance revision')
    templates = [json.loads(l) for l in (config / 'TASKS.jsonl').read_text(encoding='utf-8').splitlines()]
    require(sha(config / 'TASKS.jsonl') == m['tasksHash'], 'task bytes')
    # Independent schedule compiler, not a copy of the JS-produced plan ledger.
    full = {p: compile_calls(m, templates, p, {f['id'] for f in m['inputs']}) for p in PHASES}
    full_calls = [c for ts in full.values() for t in ts for c in t]
    require(len(full_calls) == m['maxCalls'] == 8479, 'full call budget')
    require(sum(len(chunks(ts, m['job'])) for ts in full.values()) == 523, 'matrix budget')
    require((523+36)*2.5 <= m['maxRunnerHours'] == 1400 and m['maxParallel'] == 16, 'runner/VM cap')
    require(m['overallMs'] == 120*3600000, 'campaign clock limit')
    require(m['auditContract']==dict(id='independent-python-evidence-v1',runtime='Python3-stdlib',solverReplay=False,
        prerequisiteJobs=['CANARY','CALIBRATION'],finalDedicatedVm=True,performancePass=False,independentOptimality=False), 'independent audit contract')
    require(m['cpPreflightContract']==dict(id='scoped-cpsat-weighted-tie-v1',activationCalls=1,maxCanaryVmCalls=3,
        callMs=30000,populationCalls=0), 'CP preflight contract')
    for group in ['product','harness']:
        for name,h in m.get('sourceFiles',{}).get(group,{}).items():
            data=member(Path.cwd(),name).read_bytes()
            if name.startswith(('src/','rust/','wasm/')) or name in ['package.json','package-lock.json']:
                if b'\0' not in data:
                    try:data.decode('utf-8');data=data.replace(b'\r\n',b'\n')
                    except UnicodeDecodeError:pass
            require(hashlib.sha256(data).hexdigest()==h,'independent source hash: '+name)
    if lock:
        require(lock['manifest']==m, 'manifest differs from activation')
        require(digest(m) == lock['manifestHash'] and digest(m['profileContract']) == lock['profileHash'], 'manifest/profile lock')
        require(lock['endMs'] == lock['originMs'] + m['overallMs'], 'campaign origin reset')
        try: cp_check(read(config / 'CP_PREFLIGHT.json'))
        except Exception as exc: error('CP_PREFLIGHT', exc)
    elif not inputs_only: raise ValueError('activation lock missing')
    prior_reserved=common_parent_check(m,config,lock) if m.get('continuation') else continuation_check(m,config,lock)
    db = sqlite3.connect(output / 'AUDIT_INDEX.sqlite')
    db.executescript('CREATE TABLE records(call_id TEXT PRIMARY KEY, input_id TEXT, phase TEXT, raw TEXT, checkpoint TEXT);'
                     'CREATE TABLE starts(attempt TEXT PRIMARY KEY, raw TEXT, checkpoint TEXT);')
    snapshots = {}; directories = {}; plans = {}; receipts = []; selected = {}; inventory = {}; runner_preflights = 0
    reuse_parent=read(config/'continuation/PARENT_LOCK.json') if m.get('prerequisiteReuse') else None
    reuse_history=config/'continuation/history' if reuse_parent else None
    def phase_lock(p):return reuse_parent if reuse_parent and p in m['prerequisiteReuse']['phases'] else lock
    if not inputs_only:
        try: snapshot(config)
        except Exception as exc: error('activation snapshot', exc)
        if (history / 'DOWNLOAD_COMPLETE.json').exists():
            transport = read(history / 'DOWNLOAD_COMPLETE.json')
            if transport['errors'] or transport['downloaded'] != transport['selected']: missing.append('partial artifact download')
        else: missing.append('DOWNLOAD_COMPLETE.json')
        if (history / 'DOWNLOAD_INDEX.json').exists(): inventory = {i['id']: i for i in read(history / 'DOWNLOAD_INDEX.json')['artifacts']}
        if reuse_parent:
            transport=read(reuse_history/'DOWNLOAD_COMPLETE.json')
            require(not transport['errors'] and transport['downloaded']==transport['selected'],'reused transport incomplete')
            inventory.update({i['id']:i for i in read(reuse_history/'DOWNLOAD_INDEX.json')['artifacts']})
        history_snapshots=list(history.rglob('SNAPSHOT.json'))
        if reuse_parent:history_snapshots.extend(f for f in reuse_history.rglob('SNAPSHOT.json') if '_ancestor-r3' not in f.parts)
        for file in sorted(history_snapshots):
            try:
                s = snapshot(file.parent); snapshots[s['checkpointId']] = s; directories[s['checkpointId']] = file.parent
                require(s['identity'].get('campaignId') == m['campaignId'], 'foreign snapshot campaign')
                # Payload snapshots use a name; execution snapshots use invocation/phase/chunk/part.
                if 'invocationId' in s['identity']: require(s['identity']['invocationId'] == phase_lock(s['identity'].get('phase'))['invocationId'], 'foreign snapshot invocation')
                for name in ['raw.jsonl', 'starts.jsonl']:
                    p = file.parent / name
                    if not p.exists(): continue
                    require(p.stat().st_size==0 or p.read_bytes().endswith(b'\n'), 'torn final append')
                    with p.open(encoding='utf-8') as stream:
                        for line in stream:
                            r = json.loads(line); require(r['campaignId'] == m['campaignId'], 'foreign raw campaign')
                            key = r['callId'] if name == 'raw.jsonl' else r['executionAttemptId']
                            table = 'records' if name == 'raw.jsonl' else 'starts'
                            prior = db.execute(f'SELECT raw,checkpoint FROM {table} WHERE '+('call_id' if table=='records' else 'attempt')+'=?', (key,)).fetchone()
                            if prior:
                                require(prior == (line, s['checkpointId']), 'duplicate execution without identical snapshot proof'); continue
                            if table == 'records': db.execute('INSERT INTO records VALUES(?,?,?,?,?)', (key,r['inputId'],r['phase'],line,s['checkpointId']))
                            else: db.execute('INSERT INTO starts VALUES(?,?,?)', (key,line,s['checkpointId']))
                if (file.parent / 'STAGE_PLAN.json').exists():
                    plan = read(file.parent / 'STAGE_PLAN.json'); require(plan['phase'] not in plans, 'duplicate stage plan'); plans[plan['phase']] = plan
                if (file.parent / 'SELECTION.json').exists():
                    selection = read(file.parent / 'SELECTION.json'); require(selection['phase'] not in selected, 'duplicate selection'); selected[selection['phase']] = set(selection['selected'])
                if (file.parent / 'TRANSPORT_COMPLETE.json').exists(): receipts.append(read(file.parent / 'TRANSPORT_COMPLETE.json'))
                if (file.parent / 'ENVIRONMENT.json').exists():
                    environment = read(file.parent / 'ENVIRONMENT.json')
                    owner=reuse_parent if reuse_parent and reuse_history in file.parents else lock
                    require(environment['node']=='v24.13.0' and environment['platform']=='linux'
                            and environment['commit']==owner['commit'], 'runner runtime/source')
                    if (file.parent / 'CP_PREFLIGHT.json').exists(): cp_check(read(file.parent / 'CP_PREFLIGHT.json')); runner_preflights += 1
            except Exception as exc: error(str(file), exc)
        db.commit()
    expected = {}; required = ['CANARY','CALIBRATION'] if phase=='CALIBRATION' else [phase] if phase else PHASES
    for p, plan in plans.items():
        try:
            owner=phase_lock(p)
            require(p in PHASES and plan['manifestHash'] == owner['manifestHash'], 'stage lock/phase')
            tasks = compile_calls(owner['manifest'], templates, p, selected.get(p)); calls = [c for t in tasks for c in t]
            require(plan['expectedCalls'] == calls, 'stage calls differ from independent compiler')
            cs = chunks(tasks, m['job']); require(plan['chunks'] == len(cs) == len(plan['matrix']), 'stage chunk count')
            for index, chunk in enumerate(cs):
                for part, task in enumerate(chunk):
                    for c in task: expected[c['callId']] = (c, dict(phase=p, chunk=index, part=part))
        except Exception as exc: error('plan/'+p, exc)
    reused_count=sum(len(plan['expectedCalls']) for p,plan in plans.items() if reuse_parent and p in m['prerequisiteReuse']['phases'])
    if reuse_parent:require(reused_count==128,'completed prerequisites missing')
    require(len(expected)-reused_count+prior_reserved<=m['maxCalls'], 'cumulative prior/current scheduled call cap')
    for p in ['ALL_CONFIRMATION','PER_SAVE_CONFIRMATION']:
        if p in plans:
            try:
                initial='ALL_INITIAL' if p=='ALL_CONFIRMATION' else 'PER_SAVE_INITIAL'
                require(initial in plans and db.execute('SELECT count(*) FROM records WHERE phase=?',(initial,)).fetchone()[0]
                    ==len(plans[initial]['expectedCalls']), 'confirmation before complete initial population')
                require(required_confirmation(db,m,initial)<=selected.get(p,set()),'required independent retest selection omitted')
            except Exception as exc:error('selection/'+p,exc)
    if not inputs_only:
        refs = {f['id'] for f in m['inputs']}
        for (fid,) in db.execute('SELECT DISTINCT input_id FROM records'):
            if fid not in refs: error('raw/'+fid, 'unregistered fixture')
        for p in required:
            if p not in plans: missing.append('plan/'+p)
        for c in expected:
            if not db.execute('SELECT 1 FROM records WHERE call_id=?', (c,)).fetchone(): missing.append('call/'+c)
        for receipt in receipts:
            try:
                require(receipt['status'] == 'ALL_DURABLE' and receipt['solverCallsInTransport'] == 0, 'undelivered transport')
                for r in receipt['receipts']:
                    require(r['status'] == 'UPLOADED' and r['checkpointId'] in snapshots, 'receipt checkpoint missing')
                    require(snapshots[r['checkpointId']]['identity'] == r['identity'], 'receipt identity')
                    for attempt in r['attempts']:
                        if attempt['status'] == 'UPLOADED':
                            require(attempt['artifactId'] in inventory and inventory[attempt['artifactId']]['digest'] == attempt['digest'], 'receipt/backend hash')
            except Exception as exc: error('transport', exc)
        for p, plan in plans.items():
            for index in range(plan['chunks']):
                if not any(r.get('receipts') and r['receipts'][0]['identity'].get('phase') == p
                           and r['receipts'][0]['identity'].get('chunk') == index for r in receipts): missing.append(f'receipt/{p}/{index}')
    consensus = {}; not_run = []; observed_attempts = set()
    for ref in m['inputs']:
        try:
            file = member(config, ref['member']); require(sha(file) == ref['sha256'], 'fixture byte hash')
            f = read(file); fixture_check(f, ref); fixtures += 1
        except Exception as exc: error('fixture/'+ref['id'], exc); continue
        index = {k:i for i,k in enumerate(f['keys'])}
        for (text, checkpoint) in db.execute('SELECT raw,checkpoint FROM records WHERE input_id=? ORDER BY phase,call_id', (ref['id'],)):
            r = json.loads(text); statuses[r['status']] += 1
            try:
                require(r['callId'] in expected, 'unplanned call'); c, location = expected[r['callId']]
                require(all(r.get(k) == v for k,v in c.items()), 'call/pair/limit identity')
                require(r['logicalCallId'] == c['callId'] and r['metadata'] == ref['metadata'], 'logical/metadata')
                owner=phase_lock(r['phase'])
                require(r['manifestHash'] == owner['manifestHash'] and r['profileHash'] == owner['profileHash']
                    and r['invocationId'] == owner['invocationId'] and r['condition'] == m['profileContract'], 'execution lock/profile')
                ident = snapshots[checkpoint]['identity']; require(all(ident.get(k) == v for k,v in location.items()), 'chunk placement')
                if r['executionAttemptId'] is None:
                    require(r['status'].startswith('NOT_RUN_') and r['ms'] is None, 'NOT_RUN semantics'); not_run.append(c['callId']); continue
                require(r['executionAttemptId'] == digest(dict(invocation=owner['invocationId'],call=c['callId'])), 'attempt identity')
                require(r['executionAttemptId'] not in observed_attempts, 'attempt replay'); observed_attempts.add(r['executionAttemptId'])
                start = db.execute('SELECT raw FROM starts WHERE attempt=?', (r['executionAttemptId'],)).fetchone(); require(start, 'durable start missing')
                sr = json.loads(start[0]); require(all(r.get(k) == v for k,v in sr.items()), 'start/final identity')
                e = r['execution']; require(e['status'] == r['status'] and e['reaped'] is True, 'scope status/reclamation')
                attempt_dir = directories[checkpoint] / r['executionAttemptId']
                require(read(attempt_dir/'SCOPE_COMPLETE.json')==e, 'raw/scope evidence parity')
                request = read(attempt_dir/'REQUEST.json'); require(request['callId']==r['executionAttemptId']
                    and request['limits']==c['limits'] and request['job']['variant']==r['variant']
                    and request['job']['fixtureSha256']==ref['sha256'] and request['job']['exactHumanQuality']=='true', 'scope request parity')
                traces = []; returned = []; ready = 0
                with (attempt_dir/'events.jsonl').open(encoding='utf-8') as events:
                    for line in events:
                        event = json.loads(line)
                        if event.get('event')=='ready': ready += 1
                        if event.get('event')=='result': returned.append(event['record'])
                        if event.get('event')=='phase' and event.get('name')=='policy-trace': traces.append(event['trace'])
                require(ready <= 1 and len(returned) <= 1, 'duplicate IPC ready/result')
                if 'policyTrace' in e: require(traces == e['policyTrace'], 'supervisor policy trace differs from raw IPC events')
                else: require(r['status']=='OOM' or not traces, 'missing durable supervisor trace')
                require(not cp_failure(dict(execution=dict(policyTrace=traces))), 'CP failure in raw IPC trace')
                if e.get('result') is not None: require(returned == [e['result']], 'supervisor result differs from raw IPC event')
                if r['status'] in ['EXACT','INCOMPLETE','PROBE_INCOMPLETE']: require(ready==1 and bool(returned), 'missing IPC ready/result')
                if r['variant']=='T_PROBE_SEED':
                    probes = db.execute("SELECT raw FROM records WHERE input_id=? AND phase='SEED_DIAGNOSTIC'", (ref['id'],))
                    probe = next((p for (line,) in probes if (p:=json.loads(line)).get('trialId')==r['trialId']
                                  and p['variant']=='I100K_SEED_CAPTURE'), None)
                    require(probe and probe['status'] in ['EXACT','PROBE_INCOMPLETE']
                        and request['job']['probeSeed']==probe['execution']['result']['probeSeed'], 'trial probe seed provenance')
                scope = e['memoryScope']; require(scope['memoryMax'] == 3221225472 and scope['swapMax'] == 0, 'scope memory/swap')
                if cp_failure(r): raise ValueError('CP runtime/proof failure in policy profile')
                if r['status'] not in ['EXACT','INCOMPLETE','PROBE_INCOMPLETE','TIMEOUT_CALL','TIMEOUT_STARTUP','OOM']:
                    raise ValueError('execution failure: '+r['status'])
                if r['status'] != 'EXACT': require(r['ms'] is None, 'censored call given elapsed success time')
                record = e.get('result')
                if r['status'] not in ['EXACT','PROBE_INCOMPLETE','INCOMPLETE']: continue
                require(record['fixtureSha256'] == ref['sha256'] and record['variant'] == r['variant'], 'result identity')
                require(record['primarySeedHash'] == hashlib.sha256(encode(f['seed'],False).encode()).hexdigest(), 'primary seed identity')
                result = record['result']; require(result['count'] == f['K'], 'result K')
                require(all(k in index for k in result['keys']), 'unknown result key')
                chosen = sorted(index[k] for k in result['keys']); quality = vector(f, chosen)
                require(result['qualityVector'] == quality and record['verified']['selected'] == chosen
                    and record['verified']['qualityVector'] == quality, 'independent original-row weighted vector')
                require(record['verified']['qualityHash'] == hashlib.sha256(encode(quality,False).encode()).hexdigest(), 'quality hash')
                complete = result.get('completed') is True
                require(complete == record['verified']['completed'] == (r['status']=='EXACT'), 'partial result promoted to exact')
                if r['variant']=='I100K_SEED_CAPTURE': require(record['probeSeed'] == chosen and record['stateBudget']==100000, 'probe seed/budget')
                if complete:
                    require(math.isfinite(r['ms']) and r['ms'] >= 0 and r['ms'] == record['policySettledMs'], 'settled timing')
                    if result.get('secondaryResolved') == 'cpsat': require(result.get('qualityComplete') is True and result.get('tieComplete') is True, 'CP exact/tie proof flags')
                    witness = dict(selected=chosen,quality=quality); h = hashlib.sha256(encode(witness,False).encode()).hexdigest()
                    require(ref['id'] not in consensus or consensus[ref['id']]==h, 'cross-variant/repeat witness disagreement'); consensus[ref['id']]=h
                    old = ref.get('expectedWitness')
                    if old:
                        require(old['contract'] in ['SORTED_QUALITY_SELECTED','INSERTION_SELECTED_QUALITY'], 'unknown historical witness contract')
                        expected_hash = digest(witness) if old['contract']=='SORTED_QUALITY_SELECTED' else h
                        require(expected_hash==old['sha256'] and record['historicalWitness']==expected_hash, 'historical witness mismatch')
                checked += 1
            except Exception as exc: error(r['callId'], exc)
        del f
    unknown = [a for (a,) in db.execute('SELECT attempt FROM starts') if a not in observed_attempts]
    if unknown: missing.extend('unknown-start/'+a for a in unknown)
    gates = {}; assessments={}
    if not inputs_only:
        for p in ['CANARY','CALIBRATION']:
            if p in plans:
                try: assessments[p]=phase_gate(db,p,m.get('gateContract')); gates[p]='PASS'
                except Exception as exc: gates[p]='HOLD'; error('gate/'+p,exc)
        if 'CANARY' in plans and runner_preflights != plans['CANARY']['chunks']:
            error('canary VM preflights','missing actual CP check on canary VM')
    observed = db.execute('SELECT count(*) FROM records').fetchone()[0]; db.close()
    report = dict(schemaVersion=1, status='FAIL' if errors else 'INCOMPLETE' if missing or not_run else 'PASS',
        role='INDEPENDENT_PYTHON_STDLIB_EVIDENCE_AUDIT', phase=phase or ('INPUTS_ONLY' if inputs_only else 'ALL'),
        fixtureFilesChecked=fixtures, witnessRecordsChecked=checked, observedCalls=observed, scheduledCalls=len(expected),
        statusCounts=dict(statuses), errors=errors, missing=missing, notRun=not_run, solverCalls=0,
        populationCalls=0, freshValidation=False, performancePass=False, independentOptimality=False,
        prerequisiteGates=gates, canaryVmPreflights=runner_preflights,
        priorReservedCalls=prior_reserved,currentCallCap=m['maxCalls']-prior_reserved,priorEvidencePooled=False,
        reusedPrerequisiteCalls=reused_count,reusedPrerequisiteInvocation=reuse_parent['invocationId'] if reuse_parent else None,
        scope='BYTE_HASH_SCHEDULE_START_RECEIPT_K_SEED_ORIGINAL_WEIGHTED_WITNESS_AND_NATIVE_PROOF_FLAGS',
        limitation='Witness/proof-flag audit is not an independent optimality proof or fresh performance validation.')
    if collect:
        report.update(gateContract=m['gateContract'],evidenceStatus=report['status'],decisionStatus='REVIEW_REQUIRED',
            collectionAllowed=report['status']=='PASS',prerequisiteAssessments=assessments)
    (output/'INDEPENDENT_AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    return report

def main():
    p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--history');p.add_argument('--out',required=True)
    p.add_argument('--phase',choices=['CANARY','CALIBRATION']);p.add_argument('--inputs-only',action='store_true');a=p.parse_args()
    r=audit(Path(a.config),Path(a.history) if a.history else Path(a.config)/'NO_HISTORY',Path(a.out),a.phase,a.inputs_only)
    print(json.dumps({k:r[k] for k in ['status','phase','fixtureFilesChecked','witnessRecordsChecked','solverCalls']}))
    for error in r['errors']:print('EVIDENCE_ERROR '+json.dumps(error))
    for missing in r['missing']:print('EVIDENCE_MISSING '+missing)
    for phase,assessment in r.get('prerequisiteAssessments',{}).items():
        calibration=assessment.get('calibration')
        if calibration:
            print('CALIBRATION_SCREEN '+json.dumps({k:v for k,v in calibration.items() if k!='observations'}))
            for item in calibration['observations']:
                if item['exceedsScreen'] or item['issues']:print('CALIBRATION_REVIEW '+json.dumps(item))
    return 0 if r['status']=='PASS' else 1

if __name__=='__main__': raise SystemExit(main())
