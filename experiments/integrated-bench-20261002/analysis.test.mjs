// Synthetic ledgers only: no real benchmark or solver invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {HERE,ROOT,read,write,VARIANTS} from './common.mjs';
test('analysis applies bridge, Holm gates and does not select censored-only victories',()=>{
 const dir=path.join(ROOT,'.bench/analysis-fixtures');fs.mkdirSync(dir,{recursive:true});
 const root=fs.mkdtempSync(path.join(dir,'owned-'));
 try{
  const input=path.join(root,'summary'),out=path.join(root,'analysis');
  const matrices=read(path.join(HERE,'INPUTS.json')).entries.filter(m=>m.partition==='development');
  const rows=matrices.flatMap(m=>VARIANTS.flatMap(variant=>Array.from({length:4},(_,i)=>({runId:`${m.id}:${variant}:${i}`,matrixId:m.id,variant,repetition:i+1,status:'EXACT',states:10,selectedIDs:[0],qualityRLE:[[1,1]],effective:{qualityRLE:[[1,1]]},timing:{apiMs:variant==='PD'?.9:variant==='PC'?1.1:1}}))));
  write(path.join(input,'SUMMARY.json'),{status:'PASS',phase:'development'});
  fs.writeFileSync(path.join(input,'ALL_RUNS.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  execFileSync(process.execPath,[path.join(HERE,'analyze.mjs'),input,out],{stdio:'pipe'});
  const a=read(path.join(out,'ANALYSIS.json'));assert.equal(a.provisionalFinalist,'PD');assert.equal(a.bridgeDevelopmentGate,true);assert.equal(a.a0DevelopmentGate,false);
  assert.equal(a.candidates.find(c=>c.variant==='PD').timePass,true);assert.equal(a.candidates.find(c=>c.variant==='PC').developmentPass,false);
  rows.find(r=>r.variant==='PD').status='TIMEOUT_API';
  fs.writeFileSync(path.join(input,'ALL_RUNS.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const out2=path.join(root,'censored');execFileSync(process.execPath,[path.join(HERE,'analyze.mjs'),input,out2],{stdio:'pipe'});
  const b=read(path.join(out2,'ANALYSIS.json'));assert.equal(b.provisionalFinalist,null);assert.equal(b.correctnessAndNoCensoring,false);
 }finally{fs.rmSync(root,{recursive:true})}
});
