import {FULL_ROW,popcount} from './board.mjs';
export const PIECES=['I','J','L','O','S','T','Z'];
export const CELLS={
 I:[[[0,0],[1,0],[2,0],[3,0]],[[0,0],[0,1],[0,2],[0,3]]],
 J:[[[0,0],[1,0],[2,0],[0,1]],[[0,0],[0,1],[0,2],[1,2]],[[2,0],[0,1],[1,1],[2,1]],[[0,0],[1,0],[1,1],[1,2]]],
 L:[[[0,0],[1,0],[2,0],[2,1]],[[0,0],[1,0],[0,1],[0,2]],[[0,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[0,2],[1,2]]],
 O:[[[0,0],[1,0],[0,1],[1,1]]],
 S:[[[0,0],[1,0],[1,1],[2,1]],[[1,0],[0,1],[1,1],[0,2]]],
 T:[[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[0,2]],[[1,0],[0,1],[1,1],[2,1]],[[1,0],[0,1],[1,1],[1,2]]],
 Z:[[[1,0],[2,0],[0,1],[1,1]],[[0,0],[0,1],[1,1],[1,2]]],
};
export function bit(x,y){return 1n<<BigInt(y*10+x)}
export function mirrorMask(mask,height=4){let out=0n;for(let y=0;y<height;y++)for(let x=0;x<10;x++)if(mask&bit(x,y))out|=bit(9-x,y);return out}
export function allGeometricPlacements(piece,height=4){const set=new Set(),out=[];for(const cells of CELLS[piece]){const w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1;for(let y=0;y<=height-h;y++)for(let x=0;x<=10-w;x++){let m=0n;for(const[dx,dy]of cells)m|=bit(x+dx,y+dy);const k=m.toString(16);if(!set.has(k)){set.add(k);out.push(m)}}}return out}
export function fieldMasks(page,height=4){let base=0n,fill=0n;const colors=Object.fromEntries(PIECES.map(p=>[p,0n]));for(let y=0;y<height;y++)for(let x=0;x<10;x++){const c=page.field.at(x,y);if(c==='X')base|=bit(x,y);else if(colors[c]!==undefined){colors[c]|=bit(x,y);fill|=bit(x,y)}}return{base,fill,colors}}

const OP_CELLS={
 I:{spawn:[[0,0],[-1,0],[1,0],[2,0]],right:[[0,0],[0,1],[0,-1],[0,-2]],reverse:[[0,0],[1,0],[-1,0],[-2,0]],left:[[0,0],[0,-1],[0,1],[0,2]]},
 L:{spawn:[[0,0],[-1,0],[1,0],[1,1]],right:[[0,0],[0,1],[0,-1],[1,-1]],reverse:[[0,0],[1,0],[-1,0],[-1,-1]],left:[[0,0],[0,-1],[0,1],[-1,1]]},
 O:{spawn:[[0,0],[1,0],[0,1],[1,1]],right:[[0,0],[0,-1],[1,0],[1,-1]],reverse:[[0,0],[-1,0],[0,-1],[-1,-1]],left:[[0,0],[0,1],[-1,0],[-1,1]]},
 Z:{spawn:[[0,0],[1,0],[0,1],[-1,1]],right:[[0,0],[0,-1],[1,0],[1,1]],reverse:[[0,0],[-1,0],[0,-1],[1,-1]],left:[[0,0],[0,1],[-1,0],[-1,-1]]},
 T:{spawn:[[0,0],[-1,0],[1,0],[0,1]],right:[[0,0],[0,1],[0,-1],[1,0]],reverse:[[0,0],[1,0],[-1,0],[0,-1]],left:[[0,0],[0,-1],[0,1],[-1,0]]},
 J:{spawn:[[0,0],[-1,0],[1,0],[-1,1]],right:[[0,0],[0,1],[0,-1],[1,1]],reverse:[[0,0],[1,0],[-1,0],[1,-1]],left:[[0,0],[0,-1],[0,1],[-1,-1]]},
 S:{spawn:[[0,0],[-1,0],[0,1],[1,1]],right:[[0,0],[0,1],[1,0],[1,-1]],reverse:[[0,0],[1,0],[0,-1],[-1,-1]],left:[[0,0],[0,-1],[-1,0],[-1,1]]},
};
export function fumenOperationMask(operation,height=4){
 if(!operation)return 0n;const cells=OP_CELLS[operation.type]?.[operation.rotation];if(!cells)throw new Error(`unsupported Fumen operation ${operation.type}/${operation.rotation}`);let mask=0n;for(const[dx,dy]of cells){const x=operation.x+dx,y=operation.y+dy;if(x<0||x>=10||y<0||y>=height)throw new Error(`Fumen operation exceeds ${height}-line batch domain`);mask|=bit(x,y)}return mask
}
export function assembledFieldMasks(page,height=4){
 const out=fieldMasks(page,height);if(!page.operation)return out;const piece=page.operation.type,mask=fumenOperationMask(page.operation,height);out.base&=~mask;out.fill&=~mask;for(const p of PIECES)out.colors[p]&=~mask;out.colors[piece]|=mask;out.fill|=mask;return out
}
export function partitionPieceMask(piece,mask,height=4){if(mask===0n)return[[]];const candidates=allGeometricPlacements(piece,height).filter(m=>(m&mask)===m);const byCell=new Map();for(const m of candidates){for(let i=0;i<height*10;i++){const b=1n<<BigInt(i);if(m&b){const a=byCell.get(i)??[];a.push(m);byCell.set(i,a)}}}const out=[];function dfs(rem,ops){if(rem===0n){out.push([...ops]);return}let idx=0,t=rem;while((t&1n)===0n){idx++;t>>=1n}for(const m of byCell.get(idx)??[])if((m&rem)===m){ops.push({piece,mask:m});dfs(rem^m,ops);ops.pop()}}
dfs(mask,[]);return out}
export function coloredOperationSets(page,height=4,{assembleOperation=false}={}){const{base,colors}=(assembleOperation?assembledFieldMasks:fieldMasks)(page,height);let sets=[[]];for(const p of PIECES){const parts=partitionPieceMask(p,colors[p],height);const next=[];for(const a of sets)for(const b of parts)next.push([...a,...b]);sets=next}return{base,operationSets:sets}}
export function normalizeBase(base,height=4){let cleared=0,complete=0;const incomplete=[];for(let y=0;y<height;y++){const row=(base>>BigInt(y*10))&FULL_ROW;if(row===FULL_ROW){cleared|=1<<y;complete++}else incomplete.push(row)}let board=0n;for(let y=0;y<complete;y++)board|=FULL_ROW<<BigInt(y*10);for(let i=0;i<incomplete.length;i++)board|=incomplete[i]<<BigInt((i+complete)*10);return{board,clearedRows:cleared}}
export function mapOriginalMask(mask,clearedRows,height=4){const available=[];for(let r=0;r<height;r++)if(!(clearedRows&(1<<r)))available.push(r);const c=popcount(BigInt(clearedRows));let out=0n;for(let ai=0;ai<available.length;ai++){const r=available[ai],cy=c+ai;for(let x=0;x<10;x++)if(mask&bit(x,r))out|=bit(x,cy)}return out}
export function advanceCleared(board,currentMask,clearedRows,height=4){const available=[];for(let r=0;r<height;r++)if(!(clearedRows&(1<<r)))available.push(r);const c=popcount(BigInt(clearedRows)),raw=board|currentMask;let next=clearedRows;for(let cy=c;cy<height;cy++){const row=(raw>>BigInt(cy*10))&FULL_ROW;if(row===FULL_ROW){const ai=cy-c;if(ai<available.length)next|=1<<available[ai]}}return next}
export function aggregateMasks(ops){const masks=Object.fromEntries(PIECES.map(p=>[p,0n]));for(const op of ops)masks[op.piece]|=op.mask;return masks}
export function tilingKey(ops){const m=aggregateMasks(ops);return PIECES.map(p=>m[p].toString(16)).join(':')}
