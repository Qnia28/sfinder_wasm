import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'../.a0-m1-build/browser');
const {chromium}=await import(process.env.A0_M1_PLAYWRIGHT_ROOT?pathToFileURL(path.join(process.env.A0_M1_PLAYWRIGHT_ROOT,'index.mjs')).href:'playwright-core');
const server=http.createServer((req,res)=>{
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'})[path.extname(file)]??'application/octet-stream');
  const stream=fs.createReadStream(file);stream.on('error',()=>res.writeHead(404).end());stream.pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/a0-m1-browser.html`);await page.waitForFunction(()=>window.ready);
  const caps=await page.evaluate(()=>window.capabilities);assert(caps.jspi&&caps.isolated);
  const off=await page.evaluate(()=>window.probe('reference'));assert(!requests.some(r=>r.includes('pc_a0_m1')));
  const on=await page.evaluate(()=>window.probe('a0-m1'));assert(requests.some(r=>r.includes('pc_a0_m1')));
  const transferred=await page.evaluate(p=>window.transferred(p),on),pooled=await page.evaluate(()=>window.pooled());
  for(const r of [on,transferred,pooled])for(const key of ['keys','qualityVector','count','qualityExact'])assert.deepEqual(r[key],off[key]);
  assert.equal(transferred.secondaryResolved,'threshold');assert.equal(transferred.secondaryCpStarted,false);
  assert.equal(transferred.exactProbeTrace.status,'CAPPED');assert.equal(pooled.exactProbeTrace.policy,'a0-m1');assert.deepEqual(errors,[]);
  const report={status:'BROWSER_SYNTHETIC_POLICY_LOAD_TRANSFER_AND_WORKER_CONTRACTS_PASS',caps,checks:4,
    offDoesNotFetchCandidate:true,realThresholdWorker:true,cpDelayUnchanged:true,actualCampaignInputs:0,errors};
  if(process.env.A0_M1_BROWSER_RECEIPT)fs.writeFileSync(process.env.A0_M1_BROWSER_RECEIPT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
