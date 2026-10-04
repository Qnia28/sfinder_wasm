import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver, WasmPcSolver } from '../src/wasm-backend.mjs';
import { normalizeExactProbe } from '../src/a0-m1-probe.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { minimumCoverAdaptiveAsync } from '../src/min-cover-adaptive.mjs';
import { solveExactSecondaryAsync, SECONDARY_CP_DELAY_MS } from '../src/min-cover-three-engine.mjs';
import { packFilterTask, solveFilterTask } from '../src/filter-cover-task.mjs';
import { ExactSecondaryPool } from '../src/exact-secondary-pool.mjs';

function fixture() {
  const rows = [[[0,1],[1,2]], [[1,2],[2,3]], [[0,1],[2,3]], [[0,1],[2,3]]];
  const view = createNumericCoverage(['000','001','002'], new Map(rows.map((r,i) => [i,r])), rows.map((_,caseId) => ({caseId})));
  return { ...view, qualityFor: (key,id) => view.qualityIndex.get(id)?.get(key) };
}
const context = { primary: { count: 2, backend: 'rust' }, primaryKeys: ['000','001'], primaryHard: false,
  requestedPrimary: 'rust', requested: false, kernelStats: { cases: 3, solutions: 3, entries: 6 }, secondary: 'rust' };
const witness = r => ({ count: r.count, keys: r.keys, qualityVector: r.qualityVector, completed: r.completed });

test('probe policy is explicit, reference is default, and CP60s remains unchanged', () => {
  assert.equal(normalizeExactProbe(), 'reference');
  assert.equal(normalizeExactProbe('a0-m1'), 'a0-m1');
  for (const x of ['on', true, 'M2', 'auto', null]) assert.throws(() => normalizeExactProbe(x));
  assert.equal(SECONDARY_CP_DELAY_MS, 60000);
});

test('ON calls only candidate partitioned100K; OFF calls only R; both preserve exact weighted witness', async () => {
  const ref = await createWasmSolver(4, { legal: false }), m = fixture();
  const original = WasmPcSolver.prototype.minimumCoverAtCount, calls = [];
  WasmPcSolver.prototype.minimumCoverAtCount = function(c,k,o) {
    calls.push({ candidate: this !== ref, k, ...o });
    return original.call(this,c,k,o);
  };
  try {
    const off = await solveExactSecondaryAsync(m.coverage, { ...context, solver: ref, qualityFor: m.qualityFor, exactProbeTiming: true });
    const on = await solveExactSecondaryAsync(m.coverage, { ...context, solver: ref, qualityFor: m.qualityFor, exactProbe: 'a0-m1' });
    assert.deepEqual(witness(on), witness(off));
    assert.equal(calls.length, 2);
    assert.equal(calls[0].candidate, false); assert.equal(!!calls[0].partitioned, false);
    assert.equal(calls[1].candidate, true); assert.equal(calls[1].partitioned, true);
    for (const c of calls) { assert.equal(c.stateBudget,100000); assert.equal(c.integrated,true); assert.equal(c.k,2); }
    assert.equal(on.exactProbeTrace.policy, 'a0-m1'); assert.equal(off.exactProbeTrace.policy, 'reference');
    assert.equal(on.exactProbeTrace.status, 'EXACT');
  } finally { WasmPcSolver.prototype.minimumCoverAtCount = original; ref.close(); }
});

test('CAPPED transfers identical incumbent, frees candidate before threshold, and reuses passed probe', async () => {
  const ref = await createWasmSolver(4, { legal: false }), m = fixture();
  const original = WasmPcSolver.prototype.minimumCoverAtCount, close = WasmPcSolver.prototype.close;
  let calls = 0, closed = 0, capped;
  WasmPcSolver.prototype.close = function() { if (this !== ref && this.ptr) closed++; return close.call(this); };
  WasmPcSolver.prototype.minimumCoverAtCount = function(c,k,o) {
    calls++;
    if (this !== ref) {
      assert.equal(o.stateBudget,100000); assert.equal(o.partitioned,true);
      capped = { ...original.call(this,c,k,o), completed:false, searchedStates:100000 };
      return capped;
    }
    assert.equal(closed,1); assert.equal(o.integrated,undefined); assert.equal(o.partitioned,undefined);
    assert.deepEqual(o.seedKeys,capped.keys); assert.deepEqual(o.lockedPrefix,[]);
    return original.call(this,c,k,o);
  };
  try {
    let transferred;
    await solveExactSecondaryAsync(m.coverage, { ...context, solver:ref, qualityFor:m.qualityFor, exactProbe:'a0-m1',
      deferThreshold: ctx => { transferred = ctx; return { secondaryPending: Promise.resolve('fixture') }; } });
    assert.equal(calls,1); assert.equal(closed,1); assert.equal(transferred.integratedProbe,capped);
    assert.equal(transferred.exactProbe,'a0-m1'); assert(transferred.secondaryElapsedMs>=0);
    const snapshot=JSON.stringify(capped);
    const result=await solveExactSecondaryAsync(m.coverage, { ...transferred, solver:ref, qualityFor:m.qualityFor });
    assert.equal(calls,2); assert.equal(closed,1); assert.equal(JSON.stringify(capped),snapshot);
    assert.equal(result.qualityExact,true); assert.equal(result.exactProbeTrace.status,'CAPPED');
    assert.equal(result.qualityDecision,'integrated-budget-to-threshold');
  } finally { WasmPcSolver.prototype.minimumCoverAtCount=original; WasmPcSolver.prototype.close=close; ref.close(); }
});

test('candidate invalid witness or exception never retries R and closes the candidate', async () => {
  const ref=await createWasmSolver(4,{legal:false}),m=fixture();
  const original=WasmPcSolver.prototype.minimumCoverAtCount,close=WasmPcSolver.prototype.close;
  let closed=0,referenceCalls=0;
  WasmPcSolver.prototype.close=function(){if(this!==ref&&this.ptr)closed++;return close.call(this);};
  try {
    for (const bad of ['throw','quality','keys','state']) {
      WasmPcSolver.prototype.minimumCoverAtCount=function(c,k,o){
        if(this===ref){referenceCalls++;throw Error('unexpected R retry');}
        if(bad==='throw')throw Error('candidate failure');
        const r=original.call(this,c,k,o);
        if(bad==='quality')return {...r,qualityVector:[1]};
        if(bad==='keys')return {...r,keys:['999','998']};
        return {...r,completed:undefined};
      };
      await assert.rejects(solveExactSecondaryAsync(m.coverage,{...context,solver:ref,qualityFor:m.qualityFor,exactProbe:'a0-m1'}));
    }
    assert.equal(referenceCalls,0);assert.equal(closed,4);
  } finally {WasmPcSolver.prototype.minimumCoverAtCount=original;WasmPcSolver.prototype.close=close;ref.close();}
});

test('pre-abort and bypass routes never invoke candidate; explicit modes and decomposition remain R',async()=>{
  const ref=await createWasmSolver(4,{legal:false}),m=fixture(),original=WasmPcSolver.prototype.minimumCoverAtCount;
  let candidateCalls=0;
  WasmPcSolver.prototype.minimumCoverAtCount=function(...a){if(this!==ref)candidateCalls++;return original.apply(this,a);};
  const options={...context,solver:ref,qualityFor:m.qualityFor,exactProbe:'a0-m1'};
  try{
    const controller=new AbortController();controller.abort(Error('cancel fixture'));
    await assert.rejects(solveExactSecondaryAsync(m.coverage,{...options,signal:controller.signal}),/cancel fixture/);
    for(const extra of [{primaryHard:true},{secondary:'integrated'},{secondary:'threshold'},{decomposition:'on'},{decomposition:'auto'}]){
      const result=await solveExactSecondaryAsync(m.coverage,{...options,...extra});assert.equal(result.qualityExact,true);
    }
    const trivial=createNumericCoverage(['000'],new Map([[0,[[0,2]]]]),[{caseId:0}]);
    const result=await solveExactSecondaryAsync(trivial.coverage,{...options,qualityFor:()=>2,primary:{count:1,backend:'rust'},primaryKeys:['000']});
    assert.equal(result.qualityDecision,'trivial-exact');assert.equal(candidateCalls,0);
    await minimumCoverAdaptiveAsync(m.coverage,{solver:ref,qualityFor:m.qualityFor,exactQuality:'fast',primary:'rust',tinyExactMaxCandidates:0,exactProbe:'a0-m1'});
    assert.equal(candidateCalls,0);
  }finally{WasmPcSolver.prototype.minimumCoverAtCount=original;ref.close();}
});

test('adaptive, whole-filter and secondary Worker transports carry immutable request policy',async()=>{
  const ref=await createWasmSolver(4,{legal:false}),m=fixture(),pool=new ExactSecondaryPool(1);
  try{
    const options={primary:'rust',secondary:'rust',exactQuality:'true',tinyExactMaxCandidates:0,exactProbe:'a0-m1'};
    const direct=await minimumCoverAdaptiveAsync(m.coverage,{...options,solver:ref,qualityFor:m.qualityFor});
    const payload=packFilterTask(m.coverage,m.qualityFor,options);assert.equal(payload.options.exactProbe,'a0-m1');
    const filter=await solveFilterTask(payload,ref);assert.deepEqual(witness(filter),witness(direct));
    const pending=await minimumCoverAdaptiveAsync(m.coverage,{...options,solver:ref,qualityFor:m.qualityFor,
      deferExactSecondary:(prepared,ctx)=>pool.submit(prepared,ctx)});
    const queued=await pending.secondaryPending;assert.deepEqual(witness(queued),witness(direct));
    assert.equal(queued.exactProbeTrace.policy,'a0-m1');
    const off=await minimumCoverAdaptiveAsync(m.coverage,{...options,solver:ref,qualityFor:m.qualityFor,exactProbe:'reference',exactProbeTiming:true});
    assert.equal(off.exactProbeTrace.policy,'reference');assert.deepEqual(witness(off),witness(direct));
  }finally{await pool.dispose();ref.close();}
});
