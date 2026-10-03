import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,read,write,sha,jsonSha,EXPECTED_WASM,matrix} from './common.mjs';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:128*2**20});
const commit=git('rev-parse','HEAD').toString().trim(),build=read(`${ROOT}/.a0/four/BUILD.json`),origin=read(`${ROOT}/.a0/four/ORIGIN.json`);
assert.equal(process.platform,'linux');assert.equal(commit,origin.sourceCommit);assert.equal(commit,process.env.GITHUB_SHA);assert(build.benchmarkEligible);
assert.equal(build.outputs.R.wasmSha256,EXPECTED_WASM);assert.equal(build.outputs.A0.wasmSha256,EXPECTED_WASM);
assert.equal(build.sourceDefaultControlMatchesOriginal,true,'Feature-off byte control gate is mandatory');
const diagnosticBuild=read(`${ROOT}/.a0/four/DIAGNOSTIC_BUILD.json`);
assert.equal(git('diff','--name-only','f0bc2647d67353edb7e78bb54afeadb6c9817444','HEAD','--','src','wasm','tests','scripts','package.json','package-lock.json').toString(),'');
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json','experiments/a0-four-arm-20261003','experiments/a0-diagnosis-20261003','experiments/a0-execution-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003','.github/workflows/a0-four-arm.yml').toString().trim().split('\n');
const files=names.filter(n=>!n.includes('/results/')&&!n.includes('/inputs/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
const runtimeFiles=[];
for(const [type,binaries] of [['timing',build],['diagnostic',diagnosticBuild]])for(const arm of ['R','A0','M1','M2']){
 const item=binaries.outputs[arm];assert.equal(item.diagnostics,type==='diagnostic');assert.equal(item.measured,type==='timing');
 const wasm=fs.readFileSync(`${ROOT}/${item.runtime}/wasm/pc_wasm.wasm`);assert.equal(sha(wasm),item.wasmSha256);
 const exports=WebAssembly.Module.exports(new WebAssembly.Module(wasm));assert.equal(exports.some(e=>e.name.includes('four_arm_diag')),type==='diagnostic');
 const collect=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?collect(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
 for(const path of collect(`${ROOT}/${item.runtime}`)){
  const relative=path.slice((`${ROOT}/${item.runtime}/`).length);
  if(relative.startsWith('src/'))assert.equal(sha(fs.readFileSync(path)),sha(git('show',`${arm==='R'?'c0cb2a048e7275bfea587d176b1954efff0a8a08':'HEAD'}:${relative}`)));
  if(relative==='wasm/legal_boards_4.lgb')assert.equal(sha(fs.readFileSync(path)),sha(fs.readFileSync(`${ROOT}/wasm/legal_boards_4.lgb`)));
  runtimeFiles.push({file:path.slice(ROOT.length+1).replaceAll('\\','/'),sha256:sha(fs.readFileSync(path))});
 }
}
for(const e of read(`${HERE}/INPUTS.json`).entries)matrix(e);
write(`${ROOT}/.a0/four/LOCK.json`,{commit,files,runtimeFiles,build,diagnosticBuild,origin,campaign:read(`${HERE}/CAMPAIGN.json`),diagnosticScheduleSha256:jsonSha(read(`${HERE}/DIAGNOSTIC_SCHEDULE.json`)),
 selectionSha256:jsonSha(read(`${HERE}/SELECTION.json`)),scheduleSha256:jsonSha(read(`${HERE}/SCHEDULE.json`)),referencesSha256:jsonSha(read(`${HERE}/REFERENCES.json`)),
 rulesSha256:sha(fs.readFileSync(`${HERE}/TESTING_RULES_KO.md`)),stage:'FOUR_ARM_BENCHMARK',noProductChanges:true});
