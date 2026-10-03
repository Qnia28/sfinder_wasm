"""Fresh adjacent-pair retest, not historical value replacement or promotion gate."""
import collections
import statistics

COMPARISONS=['A0/R','M1/R','M1/A0']
def analyze(selection,screen,rows):
 assert all(not r.get('diagnostic') and r.get('timingEvidence') for r in rows)
 blocks=collections.defaultdict(list)
 for r in rows:blocks[r['blockId']].append(r)
 environment=[];alarms=set();checked=set()
 for id,rr in blocks.items():
  if rr[0]['kind']=='ENVIRONMENT_CONTROL' and len(rr)==2:
   assert rr[0]['arm']==rr[1]['arm'];q=max(r['apiMs'] for r in rr)/min(r['apiMs'] for r in rr)
   item={'blockId':id,'host':rr[0]['host'],'phase':rr[0]['phase'],'arm':rr[0]['arm'],'maxToMin':q,'alarm':q>1.1}
   environment.append(item);checked.add((item['phase'],item['host'],item['arm']))
   if item['alarm']:alarms.add((item['phase'],item['host'],item['arm']))
 old={r['id']:r for r in screen['records']};results=[]
 for record in selection['records']:
  comps={}
  for key in COMPARISONS:
   n,d=key.split('/');pairs=[]
   for bid,rr in blocks.items():
    if rr[0]['matrixId']!=record['id'] or rr[0]['comparison']!=key or rr[0]['kind']=='ENVIRONMENT_CONTROL' or len(rr)!=2:continue
    by={r['arm']:r for r in rr};assert set(by)=={n,d}
    pairs.append({'blockId':bid,'host':rr[0]['host'],'ratio':by[n]['apiMs']/by[d]['apiMs'],'deltaMs':by[n]['apiMs']-by[d]['apiMs']})
   full=len(pairs)==100 and all(sum(p['host']==h for p in pairs)==10 for h in range(10));hosts=[]
   for h in range(10):
    own=[p for p in pairs if p['host']==h];hosts.append({'host':h,'ratio':statistics.median(p['ratio'] for p in own) if len(own)==10 else None,
     'deltaMs':statistics.median(p['deltaMs'] for p in own) if len(own)==10 else None,
     'environmentAlarm':any((record['phase'],h,a) in alarms for a in [n,d]),
     'environmentMissing':any((record['phase'],h,a) not in checked for a in [n,d])})
   median=statistics.median(p['ratio'] for p in pairs) if full else None
   faster=sum(h['ratio']<1 for h in hosts if h['ratio'] is not None);slower=sum(h['ratio']>1 for h in hosts if h['ratio'] is not None)
   magnitude=sum(h['ratio']>1.1 for h in hosts if h['ratio'] is not None);env=any(h['environmentAlarm'] for h in hosts);missing=any(h['environmentMissing'] for h in hosts)
   original=old[record['id']]['comparisons'][key]['medianRatio'];same=full and not env and not missing and ((original<1 and median<1 and faster>=8) or (original>1 and median>1 and slower>=8))
   classification='INCOMPLETE' if not full else 'ENVIRONMENT_UNCHECKED' if missing else 'ENVIRONMENT_SENSITIVE' if env else 'DIRECTION_REPLICATED' if same else 'NOT_REPLICATED_OR_UNCERTAIN'
   comps[key]={'complete100Pairs':full,'pairs':pairs,'hosts':hosts,'medianRatio':median,
    'medianDeltaMs':statistics.median(p['deltaMs'] for p in pairs) if full else None,'originalScreeningRatio':original,
    'fasterHosts':faster,'slowerHosts':slower,'slowdownAbove1_10Hosts':magnitude,'hostDirectionMixed':bool(faster and slower),
    'environmentAlarm':env,'environmentMissing':missing,'directionReplicated':same,'classification':classification,
    'improvementDirectionConfirmed':full and not env and not missing and median<1 and faster>=8,
    'slowdownMagnitudeConfirmed':full and not env and not missing and median>1.1 and magnitude>=8,
    'slowdownMagnitudeDiagnosticOnlyNotIntegrationVeto':True}
  variation={}
  for arm in ['R','A0','M1']:
   rr=[r for r in rows if r['matrixId']==record['id'] and r['arm']==arm and r['kind']!='ENVIRONMENT_CONTROL'];tt=[r['apiMs'] for r in rr]
   variation[arm]={'calls':len(rr),'medianMs':statistics.median(tt) if tt else None,'maxToMin':max(tt)/min(tt) if tt else None,
    'withinHostMaxToMin':[max(t)/min(t) if t else None for h in range(10) if (t:=[r['apiMs'] for r in rr if r['host']==h]) ]}
  results.append({'matrixId':record['id'],'phase':record['phase'],'reasons':record['reasons'],'isControl':record['isControl'],
   'comparisons':comps,'variation':variation,'completeAllComparisons':all(c['complete100Pairs'] for c in comps.values())})
 summary={}
 for key in COMPARISONS:
  cc=[r['comparisons'][key] for r in results];complete=[c for c in cc if c['complete100Pairs']]
  summary[key]={'completeInputs':len(complete),'classifications':dict(collections.Counter(c['classification'] for c in cc)),
   'environmentClearImprovementDirections':sum(c['improvementDirectionConfirmed'] for c in cc),
   'environmentClearSlowdownMagnitudeAlarms':sum(c['slowdownMagnitudeConfirmed'] for c in cc),
   'unfilteredDirectionalImprovements':sum(c['medianRatio']<1 and c['fasterHosts']>=8 for c in complete),
   'unfilteredMagnitudeSlowdownAlarms':sum(c['medianRatio']>1.1 and c['slowdownAbove1_10Hosts']>=8 for c in complete),
   'medianOfInputPairedMedianRatios':statistics.median(c['medianRatio'] for c in complete) if complete else None,
   'notPopulationGate':True}
 return {'status':'DESCRIPTIVE_ONE_RETEST_ONLY','completeInputs':sum(r['completeAllComparisons'] for r in results),'inputs':results,
  'summary':summary,'environmentControls':environment,'environmentAlarms':sum(e['alarm'] for e in environment),
  'originalValuesReplaced':False,'originalPopulationGateRecomputed':False,'automaticSecondRetest':False,
  'limits':'Original selected122, not168population;10runner jobs not100independent hosts;8/10runner agreement is descriptive not significance; no universal no-slowdown claim; probe timing not final product latency.'}
