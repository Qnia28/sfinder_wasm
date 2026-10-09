"""Freeze r11 compact-OR candidate on the original four r10 inputs; no solver."""
import argparse
import hashlib
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'postprocess'))
from ledger import projection,encode,digest
from package import verify

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):
    with p.open('x',encoding='utf8') as f:f.write(encode(v)+'\n')

def prepare(package,ledger,out):
    s=verify(package);assert s['runId']==37886233804 and s['collectionState']=='COMPLETE' and s['evidenceValidity']=='PASS'
    current=projection(ledger);assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']=='TRIAGE_CP_MEMORY_20261009_R10')
    assert prior['budgetEvidenceComplete'] and not prior['unknownStarts']
    assert prior['reservedCalls']==13063 and prior['cumulativeCpSyntheticCalls']==12
    assert prior['cumulativeReservedRunnerHours']==2567.6666666666665
    assert len(s['accounting']['calls'])==8 and all(c.get('rawHash') for c in s['accounting']['calls'])
    out.mkdir(parents=True,exist_ok=False)
    a=next(a for a in s['artifactIndex'] if a['collectionRole']=='activation')
    with zipfile.ZipFile(package/'EVIDENCE.zip') as z:
        data=z.read(a['object']);assert hashlib.sha256(data).hexdigest()==a['digest'][7:]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        parent_bytes=z.read('LOCK.json');parent=json.loads(parent_bytes);assert parent['invocationId']=='37886233804'
        m=json.loads(json.dumps(parent['manifest']))
        m.update(campaignId='TRIAGE_CP_COMPACT_20261009_R11',revision=11,approval='USER_CONTINUE_CP_COMPACT_20261009')
        m['design']=dict(id='cp-compact-or-v1',calls=8,inputs=4,repeats=1,comparatorRunId='37886233804',
            change='Only logicalOr encoding: paired reified Boolean OR/AND replaces linMax',
            comparison='Same fixture/arm diagnostic trajectories; historical nonrandomized comparator, not a speed promotion',
            samplingMs=250,durableFsync=True,noAdaptiveRetest=True,freshValidation=False,gates=dict(correctness_disagreements_allowed=0))
        m['provenance'].update(parentLockArtifact=a,ancestorLockArtifacts=[],priorCampaignId=parent['manifest']['campaignId'],
            priorReservedRunnerHours=prior['cumulativeReservedRunnerHours'],priorCpSyntheticCalls=12,measurementEpoch=11,
            approval=m['approval'],exposures=['R8','R10_MEMORY_DIAGNOSTIC'],priorEvidencePooled=False,
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            budgetAmendment='Existing clock and cap retained; approved compact-model follow-up 8 calls + 1 scoped synthetic')
        (out/'PARENT_LOCK.json').write_bytes(parent_bytes);(out/'FIXTURE_SOURCE_LOCK.json').write_bytes(parent_bytes)
        write(out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead'],latestPackageCollectionComplete=True,
            latestPackageMissingCalls=0,latestPackageUnknownAllocations=0,sourcePackageSha256=sha(package/'PACKAGE.json'),
            latestPackageAccounting=s['accounting']))
        m['largeRun']=dict(id='cp-memory-stages-v1',calls=8,chunks=4,callMs=600000,priorCalls=13063,priorCpCalls=12,
            priorRunnerHours=prior['cumulativeReservedRunnerHours'],controlHours=6,originMs=parent['originMs'],endMs=parent['endMs'],
            budgetAuthorization=m['approval'],parentLockSha256=sha(out/'PARENT_LOCK.json'),fixtureSourceLockSha256=sha(out/'FIXTURE_SOURCE_LOCK.json'),
            accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),modelChange='BOOLEAN_OR_DUAL_REIFICATION',comparatorRunId='37886233804')
        tasks=[dict(task_id=f'r11/{i:02d}',phase='CP_COMPACT_R11',fixture_ids=[f['id']],conditional=False,calls=2,
            arms=['CP_OPEN','H9_OPEN'] if i%2==0 else ['H9_OPEN','CP_OPEN'],role='COMPACT_OR_MEMORY_DIAGNOSTIC') for i,f in enumerate(m['inputs'])]
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf8');m['tasksHash']=sha(out/'TASKS.jsonl')
        m['sourceFiles']['harness'].update({p:'' for p in ['tests/cpsat-compact-or.test.mjs','tests/cpsat-model-shape.test.mjs',
            'tools/secondary-bench/common/triage/prepare-compact.py']})
        for group in ['product','harness']:
            for name in m['sourceFiles'][group]:
                b=Path(name).read_bytes()
                if b'\0' not in b:b=b.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(b).hexdigest()
        before=parent['manifest']['sourceFiles']['product'];after=m['sourceFiles']['product']
        assert before.keys()==after.keys() and [k for k in after if before[k]!=after[k]]==['src/cpsat-secondary-model.mjs']
        write(out/'MANIFEST.json',m)
        with zipfile.ZipFile(out/'TRIAGE_COMPACT_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as dest:
            for name in ['MANIFEST.json','TASKS.jsonl','PARENT_LOCK.json','FIXTURE_SOURCE_LOCK.json','PRIOR_ACCOUNTING.json']:dest.write(out/name,name)
            for f in m['inputs']:
                b=z.read(f['member']);assert hashlib.sha256(b).hexdigest()==f['sha256'];dest.writestr(f['member'],b)
    write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
        bundleSha256=sha(out/'TRIAGE_COMPACT_INPUTS.zip'),manifestHash=digest(m)))
    print(encode(dict(inputs=4,calls=8,chunks=4,solverCalls=0,cumulativeCallReservation=13084,
        cumulativeRunnerReservation=prior['cumulativeReservedRunnerHours']+4*350/60+6)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['package','ledger','out']:p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args();prepare(a.package,a.ledger,a.out)
