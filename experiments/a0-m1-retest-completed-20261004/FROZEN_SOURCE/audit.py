"""Read-only original-row/source/raw IPC audit and one retest analysis."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import subprocess
import sys
from analyze import analyze
EX=Path(__file__).resolve().parent;REPO=EX.parent.parent
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def js_sha(v):
 return subprocess.check_output(['node','-e',"const fs=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')))).digest('hex'));"],input=canon(v)).decode()
def audit(download):
 selection=load(EX/'SELECTION.json');schedule=load(EX/'SCHEDULE.json');expected={r['runId']:r for r in schedule['runs']};campaign=load(EX/'CAMPAIGN.json')
 refs=load(REPO/'experiments/a0-four-arm-20261003/REFERENCES.json')['references'];inputs={}
 for e in load(EX/'INPUTS.json')['entries']:
  with (REPO/'experiments/a0-integrated-revalidation-20261003'/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
  assert sha(b)==e['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
  assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==e['identitySha256'];inputs[e['id']]=m
 summaries=[p for p in download.rglob('SUMMARY.json') if p.parent.name in [str(h) for h in range(10)]];assert len(summaries)<=10
 rows=[];outcomes=[];hosts=[];source_count=file_count=raw_count=0;verified=set();locks=[]
 for sp in summaries:
  s=load(sp);folder=sp.parent;lock=s['lock'];locks.append(lock);assert js_sha(lock)==s['lockSha256'];assert s['origin']==lock['origin'] and not s['clockReset']
  assert lock['campaign']==campaign and lock['stage']=='ONE_M1_RETEST_THEN_DECISION' and lock['measuredRuntimesUnchanged']
  for key,name in [('selectionSha256','SELECTION.json'),('scheduleSha256','SCHEDULE.json'),('screeningSha256','SCREENING.json'),('inputsSha256','INPUTS.json')]:assert lock[key]==js_sha(load(EX/name))
  assert lock['build']==load(EX/'FROZEN_BUILD.json')['build'] and lock['runtimeFiles']==load(EX/'FROZEN_BUILD.json')['runtimeFiles']
  if lock['commit'] not in verified:
   for f in lock['files']:assert sha(subprocess.check_output(['git','-C',str(REPO),'show',f"{lock['commit']}:{f['file']}"],stderr=subprocess.DEVNULL))==f['sha256'];source_count+=1
   verified.add(lock['commit'])
  for f in load(folder/'FILES.json')['files']:
   b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];file_count+=1
  rr=[json.loads(l) for l in (folder/'runs.jsonl').read_text().splitlines()] if (folder/'runs.jsonl').exists() else []
  oo=[json.loads(l) for l in (folder/'outcomes.jsonl').read_text().splitlines()] if (folder/'outcomes.jsonl').exists() else []
  assert len(rr)==s['verifiedCalls'] and len(oo)==s['attemptedCalls'];assert len(rr)==len({r['worker']['pid'] for r in rr})
  assert [o['runId'] for o in oo]==[r['runId'] for r in schedule['runs'] if r['host']==s['host']][:len(oo)]
  for r in rr:
   assert all(r[k]==v for k,v in expected[r['runId']].items());assert not r['synthetic'] and not r['diagnostic'] and r['timingEvidence'] and r['profile'] is None and r['counters'] is None
   raw=[json.loads(l) for l in (folder/r['rawFile']).read_text().splitlines()];assert [v['type'] for v in raw]==['phase-start','phase-result','audit-result'];raw_count+=3
   assert raw[1]['raw']==r['probe'] and raw[1]['options']==r['options'] and raw[1]['apiMs']==r['apiMs'] and raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
   m=inputs[r['matrixId']];p=r['probe'];idx={k:i for i,k in enumerate(m['keys'])};chosen={idx[k] for k in p['keys']}
   assert p==refs[r['matrixId']]['R' if r['arm']=='R' else 'A0'];assert p['count']==len(chosen)==m['K']
   quality=lambda ids:sorted(max((q for i,q in row if i in ids),default=0) for row in m['rows'])
   q=quality(chosen);assert q[0]>0 and q==p['qualityVector'] and q>=quality({idx[k] for k in m['seedKeys']})
   assert r['witness']=={'selectedIDs':sorted(chosen),'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
   assert r['primaryProofSha256']==sha(canon(m['primary'])) and r['seedKeysSha256']==sha(canon(m['seedKeys']))
   assert r['options']['stateBudget']==100000 and r['options']['seedKeys']==m['seedKeys'] and r['options']['integrated']
   assert bool(r['options'].get('partitioned'))==(r['arm']!='R') and not r['options'].get('dominance')
   assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0 and r['worker']['callCount']==1 and r['worker']['cpu']=='UNPINNED'
   assert r['wasmSha256']==lock['build']['outputs'][r['arm']]['wasmSha256'] and 0<r['apiMs']<10000
   assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
   if not p['completed']:
    c=r['contract'];assert c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p)) and len(c['calls'])==2
    assert all(call=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for call in c['calls'])
   res=r['resources'];assert res['memoryMaxBytes']==3221225472 and res['swapMaxBytes']==0 and res['cgroupEvents']['oom_kill']==0
  rows+=rr;outcomes+=oo;hosts.append({'host':s['host'],'status':s['status'],'runtime':s['runtime'],'verified':len(rr),'attempted':len(oo),'stopReason':s['stopReason']})
 assert all(l==locks[0] for l in locks);assert len(rows)==len({r['runId'] for r in rows})
 ok={o['runId'] for o in outcomes if o['status']=='VERIFIED'};analysis=analyze(selection,load(EX/'SCREENING.json'),[r for r in rows if r['runId'] in ok])
 return {'status':'COMPLETE_INDEPENDENTLY_AUDITED' if len(ok)==len(outcomes)==len(expected) else 'PRESERVED_PARTIAL',
  'expectedCalls':len(expected),'verifiedCalls':len(ok),'rawRowsAudited':len(rows),'outcomes':dict(collections.Counter(o['status'] for o in outcomes)),
  'sourceBlobsVerified':source_count,'resultFilesVerified':file_count,'rawRecordsVerified':raw_count,'weightedQualitySeedChecks':len(rows)*2,
  'stateQualityIdsMatched':True,'actualPrimaryPcThresholdCalls':0,'hosts':hosts,'analysis':analysis,'sourceCommit':locks[0]['commit'] if locks else None,
  'originalValuesReplaced':False,'productChanged':False,'originalPopulationGateRecomputed':False}
if __name__=='__main__':
 path=Path(sys.argv[1]);report=audit(path)
 with (path/'RETEST_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps({k:v for k,v in report.items() if k!='analysis'},indent=2));print(json.dumps(report['analysis']['summary'],indent=2))
