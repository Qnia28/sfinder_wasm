import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,write} from './common.mjs';
const text=fs.readFileSync(`${ROOT}/.a0/build/product-tests.log`,'utf8');
assert.match(text,/ℹ tests 193\b/);assert.match(text,/ℹ pass 193\b/);assert.match(text,/ℹ fail 0\b/);assert.match(text,/ℹ skipped 0\b/);
write(`${ROOT}/.a0/build/TESTS.json`,{status:'PASS',uniqueProductTests:193,passed:193,skipped:0,failed:0,hosted:true,node:process.version,JSPI:true,baselineRoot:'.a0/baseline',actualCampaignInputsUsed:false});console.log('193 hosted product tests PASS, skipped0.');
