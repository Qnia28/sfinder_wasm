import { CongruentLimitError, validateCongruentLimit } from './batch-limits.mjs';
import { PIECE_CODE, RUST_PIECE_ORDER } from './piece-order.mjs';
import { retryableLoader } from './promise-utils.mjs';
const CODE_PIECE=[...RUST_PIECE_ORDER];
const U32_MAX=0xffffffff;
// All wrappers of one WASM instance share its staging lifetime.
const sessions=new WeakMap();
function sessionFor(exports){let state=sessions.get(exports);if(!state){state={depth:0,staged:null};sessions.set(exports,state)}return state}
function queueValue(entry){return typeof entry==='string'?entry:entry.queue}
function uniqueQueues(queues){
 const values=queues.map(queueValue),unique=[],ids=new Map(),remap=new Uint32Array(values.length);
 for(let i=0;i<values.length;i++){
  let id=ids.get(values[i]);if(id===undefined){id=unique.length;ids.set(values[i],id);unique.push(values[i])}remap[i]=id;
 }
 return {values,unique,remap,handle:0n};
}
function wasmU32(value){return Number(value)>>>0}
const MODE_CODE={normal:0,tetris:1,'tetris-end':2,'1l':3,'1l-or-pc':4,'2l':5,'2l-or-pc':6,'3l':7,'3l-or-pc':8,'4l':9,'4l-or-pc':10,tsm:11,tss:12,tsd:13,tst:14,b2b:15};
async function bytesFor(url){if(typeof process!=='undefined'&&process.versions?.node){const moduleName='node:fs/promises';const{readFile}=await import(/* @vite-ignore */ moduleName);return new Uint8Array(await readFile(url))}const r=await fetch(url);if(!r.ok)throw new Error(`fetch ${url}: ${r.status}`);return new Uint8Array(await r.arrayBuffer())}
export const loadBatchWasm=retryableLoader(async()=>{const wasm=await bytesFor(new URL('../wasm/batch_wasm.wasm',import.meta.url));const{instance}=await WebAssembly.instantiate(wasm,{});return instance.exports});
function packQueue(queue){if(queue.length>21)throw new Error(`batch queue length ${queue.length} exceeds 21`);let bits=0n;for(let i=0;i<queue.length;i++){const p=PIECE_CODE[queue[i]];if(p===undefined)throw new Error(`bad piece ${queue[i]}`);bits|=BigInt(p)<<BigInt(i*3)}return bits}
export class BatchReachability{
 constructor(exports,height=4,physics='jstris'){this.e=exports;this.height=height;this.physics=physics==='tetrio'?1:0}
 withSession(callback){
  if(!this.e.batch_session_begin)return callback();
  const state=sessionFor(this.e);state.depth++;this.e.batch_session_begin();
  try{return callback()}finally{this.e.batch_session_end();if(--state.depth===0)state.staged=null}
 }
 #stage(queues){
  const state=sessionFor(this.e);let staged=state.depth?state.staged:null;
  if(!staged||staged.values.length!==queues.length||!queues.every((q,i)=>queueValue(q)===staged.values[i]))staged=uniqueQueues(queues);
  const reusable=state.depth&&staged.handle!==0n&&this.e.batch_engine_reset_with_queues?.(staged.handle)===1;
  if(!reusable){
   this.e.batch_engine_reset();
   for(const queue of staged.unique)if(this.e.batch_engine_add_queue(packQueue(queue),queue.length)!==1)throw new Error('batch engine rejected queue');
   staged.handle=this.e.batch_engine_queue_handle?.()??0n;
  }
  if(state.depth)state.staged=staged;
  return staged;
 }
 placeExact(board,piece,cells){const p=PIECE_CODE[piece];if(p===undefined)throw new Error(`bad piece ${piece}`);const v=this.e.batch_place_exact(board,p,cells,this.height,this.physics);if(v===0n)return null;return v&((1n<<63n)-1n)}
 tSpinKind(board,cells){return wasmU32(this.e.batch_tspin_kind(board,cells,this.height,this.physics))}
 #run({base=0n,operations,queues=[],mode='normal',useHold=true,coverageOnly=false}){
  if(this.height>6 || (this.height>4 && !this.e.batch_engine_variant_clears64))return null;
  if(!this.e.batch_engine_reset||operations.length>(this.e.batch_engine_variant_clears64?15:10)||queues.some(entry=>(typeof entry==='string'?entry:entry.queue).length>21))return null;
  const modeCode=MODE_CODE[mode];if(modeCode===undefined)throw new Error(`unsupported batch engine mode '${mode}'`);
  const staged=this.#stage(queues);
  for(const op of operations){const p=PIECE_CODE[op.piece];if(p===undefined||this.e.batch_engine_add_operation(p,op.mask)!==1)throw new Error('batch engine rejected operation set')}
  const count=wasmU32(coverageOnly&&this.e.batch_engine_run_coverage
   ?this.e.batch_engine_run_coverage(base,this.height,this.physics,modeCode,useHold?1:0)
   :this.e.batch_engine_run(base,this.height,this.physics,modeCode,useHold?1:0));if(count===U32_MAX)throw new Error('batch engine failed');
  const variants=[],wideClears=operations.length>10;
  const emitsVariants=!(coverageOnly&&this.e.batch_engine_run_coverage);
  const packedPtr=emitsVariants&&count&&this.e.batch_engine_variants_ptr?wasmU32(this.e.batch_engine_variants_ptr()):0;
  const packed=packedPtr?new Uint32Array(this.e.memory.buffer,packedPtr,count*6).slice():null;
  const u64=(lo,hi)=>BigInt(lo)|(BigInt(hi)<<32n);
  for(let vi=0;vi<(coverageOnly&&this.e.batch_engine_run_coverage?0:count);vi++){
   const offset=vi*6;
   const ids=packed?u64(packed[offset],packed[offset+1]):this.e.batch_engine_variant_ids(vi);
   const clears=packed?(wideClears?u64(packed[offset+2],packed[offset+3]):packed[offset+2]):(wideClears?this.e.batch_engine_variant_clears64(vi):wasmU32(this.e.batch_engine_variant_clears(vi)));
   const tspins=packed?packed[offset+4]:wasmU32(this.e.batch_engine_variant_tspins(vi)),pcMask=packed?packed[offset+5]:wasmU32(this.e.batch_engine_variant_pc_mask(vi));
   let order='';const trace=[];
   for(let i=0;i<operations.length;i++){
    const id=Number((ids>>BigInt(i*4))&15n),op=operations[id],clearLines=wideClears?Number((clears>>BigInt(i*3))&7n):(clears>>>(i*3))&7,tSpinKind=(tspins>>>(i*2))&3;
    order+=op.piece;trace.push({id,piece:op.piece,mask:op.mask,clearLines,pcAfter:!!(pcMask&(1<<i)),tSpinKind});
   }
   variants.push({order,trace});
  }
  const length=staged.unique.length;
  let uniqueCovered;
  const hits=this.e.batch_engine_covered_count?.();
  if(this.e.batch_engine_covered_indices_ptr&&hits*4<length){
   const ptr=wasmU32(this.e.batch_engine_covered_indices_ptr());
   const ids=new Uint32Array(this.e.memory.buffer,ptr,hits).slice();
   const coveredIds=new Set(ids);uniqueCovered=id=>coveredIds.has(id);
  }else{
   const values=this.e.batch_engine_covered_ptr&&length
    ?new Uint8Array(this.e.memory.buffer,wasmU32(this.e.batch_engine_covered_ptr()),length).slice()
    :staged.unique.map((_,i)=>this.e.batch_engine_case_covered(i));
   uniqueCovered=id=>values[id]!==0;
  }
  const covered=Array.from(staged.remap,id=>uniqueCovered(id));
  return{variants,covered};
 }
 buildVariants({base=0n,operations,mode='normal'}){return this.#run({base,operations,mode})?.variants??null}
 coverTarget({base=0n,operations,cases,mode='normal',useHold=true,coverageOnly=false}){return this.#run({base,operations,queues:cases,mode,useHold,coverageOnly})}
 congruent(args){return this.withSession(()=>this.#congruent(args))}
 #congruent({base=0n,fill=0n,queues=[],useHold=true,maxSolutions=20000}){
  validateCongruentLimit(maxSolutions);
  if(this.height>(this.e.batch_congruent_max_height?.()??4))return null;
  if(!this.e.batch_congruent_run)return null;
  if(queues.some(queue=>queue.length>21))return null;
  this.#stage(queues);
  const count=wasmU32(this.e.batch_congruent_run(base,fill,this.height,this.physics,useHold?1:0,maxSolutions));if(count===U32_MAX)throw new CongruentLimitError(maxSolutions);
  if(this.e.batch_congruent_words_ptr&&this.e.batch_engine_bulk_word_count){
   const ptr=wasmU32(this.e.batch_congruent_words_ptr());
   const words=new Uint32Array(this.e.memory.buffer,ptr,wasmU32(this.e.batch_engine_bulk_word_count())).slice();
   let offset=0;const out=[];
   const next64=()=>{const value=BigInt(words[offset])|(BigInt(words[offset+1])<<32n);offset+=2;return value};
   for(let si=0;si<count;si++){
    const n=words[offset++],qn=words[offset++],operations=[],orders=[];
    for(let oi=0;oi<n;oi++){const piece=CODE_PIECE[words[offset++]];operations.push({piece,mask:next64()})}
    for(let i=0;i<qn;i++){const packed=next64();let order='';for(let j=0;j<n;j++)order+=CODE_PIECE[Number((packed>>BigInt(j*3))&7n)];orders.push(order)}
    out.push({operations,orders});
   }
   if(offset!==words.length)throw new Error('invalid congruent bulk result');
   return out;
  }
  const out=[];for(let si=0;si<count;si++){const n=wasmU32(this.e.batch_congruent_operation_count(si)),operations=[];for(let oi=0;oi<n;oi++){const p=wasmU32(this.e.batch_congruent_operation_piece(si,oi));operations.push({piece:CODE_PIECE[p],mask:this.e.batch_congruent_operation_mask(si,oi)})}const orders=[];for(let i=0,qn=wasmU32(this.e.batch_congruent_order_count(si));i<qn;i++){const packed=this.e.batch_congruent_order(si,i);let order='';for(let j=0;j<n;j++)order+=CODE_PIECE[Number((packed>>BigInt(j*3))&7n)];orders.push(order)}out.push({operations,orders})}return out;
 }
}
