import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,read,write,jsonSha,compare,unrle} from './common.mjs';
const [summaryFolder,output]=process.argv.slice(2).map(p=>path.resolve(p));
const summary=read(path.join(summaryFolder,'SUMMARY.json'));
const rows=fs.readFileSync(path.join(summaryFolder,'ALL_RUNS.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
const inputs=read(path.join(HERE,'INPUTS.json')).entries;
const eligible=inputs.filter(m=>m.partition==='development'&&m.route==='INTEGRATED_100K_PROBE_ELIGIBLE');
assert.equal(eligible.length,675);
const normal=r=>['EXACT','CAPPED'].includes(r.status);
const median=a=>{a=[...a].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2};
const quantile=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.max(0,Math.ceil(a.length*p)-1)]:null;
const byMatrix=new Map();for(const r of rows){if(!byMatrix.has(r.matrixId))byMatrix.set(r.matrixId,new Map());const map=byMatrix.get(r.matrixId);if(!map.has(r.variant))map.set(r.variant,[]);map.get(r.variant).push(r)}
function sample(id,v){const r=byMatrix.get(id)?.get(v)??[];return{runs:r,normal:r.length===4&&r.every(normal),exact:r.length===4&&r.every(r=>r.status==='EXACT'),wall:r.length===4&&r.every(normal)?median(r.map(r=>r.timing.apiMs)):null,states:r.find(normal)?.states,quality:r.find(normal)?.qualityRLE}}
const conditions={};
for(const v of ['H0','P0','P','PD','PC','PDC']){
 const a=eligible.map(m=>sample(m.id,v));
 conditions[v]={matrices:675,all4Normal:a.filter(a=>a.normal).length,all4Exact:a.filter(a=>a.exact).length,all4Capped:a.filter(a=>a.normal&&!a.exact).length,censoredOrMissing:a.filter(a=>!a.normal).length,apiMedianSumMs:a.every(a=>a.normal)?a.reduce((n,a)=>n+a.wall,0):null};
}
let rng=20261002;const rand=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/2**32};
function clusterInference(records){
 const clusters=new Map();for(const r of records){if(!clusters.has(r.group))clusters.set(r.group,[]);clusters.get(r.group).push(r)}
 const a=[...clusters.values()].map(rows=>({logRatio:rows.reduce((n,r)=>n+Math.log(r.ratio),0)/rows.length,exactGain:rows.reduce((n,r)=>n+r.exactGain,0)/rows.length}));
 if(!a.length)return null;
 const mean=k=>a.reduce((n,r)=>n+r[k],0)/a.length;
 const logMean=mean('logRatio'),gainMean=mean('exactGain'),timeBoot=[],gainBoot=[],nullTimes=[],nullGains=[];
 for(let b=0;b<10000;b++){
  let log=0,gain=0,nt=0,ng=0;
  for(let i=0;i<a.length;i++){const row=a[Math.floor(rand()*a.length)];log+=row.logRatio;gain+=row.exactGain;nt+=row.logRatio-logMean;ng+=row.exactGain-gainMean}
  timeBoot.push(Math.exp(log/a.length));gainBoot.push(gain/a.length);nullTimes.push(nt/a.length);nullGains.push(ng/a.length);
 }
 return{mirrorGroups:a.length,groupEqualGeomeanRatio:Math.exp(logMean),groupEqualExactRateGain:gainMean,timeRatio95CI:[quantile(timeBoot,.025),quantile(timeBoot,.975)],exactRateGain95CI:[quantile(gainBoot,.025),quantile(gainBoot,.975)],oneSidedTimeP:(1+nullTimes.filter(x=>x<=logMean).length)/10001,oneSidedCompletionP:(1+nullGains.filter(x=>x>=gainMean).length)/10001};
}
function pair(base,candidate){
 const data=[],statesRegressions=[],rawQualityRegressions=[],effectiveQualityRegressions=[];
 let bothExact=0,bothCap=0,newExact=0,lostExact=0,censored=0,baseSum=0,candidateSum=0,beSum=0,ceSum=0;
 for(const m of eligible){
  const b=sample(m.id,base),c=sample(m.id,candidate);
  if(!b.normal||!c.normal){censored++;continue}
  baseSum+=b.wall;candidateSum+=c.wall;
  if(b.exact&&c.exact){bothExact++;beSum+=b.wall;ceSum+=c.wall}else if(!b.exact&&!c.exact)bothCap++;else if(c.exact)newExact++;else lostExact++;
  const ratio=c.wall/b.wall;data.push({id:m.id,group:m.mirrorGroup,ratio,exactGain:Number(c.exact)-Number(b.exact)});
  if(c.states>b.states)statesRegressions.push(m.id);
  if(compare(unrle(c.quality),unrle(b.quality))<0)rawQualityRegressions.push(m.id);
  if(compare(unrle(c.runs[0].effective.qualityRLE),unrle(b.runs[0].effective.qualityRLE))<0)effectiveQualityRegressions.push(m.id);
 }
 const easy=inputs.filter(m=>m.partition==='development'&&['TINY_LEGACY_EXACT','TRIVIAL_EXACT'].includes(m.route));
 const overhead=easy.map(m=>{const b=sample(m.id,base),c=sample(m.id,candidate);return b.normal&&c.normal?Math.max(0,c.wall-b.wall):null});
 return{base,candidate,pairedNormal:data.length,censored,bothExact,bothCap,newExact,lostExact,exactGain:newExact-lostExact,apiMedianSumRatio:baseSum?candidateSum/baseSum:null,bothExactApiMedianSumRatio:beSum?ceSum/beSum:null,p95SlowdownRatio:quantile(data.map(r=>r.ratio),.95),statesRegressions,rawQualityRegressions,effectiveQualityRegressions,easyPositiveOverheadP95Ms:quantile(overhead.filter(x=>x!==null),.95),easyCensored:overhead.filter(x=>x===null).length,inference:clusterInference(data)};
}
const pairs=[pair('H0','P0'),pair('P0','P'),pair('P','PD'),pair('P','PC'),pair('P','PDC'),pair('PD','PDC'),pair('PC','PDC')];
const hypotheses=pairs.slice(2,5).flatMap(p=>[{candidate:p.candidate,type:'time',p:p.inference?.oneSidedTimeP??1},{candidate:p.candidate,type:'completion',p:p.inference?.oneSidedCompletionP??1}]).sort((a,b)=>a.p-b.p);
let maxAdjusted=0;for(let i=0;i<hypotheses.length;i++){maxAdjusted=Math.max(maxAdjusted,Math.min(1,hypotheses[i].p*(hypotheses.length-i)));hypotheses[i].holmAdjustedP=maxAdjusted}
const allNormal=rows.every(normal),correctness=summary.status==='PASS'&&allNormal;
const a0=pairs[0],bridge=pairs[1];
const bridgePass=correctness&&bridge.censored===0&&bridge.apiMedianSumRatio<=1.02&&bridge.p95SlowdownRatio<=1.05;
const a0Pass=correctness&&a0.exactGain>=0&&a0.statesRegressions.length===0&&a0.rawQualityRegressions.length===0&&a0.bothExact>=20&&a0.bothExactApiMedianSumRatio<=.95&&a0.apiMedianSumRatio<=1&&a0.p95SlowdownRatio<=1.10;
const candidates=pairs.slice(2,5).map(p=>{
 const shared=correctness&&bridgePass&&p.censored===0&&p.exactGain>=0&&p.p95SlowdownRatio<=1.10&&p.easyCensored===0&&p.easyPositiveOverheadP95Ms<=1;
 const timePoint=shared&&p.apiMedianSumRatio<=.95;
 const completionPoint=shared&&p.exactGain>=14&&p.apiMedianSumRatio<=1.05;
 const timeP=hypotheses.find(h=>h.candidate===p.candidate&&h.type==='time').holmAdjustedP;
 const completionP=hypotheses.find(h=>h.candidate===p.candidate&&h.type==='completion').holmAdjustedP;
 const timePass=timePoint&&p.inference.timeRatio95CI[1]<1&&timeP<=.05;
 const completionPass=completionPoint&&p.inference.exactRateGain95CI[0]>0&&completionP<=.05;
 const productionIncumbentSafe=p.candidate.includes('D')?false:p.rawQualityRegressions.length===0;
 return{variant:p.candidate,sharedGate:shared,timePointGate:timePoint,completionPointGate:completionPoint,timePass,completionPass,developmentPass:timePass||completionPass,productionIncumbentSafe,contract:p.candidate.includes('D')?'EXACT_ONLY_PREVIEW':'BOUNDED_INCUMBENT_REQUIRES_ZERO_REGRESSION',independentExactCrosscheckRequired:true};
});
const passed=candidates.filter(c=>c.developmentPass).sort((a,b)=>conditions[b.variant].all4Exact-conditions[a.variant].all4Exact||conditions[a.variant].apiMedianSumMs-conditions[b.variant].apiMedianSumMs||['PC','PD','PDC'].indexOf(a.variant)-['PC','PD','PDC'].indexOf(b.variant));
const provisionalFinalist=passed[0]?.variant??(a0Pass?'P0':null);
const report={status:'ANALYZED_NOT_PRODUCT_PROMOTION',phase:summary.phase,conditions,pairs,holm:hypotheses,correctnessAndNoCensoring:correctness,a0DevelopmentGate:a0Pass,bridgeDevelopmentGate:bridgePass,candidates,provisionalFinalist,finalistFrozen:false,requiresIndependentExactAndLegacyAuditBeforeReserve:true,rawResultsSha256:jsonSha(rows),primaryCalls:0,enumerationCalls:0,performanceScope:'fresh-process fixed-K integrated100K only; no routing/end-to-end claim'};
write(path.join(output,'ANALYSIS.json'),report);console.log(JSON.stringify({conditions,correctnessAndNoCensoring:correctness,a0DevelopmentGate:a0Pass,bridgeDevelopmentGate:bridgePass,candidates,provisionalFinalist},null,2));
