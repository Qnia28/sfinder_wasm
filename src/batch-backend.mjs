import { PIECE_CODE, RUST_PIECE_ORDER } from './piece-order.mjs';
import { retryableLoader } from './promise-utils.mjs';
const CODE_PIECE=[...RUST_PIECE_ORDER];
const U32_MAX=0xffffffff;
function wasmU32(value){return Number(value)>>>0}
const MODE_CODE={normal:0,tetris:1,'tetris-end':2,'1l':3,'1l-or-pc':4,'2l':5,'2l-or-pc':6,'3l':7,'3l-or-pc':8,'4l':9,'4l-or-pc':10,tsm:11,tss:12,tsd:13,tst:14,b2b:15};
async function bytesFor(url){if(typeof process!=='undefined'&&process.versions?.node){const moduleName='node:fs/promises';const{readFile}=await import(/* @vite-ignore */ moduleName);return new Uint8Array(await readFile(url))}const r=await fetch(url);if(!r.ok)throw new Error(`fetch ${url}: ${r.status}`);return new Uint8Array(await r.arrayBuffer())}
export const loadBatchWasm=retryableLoader(async()=>{const wasm=await bytesFor(new URL('../wasm/batch_wasm.wasm',import.meta.url));const{instance}=await WebAssembly.instantiate(wasm,{});return instance.exports});
function packQueue(queue){if(queue.length>21)throw new Error(`batch queue length ${queue.length} exceeds 21`);let bits=0n;for(let i=0;i<queue.length;i++){const p=PIECE_CODE[queue[i]];if(p===undefined)throw new Error(`bad piece ${queue[i]}`);bits|=BigInt(p)<<BigInt(i*3)}return bits}
export class BatchReachability{
 constructor(exports,height=4,physics='jstris'){this.e=exports;this.height=height;this.physics=physics==='tetrio'?1:0}
 placeExact(board,piece,cells){const p=PIECE_CODE[piece];if(p===undefined)throw new Error(`bad piece ${piece}`);const v=this.e.batch_place_exact(board,p,cells,this.height,this.physics);if(v===0n)return null;return v&((1n<<63n)-1n)}
 tSpinKind(board,cells){return wasmU32(this.e.batch_tspin_kind(board,cells,this.height,this.physics))}
 #run({base=0n,operations,queues=[],mode='normal',useHold=true}){
  if(this.height>4)return null;
  if(!this.e.batch_engine_reset||operations.length>10||queues.some(entry=>(typeof entry==='string'?entry:entry.queue).length>21))return null;
  const modeCode=MODE_CODE[mode];if(modeCode===undefined)throw new Error(`unsupported batch engine mode '${mode}'`);
  this.e.batch_engine_reset();
  for(const op of operations){const p=PIECE_CODE[op.piece];if(p===undefined||this.e.batch_engine_add_operation(p,op.mask)!==1)throw new Error('batch engine rejected operation set')}
  for(const entry of queues){const queue=typeof entry==='string'?entry:entry.queue;if(this.e.batch_engine_add_queue(packQueue(queue),queue.length)!==1)throw new Error('batch engine rejected queue')}
  const count=wasmU32(this.e.batch_engine_run(base,this.height,this.physics,modeCode,useHold?1:0));if(count===U32_MAX)throw new Error('batch engine failed');
  const variants=[];
  for(let vi=0;vi<count;vi++){
   const ids=this.e.batch_engine_variant_ids(vi),clears=wasmU32(this.e.batch_engine_variant_clears(vi)),tspins=wasmU32(this.e.batch_engine_variant_tspins(vi)),pcMask=wasmU32(this.e.batch_engine_variant_pc_mask(vi));
   let order='';const trace=[];
   for(let i=0;i<operations.length;i++){
    const id=Number((ids>>BigInt(i*4))&15n),op=operations[id],clearLines=(clears>>>(i*3))&7,tSpinKind=(tspins>>>(i*2))&3;
    order+=op.piece;trace.push({id,piece:op.piece,mask:op.mask,clearLines,pcAfter:!!(pcMask&(1<<i)),tSpinKind});
   }
   variants.push({order,trace});
  }
  const covered=queues.map((_,i)=>this.e.batch_engine_case_covered(i)!==0);
  return{variants,covered};
 }
 buildVariants({base=0n,operations,mode='normal'}){return this.#run({base,operations,mode})?.variants??null}
 coverTarget({base=0n,operations,cases,mode='normal',useHold=true}){return this.#run({base,operations,queues:cases,mode,useHold})}
 congruent({base=0n,fill=0n,queues=[],useHold=true,maxSolutions=20000}){
  if(this.height>4)return null;
  if(!this.e.batch_congruent_run)return null;
  this.e.batch_engine_reset();
  for(const queue of queues){if(queue.length>21)return null;if(this.e.batch_engine_add_queue(packQueue(queue),queue.length)!==1)throw new Error('batch engine rejected queue')}
  const count=wasmU32(this.e.batch_congruent_run(base,fill,this.height,this.physics,useHold?1:0,maxSolutions));if(count===U32_MAX)throw new Error(`congruent tiling limit ${maxSolutions} reached`);
  const out=[];for(let si=0;si<count;si++){const n=wasmU32(this.e.batch_congruent_operation_count(si)),operations=[];for(let oi=0;oi<n;oi++){const p=wasmU32(this.e.batch_congruent_operation_piece(si,oi));operations.push({piece:CODE_PIECE[p],mask:this.e.batch_congruent_operation_mask(si,oi)})}const orders=[];for(let i=0,qn=wasmU32(this.e.batch_congruent_order_count(si));i<qn;i++){const packed=this.e.batch_congruent_order(si,i);let order='';for(let j=0;j<n;j++)order+=CODE_PIECE[Number((packed>>BigInt(j*3))&7n)];orders.push(order)}out.push({operations,orders})}return out;
 }
}
