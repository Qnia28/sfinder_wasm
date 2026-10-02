// Local immutable input packaging, no solver imports.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { HERE, read, write, sha, jsonSha } from './common.mjs';
const [capture, planning, legacy] = process.argv.slice(2).map(p => path.resolve(p));
const plan = read(path.join(planning,'PLAN.json'));
const population = read(path.join(planning,'POPULATION.json')).matrices;
const schedule = read(path.join(planning,'SCHEDULE_DEVELOPMENT.json')).runs;
const entries = [], packs = [];
function pack(name, matrices, bytesFor) {
  const file = `inputs/${name}.bin`, chunks = [], rows = [];
  let offset = 0;
  for (const m of matrices) {
    const bytes = bytesFor(m); assert.equal(sha(bytes),m.sha256);
    rows.push({ ...m, pack:file, offset, length:bytes.length }); chunks.push(bytes); offset += bytes.length;
  }
  assert(offset <= 25 * 2 ** 20);
  fs.mkdirSync(path.join(HERE,'inputs'),{recursive:true});
  fs.writeFileSync(path.join(HERE,file),Buffer.concat(chunks),{flag:'wx'});
  entries.push(...rows); packs.push({file,bytes:offset,sha256:sha(fs.readFileSync(path.join(HERE,file))),ids:rows.map(m=>m.id)});
}
for (const shard of plan.shards) pack(`development-${shard.shard}`, population.filter(m=>shard.matrices.includes(m.id)), m=>fs.readFileSync(path.join(capture,m.captureFile)));
pack('reserved',population.filter(m=>m.partition==='reserved-validation'), m=>fs.readFileSync(path.join(capture,m.captureFile)));
const oldManifest = read(path.join(legacy,'manifest.json'));
const old = plan.phases.regression.legacyIds.map((id,i)=> {
  const source=fs.readFileSync(path.join(legacy,'inputs',`${id}.json`));
  assert.equal(sha(source),oldManifest.files[`inputs/${id}.json`]);
  const m=JSON.parse(source), seedKeys=m.seed.map(i=>m.keys[i]);
  assert(seedKeys.length===m.K);
  const matrix={...m,id:`legacy-${id}`,seedKeys,partition:'legacy-regression'};
  const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(matrix)),{level:9});
  return {id:matrix.id,partition:matrix.partition,sourceFile:`inputs/${id}.json`,sourceSha256:sha(source),identitySha256:jsonSha({keys:m.keys,rows:m.rows,K:m.K,seedKeys}),sha256:sha(bytes),K:m.K,n:m.keys.length,R:m.rows.length,E:m.rows.reduce((n,r)=>n+r.length,0),route:'LEGACY_REGRESSION',legacyShard:i%2,bytes};
});
pack('legacy',old.map(({bytes,...m})=>m),m=>old.find(o=>o.id===m.id).bytes);
write(path.join(HERE,'INPUTS.json'),{entries,packs});
write(path.join(HERE,'SCHEDULE.json'),{runs:schedule});
write(path.join(HERE,'PLAN.json'),plan);
write(path.join(HERE,'CAPTURE_PROVENANCE.json'),{captureRun:36998333213,selection:plan.captureSelectionSha256,index:plan.captureIndexSha256,audit:plan.independentAuditSha256,legacyManifestSha256:sha(fs.readFileSync(path.join(legacy,'manifest.json')))});
console.log(JSON.stringify({entries:entries.length,packs:packs.length,bytes:packs.reduce((n,p)=>n+p.bytes,0),developmentRuns:schedule.length,secondaryCalls:0}));
