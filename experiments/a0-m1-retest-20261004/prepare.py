"""Write-once selection from sealed four-arm screening; no solver calls."""
from pathlib import Path
import collections
import hashlib
import itertools
import json
import math
import statistics

EX=Path(__file__).resolve().parent;ROOT=EX.parent.parent
EVIDENCE=Path('D:/AI/sfinder-wasm/tools/validation/a0-four-arm-execution-20261004')
D=EVIDENCE/'github-run-37134463920';ARMS=['R','A0','M1'];COMPARISONS=[('A0','R'),('M1','R'),('M1','A0')]
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(name,v):
 assert not (EX/'launch.json').exists(),'Preparation must stop once launch is frozen'
 with (EX/name).open('w',encoding='utf-8',newline='\n') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')
assert load(D/'FOUR_ARM_AUDIT.json')['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
seal=load(EVIDENCE/'SEAL.json');sources=[];allrows=[]
for p in sorted(D.rglob('runs.jsonl')):
 if p.parent.name not in ['0','1','2','3','4']:continue
 rel=p.relative_to(EVIDENCE).as_posix();b=p.read_bytes();item=next(f for f in seal['files'] if f['file']==rel)
 assert len(b)==item['bytes'] and sha(b)==item['sha256'];sources.append(item)
 allrows.extend(json.loads(l) for l in b.decode().splitlines())
assert len(allrows)==4960
records=load(ROOT/'experiments/a0-four-arm-20261003/SELECTION.json')['records']
byid={r['id']:r for r in records};groups=collections.defaultdict(dict)
for r in allrows:
 if r['kind']!='ENVIRONMENT_CONTROL':groups[r['blockId']][r['arm']]=r
screen=[]
for id in sorted(byid):
 rows=[r for r in allrows if r['matrixId']==id and r['kind']!='ENVIRONMENT_CONTROL']
 blocks=[b for b in groups.values() if b['R']['matrixId']==id];assert len(blocks)==10
 stats={}
 for n,d in COMPARISONS:
  ratios=[b[n]['apiMs']/b[d]['apiMs'] for b in blocks]
  stats[f'{n}/{d}']={'medianRatio':statistics.median(ratios),'ratios':ratios,'medianDeltaMs':statistics.median(b[n]['apiMs']-b[d]['apiMs'] for b in blocks)}
 variation={}
 for arm in ARMS:
  rr=[r for r in rows if r['arm']==arm];times=[r['apiMs'] for r in rr]
  variation[arm]={'overallMaxToMin':max(times)/min(times),'medianMs':statistics.median(times),
   'withinHostMaxToMin':[max(t)/min(t) for h in range(5) if (t:=[r['apiMs'] for r in rr if r['host']==h])],
   'statuses':sorted({r['status'] for r in rr}),'searchedStates':sorted({r['probe']['searchedStates'] for r in rr})}
 screen.append({'id':id,'phase':byid[id]['phase'],'comparisons':stats,'variation':variation,'originalReasons':byid[id]['reasons']})
reasons={r['id']:[] for r in screen};phases={};seed='m1-retest-v1'
for phase in ['development','reserved']:
 population=[r for r in screen if r['phase']==phase];tails={}
 for n,d in COMPARISONS:
  key=f'{n}/{d}';tails[key]={}
  for direction in ['IMPROVEMENT','REGRESSION']:
   candidates=[r for r in population if (r['comparisons'][key]['medianRatio']<1 if direction=='IMPROVEMENT' else r['comparisons'][key]['medianRatio']>1)]
   candidates.sort(key=lambda r:(r['comparisons'][key]['medianRatio']*(1 if direction=='IMPROVEMENT' else -1),r['id'].encode()))
   count=math.ceil(len(candidates)*.1)
   selected=[r for r in candidates if (r['comparisons'][key]['medianRatio']<=candidates[count-1]['comparisons'][key]['medianRatio'] if direction=='IMPROVEMENT' else r['comparisons'][key]['medianRatio']>=candidates[count-1]['comparisons'][key]['medianRatio'])] if count else []
   tails[key][direction]={'groupSize':len(candidates),'ceil10Percent':count,'selected':[r['id'] for r in selected]}
   for r in selected:reasons[r['id']].append(f'{key}:{direction}_TAIL')
  for r in population:
   if r['comparisons'][key]['medianRatio']>1.1:reasons[r['id']].append(f'{key}:LEGACY_INPUT_ALARM_ABOVE_1_10_NOT_PROMOTION_VETO')
 for r in population:
  for arm,v in r['variation'].items():
   if v['overallMaxToMin']>=1.1:reasons[r['id']].append(f'{arm}:OVERALL_VARIATION_GE_1_10')
   if any(x>=1.1 for x in v['withinHostMaxToMin']):reasons[r['id']].append(f'{arm}:WITHIN_HOST_VARIATION_GE_1_10')
  if len({tuple(v['statuses']) for v in r['variation'].values()})>1:reasons[r['id']].append('EXACT_CAPPED_STATUS_TRANSITION')
  if any(len(v['statuses'])!=1 for v in r['variation'].values()):reasons[r['id']].append('REPEATED_STATUS_MISMATCH')
 # Carry inputs that were explicitly material to prior alarms/proof/hotspot, not hindsight removal.
 critical={'board-106--restricted-split--J','board-119--restricted-split--L','board-115--bag--ordinary',
  'board-111--restricted-split--ordinary','board-028--restricted-split--ordinary'}
 for r in population:
  if r['id'] in critical:reasons[r['id']].append('PRIOR_GATE_PROOF_OR_HOTSPOT_SENTINEL')
 baseline=sorted(r['variation']['R']['medianMs'] for r in population)
 quartiles=[baseline[math.ceil(len(baseline)*q)-1] for q in [.25,.5,.75]]
 strata=collections.defaultdict(list)
 for r in population:
  if reasons[r['id']]:continue
  quartile=sum(r['variation']['R']['medianMs']>v for v in quartiles);status=tuple(r['variation']['R']['statuses'])
  strata[(quartile,status)].append(r)
 controls=[]
 for stratum,rr in sorted(strata.items()):
  chosen=min(rr,key=lambda r:(sha((seed+'\n'+r['id']).encode()),r['id'].encode()));controls.append(chosen['id'])
  reasons[chosen['id']].append('HASH_STRATIFIED_UNSELECTED_CONTROL')
 if controls:environment=min(controls,key=lambda id:(sha((seed+'\n'+id).encode()),id.encode()))
 else:
  center=statistics.median(baseline);environment=min(population,key=lambda r:(abs(r['variation']['R']['medianMs']-center),r['id'].encode()))['id']
 phases[phase]={'population':len(population),'tails':tails,'controls':controls,'quartiles':quartiles,'environmentControlId':environment}
selected=[{'id':r['id'],'phase':r['phase'],'reasons':reasons[r['id']], 'isControl':reasons[r['id']]==['HASH_STRATIFIED_UNSELECTED_CONTROL']} for r in screen if reasons[r['id']]]
entries=load(ROOT/'experiments/a0-four-arm-20261003/INPUTS.json')['entries'];inputs=[e for e in entries if e['id'] in {r['id'] for r in selected}]
# User override:100fresh pairs/contrast,10runners x10pairs, alternating adjacent forward/reverse.
runs=[]
for host in range(10):
 for record in sorted(selected,key=lambda r:(sha((seed+'|'+r['id']).encode()),r['id'].encode())):
  base=int(sha((seed+'|'+record['id']).encode())[:8],16)
  for rep in range(10):
   order=list(range(3));shift=(base+host)%3;order=order[shift:]+order[:shift]
   if rep%2:order.reverse()
   for ci in order:
    n,d=COMPARISONS[ci];arms=[d,n]
    if (base+host)%2==rep%2:arms.reverse()
    block=f'h{host}-{record["id"]}-p{rep+1}-c{ci}'
    for pos,arm in enumerate(arms):runs.append({'runId':f'{block}-{arm}','blockId':block,'matrixId':record['id'],
     'phase':record['phase'],'host':host,'repetition':rep+1,'position':pos+1,'arm':arm,'comparison':f'{n}/{d}',
     'kind':'SELECTED_CONTROL' if record['isControl'] else 'SELECTED'})
 for phase,p in phases.items():
  for arm in ARMS:
   block=f'env-h{host}-{phase}-{arm}'
   for pos in [1,2]:runs.append({'runId':f'{block}-{pos}','blockId':block,'matrixId':p['environmentControlId'],'phase':phase,
    'host':host,'repetition':0,'position':pos,'arm':arm,'comparison':f'{arm}/{arm}','kind':'ENVIRONMENT_CONTROL'})
timing=[{k:r[k] for k in ['runId','blockId','matrixId','host','phase','arm','kind','apiMs','status']} for r in allrows]
buildroot=D/'a0-four-build';lock=load(next(D.glob('a0-four-host-0/results/0/SUMMARY.json')))['lock']
write('SCREENING.json',{'originRunId':37134463920,'sourceCommit':'f4716e1f2686fa25c4e844e47b51e88835a980da',
 'originalSealSha256':sha((EVIDENCE/'SEAL.json').read_bytes()),'sourceFiles':sources,'records':screen,'timingRows':timing,
 'priorEnvironmentAlarms':load(EVIDENCE/'COMPARISON_SUMMARY.json')['environmentAlarms'],'selectedPopulationOnlyNot168':True})
write('SELECTION.json',{'status':'FROZEN_PRE_NATIVE','selectionSeed':seed,'comparisons':[f'{n}/{d}' for n,d in COMPARISONS],
 'populations':phases,'records':selected,'excluded':[r['id'] for r in screen if not reasons[r['id']]],
 'legacyAlarmIsSelectionNotPromotionGate':True,'noEnvironmentSensitiveInputExcluded':True})
write('INPUTS.json',{'entries':inputs})
write('SCHEDULE.json',{'runs':runs,'jobs':10,'comparisons':[f'{n}/{d}' for n,d in COMPARISONS],'pairsPerInputPerComparison':100,
 'pairsPerRunnerPerComparison':10,'actualCalls':len(runs),'selectedCalls':600*len(selected),'environmentCalls':120,
 'design':'Each of three contrasts gets adjacent100pairs:10jobs x10pairs; each job5forward/5reverse. Each arm200calls/input across10runners. No M2/diagnostics.'})
write('FROZEN_BUILD.json',{'originalArtifactRunId':37134463920,'build':load(buildroot/'BUILD.json'),
 'diagnosticBuild':load(buildroot/'DIAGNOSTIC_BUILD.json'),'runtimeFiles':lock['runtimeFiles'],
 'actualTimingArms':ARMS,'gate':'Use exact prior Linux measured WASM/runtime bytes; mismatch blocks before actual input calls.',
 'priorSourceCommit':lock['commit'],'baselineGate':load(buildroot/'BASELINE_GATE.json'),'controlGate':load(buildroot/'CONTROL_GATE.json')})
write('CAMPAIGN.json',{'status':'AUTHORIZED_ONE_100PAIR_RETEST_THEN_DECISION_ONLY','arms':ARMS,'jobs':10,'maxParallel':10,'authorizedMaxParallel':12,
 'userOverride':'Before native launch: increase10pairs to100pairs and use10runners. Single-runner pair repetitions2->10 (5x); runners5->10 (2x).',
 'pairsPerComparison':100,'pairsPerRunnerPerComparison':10,'directionAgreementRunnerThreshold':8,
 'inputs':len(selected),'actualNativeCallCap':len(runs),'stateBudget':100000,'apiMs':10000,'processMs':30000,'startupMs':30000,'auditMs':30000,
 'durableAckMs':10000,'reapMs':2000,'perCallAdmissionSeconds':94,'computeMinutes':160,'cancelMinutes':175,'overallMinutes':180,
 'benchComputeGuardMinutes':55,'benchJobMinutes':60,'preflightJobMinutes':20,'runnerHoursUpper':10+1/3,'runnerHoursCap':64,
 'memoryMaxBytes':3221225472,'swapMaxBytes':0,'oneRetestOnly':True,'searchBudgetIncrease':False,'actualPrimaryPcThresholdCalls':0,
 'integrateDevMergeMainDeploy':False,'newOriginOnFirstWorkflowRun':True,'priorCampaignClosed':True,
 'decision':'Correctness/operational blockers first; replicated benefit and absolute losses reported separately. >10% input slowdown is not a promotion veto. Environmental uncertainty yields selectable-candidate-only recommendation, not endless reruns.',
 'newProduct5PercentGate':False,'noAutomaticSecondRetest':True})
write('TESTING_RULES_KO.md.json',{'file':'TESTING_RULES_KO.md','sourceSha256':sha((Path('D:/AI/sfinder-wasm/tools/validation/TESTING_RULES_KO.md')).read_bytes())})
print(json.dumps({'selectedInputs':len(selected),'excludedInputs':122-len(selected),'phases':{k:{'population':v['population'],'controls':len(v['controls'])} for k,v in phases.items()},
 'actualCalls':len(runs),'callsPerJob':len(runs)//10,'jobs':10,'nativeCallsExecuted':0},indent=2))
