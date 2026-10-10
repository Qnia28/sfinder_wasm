"""Offline full evidence adjudication v3; retain frozen source and original FAIL."""
import argparse,hashlib,io,json,subprocess,zipfile
from pathlib import Path
from package import verify
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def write(p,v):
    with p.open('x',encoding='utf8') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')
def run(package,work,out):
    s=verify(package);assert s['collectionState']=='COMPLETE' and s['rawDatabaseParity']=='PASS'
    work.mkdir(parents=True,exist_ok=False);out.mkdir(parents=True,exist_ok=False)
    ref=next(a for a in s['artifactIndex'] if a['collectionRole']=='activation')
    with zipfile.ZipFile(package/'EVIDENCE.zip') as z:
        with zipfile.ZipFile(io.BytesIO(z.read(ref['object']))) as a:a.extractall(work/'config')
        lock=json.loads((work/'config/LOCK.json').read_text());m=lock['manifest']
        for files in m['sourceFiles'].values():
            for name in files:
                p=work/name;p.parent.mkdir(parents=True,exist_ok=True)
                p.write_bytes(subprocess.check_output(['git','show',lock['commit']+':'+name]))
        inventory=[]
        for a in s['artifactIndex']:
            if not a['name'].startswith('triage-data-'+m['campaignId']+'-'):continue
            with zipfile.ZipFile(io.BytesIO(z.read(a['object']))) as raw:raw.extractall(work/'history'/str(a['id']))
            inventory.append(dict(id=a['id'],digest=a['digest']))
    write(work/'history/DOWNLOAD_INDEX.json',dict(artifacts=inventory))
    write(work/'history/DOWNLOAD_COMPLETE.json',dict(errors=[],downloaded=len(inventory),selected=len(inventory)))
    auditor=Path(__file__).resolve().parents[1]/'common/triage/independent-audit.py'
    (out/'independent-audit.py').write_bytes(auditor.read_bytes())
    proc=subprocess.run(['python','-B',str(out/'independent-audit.py'),'--config',str(work/'config'),'--history',str(work/'history'),'--out',str(out/'audit')],cwd=work,text=True,capture_output=True)
    (out/'AUDIT_OUTPUT.txt').write_text(proc.stdout+'\n'+proc.stderr,encoding='utf8')
    report=json.loads((out/'audit/INDEPENDENT_AUDIT.json').read_text())
    write(out/'ADJUDICATION.json',dict(contract='triage-evidence-v3-unknown-route-oom-quarantine',runId=s['runId'],
        sourcePackageSha256=sha(package/'PACKAGE.json'),frozenCommit=lock['commit'],frozenManifestHash=lock['manifestHash'],
        auditorSha256=sha(out/'independent-audit.py'),reportSha256=sha(out/'audit/INDEPENDENT_AUDIT.json'),
        originalEvidenceValidity=s['evidenceValidity'],revisedEvidenceValidity=report['status'],
        originalRewritten=False,executionSourceUnchanged=True,solverCalls=0))
    print(json.dumps({k:report[k] for k in ['status','observedCalls','scheduledCalls','witnessRecordsChecked','statusCounts','missing','normalOomSkips']}))
    if proc.returncode:raise SystemExit(proc.returncode)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['package','work','out']:p.add_argument('--'+n,type=Path,required=True)
    a=p.parse_args();run(a.package.resolve(),a.work.resolve(),a.out.resolve())
