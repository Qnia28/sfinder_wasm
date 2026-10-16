"""Offline agent package and descriptive paired analysis; solver calls=0."""
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import shutil
import sqlite3
import statistics
import sys

root, out = map(pathlib.Path, sys.argv[1:3])
out.mkdir(exist_ok=False)
parent, current = '38759068303', '38766815700'
index = root / ('actions-' + current) / 'preserved/fast-analysis-index-11991549626'
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
plan, audit, cont = [load(index / n) for n in ['PLAN.json', 'AUDIT.json', 'CONTINUATION.json']]
rows = [json.loads(l) for l in gzip.decompress((index / 'calls.jsonl.gz').read_bytes()).splitlines()]
schedule = {r['callId']: r for r in plan['schedule']}
resumed = {i for c in cont['chunks'] for i in c['callIds']}
selected = {r['callId']: r for r in rows}
assert len(selected) == len(schedule) == 30480 and selected.keys() == schedule.keys()
fixtures = {f['id']: f for category in ['main', 'supplemental'] for f in plan['selection'][category] if isinstance(f, dict)}
db = sqlite3.connect(out / 'analysis.sqlite')
db.executescript('''CREATE TABLE calls(call_id TEXT PRIMARY KEY,run_id TEXT,phase TEXT,fixture_id TEXT,arm TEXT,repeat INTEGER,trace INTEGER,status TEXT,policy_ms REAL,wall_ms REAL,record_json TEXT,schedule_json TEXT);
CREATE TABLE fixtures(fixture_id TEXT PRIMARY KEY,metadata_json TEXT);
CREATE TABLE raw_locations(run_id TEXT,call_id TEXT,path TEXT,line INTEGER,byte_offset INTEGER,byte_length INTEGER,selected INTEGER);
CREATE INDEX raw_call ON raw_locations(call_id,run_id);
CREATE TABLE quality(call_id TEXT PRIMARY KEY,quality_json TEXT);
CREATE TABLE attempts(run_id TEXT,call_id TEXT,status TEXT,record_json TEXT);''')
dump = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
for f in fixtures.values(): db.execute('INSERT INTO fixtures VALUES(?,?)', (f['id'], dump(f)))
for r in rows:
    s = schedule[r['callId']]
    db.execute('INSERT INTO calls VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (r['callId'], current if r['callId'] in resumed else parent, r['phase'], (s.get('fixture') or {}).get('id', s['taskId']), r['arm'], r['repeat'], int(r['trace']), r['status'], r.get('policyMs'), r.get('wallMs'), dump(r), dump(s)))
for line in gzip.decompress((index / 'ATTEMPTS.jsonl.gz').read_bytes()).splitlines():
    r = json.loads(line)
    db.execute('INSERT INTO attempts VALUES(?,?,?,?)', (r['attemptRunId'], r['callId'], r['status'], dump(r)))

def vector(v):
    assert v == sorted(v), 'quality vector must be sorted ascending'
    return sorted(collections.Counter(v).items())

qualities, found = {}, set()
for run in [parent, current]:
    for file in sorted((root / ('actions-' + run) / 'preserved').rglob('raw.jsonl')):
        offset = 0
        with file.open('rb') as stream:
            for number, line in enumerate(stream, 1):
                r = json.loads(line)
                cid = r.get('callId')
                chosen = cid in selected and (current if cid in resumed else parent) == run
                db.execute('INSERT INTO raw_locations VALUES(?,?,?,?,?,?,?)', (run, cid, file.relative_to(root).as_posix(), number, offset, len(line), int(chosen)))
                offset += len(line)
                if not chosen: continue
                result = r.get('execution', {}).get('result') or {}
                q = {}
                if 'qualityVector' in result: q['matrix'] = vector(result['qualityVector'])
                for k, v in (result.get('outcomes') or {}).items():
                    if 'qualityVector' in v: q[k] = vector(v['qualityVector'])
                    elif v.get('status') == 'EMPTY': q[k] = []
                if cid in qualities: assert qualities[cid] == q
                qualities[cid] = q
                found.add(cid)
assert found == selected.keys(), ('missing raw', len(selected.keys() - found))
db.executemany('INSERT INTO quality VALUES(?,?)', [(k, dump(v)) for k, v in qualities.items()])

def compare(a, b):
    # RLE histograms encode the exact sorted, weighted original-row vector.
    assert sum(n for _, n in a) == sum(n for _, n in b)
    aa, bb = dict(a), dict(b)
    for value in sorted(aa.keys() | bb.keys()):
        if aa.get(value, 0) != bb.get(value, 0):
            return 1 if aa.get(value, 0) < bb.get(value, 0) else -1
    return 0

def relation(a, b):
    if not a or a.keys() != b.keys(): return 'UNOBSERVED'
    signs = {compare(a[k], b[k]) for k in a}
    if signs == {0}: return 'EQUAL'
    if 1 in signs and -1 in signs: return 'MIXED_FILTERS'
    return 'BETTER' if 1 in signs else 'WORSE'

groups = collections.defaultdict(dict)
for r in rows:
    s = schedule[r['callId']]
    groups[(r['phase'], (s.get('fixture') or {}).get('id', s['taskId']), r['repeat'], r['trace'])][r['arm']] = r
pairs = []
for (phase, fixture, repeat, trace), arms in groups.items():
    for ref in ['BASE100', 'DIRECT']:
        if ref not in arms: continue
        b = arms[ref]
        for arm, r in arms.items():
            if arm == ref: continue
            ok = r['status'].startswith('RETURNED') and b['status'].startswith('RETURNED')
            f = fixtures.get(fixture, {})
            pairs.append(dict(phase=phase, fixture=fixture, repeat=repeat, trace=trace, reference=ref, arm=arm,
                population=f.get('command', {}).get('population', 'e2e'), primaryHard=f.get('primaryHard'), previewEligible=f.get('features', {}).get('previewEligible'),
                callId=r['callId'], referenceCallId=b['callId'], status=r['status'], referenceStatus=b['status'],
                quality=relation(qualities[r['callId']], qualities[b['callId']]) if ok else 'CENSORED',
                deltaMs=r['policyMs']-b['policyMs'] if ok else None,
                ratio=r['policyMs']/b['policyMs'] if ok and b['policyMs'] else None,
                candidateMs=r.get('policyMs'), referenceMs=b.get('policyMs')))
def csvwrite(name, data):
    with (out / name).open('w', newline='', encoding='utf-8') as stream:
        w = csv.DictWriter(stream, fieldnames=list(data[0])); w.writeheader(); w.writerows(data)
csvwrite('paired-quality-time.csv', pairs)
def percentile(v, p):
    if not v: return None
    v = sorted(v); return v[round((len(v)-1)*p)]
summaries = []
for phase in ['matrix', 'e2e', 'trace']:
    for ref in ['BASE100', 'DIRECT']:
        for arm in sorted({p['arm'] for p in pairs if p['phase'] == phase and p['reference'] == ref}):
            pp = [p for p in pairs if (p['phase'], p['reference'], p['arm']) == (phase, ref, arm)]
            ff = collections.defaultdict(list)
            for p in pp: ff[p['fixture']].append(p)
            medians = [statistics.median([p['deltaMs'] for p in v if p['deltaMs'] is not None]) for v in ff.values() if any(p['deltaMs'] is not None for p in v)]
            ratios = [statistics.median([p['ratio'] for p in v if p['ratio'] is not None]) for v in ff.values() if any(p['ratio'] is not None for p in v)]
            summaries.append(dict(phase=phase, reference=ref, arm=arm, pairs=len(pp), fixtures=len(ff),
                qualityCounts=dict(collections.Counter(p['quality'] for p in pp)),
                worseFixtures=sum(any(p['quality'] in ['WORSE','MIXED_FILTERS'] for p in v) for v in ff.values()),
                medianFixtureDeltaMs=percentile(medians,.5), p95FixtureDeltaMs=percentile(medians,.95),
                medianFixtureRatio=percentile(ratios,.5), fasterFixtures=sum(x<0 for x in medians)))
(out / 'SUMMARY.json').write_text(json.dumps(summaries, indent=2))
csvwrite('nonreturning-calls.csv', [dict(callId=r['callId'],phase=r['phase'],arm=r['arm'],status=r['status'],fixture=(schedule[r['callId']].get('fixture') or {}).get('id',schedule[r['callId']]['taskId'])) for r in rows if not r['status'].startswith('RETURNED')])
db.commit(); db.close()
for name in ['AUDIT.json','PLAN.json','CONTINUATION.json','PARENT_AUDIT.json','ATTEMPTS.jsonl.gz','calls.jsonl.gz']:
    shutil.copy2(index/name, out/name)
for name in ['FAST_BENCHMARK_SCOPE_20261015_KO.md','FAST_CONTINUATION_20261016_KO.md']:
    shutil.copy2(pathlib.Path('docs')/name,out/name)
shutil.copy2('tools/fast-bench/SCOPE_20261015_v2.json',out/'SCOPE.json')
shutil.copy2('tools/fast-bench/adapter.mjs',out/'adapter.mjs')
shutil.copytree(root/('actions-'+current)/'scalar-analysis',out/'scalar-analysis')
manifest = {'schema':1,'sourceRoot':str(root),'calls':len(rows),'rawCoverage':len(found),'artifactCount':1680,'solverCallsDuringPackaging':0,
    'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()}}
(out/'MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'calls':len(rows),'rawCoverage':len(found),'pairRows':len(pairs),'package':str(out)}))
