"""Offline byte-preserving preparation only; no native calls and no launch file."""
from pathlib import Path
import gzip
import hashlib
import json
import sys

EX=Path(__file__).resolve().parent
OLD=Path(sys.argv[1]);SOURCE=OLD/'experiments/a0-m1-retest-20261004'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(name,value):
 with (EX/name).open('x',encoding='utf-8',newline='\n') as f:json.dump(value,f,ensure_ascii=False,indent=2);f.write('\n')
assert not (EX/'launch.json').exists()
selection=load(SOURCE/'SELECTION.json');entries=load(SOURCE/'INPUTS.json')['entries'];records={r['id']:r for r in selection['records']}
packs={};inputs=[]
(EX/'inputs').mkdir()
for e in entries:
 if e['pack'] not in packs:packs[e['pack']]=(OLD/'experiments/a0-integrated-revalidation-20261003'/e['pack']).read_bytes()
 b=packs[e['pack']][e['offset']:e['offset']+e['length']];assert sha(b)==e['sha256']
 m=json.loads(gzip.decompress(b));assert m['identitySha256']==e['identitySha256'] and m['K']==e['K'] and m['primary']['cardinalityProven']
 file='inputs/'+e['id']+'.json.gz';(EX/file).write_bytes(b)
 inputs.append({**e,'file':file,'selectionReasons':records[e['id']]['reasons'],
  'request':{'sourceFumen':m['fixture']['fumen'],'analysisPattern':m['pattern'],
   'unusedPieceFilter':m['filter'],'height':m['geometry']['targetLines'],
   'useHold':True,'exactHumanQuality':'true','primary':'auto','secondary':'auto','exactProbeTiming':True}})
assert len(inputs)==122
controls={p:s['environmentControlId'] for p,s in selection['populations'].items()};runs=[]
def pair(host,block,entry,policies,kind):
 for position,policy in enumerate(policies,1):runs.append({'runId':f'{block}-{position}','blockId':block,'position':position,
  'host':host,'matrixId':entry['id'],'phase':entry['partition'],'policy':policy,'kind':kind})
for host in range(10):
 for phase,id in controls.items():
  e=next(e for e in inputs if e['id']==id)
  for policy in ['reference','a0-m1']:pair(host,f'env-h{host}-{phase}-{policy}',e,[policy,policy],'ENVIRONMENT_CONTROL')
 for rep in range(10):
  order=inputs if rep%2==0 else list(reversed(inputs))
  for e in order:
   forward=(int(e['identitySha256'][:8],16)+host+rep)%2==0
   pair(host,f'h{host}-{e["id"]}-p{rep}',e,['reference','a0-m1'] if forward else ['a0-m1','reference'],'FULL_REQUEST')
assert len(runs)==24480
write('INPUTS.json',{'sourceRunId':37138752420,'sourceCommit':'c6554bce7356fe226693074610e8c7a2177335cb',
 'sourceSelectionSha256':sha((SOURCE/'SELECTION.json').read_bytes()),'same122InputsNotNewScreening':True,'entries':inputs,'environmentControls':controls})
write('SCHEDULE.json',{'jobs':10,'pairsPerInput':100,'pairsPerRunner':10,'actualCalls':24480,'callsPerJob':2448,'selectedCalls':24400,'environmentCalls':80,'runs':runs})
write('CAMPAIGN.json',{'status':'PREPARED_NOT_LAUNCHED','scope':'Single unused-piece filter request: fresh process, original input reconstruction, product compact enumeration, original unused-piece filter, adaptive primary, ordinary100K, real threshold/CP if available, output encoding. Not a full seven-filter UI or probe-only bench.',
 'jobs':10,'maxParallel':10,'pairsPerInput':100,'actualCalls':24480,'memoryBytes':3221225472,'swapBytes':0,
 'startupMs':30000,'probeMs':10000,'apiMs':210000,'processMs':240000,'auditMs':30000,'ackMs':10000,'reapMs':2000,
 'pairAdmissionMs':664000,'computeMinutes':160,'cancelMinutes':175,'overallMinutes':180,
 'jobMinutes':165,'preflightMinutes':20,'runnerHoursUpper':27.833333333333332,'runnerHoursCap':64,
 'searchBudget':100000,'cpDelayMs':60000,'cpLimitMs':120000,'fullRequestTimePrediction':'Unknown; do not assume the47min probe retest predicts full requests. Preserve partials and do not automatically extend budgets.',
 'defaultPromotion':False,'automaticSecondCampaign':False,'partialSubsetCannotPass':True,'launchAuthorizationRequired':True})
print(json.dumps({'inputs':len(inputs),'compressedBytes':sum(e['length'] for e in entries),'calls':len(runs),'jobs':10,'nativeCalls':0,'launchCreated':False},indent=2))
