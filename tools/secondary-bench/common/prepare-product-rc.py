"""Freeze committed product/runtime bytes and original dev; no solver/build."""
import argparse,hashlib,io,json,subprocess,zipfile
from pathlib import Path

RC='2c406b98cadc186bfaf4490f4b8568535a60ea01'
DEV='7ef62d18e1d155b6479e00d651c851ff3baa7112'
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,v):
    with p.open('x',encoding='utf8') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')
def prepare(out):
    out.mkdir(parents=True,exist_ok=False);archives={}
    for label,commit in [('RC',RC),('DEV',DEV)]:
        data=subprocess.check_output(['git','archive','--format=zip',commit]);file=out/(label+'_SOURCE_RUNTIME.zip');file.write_bytes(data)
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            entries=[dict(path=n,bytes=len(z.read(n)),sha256=sha(z.read(n))) for n in sorted(z.namelist()) if not n.endswith('/')]
            product=[e for e in entries if e['path'].startswith(('src/','wasm/')) or e['path'] in ['package.json','package-lock.json']]
            assert any(e['path']=='wasm/pc_wasm.wasm' for e in product)
            assert all(any(e['path']==n for e in entries) for n in ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','docs/BUILD_AND_RELEASE.md'])
        manifest=dict(label=label,commit=commit,archive=file.name,archiveSha256=sha(data),bytes=len(data),files=entries,productFiles=product)
        write(out/(label+'_FILES.json'),manifest);archives[label]=dict(commit=commit,archive=file.name,sha256=sha(data),bytes=len(data),manifestSha256=sha((out/(label+'_FILES.json')).read_bytes()))
    diff=subprocess.check_output(['git','diff','--binary',DEV,RC,'--','src','wasm','package.json','package-lock.json'])
    (out/'PRODUCT_FROM_DEV.patch').write_bytes(diff)
    changed=subprocess.check_output(['git','diff','--name-status',DEV,RC,'--','src','wasm','package.json','package-lock.json'],text=True)
    (out/'PRODUCT_CHANGES.txt').write_text(changed,encoding='utf8')
    write(out/'RC_MANIFEST.json',dict(id='P15_RC1_20261011',status='RELEASE_CANDIDATE_INTEGRATION_PENDING',archives=archives,
        defaultPolicy='P15',productDiffSha256=sha(diff),localSolverCalls=0,assets='Committed prebuilt WASM; not rebuilt',
        benchmarkScope='Original product command including enumeration/primary/secondary/result generation; UI rendering/network excluded'))
    (out/'README_KO.md').write_text('''# P15 RC1 — 제품 통합 비교 후보

RC_SOURCE_RUNTIME.zip은 승격commit의 소스·사전빌드WASM·license·빌드안내를 포함한다.
DEV_SOURCE_RUNTIME.zip은 원래dev 전체commit으로, 새코드에옛정책만주입한대조가아니다.
각 FILES.json 및 RC_MANIFEST.json의 SHA256으로배포bytes를검증한다.

압축을 각각 독립 폴더에 해제한 뒤 Node24.13.0에서 `npm ci`로 lockfile의 의존성을 설치한다.
Node API 사용법은 docs/API_REFERENCE.md, 배포는 docs/BUILD_AND_RELEASE.md를 따른다.
브라우저배포는 src/와wasm/및tetris-fumen의존성을함께배포하고 ORTOOLS_INTEGRATION_AND_LICENSE.md의헤더요건을따른다.
이저장소는라이브러리이며별도사용자UI를포함한앱패키지가아니다.

P15는non-hard d<=14,hard d<=9,unknown fallback을사용한다. CP60초합류,내부deadline없음.
per-save9개재현손해및긴ALL입력peak증가가알려져있다. r14증거는기존P15_R14_COMPLETE.zip참조.
제품통합비교전RC이며정식릴리스/main병합완료가아니다.
되돌림은DEV_SOURCE_RUNTIME.zip전체를복원한다. 두버전의JS/WASM을섞지않는다.
''',encoding='utf8')
    with zipfile.ZipFile(out/'P15_RC1_COMPLETE.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.iterdir()):
            if p.name!='P15_RC1_COMPLETE.zip':z.write(p,p.name)
    write(out/'PACKAGE.json',dict(files=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(out.iterdir()) if p.is_file()]))
    print(json.dumps(dict(status='PACKAGED',path=str(out),rcCommit=RC,devCommit=DEV,solverCalls=0)))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();prepare(a.out)
