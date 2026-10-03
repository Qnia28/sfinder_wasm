import unittest
from analyze import analyze
def fixtures(ratio=.8):
 record={'id':'x','phase':'development','reasons':['TEST'],'isControl':False};selection={'records':[record]}
 screen={'records':[{'id':'x','comparisons':{key:{'medianRatio':ratio} for key in ['A0/R','M1/R','M1/A0']}}]};rows=[]
 for host in range(10):
  for arm in ['R','A0','M1']:
   for pos in [1,2]:rows.append({'blockId':f'env-{host}-{arm}','matrixId':'x','host':host,'phase':'development','arm':arm,'kind':'ENVIRONMENT_CONTROL','comparison':f'{arm}/{arm}','apiMs':10,'diagnostic':False,'timingEvidence':True})
  for key in ['A0/R','M1/R','M1/A0']:
   n,d=key.split('/')
   for rep in range(10):
    for arm,t in [(d,10),(n,10*ratio)]:rows.append({'blockId':f'{host}-{rep}-{key}','matrixId':'x','host':host,'phase':'development','arm':arm,'kind':'SELECTED','comparison':key,'apiMs':t,'diagnostic':False,'timingEvidence':True})
 return selection,screen,rows
class AnalysisTests(unittest.TestCase):
 def test_paired_ratio(self):
  s,o,r=fixtures();a=analyze(s,o,r);self.assertEqual(a['completeInputs'],1)
  self.assertEqual(a['inputs'][0]['comparisons']['M1/R']['medianRatio'],.8);self.assertTrue(a['inputs'][0]['comparisons']['M1/R']['directionReplicated'])
 def test_environment_not_host_exclusion(self):
  s,o,r=fixtures();r[0]['apiMs']=13;a=analyze(s,o,r);c=a['inputs'][0]['comparisons']['M1/R']
  self.assertEqual(c['classification'],'ENVIRONMENT_SENSITIVE');self.assertEqual(len(c['pairs']),100);self.assertFalse(c['directionReplicated'])
 def test_incomplete(self):
  s,o,r=fixtures();a=analyze(s,o,r[:-1]);self.assertEqual(a['completeInputs'],0)
 def test_instrumented_rejected(self):
  s,o,r=fixtures();r[0]['diagnostic']=True
  with self.assertRaises(AssertionError):analyze(s,o,r)
 def test_slowdown_is_not_integration_veto(self):
  s,o,r=fixtures(1.2);a=analyze(s,o,r);c=a['inputs'][0]['comparisons']['M1/R'];self.assertTrue(c['slowdownMagnitudeConfirmed']);self.assertTrue(c['slowdownMagnitudeDiagnosticOnlyNotIntegrationVeto'])
