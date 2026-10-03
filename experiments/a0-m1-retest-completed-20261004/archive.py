"""Preserve immutable downloaded artifacts as exact-byte archives, no solver calls."""
from pathlib import Path
import hashlib
import json
import zipfile

HERE=Path(__file__).resolve().parent;D=HERE/'github-run-37138752420'
assert not (HERE/'ARCHIVES.json').exists()
packed=HERE/'PACKED';packed.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();archives=[]
for artifact in sorted(p for p in D.iterdir() if p.is_dir()):
 target=packed/f'{artifact.name}.zip';source=[p for p in sorted(artifact.rglob('*')) if p.is_file()]
 with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in source:z.write(p,p.relative_to(HERE).as_posix())
 assert target.stat().st_size<90*2**20
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  for p in source:assert sha(z.read(p.relative_to(HERE).as_posix()))==sha(p.read_bytes())
 archives.append({'file':target.relative_to(HERE).as_posix(),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),
  'files':len(source),'source':artifact.relative_to(HERE).as_posix()})
source_bundle=HERE/'SOURCE-LAUNCH.bundle';parts=[];data=source_bundle.read_bytes();chunks=HERE/'BUNDLE_PARTS';chunks.mkdir()
for i,start in enumerate(range(0,len(data),40*2**20)):
 b=data[start:start+40*2**20];p=chunks/f'SOURCE-LAUNCH.bundle.part{i:02}';p.write_bytes(b)
 parts.append({'file':p.relative_to(HERE).as_posix(),'bytes':len(b),'sha256':sha(b)})
assert b''.join((HERE/p['file']).read_bytes() for p in parts)==data
manifest={'schema':'m1-retest-archive-v1','archives':archives,'rawOriginalsPreservedLocally':True,'allArchivedBytesVerified':True,
 'largeBundle':{'file':'SOURCE-LAUNCH.bundle','bytes':len(data),'sha256':sha(data),'parts':parts,'restore':'Concatenate listed parts in order, as raw bytes.'}}
with (HERE/'ARCHIVES.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(manifest,f,indent=2);f.write('\n')
print(json.dumps({'archives':len(archives),'rawFilesPacked':sum(a['files'] for a in archives),'packedBytes':sum(a['bytes'] for a in archives),'bundleParts':len(parts)},indent=2))
