"""Offline independent failed-campaign audit; never invokes native work."""
from pathlib import Path
import collections
import datetime
import gzip
import hashlib
import json
import shutil
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-m1-integration-20261004')
EX=REPO/'experiments/a0-m1-on-off-20261004'
SOURCE=EX/'github-run-37178792683'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda root,*a:subprocess.check_output(['git','-C',str(root),*a])
stamp=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
run=load(SOURCE/'RUN.json');initial=load(SOURCE/'INITIAL_RUN.json');watch=load(SOURCE/'WATCH_DECISION.json')
assert run['databaseId']==37178792683 and run['headSha']=='03ef21d61bb1dcbe2d68e54018ba64c12960b04b'
assert run['conclusion']=='failure' and watch['downloadExit']==0 and not watch['cancelledAtWallDeadline']
assert initial['created_at']=='2026-10-04T05:03:42Z'
assert len(run['jobs'])==11 and all(j['status']=='completed' for j in run['jobs'])
preflight=next(j for j in run['jobs'] if j['name']=='preflight');assert preflight['conclusion']=='success'
assert all(step['conclusion']=='success' for step in preflight['steps'])
artifact=SOURCE/'a0-m1-on-off-preflight';lock=load(artifact/'.a0-m1-comparison/LOCK.json')
assert lock['commit']==run['headSha'] and lock['origin']['origin']==initial['created_at']
for name,key in [('pc_wasm.wasm','referenceWasm'),('pc_a0_m1.wasm','candidateWasm'),('batch_wasm.wasm','batchWasm')]:assert sha((artifact/'wasm'/name).read_bytes())==lock[key]
assert lock['referenceWasm']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
assert lock['candidateWasm']=='c3c9a8844148341db69a1216d348a09f857f9f3259d2d5b6a2ac0517cf654530'
for blob in lock['sourceBlobs']:
 if blob['type']=='blob':assert git(REPO,'rev-parse',f'{run["headSha"]}:{blob["file"]}').decode().strip()==blob['blob']
entries={e['id']:e for e in load(EX/'INPUTS.json')['entries']}
schedule={r['runId']:r for r in load(EX/'SCHEDULE.json')['runs']}
summaries=list(SOURCE.rglob('SUMMARY.json'));assert len(summaries)==10
failures=[];raw_count=0;actual_probe=0;actual_threshold=0;seen=set()
for p in summaries:
 s=load(p);host=s['host'];assert host not in seen;seen.add(host)
 assert s['attemptedCalls']==1 and s['verifiedCalls']==0 and s['stopReason']=='ERROR_CHILD'
 assert s['lock']==lock
 for f in s['files']:
  b=(p.parent/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
 oo=[json.loads(l) for l in (p.parent/'outcomes.jsonl').read_text().splitlines()];assert len(oo)==1
 o=oo[0];expected=schedule[o['runId']];assert all(o[k]==v for k,v in expected.items())
 assert o['position']==1 and o['kind']=='ENVIRONMENT_CONTROL' and o['policy']=='reference'
 assert o['matrixId']=='board-075--restricted-split--T' and o['status']=='ERROR_CHILD'
 assert 'Regenerated original weighted matrix differs' in o['resources']['stderr']
 assert o['resources']['killToCloseMs']<2000
 resources=o['resources']['resources'];assert resources['memoryMaxBytes']==3221225472 and resources['swapMaxBytes']==0
 assert resources['cgroupEvents']['oom']==0 and resources['cgroupEvents']['oom_kill']==0
 raws=list((p.parent/'raw').glob('*.jsonl'));assert len(raws)==1
 raw=[json.loads(l) for l in raws[0].read_text().splitlines()]
 assert [r['type'] for r in raw]==['phase-start','probe-start','probe-result','phase-result'];raw_count+=len(raw)
 measured=raw[3]['raw'];assert measured['humanQualityExact'] and measured['minimalCount']==35 and len(measured['humanQualityVector'])==3668
 assert measured['exactProbeTrace']['policy']=='reference' and measured['exactProbeTrace']['status']=='CAPPED'
 probes=[c for c in measured['calls'] if c['integrated']];threshold=[c for c in measured['calls'] if not c['integrated']]
 assert len(probes)==1 and probes[0]['stateBudget']==100000 and not probes[0]['partitioned'] and not probes[0]['completed']
 assert raw[2]['probe']==probes[0] and len(threshold)==1 and threshold[0]['completed']
 actual_probe+=len(probes);actual_threshold+=len(threshold)
 e=entries[o['matrixId']];compressed=(EX/e['file']).read_bytes();assert sha(compressed)==e['sha256']
 original=json.loads(gzip.decompress(compressed));assert original['K']==31 and len(original['rows'])==1580
 assert original['identitySha256']==e['identitySha256'] and original['primary']['cardinalityProven']
 normalized=sorted([[str(c.get('sourceCaseId',c['caseId'])),sorted(row,key=lambda v:v[0])] for c,row in zip(original['cases'],original['rows'])],key=lambda v:v[0])
 original_hash=sha(json.dumps([original['keys'],normalized],ensure_ascii=False,separators=(',',':')).encode())
 assert original_hash=='bcf290233d86b7bf27d11e67b23257d166599f6c9a71e3963611247b2b3c8996'
 assert measured['regeneratedMatrixSha256']=='3e05695313c995176c98614475a59a7eb7f3ec10fbe91239e62cc06a1aadb1ea'
 failures.append({'host':host,'runId':o['runId'],'matrixId':o['matrixId'],'policy':'reference','status':'ERROR_CHILD_MATRIX_IDENTITY',
  'original':{'K':31,'weightedRows':1580,'regeneratedCanonicalSha256':original_hash,'identitySha256':original['identitySha256']},
  'measuredDifferentInput':{'K':35,'weightedRows':3668,'regeneratedCanonicalSha256':measured['regeneratedMatrixSha256']},
  'probeCalls':1,'thresholdCalls':1,'oomKills':0,'partialRawPreserved':True})
assert seen==set(range(10))
dev=ROOT/'dev-branch';assert git(dev,'status','--porcelain')==b''
protected={'devHead':git(dev,'rev-parse','HEAD').decode().strip(),'localMain':git(dev,'rev-parse','main').decode().strip(),
 'remoteMain':git(dev,'ls-remote','origin','refs/heads/main').decode().split()[0]}
assert protected=={'devHead':'c0cb2a048e7275bfea587d176b1954efff0a8a08','localMain':'187fbf954ad0749e697b4e7f1252683b318d696e','remoteMain':'03b637730c5b541f4f2934be613498fbe65327fd'}
preparation=ROOT/'tools/validation/a0-m1-integration-20261004';seal=load(preparation/'SEAL.json')
for f in seal['files']:
 b=(preparation/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
dest=HERE/'github-run-37178792683';assert not dest.exists();shutil.copytree(SOURCE,dest)
capture=ROOT/'tools/validation/integrated-capture-20261002/frozen/enumerate.mjs'
sourcefiles=['src/saves.mjs','src/minimals-feature.mjs','src/minimals-compact.mjs','experiments/a0-m1-on-off-20261004/prepare.py',
 'experiments/a0-m1-on-off-20261004/request.mjs','experiments/a0-m1-on-off-20261004/common.mjs','experiments/a0-m1-on-off-20261004/launch.json']
diagnostic=HERE/'SOURCE_DIAGNOSTIC';diagnostic.mkdir()
for file in sourcefiles:
 p=diagnostic/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git(REPO,'show',f'{run["headSha"]}:{file}'))
(diagnostic/'original-capture-enumerate.mjs').write_bytes(capture.read_bytes())
end=max(stamp(j['completedAt']) for j in run['jobs']);wall=(end-stamp(initial['created_at'])).total_seconds()
hours=sum((stamp(j['completedAt'])-stamp(j['startedAt'])).total_seconds() for j in run['jobs'])/3600
result={'status':'STOPPED_PRODUCT_BENCHMARK_INPUT_MAPPING_ERROR_NO_PERFORMANCE_JUDGMENT','runId':run['databaseId'],'sourceCommit':run['headSha'],
 'origin':initial['created_at'],'completedAt':end.isoformat(),'wallSeconds':wall,'runnerHours':hours,
 'preflightPassed':True,'referenceAndCandidateLinuxBytesMatched':True,'rustDebugTestsPassed':29,'rustReleaseTestsPassed':29,
 'tenRunnerLocksIdentical':True,'sourceBlobsVerified':len(lock['sourceBlobs']),'fileInventoriesAndDownloadedBytesVerified':True,
 'attemptedRequests':10,'environmentRequestsAttempted':10,'selectedComparisonRequestsAttempted':0,'verifiedOriginalInputRequests':0,
 'actualCandidateProbes':0,'actualReferenceProbes':actual_probe,'actualThresholdCalls':actual_threshold,'actualProductPrimaryAndEnumerationRequests':10,
 'completedAdjacentOnOffPairs':0,'rawRecords':raw_count,'oomKills':0,'timeoutRequests':0,'descendantsReaped':True,
 'cause':'Preparation incorrectly mapped queue-unused-piece filter to minimals complete last-bag save expression. The latter also includes undrawn bag pieces, changing rows and K. This is an input-contract error, not hash normalization.',
 'noA0M1PerformanceOrCorrectnessClaim':True,'noMeasuredTimingReplacementOrFavorableHostDiscard':True,'automaticRelaunch':False,
 'requiresNewExplicitRouteDesignBeforeAnyRetry':True,'originalCampaignOriginRemainsImmutable':True,'productDefault':'reference','protected':protected,
 'preparationSealReverified':{'sha256':sha((preparation/'SEAL.json').read_bytes()),'files':len(seal['files'])},
 'failures':sorted(failures,key=lambda r:r['host']),'auditNativeCalls':0}
with (HERE/'AUDIT.json').open('x',encoding='utf-8',newline='\n') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k!='failures'},indent=2))
