"""Freeze one original CP033 call for native failure diagnostics; no solver."""
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
    s=verify(package);assert s['runId']==37916694988 and s['collectionState']=='COMPLETE' and s['rawDatabaseParity']=='PASS'
    assert s['evidenceValidity']=='FAIL' and not s['errors']
    current=projection(ledger);assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']==s['campaignId'])
    assert prior['budgetEvidenceComplete'] and not prior['unknownStarts']
    assert prior['reservedCalls']==13071 and prior['cumulativeCpSyntheticCalls']==13 and prior['cumulativeReservedRunnerHours']==2596.5
    out.mkdir(parents=True,exist_ok=False)
    a=next(a for a in s['artifactIndex'] if a['collectionRole']=='activation')
    with zipfile.ZipFile(package/'EVIDENCE.zip') as archive:data=archive.read(a['object'])
    assert hashlib.sha256(data).hexdigest()==a['digest'][7:]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        parent_bytes=z.read('LOCK.json');parent=json.loads(parent_bytes);assert parent['invocationId']=='37916694988'
        m=json.loads(json.dumps(parent['manifest']));m['inputs']=m['inputs'][:1]
        assert m['inputs'][0]['id']=='cycle1-pcinfo-033/all/restricted-split/ALL'
        m.update(campaignId='TRIAGE_CP_FAILURE_20261010_R12',revision=12,maxParallel=1,approval='USER_CAUSE_ANALYSIS_20261010')
        m['budget']['maxParallel']=1;m['measurement']['variants']=['CP_OPEN']
        m['design']=dict(id='cp-native-failure-v1',calls=1,inputs=1,repeats=1,comparatorRunId='37916694988',
            purpose='Discriminate WASM grow refusal, native exception and result recovery error',
            samplingMs=250,durableFsync=True,noAdaptiveRetest=True,freshValidation=False,gates=dict(correctness_disagreements_allowed=0))
        m['provenance'].update(parentLockArtifact=a,ancestorLockArtifacts=[],priorCampaignId=parent['manifest']['campaignId'],
            priorReservedRunnerHours=2596.5,priorCpSyntheticCalls=13,measurementEpoch=12,approval=m['approval'],
            exposures=['R8','R10_MEMORY_DIAGNOSTIC','R11_COMPACT_ERROR'],priorEvidencePooled=False,
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            budgetAmendment='One diagnostic CP033 + scoped synthetic; unchanged clock/cap/product/WASM; historical FAIL retained')
        (out/'PARENT_LOCK.json').write_bytes(parent_bytes);(out/'FIXTURE_SOURCE_LOCK.json').write_bytes(parent_bytes)
        write(out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead'],latestPackageCollectionComplete=True,
            latestPackageMissingCalls=0,latestPackageUnknownAllocations=0,sourcePackageSha256=sha(package/'PACKAGE.json'),latestPackageAccounting=s['accounting']))
        m['largeRun']=dict(id='cp-memory-stages-v1',calls=1,chunks=1,callMs=600000,priorCalls=13071,priorCpCalls=13,
            priorRunnerHours=2596.5,controlHours=6,originMs=parent['originMs'],endMs=parent['endMs'],budgetAuthorization=m['approval'],
            parentLockSha256=sha(out/'PARENT_LOCK.json'),fixtureSourceLockSha256=sha(out/'FIXTURE_SOURCE_LOCK.json'),
            accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),modelChange='NONE_DIAGNOSTIC_IMPORT_EXPORT_INTERCEPTION',comparatorRunId='37916694988')
        tasks=[dict(task_id='r12/00',phase='CP_FAILURE_R12',fixture_ids=[m['inputs'][0]['id']],conditional=False,calls=1,
            arms=['CP_OPEN'],role='NATIVE_FAILURE_CAUSE_DIAGNOSTIC')]
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf8');m['tasksHash']=sha(out/'TASKS.jsonl')
        m['sourceFiles']['harness'].update({name:'' for name in ['tools/secondary-bench/common/triage/prepare-failure.py',
            'tools/secondary-bench/common/triage/wasm-failure-trace.mjs','tests/wasm-failure-trace.test.mjs']})
        for group in ['product','harness']:
            for name in m['sourceFiles'][group]:
                b=Path(name).read_bytes()
                if b'\0' not in b:b=b.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(b).hexdigest()
        assert m['sourceFiles']['product']==parent['manifest']['sourceFiles']['product']
        write(out/'MANIFEST.json',m)
        with zipfile.ZipFile(out/'TRIAGE_FAILURE_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as dest:
            for name in ['MANIFEST.json','TASKS.jsonl','PARENT_LOCK.json','FIXTURE_SOURCE_LOCK.json','PRIOR_ACCOUNTING.json']:dest.write(out/name,name)
            for f in m['inputs']:
                b=z.read(f['member']);assert hashlib.sha256(b).hexdigest()==f['sha256'];dest.writestr(f['member'],b)
    write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
        bundleSha256=sha(out/'TRIAGE_FAILURE_INPUTS.zip'),manifestHash=digest(m)))
    print(encode(dict(inputs=1,calls=1,chunks=1,solverCalls=0,cumulativeCallReservation=13086,cumulativeRunnerReservation=2596.5+350/60+6)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['package','ledger','out']:p.add_argument('--'+name,required=True,type=Path)
    a=p.parse_args();prepare(a.package,a.ledger,a.out)
