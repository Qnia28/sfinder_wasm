import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,BASELINE,EXPECTED_WASM,read,write,sha,matrix,verify,jsonSha} from './common.mjs';
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,maxBuffer:64*2**20});
assert.equal(git('diff','--name-only','b64fcba9846ff3f9c88bb21b9d200c9d7ba18b45','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json').toString(),'');
for(const file of [`${ROOT}/wasm/pc_wasm.wasm`,`${ROOT}/.a0/baseline/wasm/pc_wasm.wasm`])assert.equal(sha(fs.readFileSync(file)),EXPECTED_WASM);
const entry=read(`${HERE}/INPUT.json`),m=matrix(entry),expected=read(`${HERE}/EXPECTED.json`);
const w=verify(m,expected.probe);assert.deepEqual(w.selectedIDs,expected.selectedIDs);assert.deepEqual(expected.qualityVector,expected.probe.qualityVector);
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json','experiments/a0-proof-retest-20261003','experiments/a0-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003','.github/workflows/a0-proof-retest.yml').toString().trim().split('\n');
const files=names.filter(f=>!f.includes('/results/')&&!f.includes('/inputs/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
write(`${ROOT}/.a0/proof/LOCK.json`,{commit:git('rev-parse','HEAD').toString().trim(),baseline:BASELINE,wasmSha256:EXPECTED_WASM,files,input:entry,
 expectedSha256:jsonSha(expected),primaryProofSha256:jsonSha(m.primary),campaign:read(`${HERE}/CAMPAIGN.json`),
 rulesSha256:sha(fs.readFileSync(`${HERE}/TESTING_RULES_KO.md`)),independence:'Sequential fixed-K threshold search, not integrated partitioned BestSetSearch. Shared coverage/gain helpers and original input/WASM remain; not a fully separate implementation.',
 maxCalls:1,stateBudget:2000000,apiSeconds:30,processSeconds:45,startupSeconds:45,auditSeconds:30,durableAckSeconds:10,reapSeconds:2,noProductChanges:true});
