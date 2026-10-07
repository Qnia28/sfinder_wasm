"""Prepare the approved 25-input follow-up from saved r6 bytes; solver calls=0."""
import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'postprocess'))
from ledger import projection, encode, digest

def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(encode(v)+'\n',encoding='utf-8')

def main():
    p=argparse.ArgumentParser()
    for name in ['package','design','ledger','out']:p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args();out=a.out;out.mkdir(parents=True,exist_ok=False)
    current=projection(a.ledger);assert not current['conflicts']
    campaign=next(c for c in current['campaigns'] if c['campaignId']=='TRIAGE_PROBE_SEED_AB_20261006_R1')
    assert campaign['budgetEvidenceComplete'] and not campaign['unknownStarts']
    assert campaign['reservedCalls']==7907 and campaign['cumulativeReservedRunnerHours']==1255
    summary=read(a.package/'SUMMARY.json');artifact=next(v for v in summary['artifactIndex'] if v['collectionRole']=='activation')
    archive=a.package/artifact['object'];assert 'sha256:'+sha(archive)==artifact['digest']
    targets=[json.loads(s) for s in (a.design/'TARGETS.jsonl').read_text().splitlines()]
    tasks={t['task_id']:t for t in map(json.loads,(a.design/'TASKS.jsonl').read_text().splitlines())}
    chunks=list(map(json.loads,(a.design/'CHUNKS.jsonl').read_text().splitlines()))
    with zipfile.ZipFile(archive) as z:
        parent_bytes=z.read('LOCK.json');parent=json.loads(parent_bytes);m=json.loads(json.dumps(parent['manifest']))
        assert len(targets)==25 and len(tasks)==125 and len(chunks)==42
        ids={t['fixture_id']:t for t in targets}
        m['inputs']=[f for f in m['inputs'] if f['id'] in ids]
        for f in m['inputs']:assert f['sha256']==ids[f['id']]['fixture_sha256']
        for key in ['continuation','prerequisiteReuse','activationRecovery','startupContinuation']:m.pop(key,None)
        m.update(revision=7,approval='USER_CONTINUE_EXECUTE_SIMPLIFIED_20261007',baselineFiles=[])
        arms=['BASE_ON','A_ON','BASE_OFF','A_OFF','SHAM_ON_1','SHAM_ON_2','SHAM_OFF_1','SHAM_OFF_2']
        m['measurement']['variants']=arms
        m['design']=read(a.design/'PLAN.json')
        m['design']['gates']={'correctness_disagreements_allowed':0}
        m['provenance'].update(priorReservedRunnerHours=1255,priorCpSyntheticCalls=8,measurementEpoch=7,
            parentLockArtifact=dict(id=artifact['id'],digest=artifact['digest']),
            ancestorLockArtifacts=[parent['manifest']['provenance']['parentLockArtifact'],*parent['manifest']['provenance']['ancestorLockArtifacts']],
            approval=m['approval'],exposures=['R6_SELECTED_FAST_PANEL'],priorEvidencePooled=False,
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip())
        (out/'PARENT_LOCK.json').write_bytes(parent_bytes)
        write(out/'PRIOR_ACCOUNTING.json',dict(**campaign,ledgerHead=current['ledgerHead'],sourcePackageSha256=sha(a.package/'PACKAGE.json')))
        (out/'FOLLOWUP_DESIGN.json').write_bytes((a.design/'PLAN.json').read_bytes())
        m['followup']=dict(id='a-fast-trace-factorial-v1',calls=500,chunks=42,priorCalls=7907,priorRunnerHours=1255,
            newCpCalls=1,controlHours=3.5,originMs=parent['originMs'],endMs=parent['endMs'],
            parentLockSha256=sha(out/'PARENT_LOCK.json'),accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),designSha256=sha(out/'FOLLOWUP_DESIGN.json'))
        # Only executable/config sources are frozen; unrelated local documentation is not part of execution.
        source_names=set(m['sourceFiles']['harness'])
        source_names.update(['tools/secondary-bench/common/triage/fast-followup.mjs','tools/secondary-bench/common/triage/prepare-fast.py','tests/triage-fast-followup.test.mjs'])
        m['sourceFiles']['harness']={}
        for name in sorted(source_names):
            if name.endswith('.md'):continue
            data=Path(name).read_bytes()
            assert b'\r\n' not in data,'execution source must use LF: '+name
            m['sourceFiles']['harness'][name]=hashlib.sha256(data).hexdigest()
        for name,h in m['sourceFiles']['product'].items():
            data=Path(name).read_bytes()
            if b'\0' not in data:data=data.replace(b'\r\n',b'\n')
            assert hashlib.sha256(data).hexdigest()==h,'product changed: '+name
        templates=[]
        for chunk in chunks:
            assert len({tasks[t]['fixture_id'] for t in chunk['task_ids']})==len(chunk['task_ids'])
            for tid in chunk['task_ids']:
                t=tasks[tid];templates.append(dict(task_id=tid,phase='A_FAST_FACTORIAL',fixture_ids=[t['fixture_id']],conditional=False,
                    calls=4,block=t['block'],role=t['role'],arms=[c['arm'] for c in t['calls']]))
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in templates),encoding='utf-8')
        m['tasksHash']=sha(out/'TASKS.jsonl');write(out/'MANIFEST.json',m)
        # Only selected original fixture bytes plus the parent lock/accounting snapshot.
        bundle=out/'TRIAGE_FAST_INPUTS.zip'
        with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as dest:
            for name in ['MANIFEST.json','TASKS.jsonl','PARENT_LOCK.json','PRIOR_ACCOUNTING.json','FOLLOWUP_DESIGN.json']:dest.write(out/name,name)
            for f in m['inputs']:
                data=z.read(f['member']);assert hashlib.sha256(data).hexdigest()==f['sha256'];dest.writestr(f['member'],data)
    write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,bundleSha256=sha(bundle),manifestHash=digest(m)))
    print(encode(dict(inputs=len(m['inputs']),calls=500,chunks=42,archiveBytes=bundle.stat().st_size,
        cumulativeCallsIncludingNewCp=8408,cumulativeReservedRunnerHours=1363.5,solverCalls=0)))

if __name__=='__main__':main()
