"""Separate final evidence from analysis, validate before removing old copies."""
import gzip
import hashlib
import json
import pathlib
import shutil
import sqlite3
import sys

root = pathlib.Path(sys.argv[1]).resolve()
old = root/'agent-analysis-v4'
data, analysis = root/'final-database', root/'astra-analysis'
data.mkdir(exist_ok=False)
analysis.mkdir(exist_ok=False)
shutil.copy2(old/'analysis.sqlite', data/'benchmark.sqlite')
db = sqlite3.connect(data/'benchmark.sqlite')
db.execute('CREATE TABLE raw_evidence(call_id TEXT PRIMARY KEY,run_id TEXT,sha256 TEXT,json_gzip BLOB)')
locations = db.execute('''SELECT c.call_id,c.run_id,r.path,r.byte_offset,r.byte_length
FROM calls c JOIN raw_locations r ON r.call_id=c.call_id AND r.run_id=c.run_id
WHERE r.selected=1 GROUP BY c.call_id''').fetchall()
assert len(locations)==30480
for cid,run,file,offset,length in locations:
    with (root/file).open('rb') as f:
        f.seek(offset); raw=f.read(length)
    record=json.loads(raw)
    assert record['callId']==cid
    db.execute('INSERT INTO raw_evidence VALUES(?,?,?,?)',(cid,run,hashlib.sha256(raw).hexdigest(),gzip.compress(raw,compresslevel=1,mtime=0)))
db.execute('CREATE TABLE inputs(member TEXT PRIMARY KEY,sha256 TEXT,fixture_gzip BLOB)')
plan=json.loads((old/'PLAN.json').read_text())
refs={}
def visit(obj):
    if isinstance(obj,dict):
        if 'member' in obj and 'sha256' in obj: refs[obj['member']]=obj['sha256']
        for v in obj.values():visit(v)
    elif isinstance(obj,list):
        for v in obj:visit(v)
visit(plan)
files={p.name:p for p in (root/'actions-38759068303/preserved').glob('fast-input-*/*.json.gz')}
for member,digest in refs.items():
    raw=files[member].read_bytes()
    assert hashlib.sha256(raw).hexdigest()==digest
    db.execute('INSERT INTO inputs VALUES(?,?,?)',(member,digest,raw))
db.execute('CREATE TABLE metadata(name TEXT PRIMARY KEY,json TEXT)')
for name in ['PLAN.json','SCOPE.json']:
    db.execute('INSERT INTO metadata VALUES(?,?)',(name,(old/name).read_text()))
db.execute('DROP TABLE attempts')
db.execute('DROP TABLE raw_locations')
db.commit()
db.execute('VACUUM')
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert db.execute('SELECT count(*) FROM calls').fetchone()[0]==30480
assert db.execute('SELECT count(*) FROM calls c LEFT JOIN raw_evidence r USING(call_id) WHERE r.call_id IS NULL').fetchone()[0]==0
assert db.execute("SELECT count(*) FROM calls WHERE status NOT LIKE 'RETURNED%' AND status!='TIMEOUT_CALL'").fetchone()[0]==0
for cid,digest,compressed in db.execute('SELECT call_id,sha256,json_gzip FROM raw_evidence'):
    raw=gzip.decompress(compressed)
    assert hashlib.sha256(raw).hexdigest()==digest and json.loads(raw)['callId']==cid
db.close()
for name in ['ASTRA_ANALYSIS_KO.md','ASTRA_CASE_076.json','ASTRA_REGRESSIONS.csv','ASTRA_STRATA.json','ASTRA_TIMEOUTS.json','paired-quality-time.csv','nonreturning-calls.csv','SUMMARY.json','FAST_BENCHMARK_SCOPE_20261015_KO.md','adapter.mjs']:
    shutil.copy2(old/name,analysis/name)
shutil.copytree(old/'scalar-analysis',analysis/'scalar-analysis')
shutil.copy2('tools/fast-bench/astra-analyze.py',analysis/'astra-analyze.py')
shutil.copy2(__file__,analysis/'finalize-storage.py')
report=(analysis/'ASTRA_ANALYSIS_KO.md').read_text(encoding='utf-8')
report=report.replace('agent-analysis-v4/','astra-analysis/').replace('analysis.sqlite','../final-database/benchmark.sqlite')
report += '\n\n## 저장 구조 정리\n사용자 요청으로 이전 실패·중단 이력 및 불완전 패키지는 삭제했다. 위 본문은 분석 시점의 역사적 설명이다. 현재 최종 데이터는 `../final-database/benchmark.sqlite`의 calls/fixtures/quality/raw_evidence/inputs/metadata에 있다. raw_evidence.json_gzip은 최종 호출 원자료를 gzip 압축한 BLOB이며 입력도 DB에 포함된다. 이전 attempt·부모 감사·raw 경로 인덱스는 현재 DB에 없다. 정상 TIMEOUT39건은 유지했다.\n'
(analysis/'ASTRA_ANALYSIS_KO.md').write_text(report,encoding='utf-8')
(data/'README.md').write_text('# Final benchmark database\n\nbenchmark.sqlite is self-contained: 30,480 final calls, exact quality histograms, fixture metadata, original raw JSON (gzip BLOB), and compressed input fixtures.\n\nTables: calls, fixtures, quality, raw_evidence, inputs, metadata. No historical attempts or failed audits. Normal TIMEOUT_CALL outcomes (39) remain. run_id preserves source provenance. PLAN.json and SCOPE.json are in metadata.\n\nAnalysis and tools: ../astra-analysis/.\n',encoding='utf-8')
(analysis/'README.md').write_text('# Astra analysis\n\nStart with ASTRA_ANALYSIS_KO.md. Final database: ../final-database/benchmark.sqlite.\n\nCSV/JSON here are derived analysis, not primary records. Recompute strata with `python astra-analyze.py . ../final-database/benchmark.sqlite`. Read raw evidence using `gzip.decompress(json_gzip)` from raw_evidence; inputs.fixture_gzip stores the original compressed fixture bytes.\n\nfinalize-storage.py records the one-time migration and cleanup; do not rerun it on the finalized layout.\n',encoding='utf-8')
def sha(file):
    h=hashlib.sha256()
    with file.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
summary={'schema':1,'calls':30480,'timeouts':39,'inputs':len(refs),'rawCoverage':len(locations),'integrity':'ok','databaseSha256':sha(data/'benchmark.sqlite')}
(data/'MANIFEST.json').write_text(json.dumps(summary,indent=2))
# Only experiment run copies and superseded packages; other research notes stay.
removed=[]
for name in ['actions-38755030086','actions-38755431827','actions-38758374047','actions-38759068303','actions-38766815700','agent-analysis-v1','agent-analysis-v2','agent-analysis-v3','agent-analysis-v4']:
    target=root/name
    if target.exists():shutil.rmtree(target);removed.append(name)
(analysis/'STORAGE_CLEANUP.json').write_text(json.dumps({'validated':summary,'removedDirectories':removed},indent=2))
print(json.dumps(summary))
