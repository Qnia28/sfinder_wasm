"""Freeze the approved four-input r9 memory diagnosis. No solver execution."""
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
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(encode(v)+'\n',encoding='utf-8')

def prepare(package,bundle,ledger,out):
    verify(package);s=read(package/'SUMMARY.json');current=projection(ledger)
    assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']=='TRIAGE_H9_CP10M_20261007_R8')
    assert prior['reservedCalls']==13047 and prior['cumulativeCpSyntheticCalls']==10 and not prior['unknownStarts']
    assert s['collectionState']=='COMPLETE'
    accounting=s['accounting'];assert len(accounting['calls'])==4640 and all(c.get('rawHash') for c in accounting['calls'])
    assert not accounting['runnerAllocation']['unknownReservationJobs']
    assert prior['cumulativeReservedRunnerHours']==accounting['cumulativeReservedRunnerHours']==2533.333333333333
    out.mkdir(parents=True,exist_ok=False)
    a=next(a for a in s['artifactIndex'] if a['collectionRole']=='activation')
    with zipfile.ZipFile(package/'EVIDENCE.zip') as z:
        data=z.read(a['object']);assert hashlib.sha256(data).hexdigest()==a['digest'][7:]
    with zipfile.ZipFile(io.BytesIO(data)) as z:parent_bytes=z.read('LOCK.json')
    parent=json.loads(parent_bytes);assert parent['invocationId']=='37623263031'
    with zipfile.ZipFile(bundle) as z:
        m=json.loads(z.read('MANIFEST.json'));assert m==parent['manifest']
        ids=['cycle1-pcinfo-033/all/restricted-split/ALL','cycle1-pcinfo-030/all/restricted-split/ALL',
             'cycle1-pcinfo-031/all/bag-plus-next-draw/ALL','cycle1-pcinfo-040/all/restricted-split/ALL']
        m['inputs']=[next(f for f in m['inputs'] if f['id']==fid) for fid in ids]
        m.update(campaignId='TRIAGE_CP_MEMORY_20261009_R9',revision=9,maxParallel=4,approval='USER_CONTINUE_CP_MEMORY_20261009')
        m['job'].update(parts=1,jobMs=45*60000,jobMinutes=350)
        m['budget'].update(maxParallel=4,job=m['job'])
        m['measurement']['variants']=['CP_OPEN','H9_OPEN']
        m['design']=dict(id='cp-memory-stages-v1',calls=8,inputs=4,repeats=1,
            purpose='Locate memory boundary: input/model/encode/native; diagnostic timings are not performance comparisons',
            samplingMs=250,durableFsync=True,noAdaptiveRetest=True,freshValidation=False,
            gates=dict(correctness_disagreements_allowed=0))
        m['provenance'].update(parentLockArtifact=a,ancestorLockArtifacts=[],priorCampaignId=parent['manifest']['campaignId'],
            priorReservedRunnerHours=prior['cumulativeReservedRunnerHours'],priorCpSyntheticCalls=10,measurementEpoch=9,
            approval=m['approval'],exposures=['R8','R8_OOM_FORENSICS'],priorEvidencePooled=False,
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            budgetAmendment='No cap/clock reset; diagnostic 8 calls plus one existing scoped synthetic, latest reviewed evidence binds all prior slots')
        (out/'PARENT_LOCK.json').write_bytes(parent_bytes);(out/'FIXTURE_SOURCE_LOCK.json').write_bytes(parent_bytes)
        write(out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead'],
            latestPackageCollectionComplete=True,latestPackageMissingCalls=0,latestPackageUnknownAllocations=0,
            sourcePackageSha256=sha(package/'PACKAGE.json'),latestPackageAccounting=accounting))
        m['largeRun']=dict(id='cp-memory-stages-v1',calls=8,chunks=4,callMs=600000,priorCalls=13047,priorCpCalls=10,
            priorRunnerHours=prior['cumulativeReservedRunnerHours'],controlHours=6,originMs=parent['originMs'],endMs=parent['endMs'],
            budgetAuthorization=m['approval'],parentLockSha256=sha(out/'PARENT_LOCK.json'),
            fixtureSourceLockSha256=sha(out/'FIXTURE_SOURCE_LOCK.json'),accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'))
        tasks=[dict(task_id=f'r9/{i:02d}',phase='CP_MEMORY_R9',fixture_ids=[fid],conditional=False,calls=2,
            arms=['CP_OPEN','H9_OPEN'] if i%2==0 else ['H9_OPEN','CP_OPEN'],role='MEMORY_DIAGNOSTIC') for i,fid in enumerate(ids)]
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf-8');m['tasksHash']=sha(out/'TASKS.jsonl')
        m['sourceFiles']['harness'].update({p:'' for p in [
            'tools/secondary-bench/common/triage/memory-trace.mjs','tools/secondary-bench/common/triage/prepare-memory.py',
            'tests/cp-memory-diagnostic.test.mjs']})
        for group in ['product','harness']:
            for name in m['sourceFiles'][group]:
                data=Path(name).read_bytes()
                if b'\0' not in data:data=data.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(data).hexdigest()
        write(out/'MANIFEST.json',m)
        with zipfile.ZipFile(out/'TRIAGE_MEMORY_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as dest:
            for name in ['MANIFEST.json','TASKS.jsonl','PARENT_LOCK.json','FIXTURE_SOURCE_LOCK.json','PRIOR_ACCOUNTING.json']:dest.write(out/name,name)
            for f in m['inputs']:
                data=z.read(f['member']);assert hashlib.sha256(data).hexdigest()==f['sha256'];dest.writestr(f['member'],data)
    write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
        bundleSha256=sha(out/'TRIAGE_MEMORY_INPUTS.zip'),manifestHash=digest(m)))
    print(encode(dict(inputs=4,calls=8,chunks=4,solverCalls=0,priorBudgetEvidenceComplete=prior['budgetEvidenceComplete'],
        latestReviewedCollectionComplete=True,cumulativeCallReservation=13066,cumulativeRunnerReservation=2533.333333333333+4*350/60+6)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['package','bundle','ledger','out']:p.add_argument('--'+n,type=Path,required=True)
    a=p.parse_args();prepare(a.package,a.bundle,a.ledger,a.out)
