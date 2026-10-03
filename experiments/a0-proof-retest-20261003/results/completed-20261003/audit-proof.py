"""Independent fixed-K proof result comparison; no native solver."""
from pathlib import Path
import gzip
import hashlib
import json
import subprocess
import sys

HERE=Path(__file__).resolve().parent;RUN=int(sys.argv[1]);repo=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
folders=list((HERE/f'github-run-{RUN}').rglob('SUMMARY.json'));assert len(folders)==1
folder=folders[0].parent;s=load(folders[0]);lock=s['lock']
assert lock['commit']==load(HERE/f'github-run-{RUN}/RUN.json')['headSha']
assert sha(canon(lock))==s['lockSha256']
for f in load(folder/'FILES.json')['files']:
 b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
for f in lock['files']:assert sha(subprocess.check_output(['git','-C',str(repo),'show',f"{lock['commit']}:{f['file']}"]))==f['sha256']
assert lock['maxCalls']==1 and lock['stateBudget']==2000000 and lock['apiSeconds']==30 and lock['processSeconds']==45
entry=lock['input'];assert entry['id']=='board-111--restricted-split--ordinary'
pack=repo/'experiments/a0-integrated-revalidation-20261003'/entry['pack']
with pack.open('rb') as f:f.seek(entry['offset']);b=f.read(entry['length'])
assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b));assert m['K']==35 and m['primary']['cardinalityProven']
assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256']
expected=load(repo/'experiments/a0-proof-retest-20261003/EXPECTED.json');assert sha(canon(expected))==lock['expectedSha256']
idx={k:i for i,k in enumerate(m['keys'])}
def witness(p):
 ids=sorted(idx[k] for k in p['keys']);assert len(ids)==len(set(ids))==p['count']==m['K']
 def q(keys):
  chosen={idx[k] for k in keys};result=sorted(max((v for i,v in row if i in chosen),default=0) for row in m['rows']);assert result[0]>0;return result
 qq=q(p['keys']);assert qq==p['qualityVector'] and qq>=q(m['seedKeys'])
 return {'selectedIDs':ids,'qualitySha256':sha(canon(qq)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(qq)}
prior=witness(expected['probe']);assert prior['selectedIDs']==expected['selectedIDs']
original_raw_verified=0;exact_witnesses_verified=0
for locator in expected['sourceLocators']:
 p=Path('D:/AI/sfinder-wasm')/locator['rawFile'];b=p.read_bytes();assert sha(b)==locator['sha256'];original_raw_verified+=1
 records=[json.loads(l) for l in b.decode('utf-8').splitlines()];results=[r for r in records if r['type']=='phase-result'];assert len(results)==1
 probe=results[0]['raw'];w=witness(probe)
 if locator['status']=='PROBE_EXACT':
  assert probe['completed'] and probe['qualityVector']==expected['qualityVector'] and w==prior;exact_witnesses_verified+=1
 else:assert not probe['completed']
assert original_raw_verified==8 and exact_witnesses_verified==4
verdict='PROOF_PENDING';checks=2;rawcount=0
row=s['row']
if row:
 raw=[json.loads(l) for l in (folder/row['rawFile']).read_text().splitlines()];assert [r['type'] for r in raw]==['phase-start','phase-result','audit-result'];rawcount=3
 assert raw[1]['raw']==row['probe'] and raw[2]['witness']==row['witness']
 opt=raw[1]['options'];assert opt=={'seedKeys':m['seedKeys'],'stateBudget':2000000,'integrated':False,'partitioned':False,'dominance':False}
 assert raw[1]['apiMs']<30000 and row['verificationMs']<30000
 w=witness(row['probe']);checks+=2;assert w==row['witness'];assert 1<=row['probe']['searchedStates']<=2000000
 assert row['actualPrimaryCalls']==row['actualPcCalls']==row['integratedCalls']==0 and row['nativeThresholdCalls']==1
 assert row['primaryProofSha256']==sha(canon(m['primary']))
 res=row['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
 if row['probe']['completed']:
  verdict='INDEPENDENT_EXACT_VERIFIED' if row['probe']['qualityVector']==expected['qualityVector'] and w['selectedIDs']==expected['selectedIDs'] else 'MISMATCH'
 assert verdict==row['verdict']==s['status']
assert s['attemptedCalls']<=1 and s['actualPrimaryCalls']==s['actualPcCalls']==s['integratedCalls']==0
originrun=json.loads(subprocess.check_output(['gh','api','repos/Qnia28/sfinder_wasm/actions/runs/37115091562']))
assert s['originMs']==int(__import__('datetime').datetime.fromisoformat(originrun['created_at'].replace('Z','+00:00')).timestamp()*1000)
report={'status':verdict,'runId':RUN,'sourceCommit':lock['commit'],'matrixId':entry['id'],'K':m['K'],
 'completed':row['probe']['completed'] if row else None,'searchedStates':row['probe']['searchedStates'] if row else None,
 'apiMs':raw[1]['apiMs'] if row else None,'qualityAndSeedRecalculations':checks,'rawRecordsVerified':rawcount,
  'sourceBlobsVerified':len(lock['files']),'originalRawWitnessFilesVerified':original_raw_verified,'candidateExactWitnessesVerified':exact_witnesses_verified,
  'candidateWitnessesUnchanged':True,'sameFullQualityAndStableIds':verdict=='INDEPENDENT_EXACT_VERIFIED',
 'actualNativeThresholdCalls':1 if row else s['attemptedCalls'],'proofRetries':0,'actualPrimaryPcCalls':0,'integratedRecomputations':0,
 'independence':lock['independence'],'campaignOriginRunId':37115091562,'origin':originrun['created_at'],'oldReservedP95FailureStillValid':True,
 'productChanged':False,'failure':s['failure']}
for name,value in [('PROOF_AUDIT.json',report),('ORIGIN_RUN.json',originrun)]:
 with (HERE/name).open('x',encoding='utf-8') as f:json.dump(value,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
