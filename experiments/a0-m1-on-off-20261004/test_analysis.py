import unittest
from analyze import analyze
ENTRIES=[{'id':'fixture','partition':'development'}]
def rows(ratio=.9,alarm=False):
 rr=[]
 for host in range(10):
  for rep in range(10):
   for pos,policy in enumerate(['reference','a0-m1'],1):rr.append({'blockId':f'h{host}-p{rep}','position':pos,'host':host,'matrixId':'fixture','phase':'development',
    'kind':'FULL_REQUEST','status':'VERIFIED','policy':policy,'coldRequestMs':100*(ratio if policy=='a0-m1' else 1),'requestApiMs':50,
    'witness':{'quality':'same'},'outputSha256':'same','calls':[{'seedSha256':'same'}]})
  for policy in ['reference','a0-m1']:
   for pos in [1,2]:rr.append({'blockId':f'env-{host}-{policy}','position':pos,'host':host,'matrixId':'fixture','phase':'development','kind':'ENVIRONMENT_CONTROL',
    'status':'VERIFIED','policy':policy,'coldRequestMs':120 if alarm and host==0 and policy=='reference' and pos==2 else 100})
 return rr
class Tests(unittest.TestCase):
 def test_paired_complete(self):
  a=analyze(rows(),ENTRIES);self.assertEqual(a['completeInputs'],1);self.assertAlmostEqual(a['inputs'][0]['medianRatio'],.9);self.assertEqual(a['strictImprovementInputs'],1)
 def test_environment_no_host_exclusion(self):
  a=analyze(rows(alarm=True),ENTRIES);self.assertEqual(len(a['inputs'][0]['pairs']),100);self.assertEqual(a['strictImprovementInputs'],0)
 def test_incomplete_no_subset_pass(self):self.assertEqual(analyze(rows()[2:],ENTRIES)['completeInputs'],0)
 def test_primary_seed_variation_preserved(self):
  r=rows();r[1]['calls']=[{'seedSha256':'different'}];a=analyze(r,ENTRIES);self.assertTrue(a['inputs'][0]['primarySeedVariation']);self.assertEqual(a['strictImprovementInputs'],0)
 def test_bad_witness_rejected(self):
  r=rows();r[1]['witness']={};self.assertRaises(AssertionError,analyze,r,ENTRIES)
 def test_timeout_is_censored_not_finite_or_dropped(self):
  allrows=rows();allrows[0]['status']='TIMEOUT_API'
  a=analyze([r for r in allrows if r['status']=='VERIFIED'],ENTRIES,allrows)
  self.assertEqual(a['timeoutRequests'],1);self.assertEqual(len(a['censoredPairs']),1)
  self.assertEqual(a['completeInputs'],0);self.assertEqual(a['completeOutcomeInputsIncludingTimeout'],1)
  self.assertEqual(a['inputs'][0]['requestOutcomeCounts']['reference']['TIMEOUT_API'],1)
  self.assertEqual(len(a['inputs'][0]['pairs']),99);self.assertEqual(a['strictImprovementInputs'],0)
 def test_cross_episode_ratios_rejected_and_old_controls_not_current_host_evidence(self):
  r=rows();r[0]['executionEpisodeRunId']=2;r[1]['executionEpisodeRunId']=2
  a=analyze(r,ENTRIES,r);self.assertTrue(a['inputs'][0]['missingEnvironment']);self.assertEqual(a['strictImprovementInputs'],0)
  r[1]['executionEpisodeRunId']=3;a=analyze(r,ENTRIES,r)
  self.assertEqual(len(a['inputs'][0]['pairs']),99)
if __name__=='__main__':unittest.main(verbosity=2)
