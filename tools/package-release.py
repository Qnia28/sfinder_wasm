"""Package an immutable product commit and match its runtime to tested bytes."""
import argparse,hashlib,json,subprocess,zipfile
from pathlib import Path

def sha(data):return hashlib.sha256(data).hexdigest()

def package(commit,version,out,tested,notes):
    commit=subprocess.check_output(['git','rev-parse',commit+'^{commit}'],text=True).strip()
    out.mkdir(parents=True,exist_ok=False)
    prefix='sfinder-wasm-'+version.removesuffix('.0')+'/'
    archive=out/(prefix[:-1]+'.zip')
    subprocess.run(['git','archive','--format=zip','--prefix='+prefix,'--output='+str(archive),commit],check=True)
    entries=[]
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:raise ValueError('ZIP integrity')
        for info in z.infolist():
            if info.is_dir():continue
            data=z.read(info);name=info.filename.removeprefix(prefix)
            entries.append(dict(path=name,bytes=len(data),sha256=sha(data)))
        names={e['path'] for e in entries}
        for name in ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','package.json','package-lock.json','wasm/pc_wasm.wasm','wasm/batch_wasm.wasm','wasm/highs.wasm','wasm/legal_boards_4.lgb','docs/BUILD_AND_RELEASE.md','docs/RELEASE_3_1.md','rust/Cargo.toml','scripts/build-wasm.sh']:
            if name not in names:raise ValueError('missing '+name)
        if json.loads(z.read(prefix+'package.json'))['version']!=version:raise ValueError('version')
        lock=json.loads(z.read(prefix+'package-lock.json'))
        if lock['version']!=version or lock['packages']['']['version']!=version:raise ValueError('lock version')
        for e in entries:
            if e['path'].endswith('.wasm') and z.read(prefix+e['path'])[:8]!=b'\0asm\x01\0\0\0':raise ValueError('WASM header')
    baseline=json.loads(tested.read_text(encoding='utf8'))
    actual={e['path']:e['sha256'] for e in entries if e['path'].startswith(('src/','wasm/'))}
    expected={e['path']:e['sha256'] for e in baseline['files']}
    if actual!=expected:raise ValueError('packaged runtime differs from tested RC2 bytes')
    manifest=dict(version=version,commit=commit,validatedProductCommit=baseline['commit'],runtimeParity='PASS',testedRuntimeManifestSha256=sha(tested.read_bytes()),packaging='Unmodified committed tree; shipped binaries preserved',files=entries)
    (out/'FILES.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    (out/'RELEASE_NOTES.md').write_bytes(notes.read_bytes())
    with (out/'SHA256SUMS.txt').open('x',encoding='utf8') as stream:
        for name in [archive.name,'FILES.json','RELEASE_NOTES.md']:
            stream.write(sha((out/name).read_bytes())+'  '+name+'\n')
    print(json.dumps(dict(commit=commit,output=str(out),files=len(entries),runtimeFiles=len(actual),archiveSha256=sha(archive.read_bytes()),status='PASS')))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--commit',required=True);p.add_argument('--version',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--tested-runtime',type=Path,required=True);p.add_argument('--notes',type=Path,required=True)
    a=p.parse_args();package(a.commit,a.version,a.out.resolve(),a.tested_runtime,a.notes)
