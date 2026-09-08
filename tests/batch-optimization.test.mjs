import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {calculateCover} from '../src/batch-cover-feature.mjs';
import {calculateCongruent,calculateCongruentCover} from '../src/batch-congruent-feature.mjs';
import {calculateCoverPercent} from '../src/batch-cover-percent-feature.mjs';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {findCongruentSolutions} from '../src/batch-setup.mjs';
import {expandPattern} from '../src/pattern.mjs';
import {modes,fumen,smallCover,box,benchmarkCases,canonical} from './batch-fixtures.mjs';

for(const mode of modes) for(const useHold of [false,true]) test(`coverage parity ${mode}, Hold=${useHold}`,async()=>{
 const input={sourceFumen:smallCover,pattern:'IOT;OTI;TIO;IOT',mode,useHold,mirror:'yes'};
 const full=await calculateCover(input), coverage=await calculateCover({...input,outputMode:'coverage'});
 const stripped={...full,targets:full.targets.map(({variants,orders,...target})=>target)};
 assert.deepEqual(coverage,stripped);
});

test('Rust congruent equals independent JS geometry/order traversal',async()=>{
 const e=await loadBatchWasm();
 for(const physics of ['jstris','tetrio']) for(const useHold of [false,true]){
  const backend=new BatchReachability(e,4,physics);
  const oracle={placeExact:backend.placeExact.bind(backend),tSpinKind:backend.tSpinKind.bind(backend)};
  for(const fill of [15n|(15n<<10n)|(15n<<20n),255n|(255n<<10n)]){
   const args={base:0n,fill,height:4,queues:expandPattern('*p4'),useHold};
   const normalize=solutions=>solutions.map(s=>({key:s.key,orders:[...s.orders].sort()})).sort((a,b)=>a.key.localeCompare(b.key));
   assert.deepEqual(normalize(findCongruentSolutions({...args,reachability:backend})),normalize(findCongruentSolutions({...args,reachability:oracle})));
  }
 }
});

test('duplicate branch multiplicity and final held piece',async()=>{
 const input={sourceFumen:fumen(['OO........','OO........']),pattern:'IO;IO;OI;II',useHold:true,outputMode:'coverage'};
 const result=await calculateCover(input);
 assert.equal(result.covered,3);assert.equal(result.total,4);assert.deepEqual(result.failedQueues,['II']);
 assert.equal((await calculateCover({...input,useHold:false})).covered,1);
});

test('full default contracts match the release baseline',{skip:!process.env.BASELINE_ROOT},async()=>{
 for(const fixture of benchmarkCases){
  const load=root=>import(pathToFileURL(resolve(root,'src',fixture.module+'.mjs')));
  const before=await load(process.env.BASELINE_ROOT),after=await load(resolve(import.meta.dirname,'..'));
  assert.equal(canonical(await after[fixture.fn](fixture.input)),canonical(await before[fixture.fn](fixture.input)),fixture.name);
 }
});

test('cover-percent preserves its public output',async()=>{
 const result=await calculateCoverPercent({sourceFumen:fumen(['OO........','OO........']),pattern:'O',percentPattern:'I',clear:2});
 assert.equal(result.covered,1);assert.equal(result.solutions[0].covered,1);
 assert.ok(!('variants' in result.solutions[0]));
});
