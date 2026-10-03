"""Characterize already-sealed F14 repetitions without running any tests."""
from pathlib import Path
import json
import statistics

HERE=Path(__file__).resolve().parent
source=Path('D:/AI/sfinder-wasm/tools/validation/a0-sol-execution-plan-20261003/OLD_TAIL14.json')
tail=json.loads(source.read_text(encoding='utf-8-sig'))
rows=[]
for e in tail['inputs']:
    variants={v:[r for r in e['oldRuns'] if r['variant']==v] for v in ['R','A']}
    rm=statistics.median(r['apiMs'] for r in variants['R']);am=statistics.median(r['apiMs'] for r in variants['A'])
    rec={'matrixId':e['matrixId'],'oldMedianDeltaMs':am-rm,'oldMedianRatio':am/rm,'baselineStates':variants['R'][0]['states'],'candidateStates':variants['A'][0]['states']}
    for v,r in variants.items():
        a=[x['apiMs'] for x in r]
        rec[v]={'samplesMs':a,'rangeMs':max(a)-min(a),'coefficientOfVariation':statistics.stdev(a)/statistics.mean(a),'medianMs':statistics.median(a)}
    rec['withinVariantRangeExceedsMedianDelta']=max(rec['R']['rangeMs'],rec['A']['rangeMs'])>rec['oldMedianDeltaMs']
    rows.append(rec)
report={'status':'OLD_EVIDENCE_ONLY_NOT_NEW_MEASUREMENT','F14':rows,'matricesWithWithinVariantRangeLargerThanObservedDelta':sum(r['withinVariantRangeExceedsMedianDelta'] for r in rows),
    'medianOldPositiveDeltaMs':statistics.median(r['oldMedianDeltaMs'] for r in rows),'nativeCalls':0,
    'limitation':'Four repetitions and outcome-selected F14; variability does not prove the A0 effect is absent'}
with (HERE/'PRIOR_NOISE.json').open('x',encoding='utf-8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in report.items() if k!='F14'},indent=2))
