import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,read,sha} from './common.mjs';
const b=read(`${ROOT}/.a0/build/BUILD.json`);
for(const f of [...b.sourceFiles,...b.harnessFiles])assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
assert.equal(sha(fs.readFileSync(`${ROOT}/.a0/build/pc_wasm.wasm`)),b.wasmSha256);
for(const root of [ROOT,`${ROOT}/.a0/baseline`])fs.copyFileSync(`${ROOT}/.a0/build/pc_wasm.wasm`,`${root}/wasm/pc_wasm.wasm`);
console.log('All sources, plan, inputs and identical R/A binary verified.');
