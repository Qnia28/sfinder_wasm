"""Reconstruct sealed R18 artifacts and rerun its independent saved-evidence audit."""
import argparse,io,json,sqlite3,subprocess,sys,zipfile
from pathlib import Path
from package import read,sha,verify,validate_snapshots,write

def review(package,out):
    verify(package)
    summary=read(package/'SUMMARY.json')
    if summary['runId']!=38241601404 or summary['collectionState']!='COMPLETE':raise ValueError('wrong/incomplete package')
    out.mkdir(parents=True,exist_ok=False)
    with zipfile.ZipFile(package/'EVIDENCE.zip') as evidence:
        for a in summary['artifactIndex']:
            if a['collectionRole']=='excluded':continue
            if not a['object']:raise ValueError('missing artifact')
            if '/' in a['name'] or '\\' in a['name']:raise ValueError('unsafe artifact name')
            with zipfile.ZipFile(io.BytesIO(evidence.read(a['object']))) as z:
                validate_snapshots(z)
                z.extractall(out/'download'/a['name'])
    auditor=Path(__file__).resolve().parents[1]/'common/triage/rc2-audit.py'
    result=subprocess.run([sys.executable,'-B',str(auditor)],cwd=out,capture_output=True)
    (out/'AUDIT_LOG.txt').write_bytes(result.stdout+result.stderr)
    if result.returncode:raise ValueError('local independent audit failed; see AUDIT_LOG.txt')
    remote=out/'download/triage-independent-RC2_LINMAX_RELEASE_VALIDATION_R18_20261012-FINAL'
    def rows(path):
        with sqlite3.connect(path.as_uri()+'?mode=ro',uri=True) as db:
            if db.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('DB integrity')
            return {r['callId']:r for (text,) in db.execute('SELECT raw FROM records') for r in [json.loads(text)]}
    if rows(remote/'RAW.sqlite')!=rows(out/'audit/RAW.sqlite'):raise ValueError('independent raw mismatch')
    value=dict(status='PASS',runId=38241601404,packageSha256=sha(package/'PACKAGE.json'),artifactCount=sum(a['collectionRole']!='excluded' for a in summary['artifactIndex']),remoteRawSha256=sha(remote/'RAW.sqlite'),localAudit=read(out/'audit/INDEPENDENT_AUDIT.json'),rawSemanticParity='PASS',solverCalls=0)
    write(out/'LOCAL_REAUDIT.json',value)
    print(json.dumps(value,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--package',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();review(a.package.resolve(),a.out.resolve())
