"""Freeze approved P15 comparison using original r8 fixtures and r12 accounting."""
import argparse
import csv
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
def activation(package,summary):
    ref=next(a for a in summary['artifactIndex'] if a['collectionRole']=='activation')
    with zipfile.ZipFile(package/'EVIDENCE.zip') as z:data=z.read(ref['object'])
    assert hashlib.sha256(data).hexdigest()==ref['digest'][7:]
    return ref,zipfile.ZipFile(io.BytesIO(data))

def prepare(parent_package,fixture_package,design,ledger,out):
    ps=verify(parent_package);ss=verify(fixture_package)
    assert str(ps['runId'])=='37958947216' and str(ss['runId'])=='37623263031'
    assert all(s['collectionState']=='COMPLETE' and s['rawDatabaseParity']=='PASS' and not s['errors'] for s in [ps,ss])
    current=projection(ledger);assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']==ps['campaignId'])
    assert prior['budgetEvidenceComplete'] and not prior['unknownStarts']
    assert prior['reservedCalls']==13072 and prior['cumulativeCpSyntheticCalls']==14 and prior['cumulativeReservedRunnerHours']==2607.8333333333335
    for f in json.loads((design/'INDEX.json').read_text(encoding='utf8'))['files']:
        p=design/f['path'];assert sha(p)==f['sha256'] and p.stat().st_size==f['bytes']
    with (design/'TARGETS.csv').open(encoding='utf8',newline='') as f:targets=[t for t in csv.DictReader(f) if t['experiment']=='PROBE_P15']
    scheduled=[t for t in json.loads((design/'PROPOSED_TASKS.json').read_text(encoding='utf8')) if t['experiment']=='PROBE_P15']
    assert len(targets)==25 and len(scheduled)==50
    pref,pz=activation(parent_package,ps);sref,sz=activation(fixture_package,ss)
    out.mkdir(parents=True,exist_ok=False)
    with pz,sz:
        pb=pz.read('LOCK.json');sb=sz.read('LOCK.json');parent=json.loads(pb);source=json.loads(sb)
        m=json.loads(json.dumps(source['manifest']))
        for k in ['continuation','prerequisiteReuse','activationRecovery','startupContinuation','followup']:m.pop(k,None)
        refs={f['id']:f for f in m['inputs']}
        m['inputs']=[refs[t['fixture_id']] for t in targets]
        assert all(f['sha256']==t['fixture_sha256'] for f,t in zip(m['inputs'],targets))
        m.update(campaignId='TRIAGE_PROBE_P15_20261010_R13',revision=13,maxParallel=16,approval='USER_IMPLEMENT_COMPARE_P15_20261010',baselineFiles=[])
        arms={'H9_OPEN':dict(policy='A_H9',trace=True,secondary='auto',cpLimitMs=None),
              'P15_OPEN':dict(policy='P15',trace=True,secondary='auto',cpLimitMs=None)}
        m['profileContract'].update(arms=arms,cpLimitMs=None,callTimeoutMs=600000)
        m['job'].update(parts=3,jobMs=125*60000,jobMinutes=350)
        m['budget'].update(maxParallel=16,job=m['job']);m['measurement']['variants']=list(arms)
        authored=json.loads((design/'DESIGN.json').read_text(encoding='utf8'))
        m['design']=dict(id='probe-p15-v1',calls=100,inputs=25,repeats=2,changedInputs=18,controls=7,
            noAdaptiveRetest=True,freshValidation=False,trace=True,gates=dict(correctness_disagreements_allowed=0),
            screens=authored['analysis'],sourceDesignSha256=sha(design/'DESIGN.json'))
        m['provenance'].update(parentLockArtifact=pref,ancestorLockArtifacts=[],priorCampaignId=parent['manifest']['campaignId'],
            priorReservedRunnerHours=prior['cumulativeReservedRunnerHours'],priorCpSyntheticCalls=14,measurementEpoch=13,
            approval=m['approval'],exposures=['ORIGINAL_ENGINE_DATA','R6_POLICY','R8_H9','STEP5_DESIGN'],priorEvidencePooled=False,
            head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            budgetAmendment='Approved P15 only; original clock/caps retained; 100 calls plus one compact CP synthetic')
        (out/'PARENT_LOCK.json').write_bytes(pb);(out/'FIXTURE_SOURCE_LOCK.json').write_bytes(sb)
        write(out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead'],sourcePackageSha256=sha(parent_package/'PACKAGE.json')))
        write(out/'P15_DESIGN.json',dict(targets=targets,authoredDesign=authored,sourceIndexSha256=sha(design/'INDEX.json')))
        target_index={t['fixture_id']:t for t in targets};arm_map={'CONTROL':'H9_OPEN','CANDIDATE':'P15_OPEN'}
        tasks=[dict(task_id=t['proposed_task_id'],phase='PROBE_P15_R13',fixture_ids=[t['fixture_id']],conditional=False,calls=2,
                    block=t['block'],arms=[arm_map[a] for a in t['arms']],role=target_index[t['fixture_id']]['selection_reason']) for t in scheduled]
        write(out/'P15_SCHEDULE.json',tasks)
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf8');m['tasksHash']=sha(out/'TASKS.jsonl')
        m['largeRun']=dict(id='probe-p15-v1',calls=100,chunks=18,callMs=600000,priorCalls=13072,priorCpCalls=14,
            priorRunnerHours=prior['cumulativeReservedRunnerHours'],controlHours=6,originMs=parent['originMs'],endMs=parent['endMs'],
            budgetAuthorization=m['approval'],parentLockSha256=sha(out/'PARENT_LOCK.json'),fixtureSourceLockSha256=sha(out/'FIXTURE_SOURCE_LOCK.json'),
            accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),designSha256=sha(out/'P15_DESIGN.json'),scheduleSha256=sha(out/'P15_SCHEDULE.json'))
        m['sourceFiles']=json.loads(json.dumps(parent['manifest']['sourceFiles']))
        for name in ['tools/secondary-bench/common/triage/probe-followup.mjs','tools/secondary-bench/common/triage/prepare-probe.py','tests/triage-probe-p15.test.mjs']:
            m['sourceFiles']['harness'][name]=''
        for group in ['product','harness']:
            for name in m['sourceFiles'][group]:
                data=Path(name).read_bytes()
                if b'\0' not in data:data=data.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(data).hexdigest()
        before=parent['manifest']['sourceFiles']['product'];after=m['sourceFiles']['product']
        assert [k for k in after if after[k]!=before[k]]==['src/min-cover-triage-experiment.mjs']
        write(out/'MANIFEST.json',m)
        with zipfile.ZipFile(out/'TRIAGE_P15_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
            for p in sorted(out.iterdir()):
                if p.suffix!='.zip':z.write(p,p.name)
            for ref in m['inputs']:
                data=sz.read(ref['member']);assert hashlib.sha256(data).hexdigest()==ref['sha256']
                z.writestr(ref['member'],data)
                dest=out/ref['member'];dest.parent.mkdir(exist_ok=True);dest.write_bytes(data)
    write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
        bundleSha256=sha(out/'TRIAGE_P15_INPUTS.zip'),manifestHash=digest(m)))
    print(encode(dict(inputs=25,calls=100,chunks=18,solverCalls=0,totalCalls=13187,totalReservedRunnerHours=2718.8333333333335)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['parent-package','fixture-package','design','ledger','out']:p.add_argument('--'+n,required=True,type=Path)
    a=p.parse_args();prepare(a.parent_package,a.fixture_package,a.design,a.ledger,a.out)
