import unittest
from analyze import analyze

class AnalysisContracts(unittest.TestCase):
    def rows(self,times):
        return [{'blockId':f'h{h}-b{b}','host':h,'matrixId':'fixture','phase':'development','kind':'SELECTED','arm':a,'apiMs':t} for h in range(5) for b in range(2) for a,t in times.items()] + [
            {'blockId':f'env-h{h}-{a}','host':h,'matrixId':'fixture','phase':'development','kind':'ENVIRONMENT_CONTROL','arm':a,'apiMs':t}
            for h in range(5) for a in times for t in [10,10.01]]
    def result(self,rows):
        return analyze([{'id':'fixture','phase':'development','reasons':['SYNTHETIC'],'isControl':False}],rows)['inputs'][0]
    def test_r_gap_and_partial_improvement_are_distinct(self):
        r=self.result(self.rows({'R':10,'A0':15,'M1':10.5,'M2':13}))
        self.assertEqual(r['verdicts']['M1']['classification'],'R_GAP_REDUCED_BELOW_ALARM')
        self.assertEqual(r['verdicts']['M2']['classification'],'A0_IMPROVED_R_SLOWDOWN_REMAINS')
        self.assertAlmostEqual(r['comparisons']['M1/A0']['medianRatio'],0.7)
        self.assertAlmostEqual(r['comparisons']['M1/R']['medianRatio'],1.05)
    def test_incomplete_blocks_cannot_be_success(self):
        rr=self.rows({'R':10,'A0':15,'M1':10,'M2':13});rr.pop(0);r=self.result(rr)
        self.assertFalse(r['complete10Blocks']);self.assertEqual(r['verdicts']['M1']['classification'],'INCOMPLETE')
    def test_environment_alarm_only_affects_relevant_arm_comparisons(self):
        rows=self.rows({'R':10,'A0':15,'M1':10.5,'M2':13})
        rows=[r for r in rows if r['blockId']!='env-h0-M2']
        rows += [{'blockId':'env-h0-M2','host':0,'matrixId':'fixture','phase':'development','kind':'ENVIRONMENT_CONTROL','arm':'M2','apiMs':t} for t in [10,12]]
        r=self.result(rows)
        self.assertEqual(r['verdicts']['M1']['classification'],'R_GAP_REDUCED_BELOW_ALARM')
        self.assertEqual(r['verdicts']['M2']['classification'],'ENVIRONMENT_SENSITIVE')
    def test_missing_environment_controls_do_not_imply_no_alarm(self):
        rr=[r for r in self.rows({'R':10,'A0':15,'M1':10,'M2':13}) if r['kind']!='ENVIRONMENT_CONTROL']
        r=self.result(rr);self.assertEqual(r['verdicts']['M1']['classification'],'ENVIRONMENT_UNCHECKED')
        self.assertFalse(r['verdicts']['M1']['directionalImprovementVsA0'])
    def test_instrumented_row_cannot_enter_timing_analysis(self):
        rr=self.rows({'R':10,'A0':15,'M1':10,'M2':13});rr[0]['diagnostic']=True
        with self.assertRaises(AssertionError):self.result(rr)

if __name__=='__main__':unittest.main()
