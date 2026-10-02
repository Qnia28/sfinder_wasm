// Import only already-completed independent threshold proofs; no new solver.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,read,write,sha,jsonSha} from './common.mjs';
const source=path.resolve(process.argv[2]),references=[];
for(const name of fs.readdirSync(source).filter(n=>/^bench-crosscheck-\d+$/.test(n))){
  const dir=path.join(source,name),seal=read(`${dir}/FILES.json`);
  for(const f of seal.files)assert.equal(sha(fs.readFileSync(path.join(dir,f.file))),f.sha256);
  const bytes=fs.readFileSync(`${dir}/runs.jsonl`);
  for(const line of bytes.toString('utf8').trim().split('\n')){const row=JSON.parse(line);assert.equal(row.verdict,'VERIFIED_EXACT');assert.equal(row.status,'EXACT');
    references.push({matrixId:row.matrixId,selectedIDs:row.selectedIDs,qualitySha256:row.qualitySha256,sourceRunId:37018994637,sourceFile:`${name}/runs.jsonl`,sourceFileSha256:sha(bytes),sourceRowSha256:sha(line),sourceBuildSha256:row.buildSha256,referenceKind:'previous independent sequential threshold exact proof'});
  }
}
assert.equal(references.length,129);write(`${HERE}/EXACT_REFERENCES.json`,{references,solverCalls:0,referenceIndexSha256:jsonSha(references)});console.log('129 prior independent exact proofs sealed; no solver calls.');
