import test from'node:test';import assert from'node:assert/strict';import crypto from'node:crypto';import{createWasmSolver}from'../src/wasm-backend.mjs';import{calculateChance}from'../src/features.mjs';
const A='v115@ThR4BeBtCeR4zhBtKeAgH';
const sha=a=>crypto.createHash('sha256').update([...a].sort().join('\n')).digest('hex');
test('WASM ezchance golden 3108/5040 with exact failed set',async()=>{const s=await createWasmSolver(4);try{const r=calculateChance({sourceFumen:A,pattern:'*p7',solver:s});assert.equal(r.total,5040);assert.equal(r.success,3108);assert.equal(r.failed,1932);assert.equal(r.percent.toFixed(2),'61.67');assert.equal(sha(r.failedQueues),'108ff2e4828e632241aa2bc30b746e83084f188660d505bd7fd81659852fbd53')}finally{s.close()}});
