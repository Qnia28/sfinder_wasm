"""Zero-solver descriptive stratification of the frozen agent package."""
import collections
import csv
import json
import pathlib
import sqlite3
import statistics
import sys

p = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader((p/'paired-quality-time.csv').open(encoding='utf-8')))
rows = [r for r in rows if r['reference']=='BASE100']
result = []
for dimension in ['population','primaryHard','previewEligible']:
    for value in sorted({r[dimension] for r in rows if r['phase']=='matrix'}):
        for arm in sorted({r['arm'] for r in rows if r['phase']=='matrix'}):
            pp=[r for r in rows if r['phase']=='matrix' and r[dimension]==value and r['arm']==arm]
            if not pp: continue
            groups=collections.defaultdict(list)
            for r in pp: groups[r['fixture']].append(r)
            med=lambda key:[statistics.median(float(r[key]) for r in v if r[key]) for v in groups.values() if any(r[key] for r in v)]
            delta,ratio=med('deltaMs'),med('ratio')
            result.append(dict(dimension=dimension,stratum=value,arm=arm,fixtures=len(groups),pairs=len(pp),
                quality=dict(collections.Counter(r['quality'] for r in pp)),
                worseFixtures=[k for k,v in groups.items() if any(r['quality'] in ['WORSE','MIXED_FILTERS'] for r in v)],
                medianDeltaMs=statistics.median(delta) if delta else None,
                medianRatio=statistics.median(ratio) if ratio else None,
                completedPairTotalDeltaMs=sum(float(r['deltaMs']) for r in pp if r['deltaMs'])))
(p/'ASTRA_STRATA.json').write_text(json.dumps(result,indent=2))
reg=[r for r in rows if r['quality'] in ['WORSE','MIXED_FILTERS']]
with (p/'ASTRA_REGRESSIONS.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(reg[0]));w.writeheader();w.writerows(reg)
db=sqlite3.connect(pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else p/'analysis.sqlite')
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert db.execute('SELECT count(*) FROM calls').fetchone()[0]==30480
timeouts=db.execute("SELECT phase,arm,fixture_id,count(*) FROM calls WHERE status='TIMEOUT_CALL' GROUP BY phase,arm,fixture_id").fetchall()
(p/'ASTRA_TIMEOUTS.json').write_text(json.dumps(timeouts,indent=2))
for r in result:
    if r['dimension']=='population' and r['stratum']=='ALL':print(json.dumps(r))
print('TIMEOUTS',json.dumps(timeouts))
