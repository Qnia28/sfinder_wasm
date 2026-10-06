import assert from 'node:assert/strict';
import { digest, sha256 } from '../contracts.mjs';

const median = values => { const s = [...values].sort((a,b) => a-b), n = s.length; return n ? (s[Math.floor((n-1)/2)] + s[Math.floor(n/2)]) / 2 : null; };
export const percentile = (values, p) => { const s = [...values].sort((a,b) => a-b); if (!s.length) return null;
  const x = (s.length-1)*p, a = Math.floor(x); return s[a]+(s[Math.min(a+1,s.length-1)]-s[a])*(x-a); };
export function pairedInputs(rows, phase) {
  const pairs = new Map();
  for (const row of rows.filter(r => r.phase === phase && r.pairId)) {
    if (!pairs.has(row.pairId)) pairs.set(row.pairId, []); pairs.get(row.pairId).push(row);
  }
  const inputs = new Map();
  for (const [pairId, ps] of pairs) {
    const base = ps.find(r => ['BASELINE','TRACE_OFF_BASELINE'].includes(r.variant));
    const candidate = ps.find(r => !['BASELINE','TRACE_OFF_BASELINE'].includes(r.variant));
    const head = base ?? candidate, key = head.inputId + '/' + head.comparator;
    if (!inputs.has(key)) inputs.set(key, { inputId: head.inputId, comparator: head.comparator, metadata: head.metadata, pairs: [], deltas: [], ratios: [], baseTimes: [], candidateTimes: [], issues: [] });
    const input = inputs.get(key);
    if (ps.length !== 2 || !base || !candidate) { input.issues.push('INCOMPLETE_PAIR'); continue; }
    input.pairs.push({ pairId, base, candidate });
    if (base.status !== candidate.status) input.issues.push('STATUS_DISCORDANCE');
    if (base.status === 'EXACT' && candidate.status === 'EXACT') {
      input.deltas.push(candidate.ms - base.ms); input.ratios.push(candidate.ms / base.ms);
      input.baseTimes.push(base.ms); input.candidateTimes.push(candidate.ms);
    }
  }
  return [...inputs.values()].map(i => ({ ...i, delta: median(i.deltas), ratio: median(i.ratios), baseMs: median(i.baseTimes),
    candidateMs: median(i.candidateTimes), variability: Math.max(...[i.baseTimes,i.candidateTimes].map(v => v.length ? Math.max(...v)/Math.min(...v) : 1)) }));
}
export function selectConfirmation(manifest, rows, phase) {
  const inputs = pairedInputs(rows, phase), selected = new Set();
  const decision = [];
  const mark = (input, reason) => { selected.add(input.inputId); decision.push({ inputId: input.inputId, comparator: input.comparator, reason }); };
  for (const comp of new Set(inputs.map(i => i.comparator))) {
    const valid = inputs.filter(i => i.comparator === comp && i.delta !== null);
    const n = Math.ceil(valid.length * .1);
    const tie = id => sha256((manifest.design.selection_seed ?? 'astra-probe-seed-policy-r1-20261006')+'|'+id);
    const ordered = [...valid].sort((a,b) => a.delta-b.delta || tie(a.inputId).localeCompare(tie(b.inputId)));
    for (const i of ordered.slice(0,n)) mark(i, 'TOP_BENEFIT');
    for (const i of ordered.slice(-n)) mark(i, 'TOP_HARM');
  }
  for (const i of inputs) {
    if (i.issues.length) mark(i, 'STATUS_OR_PAIR');
    if (i.variability >= 1.1) mark(i, 'VARIABILITY');
    // Conservative union: all changed cases and every near/per-input gate case.
    // This covers leave-one-out gate impact without hiding aggregate uncertainty.
    const m = i.metadata;
    if ((!m.primary_hard && m.d >= 17) || (m.primary_hard && m.d <= 16)) mark(i, 'CHANGED_GATE_IMPACT');
    if (i.delta !== null && i.delta >= .95 * Math.max(5, .05 * i.baseMs)) mark(i, 'FAST_GATE_IMPACT');
    const ratios = key => i.pairs.map(p => {
      const a = p.base.execution?.memoryScope?.[key], b = p.candidate.execution?.memoryScope?.[key];
      return a > 0 && b !== null && b !== undefined ? b/a : null;
    }).filter(r => r !== null);
    if (['cpuUsec','peakBytes'].some(key => median(ratios(key)) >= 1.045)) mark(i, 'RESOURCE_GATE_IMPACT');
  }
  for (const id of manifest.design.retest.always_include_fixture_ids) if (inputs.some(i => i.inputId === id)) selected.add(id);
  return { selected: [...selected].sort(), decisions: decision, policy: 'CONSERVATIVE_CHANGED_PLUS_TAIL_STATUS_VARIANCE_GATE_SELECTION' };
}
export function prerequisiteGate(rows, phase, { cpPreflight } = {}) {
  if (!['CANARY','CALIBRATION'].includes(phase)) return { status: 'HOLD', reason: 'UNKNOWN_GATE' };
  const allowed = new Set(['EXACT','TIMEOUT_CALL','INCOMPLETE']);
  const errors = rows.filter(r => !allowed.has(r.status) || r.execution?.reaped !== true
    || r.status === 'EXACT' && (!Number.isFinite(r.ms) || r.ms < 0 || r.execution.result?.verified?.completed !== true
      || !Array.isArray(r.execution.result?.verified?.selected) || !Array.isArray(r.execution.result?.verified?.qualityVector)));
  if (!rows.length || errors.length) return { status: 'HOLD', reason: 'EXECUTION_OR_COVERAGE', errors: errors.map(r => r.callId ?? null) };
  // Feature detection alone cannot prove the CP worker can initialize, solve,
  // prove quality/tie, and terminate in the actual Linux process-tree scope.
  if (cpPreflight?.status !== 'EXACT' || cpPreflight.reaped !== true
    || cpPreflight.result?.cpPreflight !== 'PASS' || cpPreflight.result?.qualityComplete !== true
    || cpPreflight.result?.tieComplete !== true) return { status: 'HOLD', reason: 'CP_PREFLIGHT_REQUIRED' };
  const cpErrors = rows.filter(r => {
    const record = r.execution.result;
    const failure = record?.result?.secondaryCpFailure;
    const trace = [...(record?.trace ?? []), ...(r.execution.policyTrace ?? [])];
    return trace.some(e => e.name === 'cp-end' && ['ERROR','INVALID'].includes(e.kind))
      || Boolean(failure && !/^(Error: )?CP secondary time limit reached$|^(TIMEOUT|UNKNOWN|FEASIBLE|incomplete CP proof)$/.test(failure));
  });
  if (cpErrors.length) return { status: 'HOLD', reason: 'CP_RUNTIME_OR_PROOF_FAILURE', errors: cpErrors.map(r => r.callId ?? null) };
  if (phase === 'CANARY') {
    const groups = new Map();
    for (const r of rows) { if (!groups.has(r.inputId)) groups.set(r.inputId, []); groups.get(r.inputId).push(r); }
    for (const ps of groups.values()) {
      if (ps.length !== 4 || new Set(ps.map(r => r.variant)).size !== 4
        || !['PRECHANGE_BASELINE','BASELINE','A','B'].every(v => ps.some(r => r.variant === v)))
        return { status: 'HOLD', reason: 'CANARY_VARIANT_COVERAGE' };
      const old = ps.find(r => r.variant === 'PRECHANGE_BASELINE'), base = ps.find(r => r.variant === 'BASELINE');
      if (old.status !== base.status) return { status: 'HOLD', reason: 'BASELINE_STATUS_DRIFT' };
      if (base.status === 'EXACT' && ps.some(r => r.status !== 'EXACT'))
        return { status: 'HOLD', reason: 'CANARY_COMPLETION_REGRESSION' };
      const exact = ps.filter(r => r.status === 'EXACT');
      if (new Set(exact.map(r => digest(r.execution.result.verified))).size > 1) return { status: 'HOLD', reason: 'WITNESS_DRIFT' };
    }
  }
  if (phase === 'CALIBRATION') {
    const inputs = pairedInputs(rows,phase), valid = inputs.filter(i => i.ratio !== null);
    if (inputs.some(i => i.issues.length)) return { status: 'HOLD', reason: 'CALIBRATION_PAIR_OR_STATUS' };
    if (valid.length < 12) return { status: 'HOLD', reason: 'INSUFFICIENT_COMPLETE_CALIBRATION' };
    for (const input of valid) for (const pair of input.pairs) if (pair.base.status==='EXACT'&&pair.candidate.status==='EXACT') {
      if (digest(pair.base.execution.result.verified)!==digest(pair.candidate.execution.result.verified))
        return {status:'HOLD',reason:'TRACE_WITNESS_DRIFT'};
      const a=pair.base.execution.result.result,b=pair.candidate.execution.result.result;
      if (!a.secondaryCpStarted&&!b.secondaryCpStarted && a.qualitySearchedStates!==b.qualitySearchedStates)
        return {status:'HOLD',reason:'TRACE_NATIVE_STATES_DRIFT'};
    }
    if (median(valid.map(i => i.delta)) > Math.max(2, .02*median(valid.map(i => i.baseMs)))
      || valid.some(i => i.delta > Math.max(5, .05*i.baseMs))) return { status: 'HOLD', reason: 'TRACE_OVERHEAD' };
  }
  return { status: 'PASS', phase, performancePass: false };
}
export function developmentReport(manifest, rows) {
  const initial = pairedInputs(rows,'ALL_INITIAL'), confirmation = pairedInputs(rows,'ALL_CONFIRMATION');
  const issues = [];
  for (const i of initial) {
    const c = confirmation.find(c => c.inputId===i.inputId && c.comparator===i.comparator);
    for (const stage of [i,c].filter(Boolean)) if (stage.pairs.some(p => p.base.status==='EXACT' && p.candidate.status!=='EXACT'))
      issues.push({ inputId:i.inputId,comparator:i.comparator,reason:'POSSIBLE_COMPLETION_REGRESSION',confirmed:Boolean(c) });
    if (i.metadata.primary_hard && i.metadata.d<=16 && !c) issues.push({ inputId:i.inputId,reason:'HARD_CONFIRMATION_MISSING' });
  }
  const summaries = ['A','B'].map(comparator => {
    const cases=initial.filter(i=>i.comparator===comparator);
    const changed=cases.filter(i=>(!i.metadata.primary_hard&&i.metadata.d>=17)||(comparator==='B'&&i.metadata.primary_hard&&i.metadata.d<=16));
    const high=changed.filter(i=>!i.metadata.primary_hard);
    const fast=cases.filter(i=>i.metadata.n<=48||(!i.metadata.primary_hard&&i.metadata.d<=8));
    const groupedRatio = inputs => {
      const valid=inputs.filter(i=>i.ratio!==null),groups=new Map();
      for(const i of valid){const id=i.metadata.mirror_group;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(Math.log(i.ratio));}
      if(!valid.length)return {n:0,gmean:null,bootstrap95:null};
      const values=[...groups.values()],boot=[];
      let state=Number.parseInt(sha256(manifest.design.selection_seed).slice(0,8),16)>>>0;
      const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      for(let b=0;b<2000;b++){let sum=0,n=0;for(let k=0;k<values.length;k++)for(const x of values[Math.floor(random()*values.length)]){sum+=x;n++;}boot.push(Math.exp(sum/n));}
      return {n:valid.length,mirrorGroups:values.length,gmean:Math.exp(valid.reduce((sum,i)=>sum+Math.log(i.ratio),0)/valid.length),
        bootstrap95:[percentile(boot,.025),percentile(boot,.975)]};
    };
    const resources=key=>cases.map(i=>({inputId:i.inputId,ratio:median(i.pairs.map(p=>{
      if(p.base.status!==p.candidate.status||!['EXACT','TIMEOUT_CALL'].includes(p.base.status))return null;
      const a=p.base.execution?.memoryScope?.[key],b=p.candidate.execution?.memoryScope?.[key];
      return a>0&&b!==null&&b!==undefined?b/a:null;
    }).filter(v=>v!==null))}));
    const cpu=resources('cpuUsec'),memory=resources('peakBytes');
    const time=groupedRatio(high),full=groupedRatio(cases);
    const fastDeltas=fast.filter(i=>i.delta!==null).map(i=>i.delta);
    const failures=[];
    if(fast.some(i=>i.delta!==null&&i.delta>Math.max(5,.05*i.baseMs))||percentile(fastDeltas,.95)>5)failures.push('FAST_REGRESSION');
    for(const i of changed){const c=confirmation.find(c=>c.inputId===i.inputId&&c.comparator===comparator);
      if(c&&i.delta>Math.max(1000,.2*i.baseMs)&&c.delta>Math.max(1000,.2*c.baseMs))failures.push('CONFIRMED_LARGE_REGRESSION:'+i.inputId);}
    const hard=changed.filter(i=>i.metadata.primary_hard).map(i=>({inputId:i.inputId,initialDelta:i.delta,initialRatio:i.ratio,
      confirmationDelta:confirmation.find(c=>c.inputId===i.inputId&&c.comparator===comparator)?.delta??null}));
    const benefit=time.n>=10&&time.gmean<=.95&&time.bootstrap95[1]<1;
    return {comparator,matrices:cases.length,changed:changed.length,highDTime:time,allCompletedTime:full,
      initialTimeBenefitGate:benefit,fastDeltaP95:percentile(fastDeltas,.95),hardIncrement:hard,
      cpuRatios:cpu,peakMemoryRatios:memory,
      cpuRatioP95:percentile(cpu.map(r=>r.ratio).filter(v=>v!==null),.95),peakRatioP95:percentile(memory.map(r=>r.ratio).filter(v=>v!==null),.95),
      resourcesAvailableFraction:cases.length?cpu.filter(r=>r.ratio!==null).length/cases.length:null,
      preliminaryBlockingReasons:failures,decision:'HOLD_FOR_PHASE_SEPARATED_FULL_GATE_REVIEW',
      pendingJudgments:['matched-watchdog CPU benefit gate','five-case B increment individual confirmation','confirmed completion regression','independent raw audit completeness']};
  });
  return { status: 'DEVELOPMENT_EVIDENCE_ONLY_ASTRA_REVIEW_REQUIRED', freshValidation:false, performancePass:false,
    rows:rows.length, initial:initial.map(({pairs,...i}) => i), confirmation:confirmation.map(({pairs,...i}) => i), issues,
    gates:manifest.design.gates,summaries,
    note:'No automatic performance PASS. Full gates and phase-separated censoring reviewed from raw evidence; raw initial and selected retest remain separate.' };
}
