"""Offline R18 handoff verifier. Standard library only; no solver."""
import hashlib,json,sqlite3,sys,zipfile
from pathlib import Path

root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
seal=json.loads((root/'HANDOFF.json').read_text(encoding='utf8'))
def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
for item in seal['members']:
    file=root/item['path']
    assert file.stat().st_size==item['bytes'] and sha(file)==item['sha256'],item['path']
with sqlite3.connect((root/'R18.sqlite').as_uri()+'?mode=ro',uri=True) as db:
    assert db.execute('PRAGMA integrity_check').fetchone()==('ok',)
    tables={}
    for name in ['calls','pairs','inputs']:
        values=[json.loads(r[0]) for r in db.execute('SELECT raw FROM '+name)]
        assert values==[json.loads(line) for line in (root/(name+'.jsonl')).read_text().splitlines()]
        tables[name]=values
index={r['callId']:r for r in tables['calls']}
assert len(index)==len(tables['calls'])==1560 and len(tables['pairs'])==780 and len(tables['inputs'])==130
seen=set()
for p in tables['pairs']:
    d=index[p['devCall']];c=index[p['rc2Call']]
    assert d['variant']=='DEV' and c['variant']=='RC2'
    assert all(d[k]==c[k] for k in ['inputId','phase','repeat','runnerId'])
    assert {d['position'],c['position']}=={0,1}
    assert d['callId'] not in seen and c['callId'] not in seen
    seen.update([d['callId'],c['callId']])
    assert p['exactGainMs']==(d['ms']-c['ms'] if d['status']==c['status']=='EXACT' else None)
    assert p['failurePenalized600GainMs']==sum(sign*(r['ms'] if r['status']=='EXACT' else 600000) for sign,r in [(1,d),(-1,c)])
package=root/'evidence-package';descriptor=json.loads((package/'PACKAGE.json').read_text())
assert sha(package/'PACKAGE.json')==seal['packageSha256']
for item in descriptor['files']:assert sha(package/item['path'])==item['sha256']
summary=json.loads((package/'SUMMARY.json').read_text())
with zipfile.ZipFile(package/'EVIDENCE.zip') as z:
    for a in summary['artifactIndex']:
        if a['collectionRole']=='excluded':continue
        with z.open(a['object']) as stream:assert 'sha256:'+hashlib.file_digest(stream,'sha256').hexdigest()==a['digest']
print('PASS: hashes, evidence objects, SQLite/JSONL, 1560 calls/780 pairs; solverCalls=0')
