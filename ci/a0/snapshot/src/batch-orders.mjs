import{advanceCleared,mapOriginalMask,normalizeBase,mirrorMask}from'./batch-geometry.mjs';
import { PIECE_CODE } from './piece-order.mjs';
const MIRROR_PIECE={J:'L',L:'J',S:'Z',Z:'S',I:'I',O:'O',T:'T'};
const bits=n=>{let c=0;for(;n;n>>=1)c+=n&1;return c};
const floorMask=lines=>lines?((1n<<BigInt(lines*10))-1n):0n;

// Generic 5..=6-line operation-order search. Future reachability depends on
// only board/cleared-row state and the remaining operation IDs, so histories
// that reach the same future state share one structural DAG node. The final
// order/trace variants are reconstructed afterwards.
export function buildVariants({base=0n,operations,height=4,reachability,mode='normal'}){
 const accelerated=reachability?.buildVariants?.({base,operations,mode});if(accelerated)return accelerated;
 if(!operations.length)return[{order:'',trace:[]}];
 if(operations.length>30)throw new Error(`generic operation DAG supports at most 30 operations, got ${operations.length}`);
 const init=normalizeBase(base,height),ops=operations.map((op,id)=>({...op,id})),states=[],nodes=[],edges=[],stateIds=new Map();
 const fullMask=(1<<operations.length)-1;
 const key=(board,cleared,remaining)=>`${board.toString(16)}|${cleared}|${remaining}`;
 const ensure=(board,cleared,remaining)=>{const k=key(board,cleared,remaining),hit=stateIds.get(k);if(hit!==undefined)return hit;const id=states.length;stateIds.set(k,id);states.push({board,cleared,remaining});nodes.push({start:0,len:0});return id};
 const root=ensure(init.board,init.clearedRows,fullMask);let cursor=0;
 while(cursor<states.length){
  const st=states[cursor],start=edges.length;
  for(let id=0;id<ops.length;id++){
   const bit=1<<id;if(!(st.remaining&bit))continue;
   const op=ops[id],cells=mapOriginalMask(op.mask,st.cleared,height);if(cells===0n)continue;
   const nextBoard=reachability.placeExact(st.board,op.piece,cells);if(nextBoard===null)continue;
   const nextCleared=advanceCleared(st.board,cells,st.cleared,height),newLines=bits(nextCleared)-bits(st.cleared),clearedCount=bits(nextCleared),remaining=st.remaining&~bit;
   const tSpinKind=op.piece==='T'&&newLines>0&&reachability.tSpinKind?reachability.tSpinKind(st.board,cells):0;
   const next=remaining?ensure(nextBoard,nextCleared,remaining):-1;
   edges.push({next,id,piece:op.piece,mask:op.mask,clearLines:newLines,pcAfter:nextBoard===floorMask(clearedCount),tSpinKind});
  }
  nodes[cursor]={start,len:edges.length-start};cursor++;
 }
 const productive=new Uint8Array(nodes.length);
 for(let ni=nodes.length-1;ni>=0;ni--){const node=nodes[ni];for(let ei=node.start;ei<node.start+node.len;ei++){const e=edges[ei];if(e.next<0||productive[e.next]){productive[ni]=1;break}}}
 const out=[],keys=new Set(),order=[],trace=[];
 function collect(nodeId){
  const node=nodes[nodeId];
  for(let ei=node.start;ei<node.start+node.len;ei++){
   const e=edges[ei];if(e.next>=0&&!productive[e.next])continue;
   order.push(e.piece);trace.push({id:e.id,piece:e.piece,mask:e.mask,clearLines:e.clearLines,pcAfter:e.pcAfter,tSpinKind:e.tSpinKind});
   if(e.next<0){const o=order.join(''),k=`${o}|${trace.map(x=>`${x.id}:${x.clearLines}`).join('.')}`;if(!keys.has(k)){keys.add(k);out.push({order:o,trace:[...trace]})}}
   else collect(e.next);
   order.pop();trace.pop();
  }
 }
 if(productive[root])collect(root);return out
}
export function buildOrders(args){return[...new Set(buildVariants(args).map(v=>v.order))]}

export function normalizeCoverMode(mode='normal'){
 const m=String(mode).trim().toLowerCase().replaceAll('_','-');
 const map={normal:'normal',tetris:'tetris','tetris-end':'tetris-end',tetrisend:'tetris-end',
  '1l':'1l','1line':'1l','1lines':'1l','1l-or-pc':'1l-or-pc','1line-or-pc':'1l-or-pc','1lines-or-pc':'1l-or-pc',
  '2l':'2l','2line':'2l','2lines':'2l','2l-or-pc':'2l-or-pc','2line-or-pc':'2l-or-pc','2lines-or-pc':'2l-or-pc',
  '3l':'3l','3line':'3l','3lines':'3l','3l-or-pc':'3l-or-pc','3line-or-pc':'3l-or-pc','3lines-or-pc':'3l-or-pc',
  '4l':'4l','4line':'4l','4lines':'4l','4l-or-pc':'4l-or-pc','4line-or-pc':'4l-or-pc','4lines-or-pc':'4l-or-pc'};
 if(map[m])return map[m];
 const spinMap={b2b:'b2b',any:'tsm','any-tspin':'tsm',anytspin:'tsm',tsm:'tsm',tspinm:'tsm',tss:'tss',tspin1:'tss',tsd:'tsd',tspin2:'tsd',tst:'tst',tspin3:'tst'};if(spinMap[m])return spinMap[m];
 throw new Error(`unsupported cover mode '${mode}'`)
}
export function variantSatisfiesMode(variant,mode='normal'){
 const m=normalizeCoverMode(mode);if(m==='normal')return true;
 if(m==='tetris')return variant.trace.some(s=>s.piece==='I'&&s.clearLines===4);
 if(m==='tetris-end'){const s=variant.trace.at(-1);return!!s&&s.piece==='I'&&s.clearLines===4}
 if(m==='tsm')return variant.trace.some(s=>s.clearLines>0&&s.piece==='T'&&s.tSpinKind>0);
 if(m==='tss')return variant.trace.some(s=>s.clearLines>=1&&s.piece==='T'&&s.tSpinKind===2);
 if(m==='tsd')return variant.trace.some(s=>s.clearLines>=2&&s.piece==='T'&&s.tSpinKind===2);
 if(m==='tst')return variant.trace.some(s=>s.clearLines>=3&&s.piece==='T'&&s.tSpinKind===2);
 if(m==='b2b')return variant.trace.every(s=>s.clearLines===0||(s.piece==='I'&&s.clearLines===4)||(s.piece==='T'&&s.tSpinKind>0));
 const mm=m.match(/^([1-4])l(-or-pc)?$/);if(mm){const req=Number(mm[1]),allowsPc=!!mm[2];return variant.trace.every(s=>s.clearLines===0||s.clearLines>=req||(allowsPc&&s.pcAfter))}
 return false
}

// Queue/Hold state space for a single concrete queue. Kept as the scalar
// fallback and as an independent oracle for queue-trie regression tests.
export function canQueueBuildOrder(queue,order,useHold=true){
 const n=queue.length,q=new Int8Array(n);for(let i=0;i<n;i++){q[i]=PIECE_CODE[queue[i]]??-1;if(q[i]<0)return false}
 const size=(n+1)*8;let cur=new Uint8Array(size),next=new Uint8Array(size);cur[7]=1;
 for(const wantedChar of order){
  const wanted=PIECE_CODE[wantedChar]??-1;if(wanted<0)return false;
  next.fill(0);let nextCount=0;
  for(let state=0;state<size;state++)if(cur[state]){
   const idx=state>>3,hold=state&7;
   const add=(ni,nh)=>{const id=(ni<<3)|nh;if(!next[id]){next[id]=1;nextCount++}};
   if(idx<n&&q[idx]===wanted)add(idx+1,hold);
   if(useHold){
    if(hold===7){if(idx+1<n&&q[idx+1]===wanted)add(idx+2,q[idx])}
    else if(hold===wanted){if(idx<n)add(idx+1,q[idx]);else if(idx===n)add(idx,7)}
   }
  }
  if(!nextCount)return false;const tmp=cur;cur=next;next=tmp;
 }
 return true
}

const NO_CHILD=-1;
export function createQueueOrderProjector(cases){
 const queues=cases.map(x=>typeof x==='string'?x:x.queue),nodes=[{children:new Int32Array(7).fill(NO_CHILD),terminals:[]}];
 for(let ci=0;ci<queues.length;ci++){
  let node=0;for(const ch of queues[ci]){const p=PIECE_CODE[ch];if(p===undefined)throw new Error(`bad piece ${ch}`);let child=nodes[node].children[p];if(child===NO_CHILD){child=nodes.length;nodes[node].children[p]=child;nodes.push({children:new Int32Array(7).fill(NO_CHILD),terminals:[]})}node=child}nodes[node].terminals.push(ci);
 }
 const nodeCount=nodes.length,stateSeen=new Uint32Array(nodeCount*16),positionSeen=new Uint32Array(nodeCount*2),subtreeSeen=new Uint32Array(nodeCount),caseSeen=new Uint32Array(queues.length),cache=new Map();let generation=0;
 const nextGeneration=()=>{generation=(generation+1)>>>0;if(generation===0){stateSeen.fill(0);positionSeen.fill(0);subtreeSeen.fill(0);generation=1}return generation};
 const normal=(node,hold)=>(node<<3)|hold,ended=(node,hold)=>((nodeCount+node)<<3)|hold;
 const pushState=(arr,gen,state)=>{if(stateSeen[state]!==gen){stateSeen[state]=gen;arr.push(state)}};
 function coverageForOrder(order,useHold=true){
  const ck=`${useHold?1:0}|${order}`,cached=cache.get(ck);if(cached)return cached;
  let cur=[normal(0,7)],next=[];
  for(const ch of order){
   const wanted=PIECE_CODE[ch];if(wanted===undefined){cache.set(ck,[]);return[]}
   const gen=nextGeneration();next.length=0;
   for(const state of cur){
    const hold=state&7,pos=state>>3;
    if(pos>=nodeCount){if(useHold&&hold===wanted)pushState(next,gen,ended(pos-nodeCount,7));continue}
    const meta=nodes[pos],direct=meta.children[wanted];if(direct!==NO_CHILD)pushState(next,gen,normal(direct,hold));
    if(!useHold)continue;
    if(hold===7){for(let current=0;current<7;current++){const first=meta.children[current];if(first===NO_CHILD)continue;const second=nodes[first].children[wanted];if(second!==NO_CHILD)pushState(next,gen,normal(second,current))}}
    else if(hold===wanted){for(let current=0;current<7;current++){const child=meta.children[current];if(child!==NO_CHILD)pushState(next,gen,normal(child,current))}if(meta.terminals.length)pushState(next,gen,ended(pos,7))}
   }
   if(!next.length){cache.set(ck,[]);return[]}[cur,next]=[next,cur];
  }
  const covered=[],caseGen=nextGeneration(),posGen=nextGeneration(),subGen=nextGeneration(),stack=[];
  for(const state of cur){
   const pos=state>>3;if(positionSeen[pos]===posGen)continue;positionSeen[pos]=posGen;
   if(pos>=nodeCount){for(const ci of nodes[pos-nodeCount].terminals)if(caseSeen[ci]!==caseGen){caseSeen[ci]=caseGen;covered.push(ci)};continue}
   stack.length=0;stack.push(pos);
   while(stack.length){const node=stack.pop();if(subtreeSeen[node]===subGen)continue;subtreeSeen[node]=subGen;const meta=nodes[node];for(const ci of meta.terminals)if(caseSeen[ci]!==caseGen){caseSeen[ci]=caseGen;covered.push(ci)};for(const child of meta.children)if(child!==NO_CHILD)stack.push(child)}
  }
  covered.sort((a,b)=>a-b);cache.set(ck,covered);return covered;
 }
 return{
  coverageForOrder,
  coveredIndices(orders,useHold=true){const seen=new Uint8Array(queues.length),out=[];for(const order of new Set(orders))for(const ci of coverageForOrder(order,useHold))if(!seen[ci]){seen[ci]=1;out.push(ci)}out.sort((a,b)=>a-b);return out},
  validOrders(orders,useHold=true){return[...new Set(orders)].filter(order=>coverageForOrder(order,useHold).length>0)},
 };
}

export function mirrorOperations(base,operations,height=4){return{base:mirrorMask(base,height),operations:operations.map(op=>({piece:MIRROR_PIECE[op.piece],mask:mirrorMask(op.mask,height)}))}}
