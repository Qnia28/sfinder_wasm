"""Descriptive within-block four-arm analysis, never a population gate."""
import collections
import statistics

COMPARISONS=[('A0','R'),('M1','A0'),('M2','A0'),('M1','R'),('M2','R'),('M1','M2')]

def analyze(records, rows):
    blocks=collections.defaultdict(list)
    for row in rows:blocks[row['blockId']].append(row)
    environment=[];alarms=set();checked_controls=set();complete=[]
    for block_id, rr in blocks.items():
        if rr[0]['kind']=='ENVIRONMENT_CONTROL':
            if len(rr)==2:
                ratio=max(r['apiMs'] for r in rr)/min(r['apiMs'] for r in rr)
                e={'blockId':block_id,'phase':rr[0]['phase'],'host':rr[0]['host'],'arm':rr[0]['arm'],'maxToMin':ratio,'alarm':ratio>1.1}
                environment.append(e)
                checked_controls.add((e['phase'],e['host'],e['arm']))
                if e['alarm']:alarms.add((e['phase'],e['host'],e['arm']))
        elif len(rr)==4 and {r['arm'] for r in rr}=={'R','A0','M1','M2'}:
            complete.append(rr)
    results=[]
    for record in records:
        bb=[b for b in complete if b[0]['matrixId']==record['id']]
        full=len(bb)==10 and all(sum(b[0]['host']==h for b in bb)==2 for h in range(5))
        comparisons={}
        for numerator,denominator in COMPARISONS:
            pp=[]
            for b in bb:
                by={r['arm']:r for r in b};n,d=by[numerator],by[denominator]
                pp.append({'blockId':b[0]['blockId'],'host':b[0]['host'],'ratio':n['apiMs']/d['apiMs'],'deltaMs':n['apiMs']-d['apiMs']})
            hh=[]
            for host in range(5):
                own=[p for p in pp if p['host']==host]
                hh.append({'host':host,'ratio':statistics.median(p['ratio'] for p in own) if len(own)==2 else None,
                           'deltaMs':statistics.median(p['deltaMs'] for p in own) if len(own)==2 else None,
                           'environmentAlarm':any((record['phase'],host,a) in alarms for a in [numerator,denominator]),
                           'environmentMissing':any((record['phase'],host,a) not in checked_controls for a in [numerator,denominator])})
            median=statistics.median(p['ratio'] for p in pp) if full else None
            comparisons[f'{numerator}/{denominator}']={'complete':full,'pairs':pp,'medianRatio':median,
                'medianDeltaMs':statistics.median(p['deltaMs'] for p in pp) if full else None,'hosts':hh,
                'fasterHosts':sum(h['ratio']<1 for h in hh if h['ratio'] is not None),
                'slowdownAbove1_10Hosts':sum(h['ratio']>1.1 for h in hh if h['ratio'] is not None),
                'environmentAlarm':any(h['environmentAlarm'] for h in hh),'environmentMissing':any(h['environmentMissing'] for h in hh)}
        verdicts={}
        for arm in ['M1','M2']:
            vs_a0=comparisons[f'{arm}/A0'];vs_r=comparisons[f'{arm}/R'];a0_r=comparisons['A0/R']
            improved=full and not vs_a0['environmentAlarm'] and not vs_a0['environmentMissing'] and vs_a0['medianRatio']<1 and vs_a0['fasterHosts']>=4
            r_alarm=full and vs_r['medianRatio']>1.1 and vs_r['slowdownAbove1_10Hosts']>=4
            r_gap_closed=improved and not vs_r['environmentAlarm'] and not vs_r['environmentMissing'] and a0_r['medianRatio']>1.1 and a0_r['slowdownAbove1_10Hosts']>=4 and vs_r['medianRatio']<=1.1 and sum(h['ratio']<=1.1 for h in vs_r['hosts'])>=4
            classification='INCOMPLETE' if not full else 'ENVIRONMENT_UNCHECKED' if vs_a0['environmentMissing'] or vs_r['environmentMissing'] else 'ENVIRONMENT_SENSITIVE' if vs_a0['environmentAlarm'] or vs_r['environmentAlarm'] else 'R_GAP_REDUCED_BELOW_ALARM' if r_gap_closed else 'A0_IMPROVED_R_SLOWDOWN_REMAINS' if improved and r_alarm else 'A0_IMPROVED_R_COMPARISON_SEPARATE' if improved else 'NO_CONSISTENT_A0_IMPROVEMENT'
            verdicts[arm]={'directionalImprovementVsA0':improved,'slowdownMagnitudeVsR':r_alarm,'rGapReducedBelowAlarm':r_gap_closed,'classification':classification}
        variation={}
        for arm in ['R','A0','M1','M2']:
            tt=[r['apiMs'] for r in rows if r['matrixId']==record['id'] and r['arm']==arm and r['kind']!='ENVIRONMENT_CONTROL']
            variation[arm]={'maxToMin':max(tt)/min(tt) if tt else None,
                'medianMs':statistics.median(tt) if len(tt)==10 else None,
                'withinHostMaxToMin':[max(t)/min(t) if len(t)==2 else None for host in range(5) if (t:=[r['apiMs'] for r in rows if r['matrixId']==record['id'] and r['arm']==arm and r['host']==host and r['kind']!='ENVIRONMENT_CONTROL'])]}
        results.append({'matrixId':record['id'],'phase':record['phase'],'reasons':record['reasons'],'control':record['isControl'],'complete10Blocks':full,
                       'comparisons':comparisons,'verdicts':verdicts,'variation':variation})
    return {'status':'DESCRIPTIVE_SELECTED_SET_ONLY','inputs':results,'completeInputs':sum(i['complete10Blocks'] for i in results),
            'environmentControls':environment,'environmentAlarms':sum(e['alarm'] for e in environment),'populationGateRecomputed':False,
            'originalReservedP95FailureStillValid':True,'originalValuesReplaced':False,
            'limits':'5runner jobs not10independent hosts. No formal significance or full-population PASS. All ten blocks required; ratios are within-block medians, not ratio-of-medians.'}
