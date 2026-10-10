"""Freeze P15 broad promotion: saved fixtures only; zero local solver calls."""
import argparse
import collections
import hashlib
import json
import sqlite3
import subprocess
import sys
import zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'postprocess'))
from ledger import projection,encode,digest
from package import verify
import importlib.util
spec=importlib.util.spec_from_file_location('probe_prepare',Path(__file__).with_name('prepare-probe.py'))
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)
sha=probe.sha;write=probe.write
SEED='p15-promotion-r14-v1'
def tie(fid):return hashlib.sha256((SEED+'|'+fid).encode()).hexdigest()

def prepare(parent_package,fixture_package,collection,archive,ledger,out):
    ps=verify(parent_package);ss=verify(fixture_package)
    assert str(ps['runId'])=='38028248052' and ps['evidenceValidity']=='PASS' and ps['executionCompleteness']=='COMPLETE'
    assert str(ss['runId'])=='37623263031'
    current=projection(ledger);assert not current['conflicts']
    prior=next(c for c in current['campaigns'] if c['campaignId']==ps['campaignId'])
    assert prior['budgetEvidenceComplete'] and not prior['unknownStarts']
    assert (prior['reservedCalls'],prior['cumulativeCpSyntheticCalls'],prior['cumulativeReservedRunnerHours'])==(13272,16,2718.8333333333335)
    pref,pz=probe.activation(parent_package,ps);sref,sz=probe.activation(fixture_package,ss)
    with pz,sz:
        pb=pz.read('LOCK.json');sb=sz.read('LOCK.json');parent=json.loads(pb);source=json.loads(sb)
        refs={r['id']:r for r in source['manifest']['inputs']}
        dbpath=collection/'per-save/per-save.sqlite'
        db=sqlite3.connect(dbpath.as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
        rows=[dict(r) for r in db.execute('SELECT f.*,c.family,c.pattern,c.mirror_group,s.workspace_path FROM fixtures f JOIN captures c USING(command_id) JOIN sources s ON s.source_id=f.fixture_source_id')]
        witnesses={}
        for fid,h in db.execute("SELECT fixture_id,witness_sha256 FROM calls WHERE status='EXACT' AND witness_sha256 IS NOT NULL"):
            assert witnesses.setdefault(fid,h)==h
        db.close()
        reasons={fid:['ORIGINAL_580_CENSUS'] for fid in refs}
        groups=collections.defaultdict(list)
        for r in rows:
            fid=r['fixture_id']
            if 14<=r['d']<=17:
                reasons.setdefault(fid,[]).append('PER_SAVE_CHANGED_CENSUS' if r['d'] in [15,16] else 'PER_SAVE_BOUNDARY_CENSUS')
            else:
                key=(r['family'],'trivial' if r['is_trivial'] else 'low' if r['d']<=8 else 'mid' if r['d']<=13 else 'high','tiny' if r['n']<=48 else 'large')
                groups[key].append(r)
        for key,group in sorted(groups.items()):
            for r in sorted(group,key=lambda r:tie(r['fixture_id']))[:2]:reasons.setdefault(r['fixture_id'],[]).append('STRUCTURAL_HASH_CONTROL:'+':'.join(key))
        assert len(reasons)==761
        out.mkdir(parents=True,exist_ok=False);(out/'fixtures').mkdir()
        with zipfile.ZipFile(archive) as az:
            for r in rows:
                fid=r['fixture_id']
                if fid not in reasons or fid in refs:continue
                path=Path(r['workspace_path']);data=path.read_bytes() if path.is_file() else az.read('objects/'+r['fixture_sha256'])
                assert hashlib.sha256(data).hexdigest()==r['fixture_sha256'];f=json.loads(data);assert f['id']==fid
                meta=dict(id=fid,fixture_sha256=r['fixture_sha256'],command_id=r['command_id'],dataset='PER_SAVE',family=r['family'],
                    pattern=r['pattern'],mirror_group=r['mirror_group'],n=r['n'],K=r['k'],R=r['r'],E=r['e'],F=r['forced'],
                    d=r['d'],u=r['u'],primary_hard=bool(r['primary_hard']),primary_backend=r['primary_backend'],
                    trivial=bool(r['is_trivial']),is_box=bool(r['is_box']),phases=['P15_PROMOTION'],analysis_tags=[])
                refs[fid]=dict(id=fid,sha256=r['fixture_sha256'],member='fixtures/'+r['fixture_sha256']+'.json',metadata=meta,
                    expectedWitness=dict(contract='INSERTION_SELECTED_QUALITY',sha256=witnesses[fid]) if fid in witnesses else None)
                (out/refs[fid]['member']).write_bytes(data)
        for ref in source['manifest']['inputs']:
            data=sz.read(ref['member']);assert hashlib.sha256(data).hexdigest()==ref['sha256'];(out/ref['member']).write_bytes(data)
        selected=[refs[fid] for fid in sorted(reasons)]
        catalog=dict(selectedRefs=selected,reasons=reasons,selectionSeed=SEED,sourcePerSaveDatabaseSha256=sha(dbpath),
            sourceAllDatabaseSha256=sha(collection/'minimals-all/ALL.sqlite'),sourceFixturePackageSha256=sha(fixture_package/'PACKAGE.json'),
            perSavePopulation=[{k:r[k] for k in ['fixture_id','fixture_sha256','d','n','primary_hard','family','is_trivial','has_measurements','workspace_path']} for r in rows],
            semantics='ALL548 census; per-save d14..17 census + existing32 + 2 hash-selected per family/band/tiny stratum; no timings used')
        write(out/'PROMOTION_CATALOG.json',catalog)
        m=json.loads(json.dumps(parent['manifest']))
        m.update(campaignId='TRIAGE_P15_PROMOTION_20261010_R14',revision=14,approval='USER_BROAD_P15_PROMOTION_TAIL_LOOP_CONFIRMATION_20261010',inputs=selected)
        selection=dict(id='p15-tails-loops-v1',fraction=.1,loopRatio=1.1,tails=['deltaMs','ratio'],populations=['ALL','PER_SAVE'],changedAlways=True,
            confirmationLoops=2,statusDiscordance=True,recursiveSelection=False)
        m['design']=dict(id='p15-promotion-v1',selection=selection,gates=dict(correctness_disagreements_allowed=0),
            adjudication='AUTHORED_NET_AVERAGE_BENEFIT_WITH_COUNTEREXAMPLES_NOT_PER_INPUT_VETO',
            initialPopulation=dict(ALL=548,PER_SAVE=213,changedALL=18,changedPerSave=79),
            repetitions=dict(initial=2,selectedConfirmation=2),freshValidation=False,
            audit='No new canary/calibration or intermediate dedicated audit; final independent evidence audit once; local package validation',
            cpRuntimeFailure='Retain engine failure and surviving-engine outcome; invalid witness/proof remains blocking')
        m['job'].update(parts=12,jobMs=325*60000,jobMinutes=350);m['budget']['job']=m['job']
        m['provenance'].update(parentLockArtifact=pref,ancestorLockArtifacts=[],priorCampaignId=parent['manifest']['campaignId'],
            priorReservedRunnerHours=prior['cumulativeReservedRunnerHours'],priorCpSyntheticCalls=16,measurementEpoch=14,
            approval=m['approval'],head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
            budgetAmendment='Broad P15 initial plus one predeclared confirmation union; original clock/caps; reserve all761 confirmation inputs')
        for k in ['startupRepairSha256']:m['largeRun'].pop(k,None)
        (out/'PARENT_LOCK.json').write_bytes(pb);(out/'FIXTURE_SOURCE_LOCK.json').write_bytes(sb)
        write(out/'PRIOR_ACCOUNTING.json',dict(**prior,ledgerHead=current['ledgerHead'],sourcePackageSha256=sha(parent_package/'PACKAGE.json')))
        tasks=[]
        for phase in ['P15_INITIAL','P15_CONFIRMATION']:
            for block in [1,2]:
                for ref in sorted(selected,key=lambda r:hashlib.sha256((SEED+'|'+phase+'|'+r['id']).encode()).hexdigest()):
                    arms=['H9_OPEN','P15_OPEN']
                    if int(tie(ref['id'])[:8],16)%2==block%2:arms.reverse()
                    changed=not ref['metadata']['primary_hard'] and ref['metadata']['d'] in [15,16]
                    tasks.append(dict(task_id=f'{phase}-{block}-{tie(ref["id"])[:24]}',phase=phase,fixture_ids=[ref['id']],conditional=phase=='P15_CONFIRMATION',
                        calls=2,block=block,arms=arms,role='CHANGED_STRATUM' if changed else 'UNCHANGED_CONTROL'))
        (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf8');m['tasksHash']=sha(out/'TASKS.jsonl')
        m['largeRun']=dict(id='p15-promotion-v1',calls=6088,initialCalls=3044,chunks=256,callMs=600000,priorCalls=13272,priorCpCalls=16,
            priorRunnerHours=prior['cumulativeReservedRunnerHours'],controlHours=8,originMs=parent['originMs'],endMs=parent['endMs'],
            budgetAuthorization=m['approval'],parentLockSha256=sha(out/'PARENT_LOCK.json'),fixtureSourceLockSha256=sha(out/'FIXTURE_SOURCE_LOCK.json'),
            accountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),catalogSha256=sha(out/'PROMOTION_CATALOG.json'))
        for name in ['promotion.mjs','prepare-promotion.py']:m['sourceFiles']['harness']['tools/secondary-bench/common/triage/'+name]=''
        m['sourceFiles']['harness']['tests/triage-p15-promotion.test.mjs']=''
        for group in ['product','harness']:
            for name in m['sourceFiles'][group]:
                data=subprocess.check_output(['git','show','HEAD:'+name])
                if group=='product' and b'\0' not in data:data=data.replace(b'\r\n',b'\n')
                m['sourceFiles'][group][name]=hashlib.sha256(data).hexdigest()
        assert m['sourceFiles']['product']==parent['manifest']['sourceFiles']['product']
        write(out/'MANIFEST.json',m)
        with zipfile.ZipFile(out/'TRIAGE_P15_PROMOTION_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
            for p in sorted(out.rglob('*')):
                if p.is_file() and p.suffix!='.zip':z.write(p,p.relative_to(out).as_posix())
        write(out/'START.json',dict(state='APPROVED_FROZEN',confirm='RUN_TRIAGE_PROBE_SEED_16VM',assetId=None,
            bundleSha256=sha(out/'TRIAGE_P15_PROMOTION_INPUTS.zip'),manifestHash=digest(m)))
        print(encode(dict(inputs=len(selected),initialCalls=3044,maxPopulationCalls=6088,maxTotalCalls=19377,
            maxCumulativeRunnerHours=prior['cumulativeReservedRunnerHours']+256*350/60+8,solverCalls=0)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['parent-package','fixture-package','collection','archive','ledger','out']:p.add_argument('--'+name,type=Path,required=True)
    a=p.parse_args();prepare(a.parent_package,a.fixture_package,a.collection,a.archive,a.ledger,a.out)
