import {ORTOOLS_PRIMARY_PARAMETERS, assertORToolsSupported} from './ortools-min-cover.mjs';
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const nodeThreads = 'node:worker_threads';
const port = isNode ? (await import(/* @vite-ignore */ nodeThreads)).parentPort : null;
async function run(kernel) {
  let api, message;
  try {
    assertORToolsSupported();
    const nodeApi = './vendor/ortools/node/cp-sat.js';
    api = isNode ? await import(/* @vite-ignore */ nodeApi) : await import('./vendor/ortools/browser/cp-sat.js');
    const {CpModel, CpSolver, LinearExpr} = api;
    const model = new CpModel();
    const x = kernel.solutionIds.map((_, i) => model.newBoolVar('x' + i));
    for (const row of kernel.cases) model.add(LinearExpr.sum(row.map(i => x[i])).ge(1));
    model.minimize(LinearExpr.sum(x));
    const cp = new CpSolver();
    const status = cp.statusName(await cp.solve(model, {...ORTOOLS_PRIMARY_PARAMETERS, executor: 'direct'}));
    if (status !== 'OPTIMAL' || cp.bestObjectiveBound() !== cp.objectiveValue()) throw new Error('ORTools did not prove OPTIMAL: ' + status);
    const local = x.flatMap((v, i) => cp.value(v) ? [i] : []);
    if (local.length !== cp.objectiveValue()) throw new Error('ORTools witness/objective mismatch');
    const selected = [...kernel.forced, ...local.map(i => kernel.solutionIds[i])];
    message = {result: {count: selected.length, selected, backend: 'ortools', status,
      proofBound: cp.bestObjectiveBound() + kernel.forced.length, searchedStates: cp.numBranches}};
  } catch (error) { message = {error: error.stack || String(error)}; }
  finally {
    try { await api?.terminateLoadedRuntimeThreads(); }
    catch (error) { message = {error: 'ORTools cleanup failed: ' + String(error)}; }
  }
  if (port) port.postMessage(message); else postMessage(message);
}
if (port) port.once('message', run); else onmessage = event => run(event.data);
