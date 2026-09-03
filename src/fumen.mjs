import{decoder,encoder,Field}from'tetris-fumen';import{tilingFieldSignature}from'./tiling.mjs';
export function fieldFromSignature(sig){return Field.create(sig.replace(/\n/g,''))}
export function solutionPage(initialBoard,solution,comment='',height=4){return{field:fieldFromSignature(tilingFieldSignature(initialBoard,solution.masks,height)),comment}}
export function encodePages(initialBoard,solutions,comments=[],height=4){return encoder.encode(solutions.map((s,i)=>solutionPage(initialBoard,s,comments[i]??'',height)))}
export function combineWithIntro(source,title,pages){const intro=decoder.decode(source)[0];intro.comment=title;return encoder.encode([intro,...pages])}
