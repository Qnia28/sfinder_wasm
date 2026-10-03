"""Copy only authorized diagnosis metadata and byte-preserved compressed segments."""
from pathlib import Path
import hashlib
import json
root=Path(__file__).resolve().parent
plan=Path('D:/AI/sfinder-wasm/tools/validation/a0-sol-execution-plan-20261003')
original=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-integrated-bench-20261002/experiments/integrated-bench-20261002')
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
for f in load(plan/'FILES_SEAL.json')['files']:assert sha((plan/f['file']).read_bytes())==f['sha256']
inp=load(plan/'INPUTS.json');schedule=load(plan/'SCHEDULE.json')
ids=set(inp['diagnostic']['failed14']+[m['matchId'] for m in inp['diagnostic']['matched14']]+inp['diagnostic']['capped4'])
assert len(ids)==32
entries=[];chunks=[];offset=0
for e in inp['entries']:
    if e['id'] not in ids:continue
    with (original/e['pack']).open('rb') as f:f.seek(e['offset']);b=f.read(e['length'])
    assert sha(b)==e['sha256']
    entries.append({**e,'sourcePack':e['pack'],'sourceOffset':e['offset'],'pack':'inputs/diagnosis.bin','offset':offset})
    offset+=len(b);chunks.append(b)
runs=[r for r in schedule['runs'] if r['stage'] in ['diagnostic','aa-control','profile']]
assert len(runs)==2560
(root/'inputs').mkdir(exist_ok=True)
b=b''.join(chunks);assert len(b)<25*2**20
with (root/'inputs/diagnosis.bin').open('xb') as f:f.write(b)
def write(name,obj):
    with (root/name).open('x',encoding='utf-8') as f:json.dump(obj,f,indent=2);f.write('\n')
write('INPUTS.json',{'entries':entries,'diagnostic':inp['diagnostic'],'packSha256':sha(b),'packBytes':len(b),'sourcePlanSealSha256':sha((plan/'FILES_SEAL.json').read_bytes()),'additional64AccessAllowed':False})
write('SCHEDULE.json',{'runs':runs,'nativeThresholdCalls':0,'confirmationCalls':0,'syntheticConnectionCalls':0,'actualPrimaryCalls':0,'actualPcCalls':0})
(root/'OLD_TAIL14.json').write_bytes((plan/'OLD_TAIL14.json').read_bytes())
print(json.dumps({'diagnosticMatrices':32,'diagnosticCalls':2560,'packedBytes':len(b),'decodedMatrices':0,'performancePromotionCampaign':False}))
