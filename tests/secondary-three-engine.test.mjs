import test from 'node:test';
import assert from 'node:assert/strict';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { minimumCoverAdaptiveAsync } from '../src/min-cover-adaptive.mjs';
import { solveExactSecondaryAsync, normalizeSecondary, validateSecondaryWitness, SECONDARY_CP_DELAY_MS } from '../src/min-cover-three-engine.mjs';
import { prepareSecondaryEngineInput, startSecondaryEngine, raceSecondaryEngines } from '../src/secondary-engine-runner.mjs';
import { isORToolsSupported } from '../src/ortools-min-cover.mjs';
import { packFilterTask, solveFilterTask } from '../src/filter-cover-task.mjs';
import { ExactSecondaryPool } from '../src/exact-secondary-pool.mjs';

function matrix(rows, n = Math.max(...rows.flatMap(row => row.map(([id]) => id))) + 1) {
  const keys = Array.from({ length: n }, (_, i) => String(i).padStart(3, '0'));
  const view = createNumericCoverage(keys, new Map(rows.map((row, i) => [i, row])), rows.map((_, caseId) => ({ caseId })));
  return { ...view, qualityFor: (key, caseId) => view.qualityIndex.get(caseId)?.get(key) };
}
const triangle = () => matrix([[[0,1],[1,1]],[[1,1],[2,1]],[[0,1],[2,1]]]);
const done = { completed: true, count: 2, keys: ['000','001'], qualityVector: [1,1,1], qualityComplete: true, tieComplete: true };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); promise.catch(() => {}); return { promise, resolve, reject, stops: 0, async stop() { this.stops++; } }; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('auto delay is one minute, modes are explicit and invalid modes fail', () => {
  assert.equal(SECONDARY_CP_DELAY_MS, 60000);
  for (const mode of ['auto','rust','integrated','threshold','cpsat']) assert.equal(normalizeSecondary(mode.toUpperCase()), mode);
  assert.throws(() => normalizeSecondary('heuristic'));
});
test('easy Rust proof never initializes CP and always reaps the engine', async () => {
  const rust = deferred(); let cpCalls = 0;
  const job = raceSecondaryEngines({ startRust: () => rust, startCp: () => { cpCalls++; throw Error('unexpected'); }, cpAfterMs: 30 });
  rust.resolve(done); const result = await job; await pause(40);
  assert.equal(result.engine, 'rust'); assert.equal(result.cpStarted, false); assert.equal(cpCalls, 0); assert.equal(rust.stops, 1);
});
test('late CP joins without stopping Rust; Rust can still win after CP starts', async () => {
  const rust = deferred(), cp = deferred();
  const job = raceSecondaryEngines({ startRust: () => rust, startCp: () => cp, cpAfterMs: 1 });
  await pause(10); assert.equal(rust.stops, 0); rust.resolve(done);
  const result = await job; assert.equal(result.engine, 'rust'); assert.equal(result.cpStarted, true); assert.equal(cp.stops, 1);
});
test('CP winner needs quality AND stable-ID proof; unproved/error CP leaves Rust alive', async () => {
  for (const cpResult of [{ ...done, completed: false }, { ...done, tieComplete: false }, new Error('CP unavailable')]) {
    const rust = deferred(), cp = deferred();
    const job = raceSecondaryEngines({ startRust: () => rust, startCp: () => cp, cpAfterMs: 0 });
    await pause(5); if (cpResult instanceof Error) cp.reject(cpResult); else cp.resolve(cpResult);
    await pause(5); assert.equal(rust.stops, 0); rust.resolve(done); assert.equal((await job).engine, 'rust');
  }
  const rust = deferred(), cp = deferred();
  const job = raceSecondaryEngines({ startRust: () => rust, startCp: () => cp, cpAfterMs: 0 });
  await pause(5); cp.resolve(done); assert.equal((await job).engine, 'cpsat'); assert.equal(rust.stops, 1);
});
test('cancellation terminates all active engines', async () => {
  for (const abort of [true]) {
    const rust = deferred(), cp = deferred(), controller = new AbortController(), error = new Error('stop test');
    const job = raceSecondaryEngines({ startRust: () => rust, startCp: () => cp, cpAfterMs: 0, signal: controller.signal });
    await pause(5); if (abort) controller.abort(error); else rust.reject(error);
    await assert.rejects(job, e => e === error); assert.equal(rust.stops, 1); assert.equal(cp.stops, 1);
  }
});
test('Rust failure preserves CP progress and both failures surface without hanging', async () => {
  for(const late of [false,true]) {
    const rust=deferred(),cp=deferred();let starts=0;
    const job=raceSecondaryEngines({startRust:()=>rust,startCp:()=>{starts++;return cp;},cpAfterMs:late?0:60000});
    if(late)await pause(5);
    rust.reject(new Error('Rust worker failed'));await pause(5);
    assert.equal(starts,1);assert.equal(cp.stops,0);cp.resolve(done);
    const r=await job;assert.equal(r.engine,'cpsat');assert.match(r.rustFailure,/Rust worker failed/);
  }
  const rust=deferred(),cp=deferred();
  const job=raceSecondaryEngines({startRust:()=>rust,startCp:()=>cp,cpAfterMs:0});
  await pause(5);cp.resolve({...done,completed:false,status:'UNKNOWN'});await pause(5);
  rust.reject(new Error('Rust failed too'));await assert.rejects(job,/Both exact secondary engines failed/);
});
test('original duplicate-row weights and witness coverage are checked independently', () => {
  const m = matrix([[[0,1],[1,3]],[[0,5],[1,1]],[[0,5],[1,1]]]);
  const payload = prepareSecondaryEngineInput(m.coverage, m.qualityFor, 1, ['000']);
  assert.deepEqual(validateSecondaryWitness(payload, { count:1, keys:['000'], qualityVector:[1,5,5], completed:true }).qualityVector, [1,5,5]);
  for (const bad of [{count:1,keys:['000'],qualityVector:[1,5],completed:true}, {count:1,keys:['999'],qualityVector:[1,5,5],completed:true}, {count:1,keys:['000'],qualityVector:[1,5,5],completed:false}]) assert.throws(() => validateSecondaryWitness(payload, bad));
});

test('real Rust explicit integrated/threshold and adaptive auto retain the same weighted exact witness', async () => {
  const solver = await createWasmSolver(4), m = triangle();
  try {
    for (const secondary of ['rust','auto','integrated','threshold']) {
      const result = await minimumCoverAdaptiveAsync(m.coverage, { solver, qualityFor:m.qualityFor, primary:'rust', exactQuality:'true', tinyExactMaxCandidates:0, secondary });
      assert.deepEqual(result.keys, done.keys); assert.deepEqual(result.qualityVector, done.qualityVector); assert.equal(result.qualityExact,true);
    }
  } finally { solver.close(); }
});

const cpOptions = { skip: !isORToolsSupported() };
test('CP model agrees with brute-force fixed-K oracle on weighted, tie and integer-range fixtures', cpOptions, async () => {
  const fixtures = [
    { rows:[[[0,1],[1,3]],[[0,5],[1,1]],[[0,5],[1,1]]], k:1 },
    { rows:[[[0,1],[1,1]],[[1,1],[2,1]],[[0,1],[2,1]]], k:2 },
    { rows:[[[0,0xffffffff],[1,2]],[[0,1],[1,0xfffffffe]]], k:1 },
  ];
  let state = 27; const next = () => (state = (Math.imul(state,1664525)+1013904223)>>>0);
  for (let f=0; f<5; f++) fixtures.push({ rows:Array.from({length:7},()=>Array.from({length:6},(_,id)=>[id,1+next()%9])),k:2 });
  const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
  for (const fixture of fixtures) {
    const m = matrix(fixture.rows), n=m.prepared.keys.length; let best=null;
    for (let mask=0; mask<1<<n; mask++) {
      const ids=Array.from({length:n},(_,i)=>i).filter(i=>mask&(1<<i)); if(ids.length!==fixture.k)continue;
      const vector=fixture.rows.map(row=>Math.max(0,...row.filter(([id])=>ids.includes(id)).map(([,q])=>q))).sort((a,b)=>a-b); if(vector[0]===0)continue;
      if(!best||compare(vector,best.vector)>0||(compare(vector,best.vector)===0&&compare(ids,best.ids)<0))best={ids,vector};
    }
    const payload=prepareSecondaryEngineInput(m.coverage,m.qualityFor,fixture.k,best.ids.map(i=>m.prepared.keys[i]));
    const engine=startSecondaryEngine('cpsat',payload,{limitMs:10000});
    try{const result=validateSecondaryWitness(payload,await engine.promise);assert.equal(result.qualityComplete,true);assert.equal(result.tieComplete,true);assert.deepEqual(result.keys,best.ids.map(i=>m.prepared.keys[i]));assert.deepEqual(result.qualityVector,best.vector);}finally{await engine.stop();}
  }
});
test('CP stable-ID proof spans multiple 30-bit blocks', cpOptions, async () => {
  const m=matrix([Array.from({length:65},(_,i)=>[i,1])],65),payload=prepareSecondaryEngineInput(m.coverage,m.qualityFor,1,['064']);
  const engine=startSecondaryEngine('cpsat',payload,{limitMs:10000});
  try{const result=await engine.promise;assert.deepEqual(result.keys,['000']);assert.equal(result.tieComplete,true);assert.equal(result.stages.filter(s=>s.phase==='tie').length,3);}finally{await engine.stop();}
});
test('CP explicit mode travels through adaptive, secondary pool and whole-filter transport', cpOptions, async () => {
  const solver=await createWasmSolver(4),m=triangle(),pool=new ExactSecondaryPool(1);
  try{
    const options={primary:'rust',secondary:'cpsat',exactQuality:'true',tinyExactMaxCandidates:0};
    const result=await minimumCoverAdaptiveAsync(m.coverage,{...options,solver,qualityFor:m.qualityFor});
    assert.deepEqual(result.keys,done.keys);assert.equal(result.qualityBackend,'ortools-quality-cpsat');
    const payload=packFilterTask(m.coverage,m.qualityFor,options);assert.equal(payload.options.secondary,'cpsat');
    assert.deepEqual((await solveFilterTask(payload,solver)).keys,done.keys);
    const defer=(prepared,context)=>pool.submit(prepared,context);defer.onlyHeavy=true;
    const queued=await minimumCoverAdaptiveAsync(m.coverage,{...options,solver,qualityFor:m.qualityFor,deferExactSecondary:defer});
    assert.deepEqual((await queued.secondaryPending).keys,done.keys);
  }finally{await pool.dispose();solver.close();}
});
test('pre-aborted real worker does not launch and does not detach owner buffers', async () => {
  const m=triangle(),payload=prepareSecondaryEngineInput(m.coverage,m.qualityFor,2,['000','002']);
  const controller=new AbortController(),error=new Error('aborted before worker');controller.abort(error);
  const engine=startSecondaryEngine('threshold',payload,{signal:controller.signal});
  await assert.rejects(engine.promise,e=>e===error);await engine.stop();assert(payload.offsets.byteLength>0);assert(payload.ids.byteLength>0);
});

test('production auto keeps a transferred integrated probe and runs real threshold without CP on easy work', cpOptions, async () => {
  const solver=await createWasmSolver(4),m=triangle();
  try {
    const probe={...done,completed:false,searchedStates:100000};
    solver.minimumCoverAtCount=()=>{throw Error('transferred integrated probe must not run again');};
    const result=await solveExactSecondaryAsync(m.coverage,{solver,qualityFor:m.qualityFor,secondary:'auto',
      primary:{count:2,backend:'rust'},primaryKeys:['000','002'],primaryHard:false,integratedProbe:probe,
      requestedPrimary:'rust',requested:false,kernelStats:{cases:3,solutions:3,entries:6}});
    assert.deepEqual(result.keys,done.keys);assert.deepEqual(result.qualityVector,done.qualityVector);
    assert.equal(result.secondaryResolved,'threshold');assert.equal(result.secondaryCpStarted,false);
    assert(result.qualitySearchedStates>=100000);
  }finally{solver.close();}
});

test('real threshold can win after the late CP worker has joined', cpOptions, async () => {
  const solver=await createWasmSolver(4),m=triangle();
  try {
    const result=await solveExactSecondaryAsync(m.coverage,{solver,qualityFor:m.qualityFor,secondary:'auto',secondaryElapsedMs:60000,
      primary:{count:2,backend:'rust'},primaryKeys:['000','002'],primaryHard:true,
      requestedPrimary:'rust',requested:false,kernelStats:{cases:3,solutions:3,entries:6}});
    assert.deepEqual(result.keys,done.keys);assert.equal(result.secondaryResolved,'threshold');assert.equal(result.secondaryCpStarted,true);
  }finally{solver.close();}
});
