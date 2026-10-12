"""Saved R15 evidence -> proposed RC2 secondary-CP impact set. No execution."""
import argparse,collections,csv,hashlib,json,sqlite3
from pathlib import Path

def build(source,out):
    database=source/'ANALYSIS.sqlite'
    db=sqlite3.connect('file:'+database.as_posix()+'?mode=ro',uri=True)
    rows=[json.loads(r[0]) for r in db.execute('SELECT raw FROM calls')];db.close()
    assert len(rows)==13176 and len({r['callId'] for r in rows})==13176
    groups=collections.defaultdict(list)
    for r in rows:groups[r['inputId']].append(r)
    assert len(groups)==1098
    selected=[];counts=collections.Counter();reasonPop=collections.defaultdict(collections.Counter)
    for inputId,rs in sorted(groups.items()):
        assert collections.Counter(r['variant'] for r in rs)=={'DEV':6,'RC':6}
        assert len({r['inputHash'] for r in rs})==1
        reasons=collections.defaultdict(list)
        for r in rs:
            outcomes=(r['execution'].get('result') or {}).get('outcomes') or {}
            if any(o.get('qualityBackend')=='ortools-quality-cpsat' for o in outcomes.values()):reasons['SECONDARY_CP_WIN'].append(r['callId'])
            if r['status']!='EXACT':reasons['NONEXACT_CP_UNKNOWN'].append(r['callId'])
            if r['status']=='EXACT' and r['ms']>=60000:reasons['GE60S_CP_UNKNOWN'].append(r['callId'])
            if r['status']=='EXACT' and 50000<=r['ms']<60000:reasons['50_60S_BOUNDARY'].append(r['callId'])
        if not reasons:continue
        population=rs[0]['role'];core=any(k!='50_60S_BOUNDARY' for k in reasons)
        for k in reasons:counts[k]+=1;reasonPop[k][population]+=1
        selected.append(dict(inputId=inputId,inputHash=rs[0]['inputHash'],population=population,family=rs[0]['metadata']['family'],selection='CORE' if core else 'BOUNDARY_ONLY',evidence=dict(reasons)))
    assert len(selected)==130 and sum(r['selection']=='CORE' for r in selected)==124
    mandatory=['c7-2plus2-qb-row-068/restricted-split','c7-2plus2-qb-row-293/restricted-split','c7-2plus2-qb-row-321/all/restricted-split','c7-2plus2-qb-row-318/all/restricted-split']
    assert set(mandatory)<={r['inputId'] for r in selected}
    out.mkdir(parents=True,exist_ok=False)
    summary=dict(status='PROPOSED_SELECTION_NOT_EXECUTION_MANIFEST',sourceRunId=38072016117,sourceDatabaseSha256=hashlib.sha256(database.read_bytes()).hexdigest(),sourceAudit=json.loads((source/'SOURCE.json').read_text(encoding='utf8')),sourceCalls=len(rows),sourceInputs=len(groups),selectedInputs=len(selected),population=dict(collections.Counter(r['population'] for r in selected)),coreInputs=124,boundaryOnlyInputs=6,reasons=dict(counts),reasonPopulation={k:dict(v) for k,v in reasonPop.items()},boundaryProposalMs=50000,cpStartDelayMs=60000,selectionRule='Union over DEV/RC and all six repeats; winner is positive evidence only; total wall is a conservative screen, not proof of CP start',repeatsPerArm=6,twoArmCalls=1560,threeArmCalls=2340,solverCalls=0,dispatch=False)
    (out/'SELECTION.json').write_text(json.dumps(dict(summary=summary,inputs=selected),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    with (out/'CANDIDATES.csv').open('x',encoding='utf-8-sig',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=['inputId','inputHash','population','family','selection','evidence']);writer.writeheader()
        writer.writerows({**r,'evidence':json.dumps(r['evidence'],sort_keys=True)} for r in selected)
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);args=p.parse_args();build(args.source,args.out)
