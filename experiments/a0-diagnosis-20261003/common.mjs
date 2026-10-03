import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
export const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..');
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),jsonSha=v=>sha(JSON.stringify(v));
export const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
export function write(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});}
export function matrix(e){const fd=fs.openSync(`${HERE}/${e.pack}`,'r'),b=Buffer.alloc(e.length);try{if(fs.readSync(fd,b,0,b.length,e.offset)!==b.length)throw Error('Truncated matrix');}finally{fs.closeSync(fd);}if(sha(b)!==e.sha256)throw Error('Input drift');const m=JSON.parse(zlib.gunzipSync(b));if(jsonSha({keys:m.keys,rows:m.rows,K:m.K,seedKeys:m.seedKeys})!==e.identitySha256||!m.primary.cardinalityProven||jsonSha(m.seedKeys)!==e.seedKeysSha256)throw Error('Identity/seed/proof drift');return m;}
export {context,verify,compare} from '../a0-integrated-revalidation-20261003/common.mjs';
export function seal(dir){const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);write(`${dir}/FILES.json`,{files:walk(dir).map(f=>({file:path.relative(dir,f).replaceAll('\\','/'),bytes:fs.statSync(f).size,sha256:sha(fs.readFileSync(f))}))});}
