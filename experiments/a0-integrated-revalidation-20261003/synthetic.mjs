import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,write,append} from './common.mjs';
import {supervised} from './supervisor.mjs';
const out=`${ROOT}/.a0/synthetic`;fs.mkdirSync(out,{recursive:true});const results=[];
for(let fixture=0;fixture<32;fixture++)for(const variant of ['R','A']){
  const result=await supervised([String(fixture),variant],{script:'synthetic-sample.mjs',log:`${out}/${fixture}-${variant}.jsonl`});results.push(result);append(`${out}/results.jsonl`,result);assert.equal(result.status,'SYNTHETIC_PASS');
}
write(`${ROOT}/.a0/build/SYNTHETIC.json`,{status:'PASS',fixtures:32,variantRuns:64,nativeIntegratedCalls:64,nativeThresholdCalls:64,forcedCappedMarker:true,oracle:'exhaustive fixed-K combinations on small synthetic only',results});
console.log(JSON.stringify({status:'PASS',fixtures:32,variantRuns:64,nativeThresholdCalls:64}));
