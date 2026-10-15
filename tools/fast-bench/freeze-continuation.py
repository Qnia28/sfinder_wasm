"""Offline continuation: schedule only wholly unstarted paired fixture groups."""
import gzip
import hashlib
import json
import pathlib
import re
import sys
import datetime

root = pathlib.Path(sys.argv[1])
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
plan = read(root / 'analysis/PLAN.json')
rows = [json.loads(l) for l in gzip.decompress((root / 'analysis/calls.jsonl.gz').read_bytes()).splitlines()]
recovered = [json.loads(l) for l in (root / 'failure-134/delta-0/records.jsonl').read_bytes().splitlines()]
starts134 = [json.loads(l) for l in (root / 'failure-134/delta-0/starts.jsonl').read_bytes().splitlines()]
jobs = [j for page in read(root / 'JOBS.json') for j in page['jobs']]
by_id = {r['callId']: r for r in rows}
for row in recovered:
    assert row['callId'] not in by_id
    by_id[row['callId']] = row
started = {r['callId'] for r in by_id.values() if not r['status'].startswith('NOT_RUN')}
started.update(r['callId'] for r in starts134)
assert len(starts134) == len(recovered) + 1
unknown = sorted(started - by_id.keys())
assert len(unknown) == 1
job_by_shard = {int(re.search(r'\((\d+)\)', j['name'])[1]): j for j in jobs if j['name'].startswith('measure (')}
groups = {}
for c in plan['schedule']:
    key = c['fixture']['id'] if c['fixture'] else c['taskId'] + '/e2e'
    groups.setdefault(key, []).append(c['callId'])
eligible = set()
repeated_groups = []
for ids in groups.values():
    if not any(i in started for i in ids):
        eligible.update(ids)
    elif any(i in unknown or by_id.get(i, {}).get('status') in ['CANCELLED', 'NOT_RUN_INVALIDATED'] for i in ids):
        eligible.update(ids)
        repeated_groups.append(ids)
chunks = []
for chunk in plan['chunks']:
    ids = [c['callId'] for t in chunk['tasks'] for c in t['calls'] if c['callId'] in eligible]
    if not ids:
        continue
    j = job_by_shard[chunk['index']]
    # Unrecorded calls are safe only when the step was never invoked, or from
    # shard134 whose complete failure dump records its durable start boundary.
    if any(i not in by_id for i in ids) and chunk['index'] != 134:
        step = next((s for s in j.get('steps', []) if 'Run frozen fresh-process' in s['name']), None)
        assert step is None or step['conclusion'] == 'skipped', (chunk['index'], step)
    chunks.append({'shard': chunk['index'], 'callIds': ids})
excluded = [c['callId'] for c in plan['schedule'] if c['callId'] not in eligible
            and (c['callId'] not in by_id or by_id[c['callId']]['status'].startswith('NOT_RUN'))]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
parse = lambda s: datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
spent = sum(max(0, (parse(j['completed_at']) - parse(j['started_at'])).total_seconds())
            for j in jobs if j.get('completed_at') and j.get('started_at'))
reserved = sum(c['reservationSeconds'] for c in plan['schedule'] if c['callId'] in eligible)
# Closed parent jobs charged at actual runner time, including cancelled jobs.
# Prior preflight/control allowance1h conservatively covers the small earlier runs.
total_hours = spent / 3600 + 1 + reserved / 3600 + len(chunks) * 900 / 3600 + 2
assert total_hours < 1200
result = {'schema': 1, 'parentRunId': '38759068303', 'sourceCommit': plan['lock']['commit'],
          'originUtc': plan['lock']['originUtc'], 'deadlineMs': plan['lock']['deadlineMs'],
          'scheduleHash': plan['scheduleHash'], 'policy': 'USER_AUTHORIZED_WHOLE_INTERRUPTED_GROUP_REMEASUREMENT',
          'authorization': 'User explicitly requested remeasurement of groups interrupted by artifact failure; retain all original attempts',
          'remeasuredGroups': repeated_groups,
          'priorAttemptCallIds': sorted(i for i in eligible if i in started),
          'budget': {'closedParentRunnerSeconds': spent, 'priorPreflightAllowanceHours': 1,
                     'remainingCallReservationSeconds': reserved, 'continuationControlSeconds': len(chunks)*900+7200,
                     'cumulativeConservativeHours': total_hours, 'capHours': 1200},
          'planArtifact': {'id': 11985341540, 'digest': '6674c2a48f7b2b5da447f847bdf33aa2fbc610ccf3982b70a49881f4e5745d96'},
          'analysisArtifact': {'id': 11985979227, 'digest': 'bc65cec19333d7c5b55cdbfa63cb234f85bb31820fb65192c72116d0c289992a'},
          'chunks': chunks, 'resumeCalls': sum(len(c['callIds']) for c in chunks),
          'excludedInterruptedBlockCalls': excluded, 'unknownStartedCalls': unknown,
          'recoveredRecords': recovered,
          'evidenceHashes': {str(p.relative_to(root)): sha(p) for p in [root/'JOBS.json', root/'analysis/AUDIT.json',
              root/'analysis/PLAN.json', root/'analysis/calls.jsonl.gz', root/'failure-134/delta-0/starts.jsonl',
              root/'failure-134/delta-0/raw.jsonl', root/'failure-134/delta-0/records.jsonl']}}
out = pathlib.Path(__file__).with_name('CONTINUATION_38759068303.json')
out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'chunks': len(chunks), 'resumeCalls': result['resumeCalls'], 'excluded': len(excluded),
                  'unknown': unknown, 'recoveredRecords': len(recovered), 'sha256': sha(out)}, indent=2))
