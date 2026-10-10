// Product-command RC comparison. Uses the established common executor/scopes.
import assert from 'node:assert/strict';
import { digest, integer } from '../contracts.mjs';
import { FOLLOWUP_JOB, validateBudget, worstCall, packTasks } from '../budget.mjs';
export const isProductIntegration=m=>m.integration?.id==='rc-dev-product-v1';
export const INTEGRATION_JOB=Object.freeze({...FOLLOWUP_JOB,parts:12,jobMs:325*60000,jobMinutes:350});
export const INTEGRATION_PHASES=['RC_INITIAL_1','RC_INITIAL_2','RC_INITIAL_3','RC_CONFIRMATION_1','RC_CONFIRMATION_2'];
export const INTEGRATION_PROFILE=Object.freeze({id:'triage-cold-v1',lifecycle:'fresh-process-cold',exactHumanQuality:'true',
  timingContract:'product-command-cold-settled-v1',memoryScope:'command-process-tree',memoryMaxBytes:3221225472,swapMaxBytes:0,
  threads:{rustPrimary:1,highsPrimary:1,cpsatPrimary:2,rustSecondary:1,cpsatSecondary:1},
  productPolicy:'UNCHANGED_COMMITTED_DEFAULT_PER_ARM',callTimeoutMs:600000});
export function validateIntegration(m) {
  assert.equal(m.schemaVersion,1);assert.equal(m.revision,15);assert.equal(m.profile,'triage-cold-v1');
  assert.equal(m.purpose,'product-integration-rc-dev');assert.equal(m.freshValidation,false);
  assert.equal(m.maxParallel,16);assert.equal(m.maxCalls,21960);assert.equal(m.overallMs,21*86400000);
  assert.deepEqual(m.job,INTEGRATION_JOB);assert.deepEqual(m.profileContract,INTEGRATION_PROFILE);
  assert.deepEqual(m.measurement,{adapter:'triage-fixture',variants:['DEV','RC']});
  assert.equal(m.inputs.length,1098);assert.equal(new Set(m.inputs.map(r=>r.id)).size,1098);
  assert.equal(m.inputs.filter(r=>r.metadata.dataset==='ALL').length,548);
  assert.equal(m.inputs.filter(r=>r.metadata.dataset==='PER_SAVE').length,550);
  for(const f of m.inputs){assert(/^[a-f0-9]{64}$/.test(f.sha256));assert.equal(f.member,`commands/${f.sha256}.json`);assert(f.metadata.productCommand);}
  assert.equal(m.integration.rcCommit,'2c406b98cadc186bfaf4490f4b8568535a60ea01');
  assert.equal(m.integration.devCommit,'7ef62d18e1d155b6479e00d651c851ff3baa7112');
  assert.equal(m.integration.initialRounds,3);assert.equal(m.integration.confirmationRounds,2);
  assert.equal(m.integration.repeatsPerRound,2);assert.equal(m.integration.newCpCalls,0);
  assert.equal(m.maxRunnerHours,5381);assert.equal(m.integration.maxMatrixJobs,920);
  assert(920*350/60+13.5<=m.maxRunnerHours);assert(m.approval);
  validateBudget(m.budget);assert.deepEqual(m.budget,{maxParallel:16,overallMs:m.overallMs,maxCalls:m.maxCalls,job:m.job});
  assert.equal(m.auditContract.id,'product-command-independent-python-v1');
  assert.deepEqual(m.auditContract.prerequisiteJobs,[]);
  for(const h of [m.tasksHash,m.integration.priorAccountingSha256,m.integration.rcPackageSha256])assert(/^[a-f0-9]{64}$/.test(h));
  return m;
}
export function integrationTasks(m,templates,phase,selected=null) {
  assert(INTEGRATION_PHASES.includes(phase));const refs=new Map(m.inputs.map(f=>[f.id,f]));
  return templates.filter(t=>t.phase===phase&&(!t.conditional||selected?.includes(t.fixture_ids[0]))).map(t=>{
    const f=refs.get(t.fixture_ids[0]);assert(f);integer(t.block,1,2);assert.deepEqual([...t.arms].sort(),['DEV','RC']);
    const limits={startupMs:10000,callMs:600000,reapMs:5000};
    const calls=t.arms.map((variant,position)=>{
      const identity={campaignId:m.campaignId,phase,taskId:t.task_id,inputId:f.id,inputHash:f.sha256,variant,repeat:t.block,
        block:t.block,position,role:f.metadata.dataset,measurementEpoch:15};
      return {...identity,callId:digest(identity),limits};
    });
    return {id:t.task_id,adapter:'triage-fixture',phase,calls,worstMs:calls.reduce((n,c)=>n+worstCall(c.limits,m.job),0)};
  });
}
export function integrationChunks(tasks,job) {
  // Each repetition gets separate workers, even at the population boundary.
  const chunks=[1,2].flatMap(b=>packTasks(tasks.filter(t=>t.calls[0].block===b),job));assert(chunks.length<=256);return chunks;
}
const median=xs=>{const s=xs.toSorted((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
export function selectIntegration(m,rows) {
  const initial=rows.filter(r=>r.phase.startsWith('RC_INITIAL_'));assert.equal(initial.length,13176);
  const selected=new Set(m.integration.mandatoryConfirmation),decisions=m.integration.mandatoryConfirmation.map(inputId=>({inputId,reason:'PRIOR_COUNTEREXAMPLE_RESOURCE'})),metrics=[];
  const mark=(inputId,reason)=>{selected.add(inputId);decisions.push({inputId,reason});};
  for(const f of m.inputs){
    const rs=initial.filter(r=>r.inputId===f.id);assert.equal(rs.length,12);
    const ratios=[],deltas=[],times={DEV:[],RC:[]};
    for(const phase of INTEGRATION_PHASES.slice(0,3))for(const block of [1,2]){
      const pair=rs.filter(r=>r.phase===phase&&r.block===block);assert.equal(pair.length,2);
      const b=pair.find(r=>r.variant==='DEV'),c=pair.find(r=>r.variant==='RC');assert(b&&c);assert.equal(b.runnerId,c.runnerId);
      for(const r of pair)if(r.status==='EXACT'){assert(r.ms>0);times[r.variant].push(r.ms);}
      if(b.status!==c.status)mark(f.id,'COMPLETION_DISCORDANCE');
      if(b.status==='EXACT'&&c.status==='EXACT'){
        assert.equal(digest(b.execution.result.verified),digest(c.execution.result.verified),'product witness disagreement');
        ratios.push(c.ms/b.ms);deltas.push(c.ms-b.ms);
      }
    }
    if(new Set(rs.map(r=>r.status)).size>1)mark(f.id,'STATUS_VARIATION');
    const spread=xs=>xs.length>1?Math.max(...xs)/Math.min(...xs):null;
    const row={inputId:f.id,population:f.metadata.dataset,deltaMs:deltas.length===6?median(deltas):null,ratio:ratios.length===6?median(ratios):null,
      baseSpread:spread(times.DEV),candidateSpread:spread(times.RC),ratioSpread:spread(ratios)};metrics.push(row);
    if([row.baseSpread,row.candidateSpread,row.ratioSpread].some(x=>x>1.1))mark(f.id,'REPEAT_GT_10_PERCENT');
  }
  for(const pop of ['ALL','PER_SAVE'])for(const metric of ['deltaMs','ratio']){
    const sorted=metrics.filter(r=>r.population===pop&&r[metric]!==null).sort((a,b)=>a[metric]-b[metric]||(a.inputId<b.inputId?-1:a.inputId>b.inputId?1:0));
    const n=Math.ceil(sorted.length*.1);
    for(const r of sorted.slice(0,n))mark(r.inputId,`${pop}_${metric}_TOP_BENEFIT`);
    for(const r of sorted.slice(-n))mark(r.inputId,`${pop}_${metric}_TOP_HARM`);
  }
  return {selected:[...selected].sort(),decisions,metrics,solverCalls:0,recursiveSelection:false};
}
