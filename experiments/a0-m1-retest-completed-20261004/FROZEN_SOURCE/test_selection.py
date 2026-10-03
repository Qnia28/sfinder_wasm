"""Independent fixed-union and adjacency/order checks, no native calls."""
from pathlib import Path
import collections
import hashlib
import json
import math
import statistics
import unittest
EX=Path(__file__).resolve().parent
load=lambda n:json.loads((EX/n).read_text(encoding='utf-8-sig'))
class Contracts(unittest.TestCase):
 def test_union_tails_and_variation(self):
  screen=load('SCREENING.json')['records'];selection=load('SELECTION.json');reasons=collections.defaultdict(set)
  for phase in ['development','reserved']:
   pp=[r for r in screen if r['phase']==phase]
   for key in ['A0/R','M1/R','M1/A0']:
    for direction in ['IMPROVEMENT','REGRESSION']:
     rr=sorted((r for r in pp if (r['comparisons'][key]['medianRatio']<1 if direction=='IMPROVEMENT' else r['comparisons'][key]['medianRatio']>1)),key=lambda r:r['comparisons'][key]['medianRatio'],reverse=direction=='REGRESSION')
     k=math.ceil(len(rr)*.1);cutoff=rr[k-1]['comparisons'][key]['medianRatio'] if k else None
     ids={r['id'] for r in rr if (r['comparisons'][key]['medianRatio']<=cutoff if direction=='IMPROVEMENT' else r['comparisons'][key]['medianRatio']>=cutoff)} if k else set()
     self.assertEqual(ids,set(selection['populations'][phase]['tails'][key][direction]['selected']))
     for id in ids:reasons[id].add(f'{key}:{direction}_TAIL')
    for r in pp:
     if r['comparisons'][key]['medianRatio']>1.1:reasons[r['id']].add(f'{key}:LEGACY_INPUT_ALARM_ABOVE_1_10_NOT_PROMOTION_VETO')
   for r in pp:
    for arm,v in r['variation'].items():
     if v['overallMaxToMin']>=1.1:reasons[r['id']].add(f'{arm}:OVERALL_VARIATION_GE_1_10')
     if max(v['withinHostMaxToMin'])>=1.1:reasons[r['id']].add(f'{arm}:WITHIN_HOST_VARIATION_GE_1_10')
  selected={r['id']:set(r['reasons']) for r in selection['records']}
  for id,why in reasons.items():self.assertTrue(why<=selected[id])
  self.assertEqual(set(selected),{r['id'] for r in screen});self.assertEqual(len(selected),122)
  for phase,p in selection['populations'].items():
   self.assertEqual(p['controls'],[])
   pp=[r for r in screen if r['phase']==phase];center=statistics.median(r['variation']['R']['medianMs'] for r in pp)
   self.assertEqual(p['environmentControlId'],min(pp,key=lambda r:(abs(r['variation']['R']['medianMs']-center),r['id'].encode()))['id'])
 def test_adjacent_100pairs_per_comparison_no_m2(self):
  schedule=load('SCHEDULE.json');runs=schedule['runs'];campaign=load('CAMPAIGN.json')
  self.assertEqual(len(runs),73320);self.assertEqual(len({r['runId'] for r in runs}),73320)
  self.assertEqual(len([r for r in runs if r['kind']=='ENVIRONMENT_CONTROL']),120)
  self.assertEqual({r['arm'] for r in runs},{'R','A0','M1'});self.assertLessEqual(campaign['maxParallel'],12)
  for host in range(10):self.assertEqual(sum(r['host']==host for r in runs),7332)
  blocks=collections.defaultdict(list)
  for r in runs:blocks[r['blockId']].append(r)
  self.assertTrue(all(len(rr)==2 and [r['position'] for r in rr]==[1,2] for rr in blocks.values()))
  for record in load('SELECTION.json')['records']:
   for comparison in ['A0/R','M1/R','M1/A0']:
    bb=[rr for rr in blocks.values() if rr[0]['matrixId']==record['id'] and rr[0]['comparison']==comparison and rr[0]['kind']!='ENVIRONMENT_CONTROL']
    self.assertEqual(len(bb),100)
    for host in range(10):
     own=[rr for rr in bb if rr[0]['host']==host];self.assertEqual(len(own),10)
     orders=collections.Counter(tuple(r['arm'] for r in pair) for pair in own)
     self.assertEqual(sorted(orders.values()),[5,5])
 def test_sources_and_screen_stats(self):
  screen=load('SCREENING.json');groups=collections.defaultdict(dict)
  for r in screen['timingRows']:
   if r['kind']!='ENVIRONMENT_CONTROL':groups[r['blockId']][r['arm']]=r
  for r in screen['records']:
   bb=[b for b in groups.values() if b['R']['matrixId']==r['id']];self.assertEqual(len(bb),10)
   for key,c in r['comparisons'].items():
    n,d=key.split('/');self.assertEqual(statistics.median(b[n]['apiMs']/b[d]['apiMs'] for b in bb),c['medianRatio'])
   for arm,v in r['variation'].items():
    tt=[b[arm]['apiMs'] for b in bb];self.assertEqual(max(tt)/min(tt),v['overallMaxToMin'])
  self.assertFalse(load('CAMPAIGN.json')['integrateDevMergeMainDeploy']);self.assertTrue(load('CAMPAIGN.json')['oneRetestOnly'])
if __name__=='__main__':unittest.main(verbosity=2)
