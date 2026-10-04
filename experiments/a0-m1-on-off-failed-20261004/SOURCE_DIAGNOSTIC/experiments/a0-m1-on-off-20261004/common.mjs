import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
export const HERE=import.meta.dirname, ROOT=path.resolve(HERE,'../..');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function write(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});}
export function matrix(entry){const bytes=fs.readFileSync(path.join(HERE,entry.file));assert.equal(sha(bytes),entry.sha256);const m=JSON.parse(gunzipSync(bytes));assert.equal(m.identitySha256,entry.identitySha256);assert.equal(m.K,entry.K);assert(m.primary.cardinalityProven);return m;}
export function requestMatrixSha256(keys,cases,rows){
  const original=cases.map((c,i)=>[String(c.sourceCaseId??c.caseId),rows[i].map(e=>[...e]).sort((a,b)=>a[0]-b[0])]);
  original.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  return sha(JSON.stringify([keys,original]));
}
export function verify(m,r){
  assert.equal(r.regeneratedMatrixSha256,requestMatrixSha256(m.keys,m.cases,m.rows),'Regenerated original weighted matrix differs');
  assert.equal(r.minimalCount,m.K);assert.equal(r.keys.length,m.K);assert.equal(new Set(r.keys).size,m.K);
  const ids=new Set(r.keys.map(k=>{const i=m.keys.indexOf(k);assert(i>=0);return i;}));
  const vector=m.rows.map(row=>{const q=Math.max(0,...row.filter(([id])=>ids.has(id)).map(([,q])=>q));assert(q>0);return q;}).sort((a,b)=>a-b);
  assert.deepEqual(r.humanQualityVector,vector);assert.equal(r.humanQualityExact,true);
  return {minimumK:m.K,weightedRows:vector.length,qualitySha256:sha(JSON.stringify(vector)),stableIdsSha256:sha(JSON.stringify([...ids].sort((a,b)=>a-b))),originalIdentity:m.identitySha256};
}
