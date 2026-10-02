"""Fixed-seed mirror-group clustered description, no solver calls or retuning."""
from pathlib import Path
import json
import math
import sys

summary=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2]);metrics=summary['metrics']
clusters={}
for m in metrics:clusters.setdefault(m['mirrorGroup'],[]).append(m)
groups=list(clusters.values())
def quantile(a,p):return sorted(a)[max(0,math.ceil(len(a)*p)-1)]
state=20261003
def rand():
    global state
    state^=(state<<13)&0xffffffff;state^=state>>17;state^=(state<<5)&0xffffffff;state&=0xffffffff
    return state/2**32
ratios=[];geomeans=[]
if groups:
    for b in range(10000):
        sampled=[groups[int(rand()*len(groups))] for _ in groups]
        baseline=sum(m['baselineMedianMs'] for group in sampled for m in group)
        candidate=sum(m['candidateMedianMs'] for group in sampled for m in group)
        ratios.append(candidate/baseline)
        geomeans.append(math.exp(sum(sum(math.log(m['candidateMedianMs']/m['baselineMedianMs']) for m in group)/len(group) for group in sampled)/len(groups)))
report={'phase':summary['phase'],'status':'DESCRIPTIVE_ONLY_NO_GATE_CHANGE','mirrorGroups':len(groups),'pairedFinalExactMatrices':len(metrics),'bootstrapSamples':10000,
        'fixedSeed':20261003,'completeFinalRouteComparison':summary['finalRouteAllConfirmed'],
        'sumRouteRatio':summary['apiMedianSumRatio'],'sumRouteRatio95CI':[quantile(ratios,.025),quantile(ratios,.975)] if ratios else None,
        'groupEqualGeomeanRatio95CI':[quantile(geomeans,.025),quantile(geomeans,.975)] if geomeans else None,
        'censoredRowsExcludedAreNotDeclaredSuccessful':True,'nativeEffectEvidenceReused':True,'devApplied':False}
out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
