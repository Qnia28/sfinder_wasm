"""Make diagnosis response decision from audited evidence; no product/test execution."""
from pathlib import Path
import datetime
import hashlib
import json
import statistics
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-diagnosis-20261003')
DEV=Path('D:/AI/sfinder-wasm/dev-branch')
download=HERE/'github-run-37096100399'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
d=load(HERE/'DIAGNOSIS.json');assert d['observedRuns']==d['expectedRuns']==2560 and not d['missingRunIds']
assert not d['determinismErrors'] and not d['stateRegressions'] and not d['qualityRegressions']
sessions=[]
for f in download.glob('a0d-h*-s*/SHARD.json'):
    s=load(f);assert s['status']=='COMPLETE';sessions+=s['sessions']
assert all(s['status']=='CLOSED' and s['code']==0 and s['signal'] is None and not s['stderr'] for s in sessions)
assert git(DEV,'status','--porcelain')==b'' and git(DEV,'rev-parse','HEAD').decode().strip()=='c0cb2a048e7275bfea587d176b1954efff0a8a08'
assert git(REPO,'diff','--name-only','e77d19fafe12f76d09f426f647c5d2d14bfd9458','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json')==b''
localmain=git(DEV,'rev-parse','main').decode().strip();remote=git(REPO,'ls-remote','origin','refs/heads/main').decode().split()[0]
assert localmain=='187fbf954ad0749e697b4e7f1252683b318d696e' and remote=='03b637730c5b541f4f2934be613498fbe65327fd'
assert 'ref: refs/heads/main\tHEAD' in git(REPO,'ls-remote','--symref','origin','HEAD').decode()
pairs=d['pairs'];observations=[]
for h in [0,1]:
    for mode in ['COLD','COMPILED','WARM']:
        pp=[p for p in pairs if p['stage']=='diagnostic' and p['host']==h and p['mode']==mode and p['kind']=='measured' and p['group']=='F14']
        observations.append({'host':h,'mode':mode,'F14Matrices':len(pp),'medianBaselineApiMs':statistics.median(p['baselineMs'] for p in pp),
            'medianCandidateApiMs':statistics.median(p['candidateMs'] for p in pp),'candidateSlowerMatrices':sum(p['deltaMs']>0 for p in pp),
            'candidateOver10PercentMatrices':sum(p['ratio']>1.1 for p in pp),'medianDeltaMs':statistics.median(p['deltaMs'] for p in pp)})
coherent={}
for mode in ['COLD','WARM']:
    a={p['matrixId']:p for p in pairs if p['stage']=='diagnostic' and p['host']==0 and p['mode']==mode and p['kind']=='measured' and p['group']=='F14'}
    b={p['matrixId']:p for p in pairs if p['stage']=='diagnostic' and p['host']==1 and p['mode']==mode and p['kind']=='measured' and p['group']=='F14'}
    coherent[mode]={'slowerBothHosts':sum(a[id]['deltaMs']>0 and b[id]['deltaMs']>0 for id in a),'over10PercentBothHosts':sum(a[id]['ratio']>1.1 and b[id]['ratio']>1.1 for id in a)}
anomaly_id='board-028--restricted-split--ordinary'
anomaly=[p for p in pairs if p['stage']=='diagnostic' and p['matrixId']==anomaly_id and p['kind']=='measured']
cpu_rows=[]
for f in download.glob('a0d-h*-s*/runs.jsonl'):
    for l in f.read_text().splitlines():
        r=json.loads(l)
        if r['matrixId']==anomaly_id and r['stage']=='diagnostic' and r['kind']=='measured':
            cpu_rows.append({k:r[k] for k in ['hostBlock','mode','label','repetition','apiMs','cpu','initMs','coverageMs']})
run=load(download/'RUN.json');initial=load(download/'INITIAL_RUN.json')
date=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
wall=(max(date(j['completedAt']) for j in run['jobs'])-date(initial['created_at'])).total_seconds()/60
runner=sum((date(j['completedAt'])-date(j['startedAt'])).total_seconds() for j in run['jobs'])/3600
decision={'status':'DIAGNOSIS_COMPLETE_RESPONSE_KEEP_PRODUCT_UNCHANGED','progressionStatus':'STOP_MEASUREMENT_UNRELIABLE_NO_CONFIRMATION',
    'runId':37096100399,'runConclusion':run['conclusion'],'sourceCommit':run['headSha'],
    'diagnosticCalls':2560,'diagnosticMatrices':32,'missingTimeoutOomErrors':0,
    'aaAlarms':d['aaEnvironmentAlarms'],'F14ModeObservations':observations,'F14BetweenHostCoherence':coherent,
    'specificColdCpuAnomaly':{'matrixId':anomaly_id,'modeComparisons':anomaly,'cpuSamples':cpu_rows,'dismissedAsRandomWallNoise':False,'exactRuntimeMechanismProven':False},
    'findings':[
        {'finding':'Identical baseline comparisons exceed the old 10 percent tail tolerance','confidence':'DIRECTLY_OBSERVED','meaning':'Current cold 4-repeat protocol lacks precision to attribute these small tail differences to A0'},
        {'finding':'First-call versus warm lifecycle effect is large in both variants; old F14 positive direction is not stable across hosts','confidence':'DIRECTLY_OBSERVED','meaning':'Prior tail is not evidence of a uniform persistent millisecond-scale sibling-management cost'},
        {'finding':'Runtime first-execution/code-tier/code-layout/cache and host variability are plausible contributors','confidence':'SUPPORTED_CLASS_NOT_SPECIFIC_MECHANISM','meaning':'No V8 trace or controlled tier/CPU intervention yet; do not claim JIT alone proved'},
        {'finding':'One long bounded cold case shows repeatable host0 50 percent CPU-time difference, absent in warm and host1','confidence':'DIRECTLY_OBSERVED_UNRESOLVED_MECHANISM','meaning':'A real runtime-dependent cold cost remains; cannot declare regression-free'}],
    'response':{'modifyA0SiblingSearchNow':False,'addWarmupToProductNow':False,'addIdOrSizeDispatchExceptions':False,'changePerformanceGate':False,
        'repeat232ConfirmationCampaign':False,'promoteCandidate':False,'productCandidate':'e5f2f3d1a9885085e11cde7457aad2b338ca8130',
        'nextProposal':'Single-input engine-tier/first-call/CPU-affinity diagnosis for board-028; do not run a new broad performance campaign'},
    'independentExactProofStillPending':'board-111--restricted-split--ordinary',
    'pastFailedRunsUnchanged':[37034641097,37039906398,37041073063],
    'nativeThresholdCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0,'confirmationCalls':0,
    'productChanged':False,'devApplied':False,'mainMerged':False,'deployed':False,
    'devHead':'c0cb2a048e7275bfea587d176b1954efff0a8a08','localMain':localmain,'remoteMain':remote,'defaultBranch':'main',
    'wallMinutes':wall,'observedRunnerHours':runner,'artifactCompressedBytes':sum(a['size_in_bytes'] for a in load(download/'ARTIFACTS.json')['artifacts'])}
with (HERE/'DECISION.json').open('x',encoding='utf-8') as f:json.dump(decision,f,indent=2);f.write('\n')
(HERE/'STATUS.json').write_text(json.dumps(decision,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in decision.items() if k!='specificColdCpuAnomaly'},indent=2))
