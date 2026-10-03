"""Correct attempted-wrapper/native-entry accounting without changing first audit or raw evidence."""
from pathlib import Path
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
audit=load(HERE/'PROOF_AUDIT.json');assert audit['status']=='PROOF_PENDING'
summary_file=next((HERE/'github-run-37115091562').rglob('SUMMARY.json'));s=load(summary_file)
assert s['row'] is None and s['failure']['status']=='ERROR_EXIT'
assert 'minimumCoverAtCount requires a positive human-quality provider' in s['failure']['failure']['stderr']
source=subprocess.check_output(['git','-C',str(REPO),'show',f"{s['lock']['baseline']}:src/pc-wasm-min-cover.mjs"]).decode()
assert source.index('if (qualityFor === null) throw')<source.index('const bounded = stateBudget != null')<source.index('status = wasmU32(boundedExport(')
raws=list((summary_file.parent/'raw').glob('*.jsonl'));assert len(raws)==1
raw=[json.loads(l) for l in raws[0].read_text().splitlines()];assert [r['type'] for r in raw]==['phase-start']
record={'status':'PRESERVED_PRE_NATIVE_HARNESS_FAILURE_PROOF_PENDING','runId':37115091562,'sourceCommit':s['lock']['commit'],
 'failedWrapperAttempts':1,'actualNativeThresholdSearchCalls':0,'actualIntegratedSearchCalls':0,'actualPrimaryPcSearchCalls':0,
 'rawPhaseStartRecords':1,'rawPhaseResultRecords':0,'noWitnessLostAfterNativeReturn':True,'proofRetries':0,
 'cause':'Required qualityFor option omitted in direct minimumCoverAtCount call; wrapper rejects at baseline pc-wasm-min-cover.mjs:178 before row packing/allocation/native export call.',
 'notSolverMismatchOrTimeout':True,'candidateFourExactWitnessesRemainValidButIndependentProofPending':True,
 'initialAuditAccountingCorrection':'PROOF_AUDIT.actualNativeThresholdCalls=1 counted wrapper attempt. This correction records native search0; first audit stays unchanged.',
 'initialAuditSha256':sha((HERE/'PROOF_AUDIT.json').read_bytes()),'rawSha256':sha(raws[0].read_bytes()),'baselineWrapperSha256':sha(source.encode()),
 'nextIfAuthorized':'Add required numeric-quality guard function in the direct proof wrapper; synthetic direct threshold ABI fixture first. New source/manifest and linked pre-native failure; no successful/native measurement substitution. Keep1 native call,2Mstates/API30/process45 unchanged.',
 'performanceRetestCalls':0,'conditionalRetestLaunchAllowed':False,'productChanged':False}
with (HERE/'PROOF_FAILURE_REANALYSIS.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps(record,indent=2))
