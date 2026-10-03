"""Post-run raw/source/weighted witness audit. No solver invocation."""
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
    schedule=load(EX/'SCHEDULE.json')['runs'];expected={r['runId']:r for r in schedule};assert len(expected)==4960
    records=load(EX/'SELECTION.json')['records'];refs=load(EX/'REFERENCES.json')['references'];inputs={}
    for entry in load(EX/'INPUTS.json')['entries']:
        p=REPO/'experiments/a0-integrated-revalidation-20261003'/entry['pack']
        with p.open('rb') as f:f.seek(entry['offset']);b=f.read(entry['length'])
        assert sha(b)==entry['sha256'];m=json.loads(gzip.decompress(b));assert m['primary']['cardinalityProven']
        assert sha(canon({k:m[k] for k in ['keys','rows','K','seedKeys']}))==entry['identitySha256'];inputs[entry['id']]=m
    summaries=[p for p in download.rglob('SUMMARY.json') if p.parent.name in ['0','1','2','3','4']]
    assert len(summaries)<=5
    builds=[p for p in download.rglob('BUILD.json') if (p.parent/'runtime').exists()];assert len(builds)==1;build_root=builds[0].parent
    verified_sources=set();rows=[];outcomes=[];raw_count=0;source_count=0;result_count=0;hosts=[]
    for sp in summaries:
        s=load(sp);folder=sp.parent;lock=s['lock'];assert js_sha(lock)==s['lockSha256']
        assert lock['build']['benchmarkEligible'] and lock['build']==load(builds[0]) and s['origin']==lock['origin']
        assert lock['campaign']==load(EX/'CAMPAIGN.json');assert not s['clockReset'];assert s['expectedCalls']==992
        assert lock['selectionSha256']==js_sha(load(EX/'SELECTION.json')) and lock['scheduleSha256']==js_sha(load(EX/'SCHEDULE.json'))
        assert lock['referencesSha256']==js_sha(load(EX/'REFERENCES.json'))
        if lock['commit'] not in verified_sources:
            for f in lock['files']:
                assert sha(subprocess.check_output(['git','-C',str(REPO),'show',f"{lock['commit']}:{f['file']}"]))==f['sha256'];source_count+=1
            for f in lock['runtimeFiles']:assert sha((build_root/f['file'].removeprefix('.a0/four/')).read_bytes())==f['sha256']
            verified_sources.add(lock['commit'])
        for f in load(folder/'FILES.json')['files']:
            b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];result_count+=1
        rr=[json.loads(l) for l in (folder/'runs.jsonl').read_text().splitlines()] if (folder/'runs.jsonl').exists() else []
        oo=[json.loads(l) for l in (folder/'outcomes.jsonl').read_text().splitlines()] if (folder/'outcomes.jsonl').exists() else []
        assert len(rr)==s['verifiedCalls'] and len(oo)==s['attemptedCalls']
        assert [o['runId'] for o in oo]==[r['runId'] for r in schedule if r['host']==s['host']][:len(oo)]
        for r in rr:
            assert all(r[k]==v for k,v in expected[r['runId']].items());assert not r['synthetic'] and r['profile'] is None
            raw=[json.loads(l) for l in (folder/r['rawFile']).read_text().splitlines()]
            assert [v['type'] for v in raw]==['phase-start','phase-result','audit-result'];raw_count+=3
            assert raw[1]['raw']==r['probe'] and raw[1]['options']==r['options'] and raw[1]['apiMs']==r['apiMs']
            assert raw[2]['witness']==r['witness'] and raw[2]['contract']==r['contract']
            m=inputs[r['matrixId']];p=r['probe'];idx={k:i for i,k in enumerate(m['keys'])};chosen={idx[k] for k in p['keys']}
            assert p['count']==len(chosen)==m['K'];quality=lambda ids:sorted(max((q for i,q in row if i in ids),default=0) for row in m['rows'])
            q=quality(chosen);assert q[0]>0 and q==p['qualityVector'] and q>=quality({idx[k] for k in m['seedKeys']})
            assert r['witness']=={'selectedIDs':sorted(chosen),'qualitySha256':sha(canon(q)),'seedSha256':sha(canon(m['seedKeys'])),'originalRowCount':len(q)}
            assert p==refs[r['matrixId']]['R' if r['arm']=='R' else 'A0'],'arm state/quality/ID/status mismatch'
            assert r['primaryProofSha256']==sha(canon(m['primary'])) and r['seedKeysSha256']==sha(canon(m['seedKeys']))
            assert r['options']['seedKeys']==m['seedKeys'] and r['options']['stateBudget']==100000 and r['options']['integrated']
            assert bool(r['options'].get('partitioned'))==(r['arm']!='R') and not r['options'].get('dominance')
            assert r['actualPrimaryCalls']==r['actualPcCalls']==r['nativeThresholdCalls']==0 and r['worker']['callCount']==1 and r['worker']['cpu']=='UNPINNED'
            assert r['wasmSha256']==lock['build']['outputs'][r['arm']]['wasmSha256'] and 0<r['apiMs']<10000
            assert 1<=p['searchedStates']<=100000 and p['completed']==(r['status']=='PROBE_EXACT')
            if not p['completed']:
                c=r['contract'];assert c['nativeThresholdCalls']==0 and c['incomingProbeSha256']==sha(canon(p)) and len(c['calls'])==2
                assert all(call=={'K':m['K'],'seedKeys':p['keys'],'lockedPrefix':[]} for call in c['calls'])
            resource=r['resources'];assert resource['memoryMaxBytes']==3221225472 and resource['swapMaxBytes']==0 and resource['cgroupEvents']['oom_kill']==0
        assert len({r['worker']['pid'] for r in rr})==len(rr)
        rows+=rr;outcomes+=oo;hosts.append({'host':s['host'],'status':s['status'],'runtime':s['runtime'],'verified':len(rr),'attempted':len(oo),'stopReason':s['stopReason']})
    assert len({r['runId'] for r in rows})==len(rows)
    # ERROR_CLOSE rows remain raw evidence but are never analyzed as successful observations.
    ok={o['runId'] for o in outcomes if o['status']=='VERIFIED'};analysis=analyze(records,[r for r in rows if r['runId'] in ok])
    report={'status':'COMPLETE_INDEPENDENTLY_AUDITED' if len(ok)==4960 and len(outcomes)==4960 else 'PRESERVED_PARTIAL',
        'expectedCalls':4960,'verifiedCalls':len(ok),'rawRowsAudited':len(rows),'outcomes':dict(collections.Counter(o['status'] for o in outcomes)),
        'rawRecordsVerified':raw_count,'sourceBlobsVerified':source_count,'resultFilesVerified':result_count,'hosts':hosts,
        'fullWeightedQualitySeedChecks':len(rows)*2,'referencesAndStatesMatched':True,'actualPrimaryPcThresholdCalls':0,
        'originalGateRecomputed':False,'productChanged':False,'analysis':analysis}
    return report

if __name__=='__main__':
    path=Path(sys.argv[1]);report=audit(path)
    with (path/'FOUR_ARM_AUDIT.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({k:v for k,v in report.items() if k!='analysis'},indent=2))
