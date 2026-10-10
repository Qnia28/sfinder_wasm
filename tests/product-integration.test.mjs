import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest,sha256} from '../tools/secondary-bench/common/contracts.mjs';
import {integrationTasks,integrationChunks,selectIntegration,INTEGRATION_JOB,INTEGRATION_PHASES} from '../tools/secondary-bench/common/triage/product-integration.mjs';
import {executeProduct} from '../tools/secondary-bench/common/triage/product-child.mjs';

const population=()=>Array.from({length:1098},(_,i)=>({id:'input-'+String(i).padStart(4,'0'),sha256:'a'.repeat(64),metadata:{dataset:i<548?'ALL':'PER_SAVE'}}));
function fixture(){
  const inputs=population(),m={campaignId:'test',inputs,job:INTEGRATION_JOB,integration:{mandatoryConfirmation:['input-0548']}};
  const templates=INTEGRATION_PHASES.flatMap(phase=>[1,2].flatMap(block=>inputs.map(f=>({phase,block,task_id:`${phase}-${block}-${f.id}`,fixture_ids:[f.id],conditional:phase.includes('CONFIRMATION'),arms:block===1?['DEV','RC']:['RC','DEV']}))));
  const rows=INTEGRATION_PHASES.slice(0,3).flatMap(phase=>integrationTasks(m,templates,phase).flatMap(t=>t.calls.map(c=>({...c,status:'EXACT',ms:c.variant==='DEV'?100:80,runnerId:phase+'/'+c.block,execution:{result:{verified:{keys:['x']}}}}))));
  return {m,templates,rows};
}
test('all commands complete two repeats before next round; repetitions have separate workers',()=>{
  const {m,templates}=fixture();let total=0;
  for(const phase of INTEGRATION_PHASES){
    const tasks=integrationTasks(m,templates,phase,m.inputs.map(f=>f.id)),chunks=integrationChunks(tasks,m.job);
    assert.equal(chunks.length,184);assert.equal(tasks.length*2,4392);total+=tasks.length*2;
    for(const c of chunks)assert.equal(new Set(c.tasks.map(t=>t.calls[0].block)).size,1);
  }
  assert.equal(total,21960);assert(920*350/60+13.5<=5381);
});
test('independent Python compiler, chunk count and tail selection agree',()=>{
  const {m,templates,rows}=fixture();rows.find(r=>r.inputId==='input-0300').ms=1000;
  rows.find(r=>r.inputId==='input-0750').status='TIMEOUT_CALL';rows.find(r=>r.inputId==='input-0750').ms=null;
  const selected=selectIntegration(m,rows);assert(selected.selected.includes('input-0300'));assert(selected.selected.includes('input-0750'));assert(selected.selected.includes('input-0548'));
  const script=`import importlib.util,json,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('pa',Path('tools/secondary-bench/common/triage/product-audit.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)\nv=json.load(sys.stdin);ts=a.compile_calls(v['m'],v['templates'],'RC_INITIAL_1');print(json.dumps(dict(calls=[c for t in ts for c in t],chunks=len(a.chunks(ts,v['m']['job'])),selected=sorted(a.selection(v['m'],v['rows'])))))`;
  const actual=JSON.parse(execFileSync('python',['-B','-c',script],{input:JSON.stringify({m,templates,rows}),maxBuffer:32*1024**2,encoding:'utf8'}));
  assert.deepEqual(actual.calls,integrationTasks(m,templates,'RC_INITIAL_1').flatMap(t=>t.calls));assert.equal(actual.chunks,184);assert.deepEqual(actual.selected,selected.selected);
  rows[0].execution={result:{verified:{keys:['wrong']}}};assert.throws(()=>selectIntegration(m,rows),/witness disagreement/);
});
test('product command uses committed-root API and original weighted witness; no solver needed',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rc-command-contract-'));
  try{
    fs.mkdirSync(path.join(dir,'src'));fs.mkdirSync(path.join(dir,'fixtures'));
    fs.writeFileSync(path.join(dir,'src/wasm-backend.mjs'),'export async function createWasmSolver(){return {close(){}}}');
    fs.writeFileSync(path.join(dir,'src/minimals-feature.mjs'),`export async function calculateSaveMinimals(o){if(o.analysisPattern!=='test'||o.exactHumanQuality!=='true'||o.secondary!=='auto')throw Error('options');return {keys:['a'],minimalCount:1,humanQualityVector:[2,3],humanQualityExact:true,cases:[1,2]};}export const encodeSaveMinimalFumen=()=> 'fumen';`);
    const f={schema:1,id:'command/ALL',keys:['a','b'],rows:[[[0,2],[1,1]],[[0,3],[1,1]]],K:1,seed:[0],cardinalityProof:{status:'PROVEN',backend:'synthetic'}};
    const bytes=Buffer.from(JSON.stringify(f)),h=sha256(bytes);fs.writeFileSync(path.join(dir,'fixtures/'+h+'.json'),bytes);
    const input={command:{id:'command',kind:'minimals',clear:4,useHold:true,queueLength:7,sourceFumen:'mock',pattern:'test'},filters:['ALL'],fixtures:[{filter:'ALL',member:'fixtures/'+h+'.json',sha256:h}]};
    const command=Buffer.from(JSON.stringify(input)),file=path.join(dir,'command.json');fs.writeFileSync(file,command);
    const job={exactHumanQuality:'true',variant:'RC',commandPath:file,commandSha256:sha256(command),productRoot:dir,bundleRoot:dir};
    const result=await executeProduct(job);assert.deepEqual(result.verified.ALL,{keys:['a'],qualityVector:[2,3],count:1});assert(result.policySettledMs>0);
    fs.writeFileSync(path.join(dir,'fixtures/'+h+'.json'),'{}');await assert.rejects(executeProduct(job));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
