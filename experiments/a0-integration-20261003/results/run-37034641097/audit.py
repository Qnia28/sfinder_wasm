"""Independent offline A0 route audit. No solver, PC, or primary invocation."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import statistics
import math

p=argparse.ArgumentParser()
p.add_argument('download');p.add_argument('--repository',required=True);p.add_argument('--source-experiment',required=True);p.add_argument('--output',required=True)
args=p.parse_args();download=Path(args.download);repo=Path(args.repository);output=Path(args.output)
experiment=repo/'experiments/a0-integration-20261003'
def load(f):return json.loads(Path(f).read_text(encoding='utf-8-sig'))
def canonical(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def expanded(v):
    assert all(isinstance(q,int) and q>0 and isinstance(n,int) and n>0 for q,n in v)
    assert all(v[i-1][0]<v[i][0] for i in range(1,len(v)))
    return [q for q,n in v for _ in range(n)]
build=load(download/'a0-build-tests/BUILD.json');inputs=load(experiment/'INPUTS.json');schedule=load(experiment/'SCHEDULE.json')['runs']
assert build['baselineCommit']=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
assert build['changedProductSources']==['src/min-cover-exact-secondary.mjs']
assert build['nativeAlgorithmsChanged'] is False
assert build['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
assert sha((download/'a0-build-tests/pc_wasm.wasm').read_bytes())==build['wasmSha256']
assert sha((download/'a0-build-tests/original-product.wasm').read_bytes())==build['originalProductWasmSha256']
source_checked=0
for f in build['sourceFiles']+build['harnessSources']:
    b=subprocess.check_output(['git','-C',str(repo),'show',f"{build['candidateCommit']}:{f['file']}"])
    assert sha(b)==f['sha256'],f['file'];source_checked+=1
    if f in build['sourceFiles'] and f['file']!='src/min-cover-exact-secondary.mjs':assert f['sha256']==f['baselineSha256']
assert build['inputsSha256']==sha(canonical(inputs))
assert build['scheduleSha256']==sha(canonical({'runs':schedule}))
for pack in inputs['packs']:
    b=(experiment/pack['file']).read_bytes();assert len(b)==pack['bytes'] and sha(b)==pack['sha256']
parity=load(download/'a0-build-tests/PARITY.json');assert parity['status']=='PASS' and parity['calls']==27
entries={e['id']:e for e in inputs['entries']}
source=Path(args.source_experiment);old=load(source/'INPUTS.json');old_entries={e['id']:e for e in old['entries']}
assert inputs['sourceIndexSha256']==sha(canonical(old))
for e in entries.values():
    original=old_entries[e['id']]
    assert {k:v for k,v in e.items() if k not in ['pack','offset','sourcePack','sourceOffset']}=={k:v for k,v in original.items() if k not in ['pack','offset']}
    assert e['sourcePack']==original['pack'] and e['sourceOffset']==original['offset']
    with (source/original['pack']).open('rb') as f:f.seek(original['offset']);b=f.read(original['length'])
    assert sha(b)==e['sha256']
eligible=[e for e in old['entries'] if e['partition']=='development' and e['route']=='INTEGRATED_100K_PROBE_ELIGIBLE']
selected={e['id'] for e in sorted(eligible,key=lambda e:(-e['E'],e['id']))[:4]}
for e in sorted(eligible,key=lambda e:sha(f"a0-integration-20261003\0smoke\0{e['id']}".encode())):
    if len(selected)==16:break
    selected.add(e['id'])
assert selected=={e['id'] for e in entries.values() if e['partition']=='development'}
report={'status':'EVIDENCE_AUDITED_PRODUCT_CONNECTION_HOLD','nativeSourcesAndHarnessGitBlobsVerified':source_checked,'rebuildHashMatchesPriorVerifiedImplementation':True,'smallProductRebuildParityCalls':27,'phases':{},'actualInputPrimaryCalls':0,'actualInputPcCalls':0,'devApplied':False}
report.update(bytePreservedInputSegmentsVerified=len(entries),sourceAliasesAndMetadataPreserved=True,smokeSelectionIndependentlyVerified=True,reservedMatricesDecodedByAudit=0)
all_results=[];matrix_cache={};quality_checks=0;sealed_files=0;event_phase_starts=0;event_phase_completions=0;timeout_reaps=[]
for phase,shard_count in [('smoke',8),('reserved',16)]:
    expected={r['runId']:r for r in schedule if r['phase']==phase};results=[]
    dirs=sorted(d for d in download.glob(f'a0-{phase}-*') if (d/'SHARD.json').exists())
    if not dirs:
        report['phases'][phase]={'status':'NOT_RUN','expectedRuns':len(expected),'observedRuns':0};continue
    assert len(dirs)==shard_count
    shard_ids=set()
    for folder in dirs:
        for f in load(folder/'FILES.json')['files']:
            b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];sealed_files+=1
        s=load(folder/'SHARD.json');assert s['phase']==phase and s['shard'] not in shard_ids;shard_ids.add(s['shard'])
        assert s['build']==build and s['scheduleSha256']==sha(canonical(s['scheduledRuns']))
        assert s['actualInputPrimaryCalls']==s['actualInputPcCalls']==0
        r=[json.loads(l) for l in (folder/'runs.jsonl').read_text().splitlines() if l.strip()]
        assert len(r)==s['observedRuns'];results+=r
    assert len({r['runId'] for r in results})==len(results)
    statuses=collections.Counter();by_matrix=collections.defaultdict(list)
    for r in results:
        assert r['runId'] in expected
        for key in ['phase','shard','matrixId','variant','repetition','position']:assert r[key]==expected[r['runId']][key]
        assert r['buildSha256']==sha(canonical(build))
        e=entries[r['matrixId']];assert r['inputSha256']==e['sha256'] and r['identitySha256']==e['identitySha256']
        assert (e['partition']=='reserved-validation')==(phase=='reserved')
        if r['matrixId'] not in matrix_cache:
            matrix_cache.clear()
            with (experiment/e['pack']).open('rb') as stream:stream.seek(e['offset']);b=stream.read(e['length'])
            assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b))
            assert sha(canonical({k:m[k] for k in ['keys','rows','K','seedKeys']}))==e['identitySha256']
            assert m['primary']['cardinalityProven'];matrix_cache[r['matrixId']]=m
        m=matrix_cache[r['matrixId']];statuses[r['status']]+=1;by_matrix[r['matrixId']].append(r)
        active=None;active_start=None
        for event in r['events']:
            if event.get('type')=='phase-start':
                assert active is None and event['engine'] in ['integrated','threshold']
                active=event['engine'];active_start=event['elapsedMs'];event_phase_starts+=1
            elif event.get('type')=='phase-done':
                assert active==event['engine'];active=None;event_phase_completions+=1
            elif event.get('reason')=='TIMEOUT_API':
                assert active==event['engine']
                expected_limit=10000 if active=='integrated' else 30000
                assert abs(event['elapsedMs']-active_start-expected_limit)<100
                assert r['processWallMs']-event['elapsedMs']<2000
                timeout_reaps.append(r['processWallMs']-event['elapsedMs'])
        if r['status'] in ['EXACT','INCONCLUSIVE']:
            trace=r['trace'];assert 1<=len(trace)<=2 and trace[0]['engine']=='integrated'
            assert trace[0]['stateBudget']==100000 and trace[0]['partitioned']==(r['variant']=='A')
            assert trace[0]['inputSeedKeys']==m['seedKeys']
            assert r['actualInputPrimaryCalls']==r['actualInputPcCalls']==0
            index={k:i for i,k in enumerate(m['keys'])}
            def vector(ids):
                global quality_checks
                chosen=set(ids);q=sorted(max((q for id,q in row if id in chosen),default=0) for row in m['rows'])
                assert q and q[0]>0;quality_checks+=1;return q
            for t in trace:
                ids=t['selectedIDs'];assert ids==sorted(set(ids)) and len(ids)==m['K'] and all(0<=i<len(m['keys']) for i in ids)
                q=vector(ids);assert q==expanded(t['qualityRLE']) and sha(canonical(q))==t['qualitySha256']
                assert t['seedSha256']==sha(canonical(t['inputSeedKeys']))
                seed_ids=[index[k] for k in t['inputSeedKeys']];assert q>=vector(seed_ids)
                assert 1<=t['states']<=t['stateBudget']
            if len(trace)==2:
                assert not trace[0]['completed'] and trace[1]['engine']=='threshold' and not trace[1]['partitioned'] and trace[1]['stateBudget']==2000000
                assert sorted(index[k] for k in trace[1]['inputSeedKeys'])==trace[0]['selectedIDs']
            if r['status']=='EXACT':
                final=r['finalWitness'];assert final['selectedIDs']==trace[-1]['selectedIDs'] and final['qualityRLE']==trace[-1]['qualityRLE'] and final['qualitySha256']==trace[-1]['qualitySha256'] and trace[-1]['completed']
                assert r['finalStates']==sum(t['states'] for t in trace)
                assert r['decision']==('integrated-exact' if len(trace)==1 else 'integrated-budget-to-threshold')
            else:assert r['finalWitness'] is None and trace[-1]['engine']=='threshold' and not trace[-1]['completed']
            assert abs(r['routeGrossMs']-r['witnessVerifyMs']-r['routeWallMs'])<.001
        elif r['status'].startswith('TIMEOUT'):
            assert r['signal']=='SIGKILL' and r.get('finalWitness') is None
            assert r['status']=='TIMEOUT_API' and active=='threshold'
        else:raise AssertionError(f"Unaccepted status: {r['status']}")
    ratios=[];r_sum=a_sum=0;paired=0;probe_exact={'R':0,'A':0};quality_regressions=[];state_regressions=[]
    for id,values in by_matrix.items():
        exact=[r for r in values if r['status']=='EXACT']
        assert len({(tuple(r['finalWitness']['selectedIDs']),tuple(map(tuple,r['finalWitness']['qualityRLE']))) for r in exact})<=1
        for variant in ['R','A']:
            normal=[r for r in values if r['variant']==variant and r['status'] in ['EXACT','INCONCLUSIVE']]
            fingerprints=[]
            for r in normal:
                fingerprint={'status':r['status'],'finalWitness':r['finalWitness'],'finalStates':r['finalStates'],'trace':[{k:v for k,v in t.items() if k!='apiMs'} for t in r['trace']]}
                fingerprints.append(sha(canonical(fingerprint)))
            assert len(set(fingerprints))<=1,'Nondeterministic route'
            if len(normal)==4 and all(r['trace'][0]['completed'] for r in normal):probe_exact[variant]+=1
        for rep in range(1,5):
            rr=next((r for r in values if r['variant']=='R' and r['repetition']==rep),None);aa=next((r for r in values if r['variant']=='A' and r['repetition']==rep),None)
            if rr and aa and rr.get('trace') and aa.get('trace'):
                if aa['trace'][0]['states']>rr['trace'][0]['states']:state_regressions.append(id)
                if expanded(aa['trace'][0]['qualityRLE'])<expanded(rr['trace'][0]['qualityRLE']):quality_regressions.append(id)
        rr=[r for r in values if r['variant']=='R'];aa=[r for r in values if r['variant']=='A']
        if len(rr)==len(aa)==4 and all(r['status']=='EXACT' for r in rr+aa):
            rt=statistics.median(r['routeWallMs'] for r in rr);at=statistics.median(r['routeWallMs'] for r in aa)
            paired+=1;r_sum+=rt;a_sum+=at;ratios.append(at/rt)
    assert not quality_regressions and not state_regressions
    aggregate=load(download/f'a0-{phase}-summary/SUMMARY.json');assert aggregate['observedRuns']==len(results) and aggregate['probeExactMatrices']==probe_exact
    phase_report={'status':'AUDITED_COMPLETE' if len(results)==len(expected) else 'AUDITED_PARTIAL','expectedRuns':len(expected),'observedRuns':len(results),'statuses':dict(statuses),
                  'probeExactMatrices':probe_exact,'pairedFinalExactMatrices':paired,'pairedConfirmedRouteRatio':a_sum/r_sum if paired else None,
                  'pairedConfirmedP95Ratio':sorted(ratios)[math.ceil(.95*len(ratios))-1] if ratios else None,
                  'censoringPreserved':any(k!='EXACT' for k in statuses),'qualityRegressions':0,'stateRegressions':0,
                  'qualityAndStateAuditCoverage':'Only persisted completed-call traces; no claim about killed-call incumbents',
                  'uniqueMatrixCount':len(by_matrix),'productApplied':False,
                  'perMatrix':[{'matrixId':id,'statuses':dict(collections.Counter(r['status'] for r in values)),
                               'statusMatchesAllRepetitions':len({r['status'] for r in values})==1} for id,values in by_matrix.items()]}
    report['phases'][phase]=phase_report;all_results+=results
report['sealedFilesVerified']=sealed_files;report['originalWeightedQualityRecomputations']=quality_checks
report['observedRouteTuples']=len(all_results);report['persistedCompletedSolverCallTraces']=sum(len(r.get('trace',[])) for r in all_results)
report['phaseStartEvents']=event_phase_starts;report['phaseDoneEvents']=event_phase_completions
report['timeoutProcessesReaped']=len(timeout_reaps);report['maxTimeoutKillToCloseMs']=max(timeout_reaps,default=0)
report['partialTraceLimitation']='Threshold-killed processes retained phase events/status but not already-completed integrated witness traces; no retrospective reconstruction or rerun substitution'
report['finalProductApproval']='HOLD_SMOKE_GATE_FAILED_RESERVED_NOT_RUN'
if (download/'a0-dispatch-audit/DISPATCH.json').exists():
    d=load(download/'a0-dispatch-audit/DISPATCH.json');assert d['status']=='PASS' and d['reservedTinyMatrices']==115 and all(r['a0Calls']==r['nativeSolverCalls']==0 for r in d['ledger']);report['reservedTinyDispatchAudit']='PASS'
output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
