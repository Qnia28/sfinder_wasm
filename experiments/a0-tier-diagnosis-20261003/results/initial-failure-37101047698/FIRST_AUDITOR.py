"""Independent engine-tier audit; preserves raw traces and never reruns native calls."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import re
import statistics
import subprocess
import sys

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-tier-diagnosis-20261003')
RUN_ID=int(sys.argv[1]);DOWNLOAD=HERE/f'github-run-{RUN_ID}'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
read_rows=lambda p:[json.loads(l) for l in p.read_text(encoding='utf-8').splitlines()]
summary_files=list(DOWNLOAD.rglob('SUMMARY.json'));assert len(summary_files)==1
folder=summary_files[0].parent;s=load(summary_files[0]);lock=s['lock']
assert lock['commit']=='952f5aae897bfa924cabdddef529f0fd0430b84b'
assert sha(canon(lock))==s['lockSha256']
assert not s['clockReset'] and s['campaign']['originRunId']==37096100399
assert lock['maxCalls']==24 and lock['plainCalls']==18 and lock['traceCalls']==6
assert lock['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
verified=0
for f in load(folder/'FILES.json')['files']:
    b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];verified+=1
for f in lock['files']:assert sha(git('show',f"{lock['commit']}:{f['file']}"))==f['sha256']
assert git('diff','--name-only',lock['evidenceParent'],lock['commit'],'--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003','experiments/a0-order-diagnosis-20261003')==b''
entry=lock['input'];assert entry['id']=='board-028--restricted-split--ordinary'
with (REPO/'experiments/a0-diagnosis-20261003'/entry['pack']).open('rb') as f:f.seek(entry['offset']);b=f.read(entry['length'])
assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256']
index={k:i for i,k in enumerate(m['keys'])}
def quality(keys):
    chosen={index[k] for k in keys};q=sorted(max((v for id,v in row if id in chosen),default=0) for row in m['rows']);assert q[0]>0;return q
seed_q=quality(m['seedKeys'])
rows=read_rows(folder/'runs.jsonl') if (folder/'runs.jsonl').exists() else []
outcomes=read_rows(folder/'outcomes.jsonl') if (folder/'outcomes.jsonl').exists() else []
starts=read_rows(folder/'starts.jsonl') if (folder/'starts.jsonl').exists() else []
expected={r['runId']:r for r in lock['schedule']}
assert [r['runId'] for r in outcomes]==[r['runId'] for r in lock['schedule'][:len(outcomes)]]
assert len(outcomes)==s['attemptedCalls'] and len(rows)==s['verifiedCalls']
assert len({r['runId'] for r in rows})==len(rows)
verified_ids={r['runId'] for r in rows};assert verified_ids=={o['runId'] for o in outcomes if o['status']=='VERIFIED'}
raw_records=0;recalculations=0
for r in rows:
    for k,v in expected[r['runId']].items():assert r[k]==v
    raw=read_rows(folder/r['rawFile']);assert [a['type'] for a in raw]==['phase-start','phase-result','audit-result'];raw_records+=3
    assert raw[1]['raw']==r['probe'] and raw[1]['apiMs']==r['apiMs'] and raw[1]['options']==r['options']
    for key in ['profile','worker','threadCpu','engine']:assert raw[1][key]==r[key]
    assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
    assert 0<r['apiMs']<30000 and r['verificationMs']<30000
    assert r['engine']['mode']==r['engineMode'] and r['engine']['trace']==r['trace'] and r['engine']['execArgv']==r['engineFlags']
    assert r['worker']['pid']==r['engine']['pid'] and r['worker']['callCount']==1
    assert r['worker']['allowed']==r['worker']['cpu']==s['runtime']['workerCpu']
    er=next(e for e in r['startupEvents'] if e['type']=='engine-ready');assert er['execArgv']==r['engineFlags'] and er['pid']==r['worker']['pid']
    assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
    p=r['probe'];ids=sorted(index[k] for k in p['keys']);q=quality(p['keys']);recalculations+=2
    assert len(ids)==len(set(ids))==p['count']==m['K'] and q==p['qualityVector'] and q>=seed_q
    assert r['options']['seedKeys']==m['seedKeys'] and r['options']['stateBudget']==100000 and r['options']['integrated']
    assert bool(r['options'].get('partitioned'))==(r['label']=='A')
    assert r['seedKeysSha256']==entry['seedKeysSha256']==sha(canon(m['seedKeys'])) and r['primaryProofSha256']==sha(canon(m['primary']))
    assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
    assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
    if not p['completed']:
        c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p))
        assert len(c['calls'])==2 and all(a=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for a in c['calls'])
    res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
    if r['trace']:
        pr=r['profile'];assert pr['coreEntries']==1 and not pr['getterHooks'];assert abs(pr['preCoreWallMs']+pr['coreWallMs']+pr['postCoreWallMs']-r['apiMs'])<1e-6
    else:assert r['profile'] is None
determinism={v:len({sha(canon(r['probe'])) for r in rows if r['label']==v}) for v in ['R','A']};assert all(n<=1 for n in determinism.values())
assert len({r['worker']['pid'] for r in rows})==len(rows)
groups={}
for mode in ['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST']:
    for v in ['R','A']:
        rr=[r for r in rows if r['engineMode']==mode and r['label']==v and not r['trace']]
        oo=[o for o in outcomes if o['engineMode']==mode and o['label']==v and not o['trace']]
        groups[f'{mode}:{v}']={'completedUntracedCalls':len(rr),'attemptedCalls':len(oo),'outcomeStatuses':dict(collections.Counter(o['status'] for o in oo)),
            'apiSamplesMs':[r['apiMs'] for r in rr],'medianApiMs':statistics.median(r['apiMs'] for r in rr) if rr else None,
            'initSamplesMs':[r['initMs'] for r in rr],'medianInitMs':statistics.median(r['initMs'] for r in rr) if rr else None,
            'threadCpuSamplesMs':[(r['threadCpu']['user']+r['threadCpu']['system'])/1000 for r in rr]}
contrasts=[]
for mode in ['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST']:
    r=groups[f'{mode}:R']['medianApiMs'];a=groups[f'{mode}:A']['medianApiMs']
    if r and a:contrasts.append({'mode':mode,'candidateToBaselineRatio':a/r})
for v in ['R','A']:
    d=groups[f'DEFAULT:{v}']['medianApiMs'];l=groups[f'LIFTOFF_ONLY:{v}']['medianApiMs'];o=groups[f'OPTIMIZED_FIRST:{v}']['medianApiMs']
    if d and l and o:contrasts.append({'variant':v,'liftoffToDefault':l/d,'optimizedFirstToDefault':o/d,'liftoffToOptimizedFirst':l/o})
# Exact Node24.13.0 V8 source logs: module-pointer#function-index, compiler kind.
pattern=re.compile(r'Compiled function\s+(0x[0-9a-fA-F]+)#(\d+)\s+using\s+(Liftoff|TurboFan),\s+took\s+(\d+)\s+ms[^\n]*')
trace_reports=[]
export_by_name={e['symbol']:e['index'] for e in lock['wasmMap']['exports']}
for o in outcomes:
    if not o['trace']:continue
    log=folder/'logs'/f"{o['runId']}.jsonl";chunks=read_rows(log) if log.exists() else []
    streams={stream:''.join(c['text'] for c in chunks if c['stream']==stream) for stream in ['stdout','stderr']}
    text=streams['stdout']+'\n'+streams['stderr'];events=[]
    for match in pattern.finditer(text):
        pointer,idx,compiler,ms=match.groups();events.append({'modulePointer':pointer,'functionIndex':int(idx),'compiler':compiler,'compileMsRounded':int(ms),'line':match.group(0)})
    markers=[]
    for line in text.splitlines():
        if line.startswith('A0_MARKER '):markers.append(json.loads(line[len('A0_MARKER '):]))
    r=next((r for r in rows if r['runId']==o['runId']),None)
    export='solver_min_cover_at_count_integrated_partitioned_bounded' if o['label']=='A' else 'solver_min_cover_at_count_integrated_bounded'
    export_index=export_by_name[export]
    counts=dict(collections.Counter(e['compiler'] for e in events));export_events=[e for e in events if e['functionIndex']==export_index]
    trace_reports.append({'runId':o['runId'],'mode':o['engineMode'],'variant':o['label'],'outcome':o['status'],'compilerCounts':counts,
        'export':export,'exportIndex':export_index,'exportCompilerEvents':export_events,'markers':markers,
        'parsedCompilationEvents':len(events),'compileMsRoundedSum':sum(e['compileMsRounded'] for e in events),
        'timingsDiagnosticOnly':{k:r[k] for k in ['apiMs','initMs','profile']} if r else None,
        'traceConfirmsRequestedCompilerPolicy':bool(events) and (o['engineMode']=='DEFAULT' or (o['engineMode']=='LIFTOFF_ONLY' and counts.get('TurboFan',0)==0) or (o['engineMode']=='OPTIMIZED_FIRST' and counts.get('Liftoff',0)==0)),
        'events':events,'rawLogBytes':sum(len(c['text'].encode('utf-8')) for c in chunks),
        'limits':'Compiler generation is observed, not instruction-by-instruction execution tier; rounded compile durations are neither critical-path wall time nor DFS time. Worker marker/native trace producers may buffer differently.'})
complete=s['status']=='COMPLETE' and len(rows)==24 and len(outcomes)==24
report={'status':'COMPLETE_INDEPENDENTLY_AUDITED' if complete else 'PRESERVED_PARTIAL_OR_TIMEOUT','runId':RUN_ID,'sourceCommit':lock['commit'],
    'attemptedCalls':len(outcomes),'verifiedCalls':len(rows),'untracedCalls':sum(not r['trace'] for r in rows),'tracedCalls':sum(r['trace'] for r in rows),
    'outcomeCounts':dict(collections.Counter(o['status'] for o in outcomes)),'sourceBlobsVerified':len(lock['files']),'artifactFilesVerified':verified,
    'rawRecordsVerified':raw_records,'weightedQualityAndSeedRecalculations':recalculations,'determinismCounts':determinism,'runtime':s['runtime'],
    'groups':groups,'contrasts':contrasts,'traces':trace_reports,'stopReason':s['stopReason'],'notRun':s['notRun'],
    'campaign':s['campaign'],'clockReset':False,'productChanged':False,'performanceConfirmationCalls':0,'primaryPcThresholdCalls':0}
with (HERE/'ANALYSIS.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k!='traces'},indent=2))
print(json.dumps({'traceSummaries':[{k:v for k,v in t.items() if k!='events'} for t in trace_reports]},indent=2))
