import {decoder} from 'tetris-fumen';
import {boardFromFumenPage,popcount} from './board.mjs';
import {expandPatternCasesInternal} from './pattern.mjs';
import {calculatePerSaveMinimalsFromBoard,calculatePerSaveMinimalsFromBoardAsync} from './per-save-minimals-core.mjs';
import {combineWithIntro,solutionPage} from './fumen.mjs';

export class PerSaveMinimalsInputError extends Error{
  constructor(message){super(message);this.name='PerSaveMinimalsInputError'}
}

export function resolvePerSaveTargetLines({targetLines,clear}={}){
  if(targetLines!==undefined&&clear!==undefined&&targetLines!==clear){
    throw new PerSaveMinimalsInputError(`targetLines (${targetLines}) and clear (${clear}) disagree`);
  }
  const resolved=targetLines??clear??4;
  if(!Number.isInteger(resolved)||resolved<2||resolved>6){
    throw new PerSaveMinimalsInputError(`per-save minimals targetLines must be 2, 3, 4, 5, or 6; got ${resolved}`);
  }
  return resolved;
}

export function perSaveInputGeometry({sourceFumen,targetLines},context){
  const page=context?.page??decoder.decode(sourceFumen)[0];
  if(!page)throw new PerSaveMinimalsInputError('empty fumen');
  const board=context?.board??boardFromFumenPage(page,targetLines);
  const occupiedCells=popcount(board);
  const remainingCells=targetLines*10-occupiedCells;
  if(remainingCells<=0){
    throw new PerSaveMinimalsInputError(
      `per-save minimals requires unfilled target cells: targetLines=${targetLines}, occupiedCells=${occupiedCells}`,
    );
  }
  if(remainingCells%4!==0){
    throw new PerSaveMinimalsInputError(
      `occupied cell count is incompatible with a ${targetLines}-line PC: `+
      `remainingCells=${remainingCells} is not divisible by 4`,
    );
  }
  const piecesNeeded=remainingCells/4;
  const expectedQueueLength=piecesNeeded+1;
  return{page,board,targetLines,occupiedCells,remainingCells,piecesNeeded,expectedQueueLength};
}

export function calculatePerSaveMinimals({sourceFumen,pattern,solver,useHold=true,targetLines,clear,candidateLimit=16},context){
  const resolvedTargetLines=resolvePerSaveTargetLines({targetLines,clear});
  const geometry=perSaveInputGeometry({sourceFumen,targetLines:resolvedTargetLines},context);
  const queues=expandPatternCasesInternal(pattern);
  if(queues.length===0)throw new PerSaveMinimalsInputError('pattern expands to no queues');
  const badQueue=queues.find(entry=>entry.queue.length!==geometry.expectedQueueLength);
  if(badQueue){
    throw new PerSaveMinimalsInputError(
      `queue length is incompatible with this board: expected see${geometry.expectedQueueLength} `+
      `(${geometry.piecesNeeded} pieces needed + 1 save), got ${badQueue.queue.length}`,
    );
  }
  return{
    ...calculatePerSaveMinimalsFromBoard({board:geometry.board,queues,solver,useHold,candidateLimit}),
    targetLines:geometry.targetLines,
    occupiedCells:geometry.occupiedCells,
    remainingCells:geometry.remainingCells,
    piecesNeeded:geometry.piecesNeeded,
    expectedQueueLength:geometry.expectedQueueLength,
  };
}

export function encodePerSaveMinimals({sourceFumen,title='',calculation},sourcePage){
  const pages=[];
  const pageCounts={};
  for(const piece of Object.keys(calculation.results)){
    const result=calculation.results[piece];
    pageCounts[piece]=result.solutions.length;
    for(const solution of result.solutions){
      pages.push(solutionPage(calculation.board,solution,result.label,calculation.targetLines));
    }
  }
  return{fumen:combineWithIntro(sourceFumen,title,pages,sourcePage),pageCounts};
}

export async function calculatePerSaveMinimalsAsync({
  sourceFumen,pattern,solver,useHold=true,targetLines,clear,candidateLimit=16,
  primary=undefined,Primary=undefined,exactHumanQuality="true",useHiGHS="auto",UseHiGHS=undefined,fastStateBudget=undefined,
  tinyExactMaxCandidates=48,includeCoverage=true,secondaryWorkers='auto',filterWorkers=0,signal=null,secondary='auto',
},context){
  const resolvedTargetLines=resolvePerSaveTargetLines({targetLines,clear});
  const geometry=perSaveInputGeometry({sourceFumen,targetLines:resolvedTargetLines},context);
  const queues=expandPatternCasesInternal(pattern);
  if(queues.length===0)throw new PerSaveMinimalsInputError('pattern expands to no queues');
  const badQueue=queues.find(entry=>entry.queue.length!==geometry.expectedQueueLength);
  if(badQueue){
    throw new PerSaveMinimalsInputError(
      `queue length is incompatible with this board: expected see${geometry.expectedQueueLength} `+
      `(${geometry.piecesNeeded} pieces needed + 1 save), got ${badQueue.queue.length}`,
    );
  }
  return{
    ...await calculatePerSaveMinimalsFromBoardAsync({
      board:geometry.board,queues,solver,useHold,candidateLimit,
      exactHumanQuality,primary:primary??Primary,useHiGHS:UseHiGHS??useHiGHS,fastStateBudget,tinyExactMaxCandidates,includeCoverage,secondaryWorkers,filterWorkers,signal,secondary,
    }),
    targetLines:geometry.targetLines,
    occupiedCells:geometry.occupiedCells,
    remainingCells:geometry.remainingCells,
    piecesNeeded:geometry.piecesNeeded,
    expectedQueueLength:geometry.expectedQueueLength,
  };
}
