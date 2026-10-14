import {decoder,encoder,Field} from 'tetris-fumen';
import {MASK_PIECES} from './tiling.mjs';

export function fieldFromSignature(sig){return Field.create(sig.replace(/\n/g,''))}

export function solutionPage(initialBoard,solution,comment='',height=4){
  const field=Field.create();
  const rows=new Uint16Array(7);
  for(let y=0;y<height;y++){
    const shift=BigInt(y*10);
    const base=Number((initialBoard>>shift)&1023n);
    for(let i=0;i<7;i++)rows[i]=Number((solution.masks[i]>>shift)&1023n);
    for(let x=0;x<10;x++){
      const bit=1<<x;
      let color=(base&bit)?'X':'_';
      for(let i=0;i<7;i++)if(rows[i]&bit){color=MASK_PIECES[i];break}
      if(color!=='_')field.set(x,y,color);
    }
  }
  return {field,comment};
}
export function encodePages(initialBoard,solutions,comments=[],height=4){return encoder.encode(solutions.map((s,i)=>solutionPage(initialBoard,s,comments[i]??'',height)))}

// The optional page belongs to this request. Clone encoder-mutated metadata so
// callers can safely reuse decoded pages without changing comments or flags.
export function combineWithIntro(source,title,pages,sourcePage){
  const page=sourcePage??decoder.decode(source)[0];
  const intro={field:page.field,operation:page.operation,flags:{...page.flags},comment:title};
  return encoder.encode([intro,...pages]);
}
