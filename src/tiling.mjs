import{popcount}from'./board.mjs';
export const MASK_PIECES='IJLOSTZ';
export function solutionKey(masks){return masks.map(x=>x.toString(16)).join(':')}
export function placedCounts(solution){const c=new Map();for(let i=0;i<7;i++)c.set(MASK_PIECES[i],popcount(solution.masks[i])/4);return c}
export function tilingFieldSignature(initialBoard,masks,height=4){const rows=[];for(let y=height-1;y>=0;y--){let row='';for(let x=0;x<10;x++){const bit=1n<<BigInt(y*10+x);let c=(initialBoard&bit)?'X':'_';for(let i=0;i<7;i++)if(masks[i]&bit){c=MASK_PIECES[i];break}row+=c}rows.push(row)}return rows.join('\n')}
