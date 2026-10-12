"""Project saved R17 factorial evidence. No solver imports, no authored verdict."""
import argparse,collections,csv,hashlib,importlib.util,itertools,json,sqlite3
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit_base',Path(__file__).parents[1]/'common/triage/independent-audit.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
CAMPAIGN='RC_REGRESSION_R17_FACTORIAL_20261012'
def build(artifacts,out):
    out.mkdir(parents=True,exist_ok=False)
    lock=base.read(artifacts/('triage-lock-'+CAMPAIGN)/'LOCK.json');base.snapshot(artifacts/('triage-lock-'+CAMPAIGN))
    audit=base.read(artifacts/('triage-independent-'+CAMPAIGN+'-FINAL')/'INDEPENDENT_AUDIT.json')
    assert audit['status']=='PASS' and audit['calls']==64,audit
    calls=[];traces=[];segments=[];stages=[]
    for chunk in range(8):
        root=artifacts/f'triage-data-{CAMPAIGN}-worker-{chunk}';base.snapshot(root)
        assert base.read(root/'LOCK.json')==lock
        assert base.sha(root/'FACTOR_PATCHES.json')==lock['manifest']['factorPatchSha256']
        for position in range(8):
            directory=root/f'part-{position}';base.snapshot(directory)
            raw=[json.loads(l) for l in (directory/'raw.jsonl').read_text().splitlines()];assert len(raw)==1;r=raw[0];e=r['execution'];arm=r['variant']
            row=dict(callId=r['callId'],inputId=r['inputId'],arm=arm,P=int(arm[1]),C=int(arm[3]),M=int(arm[5]),repeat=r['repeat'],chunk=chunk,position=position,status=r['status'],ms=r['ms'],cpuUsec=e['memoryScope']['cpuUsec'],peakBytes=e['memoryScope']['peakBytes'],supervisorWallMs=r['supervisorWallMs'],source=(directory/'raw.jsonl').relative_to(artifacts).as_posix())
            events=[]
            for f in (directory/'diagnostic-traces').glob('*.jsonl'):
                for line,text in enumerate(f.read_text().splitlines(),1):
                    event=json.loads(text);assert event['pid']==e['pid'];event.update(callId=r['callId'],source=f.relative_to(artifacts).as_posix(),line=line);events.append(event)
            events.sort(key=lambda v:(int(v['monotonicNs']),v['threadId'],v['seq']));traces.extend(events)
            main=[v for v in events if v['threadId']==0];kpiece={};piece='ALL'
            for event in main:
                if event['event']=='piece-start':piece=event['details']['piece']
                if event['event']=='primary-end':
                    k=event['details']['K'];assert k not in kpiece,'K mapping is only valid for these frozen inputs';kpiece[k]=piece
            row['completedPieces']=[v['details']['piece'] for v in main if v['event']=='piece-completed'];calls.append(row)
            taskEvents=[v for v in events if v['event']=='secondary-worker-task']
            groups=[]
            if taskEvents:
                for i,start in enumerate(taskEvents):
                    end=int(taskEvents[i+1]['monotonicNs']) if i+1<len(taskEvents) else float('inf')
                    groups.append((start,[v for v in events if int(start['monotonicNs'])<=int(v['monotonicNs'])<end]))
            else:
                start=next(v for v in events if v['event']=='secondary-structure');groups=[(start,events)]
            for start,group in groups:
                structure=next(v for v in group if v['event']=='secondary-structure');k=structure['details']['structure']['count'];piece=kpiece[k]
                at=lambda v:(int(v['monotonicNs'])-int(start['monotonicNs']))/1e6
                s=dict(callId=r['callId'],inputId=r['inputId'],arm=arm,repeat=r['repeat'],piece=piece,K=k,d=structure['details']['structure']['unforcedSlots'],startUtc=start['utc'],source=start['source'],line=start['line'])
                endings=[v for v in group if v['event']=='engine-message' and v['details'].get('completed') is True]
                winner=endings[0] if endings else None;s['winner']=winner['details']['engine'] if winner else None;s['winnerMs']=at(winner) if winner else None
                cp=next((v for v in group if v['event']=='engine-start' and v['details']['engine']=='cpsat'),None)
                s['cpStartMs']=at(cp) if cp else None;s['cpWallMs']=at(winner)-at(cp) if cp and s['winner']=='cpsat' else None
                s['seedHash']=next((v['details']['sha256'] for v in group if v['event']=='threshold-seed'),None)
                s['cpErrors']=[v['details'] for v in group if v['event']=='engine-error']
                segments.append(s)
                ready=None
                for v in group:
                    if v['event']=='cp-stage-model-ready':ready=v
                    if v['event']=='cp-stage-solve-return':
                        assert ready is not None
                        stages.append(dict(callId=r['callId'],inputId=r['inputId'],arm=arm,repeat=r['repeat'],piece=piece,**v['details'],ms=(int(v['monotonicNs'])-int(ready['monotonicNs']))/1e6,source=v['source'],line=v['line']))
                        ready=None
                if ready:stages.append(dict(callId=r['callId'],inputId=r['inputId'],arm=arm,repeat=r['repeat'],piece=piece,**ready['details'],ms=None,status='NO_STAGE_RETURN_OBSERVED',source=ready['source'],line=ready['line']))
    assert len(calls)==len({r['callId'] for r in calls})==64
    contrasts=[]
    for r in calls:
        for factor in ['P','C','M']:
            if r[factor]!=0:continue
            other=next(v for v in calls if v['inputId']==r['inputId'] and v['repeat']==r['repeat'] and v[factor]==1 and all(v[f]==r[f] for f in ['P','C','M'] if f!=factor))
            both=r['status']==other['status']=='EXACT'
            contrasts.append(dict(inputId=r['inputId'],repeat=r['repeat'],factor=factor,arm0=r['arm'],arm1=other['arm'],call0=r['callId'],call1=other['callId'],status0=r['status'],status1=other['status'],ms0=r['ms'],ms1=other['ms'],deltaMs=other['ms']-r['ms'] if both else None,ratio=other['ms']/r['ms'] if both else None))
    assert len(contrasts)==96
    db=sqlite3.connect(out/'FACTORIAL.sqlite')
    for name,records in [('calls',calls),('segments',segments),('stages',stages),('contrasts',contrasts),('traces',traces)]:
        db.execute(f'CREATE TABLE {name}(raw TEXT NOT NULL)');db.executemany(f'INSERT INTO {name} VALUES(?)',[(base.encode(r),) for r in records])
        (out/(name+'.jsonl')).write_text(''.join(base.encode(r)+'\n' for r in records),encoding='utf8')
        if name!='traces':
            fields=list(dict.fromkeys(k for r in records for k in r))
            with (out/(name+'.csv')).open('x',encoding='utf-8-sig',newline='') as f:
                w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows({k:base.encode(v) if isinstance(v,(dict,list)) else v for k,v in r.items()} for r in records)
    db.commit();assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close()
    facts=dict(runId=lock['invocationId'],manifestHash=lock['manifestHash'],calls=64,contrasts=96,sourceAudit=audit,statuses=dict(collections.Counter(r['status'] for r in calls)),solverCalls=0,performanceDecision=None)
    (out/'FACTS.json').write_text(base.encode(facts)+'\n',encoding='utf8');print(base.encode(facts))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--artifacts',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();build(a.artifacts,a.out)
