"""Subset the frozen R15 archive by approved saved-evidence selection; solver0."""
import argparse,hashlib,json,zipfile,contextlib
from pathlib import Path
sha=lambda b:hashlib.sha256(b).hexdigest()
def build(source,selection,out):
    picked=json.loads(selection.read_text(encoding='utf8'))
    manifest=json.loads((source/'MANIFEST.json').read_text(encoding='utf8'))
    assert picked['summary']['selectedInputs']==130
    refs={r['id']:r for r in manifest['inputs']};inputs=[];members={}
    archive=source/'RC_INTEGRATION_INPUTS.zip'
    with (zipfile.ZipFile(archive) if archive.exists() else contextlib.nullcontext()) as z,zipfile.ZipFile(out,'x',compression=zipfile.ZIP_DEFLATED) as target:
        read=lambda name:z.read(name) if z else (source/name).read_bytes()
        def put(name,data):
            if name in members:assert members[name]==sha(data);return
            info=zipfile.ZipInfo(name,date_time=(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            target.writestr(info,data);members[name]=sha(data)
        for item in picked['inputs']:
            ref=refs[item['inputId']];assert ref['sha256']==item['inputHash'];inputs.append(ref)
            data=read(ref['member']);assert sha(data)==ref['sha256'];put(ref['member'],data)
            for f in json.loads(data)['fixtures']:
                data=read(f['member']);assert sha(data)==f['sha256'];put(f['member'],data)
        put('INPUTS.json',(json.dumps(dict(inputs=inputs,parentRunId=38072016117,parentManifestHash='e7af6680ea615fe79fe3c4becd4af661d033493448fafb197f350b3c8469e988'),sort_keys=True,separators=(',',':'))+'\n').encode())
        put('SELECTION.json',selection.read_bytes())
    print(json.dumps(dict(inputs=len(inputs),members=len(members),bytes=out.stat().st_size,sha256=sha(out.read_bytes()),solverCalls=0)))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--selection',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();build(a.source,a.selection,a.out)
