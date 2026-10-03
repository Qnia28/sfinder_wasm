"""Apply frozen v1 rules to legacy168 runs; no native calls, no raw edits."""
from pathlib import Path
import hashlib
import json
import math
import statistics
import collections
import subprocess

HERE=Path(__file__).resolve().parent;V=HERE.parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-proof-retest-20261003')
EX=REPO/'experiments/a0-proof-retest-20261003'
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
seed='sfinder-retest-v1-20261003'
rank=lambda id:sha((seed+'\n'+id).encode())
schedule=load(REPO/'experiments/a0-integrated-revalidation-20261003/SCHEDULE.json')['runs'];expected={r['runId']:r for r in schedule}
rows=[];sources=[]
for phase,run in [('development',37039906398),('reserved',37041073063)]:
    base=V/f'a0-integrated-revalidation-20261003/github-run-{run}'
    for folder in sorted(base.glob(f'a0i-{phase}-*')):
        p=folder/'runs.jsonl'
        if not p.exists():continue
        for f in load(folder/'FILES.json')['files']:
            b=(folder/f['file']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
        rr=[json.loads(l) for l in p.read_text().splitlines()]
        assert all(r['phase']==phase for r in rr)
        rows+=rr;sources.append({'file':str(p),'sha256':sha(p.read_bytes())})
assert len(rows)==1344 and len({r['runId'] for r in rows})==1344
for r in rows:
    for key,val in expected[r['runId']].items():assert r[key]==val
    assert r['status'] in ['PROBE_EXACT','PROBE_CAPPED'] and r['apiMs']>0
entries=load(REPO/'experiments/a0-integrated-revalidation-20261003/INPUTS.json')['entries'];entryby={e['id']:e for e in entries}
allrecords=[];controls=[];phaseinfo={};env=[]
for phase,count in [('development',64),('reserved',104)]:
    ids=sorted({r['matrixId'] for r in rows if r['phase']==phase});assert len(ids)==count
    records=[]
    for id in ids:
        rr=[r for r in rows if r['matrixId']==id and r['phase']==phase]
        assert len(rr)==8
        times={v:[r['apiMs'] for r in rr if r['variant']==v] for v in ['R','A']}
        ratios=[]
        for rep in range(1,5):
            pair=[r for r in rr if r['repetition']==rep];assert len(pair)==2 and {r['position'] for r in pair}=={1,2} and len({r['shard'] for r in pair})==1
            by={r['variant']:r for r in pair};ratios.append(by['A']['apiMs']/by['R']['apiMs'])
        ratio=statistics.median(ratios)
        complete={v:all(r['probe']['completed'] for r in rr if r['variant']==v) for v in ['R','A']}
        variation={v:max(times[v])/min(times[v]) for v in ['R','A']}
        rec={'matrixId':id,'phase':phase,'mirrorGroup':entryby[id]['mirrorGroup'],'pairEvidence':'EXPLICIT_ORIGINAL_SCHEDULE_SAME_SHARD_REPETITION_POSITION',
            'pairRatios':ratios,'ratio':ratio,'logRatio':math.log(ratio),'legacyRatioOfMedians':statistics.median(times['A'])/statistics.median(times['R']),
            'baselineMedianMs':statistics.median(times['R']),'candidateMedianMs':statistics.median(times['A']),'variantTimesMs':times,'variation':variation,'completed':complete,'selectionReasons':[]}
        for v in ['R','A']:
            if variation[v]>=1.1:rec['selectionReasons'].append('VARIATION_10_PERCENT_'+v)
        if ratio>1.1:rec['selectionReasons'].append('INPUT_SLOWDOWN_GATE_1_10')
        if complete['A']!=complete['R']:rec['selectionReasons'].append('EXACT_STATUS_TRANSITION')
        records.append(rec)
    tails={}
    for kind,group,reverse in [('IMPROVEMENT_TAIL',[r for r in records if r['ratio']<1],False),('REGRESSION_TAIL',[r for r in records if r['ratio']>1],True)]:
        group.sort(key=lambda r:r['logRatio'],reverse=reverse);n=math.ceil(.1*len(group));boundary=group[n-1]['logRatio'] if n else None
        chosen=[r for r in group if (r['logRatio']>=boundary if reverse else r['logRatio']<=boundary)] if n else []
        for r in chosen:r['selectionReasons'].append(kind)
        tails[kind]={'groupSize':len(group),'nominalSelected':n,'includingTies':len(chosen),'boundary':boundary}
    baseline=sorted(r['baselineMedianMs'] for r in records);bounds=[baseline[math.ceil(q*len(baseline))-1] for q in [.25,.5,.75]]
    strata=collections.defaultdict(list)
    for r in records:
        r['baselineQuartile']=sum(r['baselineMedianMs']>b for b in bounds)+1
        r['baselineStatus']='EXACT' if r['completed']['R'] else 'CAPPED'
        if not r['selectionReasons']:strata[(r['baselineQuartile'],r['baselineStatus'])].append(r)
    ctrl=[]
    for key,group in sorted(strata.items()):
        chosen=min(group,key=lambda r:(rank(r['matrixId']),r['matrixId']));chosen['selectionReasons'].append('HASH_STRATIFIED_UNSELECTED_CONTROL');ctrl.append(chosen)
    if ctrl:environment=min(ctrl,key=lambda r:(rank(r['matrixId']),r['matrixId']))
    else:
        median=statistics.median(baseline);environment=min(records,key=lambda r:(abs(r['baselineMedianMs']-median),r['matrixId']))
    env.append({'phase':phase,'matrixId':environment['matrixId']})
    for r in records:r['selected']=bool(r['selectionReasons']);r['selectedAsControl']=r in ctrl
    phaseinfo[phase]={'population':count,'tails':tails,'quartileBoundsMs':bounds,'mainSelected':sum(r['selected'] and not r['selectedAsControl'] for r in records),
        'controlSelected':len(ctrl),'allSelected':sum(r['selected'] for r in records),'environmentControlId':environment['matrixId']}
    allrecords+=records;controls+=ctrl
selected=[r for r in allrecords if r['selected']]
runs=[]
for host in range(5):
    ordered=sorted(selected,key=lambda r:(sha((seed+f'\nhost{host}\n'+r['matrixId']).encode()),r['matrixId']))
    for rec in ordered:
        first=bool(int(rank(rec['matrixId']+f':{host}')[:8],16)&1)
        for rep,order in enumerate(['AR','RA'] if first else ['RA','AR'],1):
            for pos,v in enumerate(order,1):runs.append({'runId':f"retest-h{host}-{rec['matrixId']}-p{rep}-{v}",'matrixId':rec['matrixId'],'phase':rec['phase'],
                'host':host,'repetition':rep,'position':pos,'variant':v,'actualVariant':v,'pairId':f"h{host}-{rec['matrixId']}-p{rep}",'kind':'CONTROL' if rec['selectedAsControl'] else 'SELECTED'})
    for e in env:
        for variant in ['R','A']:
            for pos in [1,2]:runs.append({'runId':f"env-h{host}-{e['phase']}-{variant}-{pos}",'matrixId':e['matrixId'],'phase':e['phase'],'host':host,
                'repetition':0,'position':pos,'variant':variant,'actualVariant':variant,'pairId':f"env-h{host}-{e['phase']}-{variant}",'kind':'ENVIRONMENT_CONTROL'})
assert len(runs)==20*len(selected)+40
maxmed={id:max(r['baselineMedianMs'],r['candidateMedianMs']) for r in selected for id in [r['matrixId']]}
estimated=sum(maxmed[r['matrixId']] if r['matrixId'] in maxmed else next(max(x['baselineMedianMs'],x['candidateMedianMs']) for x in allrecords if x['matrixId']==r['matrixId']) for r in runs)/1000
selection={'schema':'sfinder-retest-selection-v1','rulesSha256':sha((V/'TESTING_RULES_KO.md').read_bytes()),'selectionSeed':seed,'populations':phaseinfo,
    'sourceFiles':sources,'originalScheduleSha256':sha((REPO/'experiments/a0-integrated-revalidation-20261003/SCHEDULE.json').read_bytes()),'records':allrecords,
    'selectedInputs':len(selected),'controlInputs':len(controls),'environmentControls':env,'maxNativeCalls':len(runs),'runnerJobs':5,
    'legacyMedianValuesNotReplaced':True,'wholePopulationGateRecomputedWithNewValues':False,'nativeCallsInPreparation':0,
    'budget':{'estimatedNativeSecondsUsingOldLargerMedian':estimated,'perHostCalls':len(runs)//5,'perCallAdmissionSeconds':167,
        'worstCaseSerialSecondsPerHost':len(runs)//5*167,'jobMinutes':45,'jobs':5,'runnerHoursUpper':3.75,'campaignOverallMinutes':180,
        'admission':'Worst-case remaining call sum does not fit a45min job; each next call independently admitted or NOT_RUN_BUDGET. Expected durations are planning estimates, not completion guarantees.'}}
for p,data in [(HERE/'SELECTION.json',selection),(EX/'RETEST_SELECTION.json',selection),(EX/'RETEST_SCHEDULE.json',{'runs':runs}),
    (EX/'RETEST_INPUTS.json',{'entries':[entryby[r['matrixId']] for r in selected]+[entryby[e['matrixId']] for e in env if e['matrixId'] not in {r['matrixId'] for r in selected}]})]:
    with p.open('x',encoding='utf-8') as f:json.dump(data,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in selection.items() if k not in ['records','sourceFiles']},indent=2))
