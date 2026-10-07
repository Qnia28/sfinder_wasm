"""Freeze r8 original inputs and fixed 10-minute comparisons; solver calls=0."""
import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'postprocess'))
from ledger import projection, encode, digest

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,v): p.write_text(encode(v)+'\n',encoding='utf-8')
def activation(package):
    a=next(x for x in read(package/'SUMMARY.json')['artifactIndex'] if x['collectionRole']=='activation')
    file=package/a['object'];assert 'sha256:'+sha(file)==a['digest']
    return a,zipfile.ZipFile(file)

def main():
    p=argparse.ArgumentParser()
    for n in ['r6','r7','ledger','out']:p.add_argument('--'+n,type=Path,required=True)
    a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    current=projection(a.ledger);assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']=='TRIAGE_PROBE_SEED_AB_20261006_R1')
    assert prior['reservedCalls']==8407 and prior['cumulativeCpSyntheticCalls']==9 and prior['cumulativeReservedRunnerHours']==1363.5
    source_ref,z6=activation(a.r6);parent_ref,z7=activation(a.r7)
    with z6,z7:
        source_bytes=z6.read('LOCK.json');source=json.loads(source_bytes)
        parent_bytes=z7.read('LOCK.json');parent=json.loads(parent_bytes)
        m=json.loads(json.dumps(source['manifest']))
        for k in ['continuation','prerequisiteReuse','activationRecovery','startupContinuation','followup']:m.pop(k,None)
        arms={
            'A_120':dict(policy='A',trace=True,secondary='auto',cpLimitMs=120000),
            'H9_120':dict(policy='A_H9',trace=True,secondary='auto',cpLimitMs=120000),
            'H9_OPEN':dict(policy='A_H9',trace=True,secondary='auto',cpLimitMs=None),
            'CP_OPEN':dict(policy='baseline',trace=True,secondary='cpsat',cpLimitMs=None)}
        m.update(campaignId='TRIAGE_H9_CP10M_20261007_R8',revision=8,
            approval='USER_BROAD_TEST_10MIN_20261007',baselineFiles=[],maxCalls=20000,maxRunnerHours=5000)
        m['profileContract'].update(cpLimitMs=None,arms=arms,callTimeoutMs=600000)
        m['job'].update(jobMs=325*60000,jobMinutes=350)
        m['budget'].update(maxCalls=m['maxCalls'],job=m['job'])
        m['measurement']['variants']=list(arms)
        m['design']=dict(id='h9-cp-10m-v1',calls=4640,inputs=580,repeats=2,
            primaryPopulation='ALL451_NONTRIVIAL',supportingPopulations=['PER_SAVE32','TRIVIAL97'],
            contrasts=['H9_120-A_120','H9_OPEN-H9_120','H9_OPEN-A_120'],
            diagnostic='CP_OPEN is standalone, not a subtractable policy component',
            gates=dict(correctness_disagreements_allowed=0),
            noAdaptiveRetest=True,noTimingSubtraction=True,trace=True,freshValidation=False)
        m['provenance'].update(priorReservedRunnerHours=1363.5,priorCpSyntheticCalls=9,measurementEpoch=8,
            parentLockArtifact=parent_ref,ancestorLockArtifacts=[],approval=m['approval'],
            exposures=['ORIGINAL_ENGINE_DATA','R6_POLICY','R7_FAST'],priorEvidencePooled=False,
            priorCampaignId=parent['manifest']['campaignId'],budgetAmendment='Explicit user-approved broad 10-minute study; original clock and accounting retained',
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip())
        (a.out/'PARENT_LOCK.json').write_bytes(parent_bytes)
        (a.out/'FIXTURE_SOURCE_LOCK.json').write_bytes(source_bytes)
        write(a.out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead']))
        m['largeRun']=dict(id='h9-cp-10m-v1',calls=4640,chunks=194,callMs=600000,priorCalls=8407,
            priorCpCalls=9,priorRunnerHours=1363.5,controlHours=6,originMs=parent['originMs'],endMs=parent['endMs'],
            budgetAuthorization=m['approval'],parentLockSha256=sha(a.out/'PARENT_LOCK.json'),
            fixtureSourceLockSha256=sha(a.out/'FIXTURE_SOURCE_LOCK.json'),accountingSha256=sha(a.out/'PRIOR_ACCOUNTING.json'))
        # Hash order independent of observed timing. Four cyclic orders, reversed repeat.
        refs=sorted(m['inputs'],key=lambda f:hashlib.sha256(('r8-fixed-order-v1/'+f['id']).encode()).hexdigest())
        tasks=[];names=list(arms)
        for i,f in enumerate(refs):
            order=names[i%4:]+names[:i%4];meta=f['metadata']
            role='TRIVIAL_CONTRACT' if meta['trivial'] else 'PER_SAVE_SUPPORT' if meta['dataset']=='PER_SAVE' else 'ALL_PRIMARY'
            tasks.append(dict(task_id=f'r8/{i:04d}',phase='H9_CP_10M',fixture_ids=[f['id']],conditional=False,
                calls=8,arms=order+list(reversed(order)),role=role))
        (a.out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf-8')
        m['tasksHash']=sha(a.out/'TASKS.jsonl')
        extra=['tools/secondary-bench/common/triage/large-run.mjs','tools/secondary-bench/common/triage/prepare-large.py',
            'tools/secondary-bench/common/triage/fast-followup.mjs',
            'tools/secondary-bench/postprocess/package.py','tools/secondary-bench/postprocess/ledger.py',
            'tests/triage-large-run.test.mjs']
        for group in ['product','harness']:
            names=set(m['sourceFiles'][group])
            if group=='harness':names.update(extra)
            m['sourceFiles'][group]={}
            for name in sorted(names):
                if name.endswith('.md'):continue
                data=Path(name).read_bytes()
                if b'\0' not in data:data=data.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(data).hexdigest()
        write(a.out/'MANIFEST.json',m)
        with zipfile.ZipFile(a.out/'TRIAGE_LARGE_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
            for name in ['MANIFEST.json','TASKS.jsonl','PARENT_LOCK.json','FIXTURE_SOURCE_LOCK.json','PRIOR_ACCOUNTING.json']:z.write(a.out/name,name)
            for f in m['inputs']:
                data=z6.read(f['member']);assert hashlib.sha256(data).hexdigest()==f['sha256'];z.writestr(f['member'],data)
        write(a.out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
            bundleSha256=sha(a.out/'TRIAGE_LARGE_INPUTS.zip'),manifestHash=digest(m)))
        print(encode(dict(inputs=580,calls=4640,chunks=194,callMs=600000,solverCalls=0)))

if __name__=='__main__':main()
