import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,read,sha} from './common.mjs';
const lock=read(`${ROOT}/.a0/build/LOCK.json`);
for(const f of lock.files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
assert.equal(sha(fs.readFileSync(`${ROOT}/.a0/build/pc_wasm.wasm`)),lock.wasmSha256);
for(const root of [ROOT,`${ROOT}/.a0/baseline`])fs.copyFileSync(`${ROOT}/.a0/build/pc_wasm.wasm`,`${root}/wasm/pc_wasm.wasm`);
