// The harness and fixtures always come from the candidate checkout; only the
// implementation root changes. Each sample starts a fresh Node/WASM process.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus,platform,arch} from 'node:os';
import {benchmarkCases,canonical} from '../tests/batch-fixtures.mjs';
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
if(args.includes('--sample')){
 const root=resolve(option('--root','.')), results=[];
 for(const fixture of benchmarkCases.filter(f=>!option('--case',null)||f.name===option('--case',null))){
  const fn=(await import(pathToFileURL(resolve(root,'src',fixture.module+'.mjs'))))[fixture.fn];
  const coldStart=performance.now();const first=await fn(fixture.input);const coldMs=performance.now()-coldStart;
  const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
  const digest=hash(first);
  // Untimed warmup, followed by batched calls to reduce timer noise. All
  // serialization/hash checks are outside the measured implementation time.
  await fn(fixture.input);
  let ms=0,last;
  const iterations=Number(option('--iterations','5'));
  for(let i=0;i<iterations;i++){const start=performance.now();last=await fn(fixture.input);ms+=performance.now()-start;}
  if(hash(last)!==digest)throw Error(`${fixture.name}: unstable output`);
  results.push({name:fixture.name,coldMs,warmMs:ms/iterations,digest});
 }
 console.log(JSON.stringify({results,peakRss:process.resourceUsage().maxRSS}));
}else{
 const baseline=resolve(option('--baseline','../sfinder-baseline')),candidate=resolve(option('--candidate','.'));
 const pairs=Number(option('--pairs','5')), output=resolve(option('--out','benchmark-results'));
 if(!Number.isInteger(pairs)||pairs<3)throw Error('at least three paired samples are required');
 mkdirSync(output,{recursive:true});
 const samples={baseline:[],candidate:[]};
 for(let pair=0;pair<pairs;pair++)for(const side of pair%2?['candidate','baseline']:['baseline','candidate']){
  const root=side==='baseline'?baseline:candidate;
  const results=[],peakRss=[];
  for(const fixture of benchmarkCases){
   const run=spawnSync(process.execPath,[import.meta.filename,'--sample','--root',root,'--case',fixture.name,'--iterations',option('--iterations','5')],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:180000});
   if(run.status!==0)throw Error(`${side} ${fixture.name} sample failed: ${run.stderr||run.error}`);
   const sample=JSON.parse(run.stdout);results.push(...sample.results);peakRss.push(sample.peakRss);
  }
  samples[side].push({results,peakRss});
 }
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const rows=benchmarkCases.map((f,index)=>{
  const all=[...samples.baseline,...samples.candidate].map(s=>s.results[index]);
  if(new Set(all.map(x=>x.digest)).size!==1)throw Error(`${f.name}: baseline/candidate outputs differ`);
  const b=samples.baseline.map(s=>s.results[index]),c=samples.candidate.map(s=>s.results[index]);
  const baseMs=median(b.map(x=>x.warmMs)),candidateMs=median(c.map(x=>x.warmMs));
  return {name:f.name,baseMs,candidateMs,speedup:baseMs/candidateMs,baseColdMs:median(b.map(x=>x.coldMs)),candidateColdMs:median(c.map(x=>x.coldMs)),digest:all[0].digest};
 });
 const sha=root=>spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
 const result={baseline:sha(baseline),candidate:sha(candidate),node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,pairs,iterations:Number(option('--iterations','5')),rows,samples};
 writeFileSync(resolve(output,'results.json'),JSON.stringify(result,null,2));
 const markdown=['Same machine, pinned compiler/Node in CI, rebuilt WASM on both revisions, sequential alternating fresh processes per workload. Warm medians exclude result hashing; cold includes first-call asset initialization. Speedup >1 means faster. All output hashes match.\n',`Baseline: ${result.baseline}; candidate: ${result.candidate}; pairs: ${pairs}.\n`,'| Workload | Baseline warm ms | Candidate warm ms | Speedup | Baseline cold ms | Candidate cold ms |','|---|---:|---:|---:|---:|---:|',...rows.map(r=>`| ${r.name} | ${r.baseMs.toFixed(3)} | ${r.candidateMs.toFixed(3)} | ${r.speedup.toFixed(2)}x | ${r.baseColdMs.toFixed(3)} | ${r.candidateColdMs.toFixed(3)} |`)].join('\n');
 writeFileSync(resolve(output,'summary.md'),markdown+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown+'\n');
 console.log(markdown);
}
