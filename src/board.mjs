export const WIDTH=10,MAX_HEIGHT=6,FULL_ROW=0x3ffn;
export const boardMask=h=>(1n<<BigInt(h*10))-1n;
export function popcount(v){let n=0;while(v){v&=v-1n;n++}return n}

// A decoded Page.field getter returns a copy. Read it once per scan.
export function boardFromField(field,height=4){
  let board=0n;
  for(let y=height-1;y>=0;y--){
    let row=0;
    for(let x=0;x<10;x++)if(field.at(x,y)!=='_')row|=1<<x;
    board=(board<<10n)|BigInt(row);
  }
  return board;
}
export function boardFromFumenPage(page,height=4){return boardFromField(page.field,height)}
export function highestOccupiedRow(page){
  const field=page.field;
  for(let y=22;y>=0;y--)for(let x=0;x<10;x++)if(field.at(x,y)!=='_')return y;
  return -1;
}
export function scanFumenField(field,height=4){
  let highest=-1,board=0n;
  for(let y=22;y>=0;y--){
    let row=0;
    for(let x=0;x<10;x++)if(field.at(x,y)!=='_')row|=1<<x;
    if(row&&highest<0)highest=y;
    if(y<height)board=(board<<10n)|BigInt(row);
  }
  return {board,highest};
}
