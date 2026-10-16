"""Stream original singleton structure for zero-solver equivalence verification."""
import gzip
import hashlib
import json
import pathlib
import sqlite3
import sys

database = pathlib.Path(sys.argv[1])
assert hashlib.file_digest(database.open('rb'), 'sha256').hexdigest() == '98441a87c73449e38c97a4cec31a7f30634f2bc3a03dfff488ec77365a5369a0'
c = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
for (metadata,) in c.execute('select metadata_json from fixtures order by fixture_id'):
    f = json.loads(metadata)
    blob = c.execute('select fixture_gzip from inputs where member=?', (f['member'],)).fetchone()[0]
    raw = json.loads(gzip.decompress(blob))
    singletons = [r[0][0] if len(r) == 1 else None for r in raw['rows']]
    F = len({i for i in singletons if i is not None})
    assert F == f['features']['F']
    assert len(raw['keys']) == f['features']['S']
    print(json.dumps(dict(id=f['id'], S=len(raw['keys']), K=raw['K'], F=F, singletons=singletons)))
