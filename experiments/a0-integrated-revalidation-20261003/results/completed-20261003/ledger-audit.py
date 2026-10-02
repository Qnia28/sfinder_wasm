"""Extra journal/start/deadline/resource audit. No native solver calls."""
from pathlib import Path
import collections
import hashlib
import json
import sys

download=Path(sys.argv[1]);phase=sys.argv[2];out=Path(sys.argv[3])
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def canonical(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
count=0;shards=set();statuses=collections.Counter();phase_raw=0;contract_checks=0
peak_max=0;rss_max=0;wasm_max=0;api_max=0;ids=set();cap_states=collections.Counter()
for d in sorted(download.glob(f'a0i-{phase}-*')):
    if not (d/'SHARD.json').exists():continue
    s=load(d/'SHARD.json');assert s['shard'] not in shards;shards.add(s['shard'])
    starts=[json.loads(l) for l in (d/'starts.jsonl').read_text().splitlines() if l.strip()]
    rows=[json.loads(l) for l in (d/'runs.jsonl').read_text().splitlines() if l.strip()]
    assert len(starts)==len(rows)==s['observedRuns']
    assert [{k:v for k,v in r.items() if k!='utc'} for r in starts]==s['scheduledRuns'][:len(rows)]
    for start,r in zip(starts,rows):
        assert start['runId']==r['runId'] and r['runId'] not in ids;ids.add(r['runId'])
        assert r['code']==0 and r['signal'] is None and not r['stderr']
        assert r['status'] in ['PROBE_EXACT','PROBE_CAPPED'];statuses[r['status']]+=1;count+=1
        raw=[json.loads(l) for l in (d/r['rawFile']).read_text().splitlines() if l.strip()]
        assert [p['type'] for p in raw]==['phase-start','phase-result','audit-result']
        start_phase,result_phase,audit_phase=raw
        assert start_phase['engine']==result_phase['engine']=='integrated'
        assert result_phase['raw']==r['probe'] and result_phase['options']==r['options']
        assert result_phase['apiMs']==r['apiMs'] and result_phase['elapsedMs']>=start_phase['elapsedMs']
        assert 0<r['apiMs']<10000 and 0<=r['verificationMs']<30000 and r['processWallMs']<90000
        assert audit_phase['result']['witness']==r['witness'] and audit_phase['result']['contract']==r['contract']
        assert result_phase['resources']['cgroupPeakBytes']<=r['resources']['cgroupPeakBytes']
        assert result_phase['resources']['memoryMaxBytes']==r['resources']['memoryMaxBytes']==3221225472
        assert result_phase['resources']['swapMaxBytes']==r['resources']['swapMaxBytes']==0
        assert r['resources']['cgroupCurrentBytes']<=64*2**20
        assert r['resources']['cgroupEvents']['oom']==r['resources']['cgroupEvents']['oom_kill']==0
        if not r['probe']['completed']:
            contract_checks+=len(r['contract']['directAndDeferred']);cap_states[r['probe']['searchedStates']]+=1
        phase_raw+=1;peak_max=max(peak_max,r['resources']['cgroupPeakBytes']);rss_max=max(rss_max,r['samplePeakRssBytes']);wasm_max=max(wasm_max,r['wasmBytes']);api_max=max(api_max,r['apiMs'])
report={'status':'START_RAW_AUDIT_RESOURCE_LEDGER_VERIFIED','phase':phase,'observedRuns':count,'uniqueRunIds':len(ids),'shards':len(shards),'statuses':dict(statuses),
        'rawResultPersistedBeforeAuditRecords':phase_raw,'contractOnlyThresholdChecks':contract_checks,'cappedStateCounts':dict(cap_states),
        'maxCgroupPeakBytes':peak_max,'maxProcessRssBytes':rss_max,'maxWasmMemoryBytes':wasm_max,'maxIntegratedApiMs':api_max,
        'actualInputNativeThresholdCalls':0,'actualInputPrimaryCalls':0,'actualInputPcCalls':0,'devApplied':False}
out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
