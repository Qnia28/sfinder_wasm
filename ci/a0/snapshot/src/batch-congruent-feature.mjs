import { calculateTargetCoverCount } from './batch-cover-count-feature.mjs';
import { createPatternPrefixSource } from './pattern-prefix-source.mjs';
import { MAX_PATTERN_CASES, PatternExpansionError } from './pattern.mjs';
import { validateCongruentLimit } from './batch-limits.mjs';
import { decoder, encoder } from "tetris-fumen";
import { coverTargets } from "./batch-cover.mjs";
import { batchReachability, boolMirror, solutionFromOps } from "./batch-feature-common.mjs";
import { fieldMasks } from "./batch-geometry.mjs";
import { findCongruentSolutions } from "./batch-setup.mjs";
import { solutionPage } from "./fumen.mjs";
import { expandPattern, expandPatternCasesInternal, queuesForFinder } from "./pattern.mjs";
import { validateTargetLines } from "./pc-input.mjs";

export async function calculateCongruent({
  sourceFumen,
  pattern,
  clear = 4,
  blueGarbage = false,
  useHold = true,
  _keepVariants = false,
  maxSolutions = 20000,
}, context) {
  validateCongruentLimit(maxSolutions);
  validateTargetLines(clear);
  const pages = decoder.decode(sourceFumen);
  if (!pages.length) throw new Error("input Fumen has no pages");
  const finderPattern = queuesForFinder(pattern);
  const queues = context?.queues ?? expandPattern(finderPattern);
  const reachability = await batchReachability(clear, "tetrio");
  const out = [];
  reachability.withSession(() => {
  for (const page of pages) {
    let { base, fill } = fieldMasks(page, clear);
    if (blueGarbage) {
      fill |= base;
      base = 0n;
    }
    const solutions = findCongruentSolutions({
      base,
      fill,
      queues,
      height: clear,
      reachability,
      useHold,
      maxSolutions,
    });
    for (const solution of solutions) {
      if (_keepVariants) {
        out.push({ ...solution, base });
      } else {
        const { variants, ...publicSolution } = solution;
        out.push({ ...publicSolution, base });
      }
    }
  }
  });
  if (!out.length) throw new Error("no congruent solutions");
  const fumen = context?.encode === false ? undefined : encoder.encode(out.map((solution) => solutionPage(
    solution.base,
    solutionFromOps(solution.operations),
    solution.comment,
    clear,
  )));
  return {
    pathPattern: finderPattern,
    analysisPattern: pattern,
    solutions: out,
    count: out.length,
    ...(fumen === undefined ? {} : { fumen }),
  };
}

export async function calculateCongruentCover({
  sourceFumen, pattern, clear = 4, mode = 'normal', mirror = 'no',
  blueGarbage = false, useHold = true, outputMode = 'variants',
  maxSolutions = 20000, maxBatchPrefixes = 65536,
}) {
  if (!['variants','coverage','count'].includes(outputMode)) throw new RangeError(`unsupported congruent-cover outputMode '${outputMode}'`);
  validateTargetLines(clear);
  let queues;
  if (outputMode === 'count') {
    const pages=decoder.decode(sourceFumen);
    let take=0;
    for(const page of pages){
      const masks=fieldMasks(page,clear);let bits=masks.fill|(blueGarbage?masks.base:0n),cells=0;
      for(;bits;bits&=bits-1n)cells++;
      take=Math.max(take,Math.floor(cells/4)+(useHold?1:0));
    }
    const source=createPatternPrefixSource(queuesForFinder(pattern),take),unique=new Set();
    for(const entry of source.prefixes()){
      unique.add(entry.queue);
      if(unique.size>MAX_PATTERN_CASES)throw new PatternExpansionError(MAX_PATTERN_CASES);
    }
    queues=[...unique];
  }
  const congruent = await calculateCongruent({sourceFumen,pattern,clear,blueGarbage,useHold,maxSolutions,_keepVariants:outputMode==='variants'},
    {queues,encode:outputMode==='variants'});
  const targets=congruent.solutions.map(solution=>({base:solution.base,operations:solution.operations,
    ...(outputMode==='variants'?{orders:solution.orders,variants:solution.variants}:{}),comment:solution.comment,key:solution.key}));
  if(outputMode==='count'){
    const counted=await calculateTargetCoverCount({targets,pattern,clear,mode,mirror,useHold,maxBatchPrefixes});
    const {targets:coverTargets,...summary}=counted;
    return {...summary,count:congruent.count,coverTargets};
  }
  const reachability=await batchReachability(clear,'jstris');
  const result=coverTargets({targets,queues:expandPatternCasesInternal(congruent.pathPattern),height:clear,reachability,
    useHold,mirror:boolMirror(mirror),mode,coverageOnly:outputMode==='coverage'});
  const common={mode:result.mode,mirror:boolMirror(mirror),covered:result.covered,total:result.total,
    failed:result.failed.length,failedQueues:result.failed,percent:result.total?result.covered/result.total*100:0,coverTargets:result.targets};
  if(outputMode==='coverage')return {outputMode,pathPattern:congruent.pathPattern,analysisPattern:pattern,count:congruent.count,...common};
  return {...congruent,solutions:congruent.solutions.map(({variants,...solution})=>solution),...common};
}
