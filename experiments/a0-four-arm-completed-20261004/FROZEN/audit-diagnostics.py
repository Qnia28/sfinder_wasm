"""Read-only work-count audit; instrumented time never enters performance stats."""
from pathlib import Path
import json
import gzip
import sys
from audit import load,sha,canon,js_sha,EX,REPO

download=Path(sys.argv[1]);paths=[p for p in download.rglob('SUMMARY.json') if p.parent.name=='work-results'];assert len(paths)==1
folder=paths[0].parent;s=load(paths[0]);schedule=load(EX/'DIAGNOSTIC_SCHEDULE.json');assert s['stage']=='WORK_DIAGNOSTIC' and not s['timingEvidence']
assert js_sha(s['lock'])==s['lockSha256'];assert s['lock']['diagnosticScheduleSha256']==js_sha(schedule)
for f in load(folder/'FILES.json')['files']:
 b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
rows=[json.loads(l) for l in (folder/'runs.jsonl').read_text().splitlines()] if (folder/'runs.jsonl').exists() else []
assert [r['runId'] for r in rows]==[r['runId'] for r in schedule['runs']][:len(rows)]
refs=load(EX/'REFERENCES.json')['references'];groups={}
inputs={}
for entry in load(EX/'INPUTS.json')['entries']:
 if entry['id'] not in schedule['inputs']:continue
 with (REPO/'experiments/a0-integrated-revalidation-20261003'/entry['pack']).open('rb') as f:f.seek(entry['offset']);b=f.read(entry['length'])
 assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
 assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256'];inputs[entry['id']]=m
for r in rows:
 assert r['diagnostic'] and not r['timingEvidence'] and not r['synthetic'];assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0
 assert r['options']['stateBudget']==100000 and r['probe']==refs[r['matrixId']]['R' if r['arm']=='R' else 'A0']
 raw=[json.loads(l) for l in (folder/r['rawFile']).read_text().splitlines()];assert [v['type'] for v in raw]==['phase-start','phase-result','audit-result']
 assert raw[1]['raw']==r['probe'] and raw[1]['counters']==r['counters'] and raw[2]['witness']==r['witness']
 m=inputs[r['matrixId']];idx={k:i for i,k in enumerate(m['keys'])};p=r['probe'];chosen={idx[k] for k in p['keys']}
 assert len(chosen)==p['count']==m['K'];quality=lambda ids:sorted(max((q for i,q in row if i in ids),default=0) for row in m['rows'])
 q=quality(chosen);assert q[0]>0 and q==p['qualityVector'] and q>=quality({idx[k] for k in m['seedKeys']})
 assert r['witness']=={'selectedIDs':sorted(chosen),'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
 assert r['wasmSha256']==s['lock']['diagnosticBuild']['outputs'][r['arm']]['wasmSha256']
 assert r['resources']['memoryMaxBytes']==3221225472 and r['resources']['swapMaxBytes']==0 and r['resources']['cgroupEvents']['oom_kill']==0
 assert all(isinstance(v,int) and v>=0 for v in r['counters'].values());groups.setdefault(r['matrixId'],{})[r['arm']]=r
results=[]
for id,by in groups.items():
 if set(by)!=set(['R','A0','M1','M2']):continue
 a,m1,m2=[by[x]['counters'] for x in ['A0','M1','M2']]
 assert by['A0']['probe']==by['M1']['probe']==by['M2']['probe']
 assert m1['boundCalls']==a['boundCalls'] and m1['prunes']==a['prunes'] and m1['trailPushes']==a['trailPushes']
 assert m1['boundWords']<=a['boundWords'] and m1['boundCandidates']<=a['boundCandidates']
 assert m2['boundCalls']==a['boundCalls'] and m2['boundWords']==a['boundWords'] and m2['prunes']==a['prunes']
 assert m2['trailPushes']+m2['avoidedTrailPushes']==a['trailPushes']
 results.append({'matrixId':id,'counters':{arm:row['counters'] for arm,row in by.items()},
  'm1BoundWordRatio':m1['boundWords']/a['boundWords'] if a['boundWords'] else None,
  'm2TrailPushRatio':m2['trailPushes']/a['trailPushes'] if a['trailPushes'] else None,
  'sameA0StatesQualityIds':True,'timingEvidence':False})
report={'status':'COMPLETE_WORK_COUNTS_AUDITED' if len(rows)==20 and s['status']=='COMPLETE' else 'PRESERVED_PARTIAL','calls':len(rows),'results':results,'timingEvidence':False,'weightedQualitySeedRecalculations':2*len(rows),'actualPrimaryPcThresholdCalls':0}
with (download/'WORK_DIAGNOSTIC_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report,indent=2))
