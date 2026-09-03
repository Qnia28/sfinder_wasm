export const WIDTH=10,MAX_HEIGHT=6,FULL_ROW=0x3ffn;
export const boardMask=h=>(1n<<BigInt(h*10))-1n;
export function popcount(v){let n=0;while(v){v&=v-1n;n++}return n}
export function boardFromFumenPage(page,height=4){let b=0n;for(let y=0;y<height;y++)for(let x=0;x<10;x++)if(page.field.at(x,y)!=='_')b|=1n<<BigInt(y*10+x);return b}
export function highestOccupiedRow(page){for(let y=22;y>=0;y--)for(let x=0;x<10;x++)if(page.field.at(x,y)!=='_')return y;return-1}
