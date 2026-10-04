"""Adjacent pair statistics only; no selection replacement, host dropping or product gate."""
import collections
import statistics

def analyze(rows, entries):
 groups=collections.defaultdict(list)
 for r in rows:
  assert r['status']=='VERIFIED' and r['coldRequestMs']>0
  groups[r['blockId']].append(r)
 env=[];pairs=collections.defaultdict(list)
 for id,g in groups.items():
  if len(g)!=2:continue
  g=sorted(g,key=lambda r:r['position']);assert [r['position'] for r in g]==[1,2]
  assert g[0]['matrixId']==g[1]['matrixId'] and g[0]['host']==g[1]['host']
  if g[0]['kind']=='ENVIRONMENT_CONTROL':
   assert g[0]['policy']==g[1]['policy']
   ratio=max(r['coldRequestMs'] for r in g)/min(r['coldRequestMs'] for r in g)
   env.append({'blockId':id,'host':g[0]['host'],'phase':g[0]['phase'],'policy':g[0]['policy'],'maxToMin':ratio,'alarm':ratio>1.1});continue
  by={r['policy']:r for r in g};assert set(by)=={'reference','a0-m1'}
  n,d=by['a0-m1'],by['reference'];assert n['witness']==d['witness'] and n['outputSha256']==d['outputSha256']
  np,dp=(r['calls'][0] for r in [n,d]);same_seed=np['seedSha256']==dp['seedSha256']
  pairs[g[0]['matrixId']].append({'blockId':id,'host':n['host'],'ratio':n['coldRequestMs']/d['coldRequestMs'],
   'deltaMs':n['coldRequestMs']-d['coldRequestMs'],'apiRatio':n['requestApiMs']/d['requestApiMs'],'samePrimarySeed':same_seed})
 results=[]
 for e in entries:
  pp=pairs[e['id']];complete=len(pp)==100 and all(sum(p['host']==h for p in pp)==10 for h in range(10))
  hosts=[{'host':h,'ratio':statistics.median(p['ratio'] for p in pp if p['host']==h)} for h in range(10) if sum(p['host']==h for p in pp)==10]
  sensitive=any(c['phase']==e['partition'] and c['alarm'] for c in env)
  missing_env=sum(c['phase']==e['partition'] for c in env)!=20
  med=statistics.median(p['ratio'] for p in pp) if pp else None
  faster=sum(h['ratio']<1 for h in hosts)
  seed_different=any(not p['samePrimarySeed'] for p in pp)
  results.append({'id':e['id'],'phase':e['partition'],'complete100Pairs':complete,'pairs':pp,'hosts':hosts,
   'medianRatio':med,'medianDeltaMs':statistics.median(p['deltaMs'] for p in pp) if pp else None,'fasterHosts':faster,
   'environmentSensitive':sensitive,'missingEnvironment':missing_env,'primarySeedVariation':seed_different,
   'strictImprovementDirection':complete and not sensitive and not missing_env and not seed_different and med<1 and faster>=8})
 return {'inputs':results,'completeInputs':sum(r['complete100Pairs'] for r in results),'environmentControls':env,
  'environmentAlarms':sum(c['alarm'] for c in env),'unfiltered8Of10FasterInputs':sum(r['complete100Pairs'] and r['medianRatio']<1 and r['fasterHosts']>=8 for r in results),
  'strictImprovementInputs':sum(r['strictImprovementDirection'] for r in results),'noUniversalNoSlowdownGate':True,
  'limits':'Node default runtime full requests, not browser CP latency or168population. No significant claim from100pairs/10jobs. Partial successful subset cannot certify readiness or default promotion.'}
