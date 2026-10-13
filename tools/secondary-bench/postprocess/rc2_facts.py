"""R18 saved raw projection and descriptive paired statistics; no verdict/solver."""
import argparse,collections,csv,json,sqlite3,statistics
from pathlib import Path
from package import sha,write

def mean(values):
    values=list(values)
    return statistics.mean(values) if values else None

def build(audit,out):
    report=json.loads((audit/'INDEPENDENT_AUDIT.json').read_text())
    if report['status']!='PASS' or report['calls']!=1560: raise ValueError('R18 audit not complete')
    with sqlite3.connect((audit/'RAW.sqlite').as_uri()+'?mode=ro',uri=True) as db:
        if db.execute('PRAGMA quick_check').fetchone()!=('ok',): raise ValueError('raw integrity')
        rows=[json.loads(r[0]) for r in db.execute('SELECT raw FROM records')]
    calls=[]
    for r in rows:
        e=r['execution'];scope=e['memoryScope']
        calls.append(dict(callId=r['callId'],inputId=r['inputId'],phase=r['phase'],repeat=r['repeat'],variant=r['variant'],role=r['role'],runnerId=r['runnerId'],position=r['position'],status=r['status'],ms=r['ms'],supervisorWallMs=r['supervisorWallMs'],peakBytes=scope['peakBytes'],cpuUsec=scope['cpuUsec'],
            failurePenalized600Ms=r['ms'] if r['status']=='EXACT' else 600000))
    index={(r['inputId'],r['phase'],r['repeat'],r['variant']):r for r in calls}
    if len(index)!=1560: raise ValueError('duplicate/missing calls')
    pairs=[]
    for d in calls:
        if d['variant']!='DEV':continue
        c=index[d['inputId'],d['phase'],d['repeat'],'RC2']
        if d['runnerId']!=c['runnerId']:raise ValueError('nonadjacent VM')
        exact=d['status']==c['status']=='EXACT'
        pairs.append(dict(inputId=d['inputId'],phase=d['phase'],repeat=d['repeat'],role=d['role'],devCall=d['callId'],rc2Call=c['callId'],devStatus=d['status'],rc2Status=c['status'],devMs=d['ms'],rc2Ms=c['ms'],commonExact=exact,
            exactGainMs=d['ms']-c['ms'] if exact else None,observedWallGainMs=d['supervisorWallMs']-c['supervisorWallMs'],failurePenalized600GainMs=d['failurePenalized600Ms']-c['failurePenalized600Ms'],peakDeltaBytes=c['peakBytes']-d['peakBytes']))
    def stats(pp):
        ids={p['devCall'] for p in pp}|{p['rc2Call'] for p in pp};rr=[r for r in calls if r['callId'] in ids];ee=[p for p in pp if p['commonExact']]
        return dict(pairs=len(pp),transitions=dict(collections.Counter(p['devStatus']+'->'+p['rc2Status'] for p in pp)),commonExactPairs=len(ee),commonExactDevMeanMs=mean(p['devMs'] for p in ee),commonExactRc2MeanMs=mean(p['rc2Ms'] for p in ee),commonExactGainMs=sum(p['exactGainMs'] for p in ee),failurePenalized600MeanGainMs=mean(p['failurePenalized600GainMs'] for p in pp),observedWallMeanGainMs=mean(p['observedWallGainMs'] for p in pp),arms={arm:dict(statuses=dict(collections.Counter(r['status'] for r in rr if r['variant']==arm)),cpuMeanUsec=mean(r['cpuUsec'] for r in rr if r['variant']==arm),peakMeanBytes=mean(r['peakBytes'] for r in rr if r['variant']==arm),failurePenalized600MeanMs=mean(r['failurePenalized600Ms'] for r in rr if r['variant']==arm)) for arm in ['DEV','RC2']})
    groups={}
    for role in ['ALL','PER_SAVE']:
        for phase in ['ALL_ROUNDS','RC2_VALIDATION_1','RC2_VALIDATION_2','RC2_VALIDATION_3']:
            groups[role+'/'+phase]=stats([p for p in pairs if p['role']==role and (phase=='ALL_ROUNDS' or p['phase']==phase)])
    inputs=[dict(inputId=id,role=next(p['role'] for p in pairs if p['inputId']==id),**stats([p for p in pairs if p['inputId']==id])) for id in sorted({p['inputId'] for p in pairs})]
    out.mkdir(parents=True,exist_ok=False)
    db=sqlite3.connect(out/'R18.sqlite')
    for name,values in [('calls',calls),('pairs',pairs),('inputs',inputs)]:
        db.execute(f'CREATE TABLE {name}(raw TEXT NOT NULL)')
        db.executemany(f'INSERT INTO {name} VALUES(?)',[(json.dumps(v,sort_keys=True),) for v in values])
        (out/(name+'.jsonl')).write_text(''.join(json.dumps(v,sort_keys=True)+'\n' for v in values),encoding='utf8')
        if name!='inputs':
            with (out/(name+'.csv')).open('x',encoding='utf-8-sig',newline='') as stream:
                writer=csv.DictWriter(stream,fieldnames=list(values[0]));writer.writeheader();writer.writerows(values)
    db.commit();db.close()
    facts=dict(runId=38241601404,rawSha256=sha(audit/'RAW.sqlite'),auditSha256=sha(audit/'INDEPENDENT_AUDIT.json'),calls=len(calls),pairs=len(pairs),groups=groups,
        metrics=dict(exactGainMs='DEV minus RC2 only when both EXACT; positive favors RC2',failurePenalized600Ms='EXACT product ms; every timeout/OOM receives fixed 600000 failure penalty. Sensitivity score, NOT observed solve time or proof of eventual completion.',observedWallGainMs='Observed supervisor cost including failed calls. Early OOM is NOT a performance success.'),solverCalls=0,performanceDecision=None)
    write(out/'FACTS.json',facts)
    print(json.dumps(facts,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--audit',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();build(a.audit.resolve(),a.out.resolve())
