"""Independent read-only native-result auditor and single-input order analysis."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import math
import statistics
import subprocess
import sys

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-order-diagnosis-20261003')
RUN_ID=sys.argv[1]
DOWNLOAD=HERE/f'github-run-{RUN_ID}'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canonical=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
git=lambda *a:subprocess.check_output(['git','-C',str(REPO),*a])
summaries=list(DOWNLOAD.rglob('SUMMARY.json'));assert len(summaries)==1
folder=summaries[0].parent;s=load(summaries[0]);lock=s['lock']
assert sha(canonical(lock))==s['lockSha256']
assert lock['commit']=='50fcc0b0ff8beb33ae18abe96f221ae93dfbdcd8'
assert lock['wasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
assert lock['baseNativeCalls']==24 and lock['maximumNativeCalls']==28
verified=0
for f in load(folder/'FILES.json')['files']:
    b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];verified+=1
source_blobs=0
for f in lock['files']:
    assert sha(git('show',f"{lock['commit']}:{f['file']}"))==f['sha256'];source_blobs+=1
assert git('diff','--name-only','edc4f2547207a509176a3e79dabf8a4995112220',lock['commit'],'--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003')==b''
entry=lock['input'];assert entry['id']=='board-028--restricted-split--ordinary'
with (REPO/'experiments/a0-diagnosis-20261003'/entry['pack']).open('rb') as f:
    f.seek(entry['offset']);b=f.read(entry['length'])
assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b))
assert m['primary']['cardinalityProven']
assert sha(canonical({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256']
assert sha(canonical(m['seedKeys']))==entry['seedKeysSha256']
index={k:i for i,k in enumerate(m['keys'])}
def quality(keys):
    chosen={index[k] for k in keys}
    q=sorted(max((v for id,v in row if id in chosen),default=0) for row in m['rows'])
    assert q[0]>0;return q
seed_q=quality(m['seedKeys'])
read_rows=lambda f:[json.loads(l) for l in f.read_text(encoding='utf-8').splitlines()]
rows=read_rows(folder/'runs.jsonl') if (folder/'runs.jsonl').exists() else []
starts=read_rows(folder/'starts.jsonl') if (folder/'starts.jsonl').exists() else []
base=[r for r in rows if r['stage']=='order-diagnosis'];profile=[r for r in rows if r['stage']=='order-profile']
assert len(base)==s['observedBaseRuns'] and len(profile)==s['observedProfileRuns']
assert len({r['runId'] for r in rows})==len(rows)
expected_base=[r for session in lock['schedule'] for r in session['runs']]
expected_profile=[r for session in lock['profileSchedule'] for r in session['runs']]
expected={r['runId']:r for r in expected_base+expected_profile}
assert [r['runId'] for r in base]==[r['runId'] for r in expected_base[:len(base)]]
assert [r['runId'] for r in profile]==[r['runId'] for r in expected_profile[:len(profile)]]
assert [r['runId'] for r in starts]==[r['runId'] for r in (expected_base+expected_profile)[:len(starts)]]
quality_checks=0;raw_records=0
for r in rows:
    for k,v in expected[r['runId']].items():assert r[k]==v
    assert r['matrixId']==entry['id'] and r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
    raw=read_rows(folder/r['rawFile']);assert [p['type'] for p in raw]==['phase-start','phase-result','audit-result'];raw_records+=len(raw)
    assert raw[1]['raw']==r['probe'] and raw[1]['options']==r['options'] and raw[1]['apiMs']==r['apiMs']
    assert raw[1]['profile']==r['profile'] and raw[1]['worker']==r['worker'] and raw[1]['threadCpu']==r['threadCpu']
    assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
    assert 0<r['apiMs']<10000 and r['verificationMs']<30000
    assert r['worker']['callCount']==1 and r['worker']['cpu']==r['worker']['allowed']==s['runtime']['workerCpu']
    assert r['options']['stateBudget']==100000 and r['options']['integrated'] and bool(r['options'].get('partitioned'))==(r['label']=='A')
    assert r['options']['seedKeys']==m['seedKeys']
    assert r['seedKeysSha256']==sha(canonical(m['seedKeys'])) and r['primaryProofSha256']==sha(canonical(m['primary']))
    p=r['probe'];ids=sorted(index[k] for k in p['keys']);assert len(ids)==len(set(ids))==p['count']==m['K']
    q=quality(p['keys']);quality_checks+=2;assert q==p['qualityVector'] and q>=seed_q
    assert r['witness']=={'selectedIDs':ids,'qualitySha256':sha(canonical(q)),'seedSha256':sha(canonical(m['seedKeys'])),'originalRowCount':len(q)}
    assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
    if not p['completed']:
        c=r['contract'];assert c['status']=='CONTRACT_ONLY_STOP' and c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canonical(p))
        assert len(c['calls'])==2 and all(a=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for a in c['calls'])
    res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
    if r['profile']:
        pr=r['profile'];assert pr['coreEntries']==1 and not pr['getterHooks']
        assert abs(pr['preCoreWallMs']+pr['coreWallMs']+pr['postCoreWallMs']-r['apiMs'])<1e-6
sessions=collections.defaultdict(list)
for r in rows:sessions[r['sessionId']].append(r)
pids=[]
for id,rr in sessions.items():
    assert len({r['worker']['pid'] for r in rr})==1
    assert len({r['worker']['osTid'] for r in rr})==len(rr)
    pids.append(rr[0]['worker']['pid'])
assert len(pids)==len(set(pids))
determinism={v:len({sha(canonical(r['probe'])) for r in rows if r['label']==v}) for v in ['R','A']}
assert all(n<=1 for n in determinism.values())
for block in range(1,5):
    rr=[r for r in base if r['block']==block and r['label']=='R'];aa=[r for r in base if r['block']==block and r['label']=='A']
    if rr and aa:assert aa[0]['probe']['searchedStates']<=rr[0]['probe']['searchedStates'] and aa[0]['probe']['qualityVector']>=rr[0]['probe']['qualityVector']
complete=len(base)==24 and s['status']=='COMPLETE'
groups={};contrasts=[];predicted_profile=False
if complete:
    for cond in ['R','A','RA','AR']:
        for v in cond:
            rr=[r for r in base if r['condition']==cond and r['label']==v]
            assert len(rr)==4
            groups[f'{cond}:{v}']={'apiSamplesMs':[r['apiMs'] for r in rr],'medianApiMs':statistics.median(r['apiMs'] for r in rr),
                'medianThreadCpuMs':statistics.median((r['threadCpu']['user']+r['threadCpu']['system'])/1000 for r in rr),
                'medianProcessCpuMs':statistics.median((r['cpu']['user']+r['cpu']['system'])/1000 for r in rr),
                'medianThreadCpuToWall':statistics.median((r['threadCpu']['user']+r['threadCpu']['system'])/1000/r['apiMs'] for r in rr),
                'medianInitMs':statistics.median(r['initMs'] for r in rr),'medianCoverageMs':statistics.median(r['coverageMs'] for r in rr)}
    for name,numerator,denominator in [('aAfterR','RA:A','A:A'),('rAfterA','AR:R','R:R'),('firstAMatched','AR:A','A:A'),('firstRMatched','RA:R','R:R'),('standaloneAToR','A:A','R:R'),('aSecondVsFirst','RA:A','AR:A'),('rSecondVsFirst','AR:R','RA:R')]:
        ratios=[]
        for block in range(1,5):
            get=lambda key:next(r for r in base if r['block']==block and f"{r['condition']}:{r['label']}"==key)
            ratios.append(get(numerator)['apiMs']/get(denominator)['apiMs'])
        value=groups[numerator]['medianApiMs']/groups[denominator]['medianApiMs']
        contrasts.append({'name':name,'numerator':numerator,'denominator':denominator,'ratioOfMedians':value,
            'blockRatios':ratios,'medianBlockRatio':statistics.median(ratios),'blocksOver10PercentSlower':sum(x>1.1 for x in ratios),'blocksOver10PercentFaster':sum(x<.9 for x in ratios)})
        if name in s['decision']['signals']:assert abs(s['decision']['signals'][name]-value)<1e-12
    predicted_profile=any(c['ratioOfMedians']<.9 or c['ratioOfMedians']>1.1 for c in contrasts[:5])
    assert predicted_profile==s['decision']['profileRequired']
    assert len(profile)==(4 if predicted_profile else 0)
    assert len(s['sessions'])==16+(2 if predicted_profile else 0)
    assert all(c['status']=='CLOSED' and c['code']==0 and c['signal'] is None and not c['stderr'] for c in s['sessions'])
report={'status':'COMPLETE_INDEPENDENTLY_AUDITED' if complete else 'PARTIAL_NOT_CAUSE_PROOF','runId':int(RUN_ID),'sourceCommit':lock['commit'],
    'expectedBaseCalls':24,'observedBaseCalls':len(base),'observedProfileCalls':len(profile),'profileRequiredByFrozenRule':predicted_profile,
    'artifactFilesVerified':verified,'sourceBlobsVerified':source_blobs,'rawRecordsVerified':raw_records,'weightedQualityAndSeedRecalculations':quality_checks,
    'determinismCounts':determinism,'runtime':s['runtime'],'groups':groups,'contrasts':contrasts,
    'profileRows':[{k:r[k] for k in ['runId','condition','label','position','apiMs','cpu','threadCpu','profile']} for r in profile],
    'stopReason':s['stopReason'],'primaryPcThresholdCalls':0,'performanceConfirmationCalls':0,'productChanged':False,'devApplied':False,
    'limits':'One host with pinned calling thread; background compiler/frequency/SMT not controlled; no CPU causal attribution from host change; no compiler-tier trace'}
with (HERE/'ANALYSIS.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
