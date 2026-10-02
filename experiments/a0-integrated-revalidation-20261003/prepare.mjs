// Fixed metadata selection; compressed reserved segments are never decoded here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, ROOT, read, write, sha, jsonSha } from './common.mjs';
const source = path.resolve(process.argv[2]), old = read(path.join(source, 'INPUTS.json'));
const old16 = read(path.join(ROOT, 'experiments/a0-integration-20261003/INPUTS.json')).entries.filter(e => e.partition === 'development').map(e => e.id);
const eligible = old.entries.filter(e => e.partition === 'development' && e.route === 'INTEGRATED_100K_PROBE_ELIGIBLE');
const ids = new Set([...old16, ...[...eligible].sort((a,b) => b.E - a.E || a.id.localeCompare(b.id)).slice(0,16).map(e => e.id)]);
for (const e of [...eligible].sort((a,b) => sha(`a0-integrated-revalidation-20261003\0${a.id}`).localeCompare(sha(`a0-integrated-revalidation-20261003\0${b.id}`)))) { if (ids.size === 64) break; ids.add(e.id); }
assert.equal(ids.size,64);
const entries = [], packs = [];
for (const [phase, selected] of [['development', old.entries.filter(e => ids.has(e.id))], ['reserved', old.entries.filter(e => e.partition === 'reserved-validation')]]) {
  let offset = 0; const chunks = [];
  for (const e of selected) { const fd = fs.openSync(path.join(source, e.pack), 'r'), b = Buffer.alloc(e.length); try { assert.equal(fs.readSync(fd,b,0,b.length,e.offset),b.length); } finally { fs.closeSync(fd); } assert.equal(sha(b),e.sha256);
    entries.push({ ...e, pack: `inputs/${phase}.bin`, offset, sourcePack: e.pack, sourceOffset: e.offset }); chunks.push(b); offset += b.length; }
  const b = Buffer.concat(chunks), file = `inputs/${phase}.bin`; assert(b.length < 25*2**20); fs.mkdirSync(path.join(HERE,'inputs'),{recursive:true}); fs.writeFileSync(path.join(HERE,file),b,{flag:'wx'}); packs.push({file,bytes:b.length,sha256:sha(b)});
}
const runs = [];
for (const [phase, count] of [['development',8],['reserved',16]]) {
  const list = entries.filter(e => (phase==='reserved' ? e.partition==='reserved-validation' : ids.has(e.id)) && e.route==='INTEGRATED_100K_PROBE_ELIGIBLE').sort((a,b)=>a.id.localeCompare(b.id));
  list.forEach((e,i)=>{ const order = parseInt(sha(`a0-integrated-revalidation-20261003\0order\0${e.id}`).slice(0,2),16)%2 ? ['A','R']:['R','A'];
    [order,[...order].reverse(),[...order].reverse(),order].forEach((o,r)=>o.forEach((variant,j)=>runs.push({phase,shard:i%count,matrixId:e.id,variant,repetition:r+1,position:j+1,runId:`${phase}--${e.id}--${variant}--r${r+1}`}))); });
}
assert.equal(runs.length,1344);
write(path.join(HERE,'INPUTS.json'),{entries,packs,old16,sourceIndexSha256:jsonSha(old),selection:'old16 union E-largest16 then fixed salt hash to64',reservedFreshHoldoutCertified:false});
write(path.join(HERE,'POPULATION.json'),old); write(path.join(HERE,'SCHEDULE.json'),{runs});
console.log(JSON.stringify({development:64,reservedEligible:104,reservedTiny:115,probeCalls:runs.length,solverCalls:0,bytes:packs.reduce((n,p)=>n+p.bytes,0)}));
