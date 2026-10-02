"""Describe the attempt and protected refs; do not apply the product candidate."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess

here=Path(__file__).resolve().parent;download=here/'github-run-37039906398'
continuation=here/'github-run-37041073063'
repo=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-revalidation-20261003');dev=Path('D:/AI/sfinder-wasm/dev-branch')
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def git(root,*a):return subprocess.check_output(['git','-C',str(root),*a])
def date(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
run=load(download/'RUN.json');initial=load(download/'INITIAL_RUN.json');resume=load(continuation/'RUN.json')
jobs=[j for r in [run,resume] for j in r['jobs'] if j['conclusion']!='skipped']
baseline='c0cb2a048e7275bfea587d176b1954efff0a8a08';assert git(dev,'status','--porcelain')==b'';assert git(dev,'rev-parse','HEAD').decode().strip()==baseline
localmain=git(dev,'rev-parse','main').decode().strip();remotemain=git(repo,'ls-remote','origin','refs/heads/main').decode().split()[0]
assert localmain=='187fbf954ad0749e697b4e7f1252683b318d696e' and remotemain=='03b637730c5b541f4f2934be613498fbe65327fd'
assert 'ref: refs/heads/main\tHEAD' in git(repo,'ls-remote','--symref','origin','HEAD').decode()
report={'status':'ATTEMPT_COMPLETED_NOT_DEV_APPROVAL','sourceMeasurementRunId':37039906398,'sourceMeasurementRunConclusion':run['conclusion'],
        'continuationRunId':37041073063,'continuationRunConclusion':resume['conclusion'],'candidateCommit':run['headSha'],'auditorContinuationCommit':resume['headSha'],
        'campaignWallMinutes':(max(date(j['completedAt']) for j in jobs)-date(initial['created_at'])).total_seconds()/60,
        'observedJobRunnerHours':sum((date(j['completedAt'])-date(j['startedAt'])).total_seconds() for j in jobs)/3600,
        'artifactCompressedBytes':sum(a['size_in_bytes'] for d in [download,continuation] for a in load(d/'ARTIFACTS.json')['artifacts']),
        'phases':{},'priorFailedRunPreserved':37034641097,'productCandidateRetuned':False,'repeat675EffectCampaign':False,
        'actualInputPrimaryCalls':0,'actualInputPcCalls':0,'actualInputNativeThresholdCalls':0,
        'fullThresholdRoutePerformanceProven':False,'devHead':baseline,'localMain':localmain,'remoteMain':remotemain,'defaultBranch':'main',
        'protectedDevClean':True,'devApplied':False,'mainMerged':False,'deployed':False,'retrySubstitution':False,
        'developmentMeasurementReruns':0,'auditorCorrectionChangesOnlyIterationOrder':True,'globalBudgetSourceRunId':37039906398}
for phase,n in [('development',512),('reserved',832)]:
    phase_download=download if phase=='development' else continuation
    summary=phase_download/f'a0i-{phase}-summary/SUMMARY.json'
    if summary.exists():
        s=load(summary);report['phases'][phase]={k:s[k] for k in ['status','expectedRuns','observedRuns','statuses','correctnessGatePass','performanceGatePass','resourceGatePass','apiMedianSumRatio','p95ApiRatio','cluster95CI','peakMemoryP95Ratio','peakMemoryP95IncreaseBytes','probeExactMatrices','errors']}
    else:report['phases'][phase]={'status':'NOT_RUN_OR_SUMMARY_MISSING','expectedRuns':n,'observedRuns':sum(load(p)['observedRuns'] for p in phase_download.glob(f'a0i-{phase}-*/SHARD.json'))}
report['bothIntegratedPopulationGatesPass']=all(p['status']=='PASS_INTEGRATED_SCOPE' for p in report['phases'].values())
report['status']='INTEGRATED_SCOPE_VERIFIED_AWAITING_SEPARATE_DEV_APPROVAL' if report['bothIntegratedPopulationGatesPass'] else 'STOPPED_BEFORE_DEV_CONNECTION_GATE_FAILED_OR_INCOMPLETE'
build_candidates=[download/'a0i-build-tests/build/BUILD.json',download/'a0i-build-tests/BUILD.json']
build_path=next((p for p in build_candidates if p.exists()),None)
if build_path:
    b=load(build_path);report['wasmSha256']=b['wasmSha256'];report['productCandidateCommit']=b['productCandidateCommit']
    test_path=build_path.parent/'TESTS.json'
    if test_path.exists():report['hostedProductTests']=load(test_path)
    synthetic=build_path.parent/'SYNTHETIC.json'
    if synthetic.exists():report['hostedSmallSyntheticThreshold']={k:v for k,v in load(synthetic).items() if k!='results'}
report['independentOfflineAudits']={phase:load(here/f'{phase}-offline-audit/INDEPENDENT_AUDIT.json') for phase in ['development','reserved'] if (here/f'{phase}-offline-audit/INDEPENDENT_AUDIT.json').exists()}
(here/'STATUS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
