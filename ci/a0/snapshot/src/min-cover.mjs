import { assertQualityProvider, requirePositiveQuality } from "./quality-contract.mjs";

// Independent exact minimum set-cover solver.
// Primary objective: minimum number of solutions.
// Secondary objective (optional): maximize the lexicographically sorted
// per-case quality vector, improving the worst-covered case first.

function popcountBigInt(value){
  let n=0;
  for(let x=value;x;x&=x-1n)n++;
  return n;
}

function bitIndices(value){
  const out=[];
  let index=0;
  for(let x=value;x;x>>=1n,index++)if(x&1n)out.push(index);
  return out;
}

function compareQualityVector(a,b){
  if(!b)return 1;
  const n=Math.min(a.length,b.length);
  for(let i=0;i<n;i++){
    if(a[i]!==b[i])return a[i]>b[i]?1:-1;
  }
  return a.length===b.length?0:(a.length>b.length?1:-1);
}

function stableSetKey(indices,keys){
  return indices.map(i=>keys[i]).sort().join('\u0000');
}

/**
 * coverage: Map<caseId, Set<solutionKey>>
 * qualityFor: optional (solutionKey, caseId) => positive integer playableOrderCount. Larger is better.
 *
 * Returns one deterministic optimal minimum set rather than all tied sets.
 */
export function exactMinimumCover(coverage,{qualityFor=null}={}){
  assertQualityProvider(qualityFor);
  const rawCases=[];
  const keySet=new Set();
  for(const[caseId,solutions]of coverage){
    if(!solutions?.size)continue;
    const keys=[...solutions];
    for(const key of keys)keySet.add(key);
    rawCases.push({caseId,keys});
  }
  if(rawCases.length===0)return{count:0,keys:[],qualityVector:[],searchedStates:0};

  const keys=[...keySet].sort();
  const keyIndex=new Map(keys.map((key,i)=>[key,i]));
  const candidateCount=keys.length;
  let candidateCoverage=Array(candidateCount).fill(0n);
  const originalCandidateSets=[];

  for(let ci=0;ci<rawCases.length;ci++){
    let cset=0n;
    for(const key of rawCases[ci].keys){
      const si=keyIndex.get(key);
      candidateCoverage[si]|=1n<<BigInt(ci);
      cset|=1n<<BigInt(si);
    }
    originalCandidateSets.push(cset);
  }

  // Remove logically redundant cases only from the cardinality search.  The
  // original case list is retained for the human-quality objective.
  const active=Array(rawCases.length).fill(true);
  const order=[...rawCases.keys()].sort((a,b)=>{
    const da=popcountBigInt(originalCandidateSets[a]);
    const db=popcountBigInt(originalCandidateSets[b]);
    return da-db||a-b;
  });
  for(let ai=0;ai<order.length;ai++){
    const a=order[ai];
    if(!active[a])continue;
    const as=originalCandidateSets[a];
    for(let bi=ai+1;bi<order.length;bi++){
      const b=order[bi];
      if(!active[b])continue;
      const bs=originalCandidateSets[b];
      // candidates(A) subset candidates(B): satisfying A always satisfies B.
      if((as&bs)===as)active[b]=false;
    }
  }

  const activeOriginalIndices=[];
  const originalToActive=Array(rawCases.length).fill(-1);
  for(let i=0;i<active.length;i++)if(active[i]){
    originalToActive[i]=activeOriginalIndices.length;
    activeOriginalIndices.push(i);
  }
  const caseCount=activeOriginalIndices.length;
  const fullMask=(1n<<BigInt(caseCount))-1n;
  const activeCoverage=Array(candidateCount).fill(0n);
  const caseCandidates=Array.from({length:caseCount},()=>[]);
  for(let si=0;si<candidateCount;si++){
    let bits=0n;
    for(const oi of bitIndices(candidateCoverage[si])){
      const ai=originalToActive[oi];
      if(ai>=0)bits|=1n<<BigInt(ai);
    }
    activeCoverage[si]=bits;
    for(const ai of bitIndices(bits))caseCandidates[ai].push(si);
  }

  // Greedy upper bound gives the exact search a useful starting point.
  function greedy(){
    let covered=0n;
    const selected=[];
    while(covered!==fullMask){
      const rem=fullMask^covered;
      let best=-1,bestGain=0;
      for(let si=0;si<candidateCount;si++){
        const gain=popcountBigInt(activeCoverage[si]&rem);
        if(gain>bestGain){best=si;bestGain=gain}
      }
      if(best<0||bestGain===0)return null;
      selected.push(best);
      covered|=activeCoverage[best];
    }
    return selected;
  }

  const greedySet=greedy();
  if(!greedySet)return{count:Infinity,keys:[],qualityVector:[],searchedStates:0};
  let bestCount=greedySet.length;
  let bestCardinalitySelected=[...greedySet].sort((a,b)=>a-b);
  let searchedStates=0;
  const bestDepthByCovered=new Map();

  function lowerBound(uncovered){
    const n=popcountBigInt(uncovered);
    let maxGain=0;
    for(let si=0;si<candidateCount;si++){
      const gain=popcountBigInt(activeCoverage[si]&uncovered);
      if(gain>maxGain)maxGain=gain;
    }
    return maxGain?Math.ceil(n/maxGain):Infinity;
  }

  function chooseCase(uncovered){
    let best=-1,bestN=Infinity;
    for(const ci of bitIndices(uncovered)){
      const n=caseCandidates[ci].length;
      if(n<bestN){best=ci;bestN=n;if(n<=1)break}
    }
    return best;
  }

  function searchCardinality(covered,selected){
    searchedStates++;
    const depth=selected.length;
    if(covered===fullMask){
      if(depth<bestCount){
        bestCount=depth;
        bestCardinalitySelected=[...selected].sort((a,b)=>a-b);
      }
      return;
    }
    if(depth>=bestCount)return;
    const prev=bestDepthByCovered.get(covered);
    if(prev!==undefined&&prev<=depth)return;
    bestDepthByCovered.set(covered,depth);
    const uncovered=fullMask^covered;
    if(depth+lowerBound(uncovered)>=bestCount)return;
    const ci=chooseCase(uncovered);
    if(ci<0)return;
    const branches=caseCandidates[ci].map(si=>({si,gain:popcountBigInt(activeCoverage[si]&uncovered)}));
    branches.sort((a,b)=>b.gain-a.gain||a.si-b.si);
    for(const{si}of branches){
      selected.push(si);
      searchCardinality(covered|activeCoverage[si],selected);
      selected.pop();
    }
  }
  searchCardinality(0n,[]);

  if(!qualityFor){
    return{
      count:bestCount,
      keys:bestCardinalitySelected.map(i=>keys[i]),
      qualityVector:[],
      searchedStates,
    };
  }

  const qualityCache=new Map();
  function q(si,oi){
    const ck=`${si}|${oi}`;
    if(qualityCache.has(ck))return qualityCache.get(ck);
    const key=keys[si],caseId=rawCases[oi].caseId;
    const normalized=requirePositiveQuality(qualityFor(key,caseId),{key,caseId});
    qualityCache.set(ck,normalized);
    return normalized;
  }
  function setQuality(selected){
    const scores=[];
    for(let oi=0;oi<rawCases.length;oi++){
      let best=-Infinity;
      const bit=1n<<BigInt(oi);
      for(const si of selected)if(candidateCoverage[si]&bit)best=Math.max(best,q(si,oi));
      scores.push(Number.isFinite(best)?best:0);
    }
    scores.sort((a,b)=>a-b);
    return scores;
  }

  let bestSelected=null,bestQuality=null,bestStable=null;
  const completed=new Set();
  function consider(selected){
    const sorted=[...selected].sort((a,b)=>a-b);
    const signature=sorted.join(',');
    if(completed.has(signature))return;
    completed.add(signature);
    const quality=setQuality(sorted);
    const stable=stableSetKey(sorted,keys);
    const cmp=compareQualityVector(quality,bestQuality);
    if(cmp>0||(cmp===0&&(bestStable===null||stable<bestStable))){
      bestSelected=sorted;
      bestQuality=quality;
      bestStable=stable;
    }
  }

  // Enumerate only exact-cardinality covers. MRV keeps this tractable on the
  // intended SFinder matrices; complete sets are deduplicated by candidate IDs.
  function searchBest(covered,selected){
    searchedStates++;
    if(covered===fullMask){
      if(selected.length===bestCount)consider(selected);
      return;
    }
    if(selected.length>=bestCount)return;
    const uncovered=fullMask^covered;
    if(selected.length+lowerBound(uncovered)>bestCount)return;
    const ci=chooseCase(uncovered);
    if(ci<0)return;
    const branches=caseCandidates[ci].map(si=>({si,gain:popcountBigInt(activeCoverage[si]&uncovered)}));
    branches.sort((a,b)=>b.gain-a.gain||a.si-b.si);
    for(const{si}of branches){
      if(selected.includes(si))continue;
      selected.push(si);
      searchBest(covered|activeCoverage[si],selected);
      selected.pop();
    }
  }
  searchBest(0n,[]);

  if(!bestSelected){
    // Greedy can only equal bestCount when cardinality search proved it; use it
    // as a deterministic fallback in the unlikely event the second search was
    // exhausted by an implementation edge case.
    bestSelected=[...greedySet].slice(0,bestCount).sort((a,b)=>a-b);
    bestQuality=setQuality(bestSelected);
  }
  return{
    count:bestCount,
    keys:bestSelected.map(i=>keys[i]),
    qualityVector:bestQuality,
    searchedStates,
  };
}

export function stableSolutionOrder(solutions){
  return[...solutions].sort((a,b)=>a.key===b.key?0:(a.key<b.key?-1:1));
}


// Prefer the Rust/WASM bitset solver when a real PcSolver is available.
// The independent JavaScript implementation remains as a deterministic
// fallback for unit tests, mocks, and older WASM binaries.
export function minimumCover(coverage,{qualityFor=null,solver=null}={}){
  assertQualityProvider(qualityFor);
  const direct=qualityFor===null
    ? solver?.minimumCoverCardinality?.(coverage)
    : solver?.minimumCover?.(coverage,{qualityFor});
  if(direct!==null&&direct!==undefined)return direct;
  return exactMinimumCover(coverage,{qualityFor});
}
