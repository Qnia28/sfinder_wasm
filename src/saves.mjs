import{lastBagInfo}from'./pattern.mjs';
import{popcount}from'./board.mjs';
import{MASK_PIECES}from'./tiling.mjs';
import { TETRIS_DISPLAY_ORDER } from './piece-order.mjs';

const ORDER=TETRIS_DISPLAY_ORDER;
const PIECE_BIT=Object.fromEntries([...ORDER].map((p,i)=>[p,1<<i]));
const ORDER_INDEX=Object.fromEntries([...ORDER].map((p,i)=>[p,i]));
const SOLUTION_INDEX=Object.fromEntries([...MASK_PIECES].map((p,i)=>[p,i]));
const expressionTables=new Map();
const exactExpressionPredicates=new Map();
const bagInfoCache=new Map();

export const tetrisSort=s=>[...new Set(s)].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b)).join('');
export const tetrisSortExact=s=>[...s].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b)).join('');

function resolveBagInfo(analysis){
  if(typeof analysis==='string'){
    let info=bagInfoCache.get(analysis);
    if(!info){info=lastBagInfo(analysis);bagInfoCache.set(analysis,info)}
    return info;
  }
  if(analysis?.pieces instanceof Set&&Number.isInteger(analysis.drawCount))return analysis;
  if(analysis?.lastBag?.pieces instanceof Set)return analysis.lastBag;
  throw new Error('missing last-bag metadata for save analysis');
}


export function prepareQueuePieceCounts(queue){
  const counts=new Uint8Array(7);
  for(const piece of queue){const index=ORDER_INDEX[piece];if(index!==undefined)counts[index]++}
  return counts;
}

export function prepareSolutionPieceCounts(solution){
  const counts=new Uint8Array(7);
  for(let oi=0;oi<7;oi++){
    const piece=ORDER[oi],si=SOLUTION_INDEX[piece];
    counts[oi]=si===undefined?0:popcount(solution.masks[si])/4;
  }
  return counts;
}

export function prepareSaveCase(queue,analysis){
  const{pieces,drawCount}=resolveBagInfo(analysis);
  let bagMask=0,drawnMask=0;
  for(const piece of pieces){const bit=PIECE_BIT[piece];if(bit)bagMask|=bit}
  const start=drawCount===0?0:Math.max(0,queue.length-drawCount);
  for(let i=start;i<queue.length;i++){const bit=PIECE_BIT[queue[i]];if(bit)drawnMask|=bit}
  return{queueCounts:prepareQueuePieceCounts(queue),baseSavedMask:bagMask&~drawnMask};
}

export function savedMaskPrepared(caseMeta,solutionCounts){
  let saved=caseMeta.baseSavedMask;
  for(let oi=0;oi<7;oi++)if(caseMeta.queueCounts[oi]>solutionCounts[oi])saved|=1<<oi;
  return saved&0x7f;
}

export function unusedPiecePrepared(queueCounts,solutionCounts){
  let saved=null,total=0;
  for(let oi=0;oi<7;oi++){
    const remaining=queueCounts[oi]-solutionCounts[oi];
    if(remaining<0)throw new Error(`solution uses more ${ORDER[oi]} pieces than queue provides`);
    if(remaining){total+=remaining;saved=ORDER[oi]}
  }
  if(total!==1)throw new Error(`expected exactly one saved piece, got ${total}`);
  return saved;
}

export function saveMaskToString(mask){let out='';for(let i=0;i<ORDER.length;i++)if(mask&(1<<i))out+=ORDER[i];return out}
export function saveStringToMask(save){let mask=0;for(const piece of save){const bit=PIECE_BIT[piece];if(bit)mask|=bit}return mask}

// Return the 7-bit save set directly.  Strings/Sets/Maps are only created at
// API boundaries now; the hot saves/minimals loops use this compact value.
export function savedMask(queue,solution,analysis){
  return savedMaskPrepared(prepareSaveCase(queue,analysis),prepareSolutionPieceCounts(solution));
}

export function savedString(queue,solution,analysis){return saveMaskToString(savedMask(queue,solution,analysis))}

function containsSubsequence(save,want){let i=0;for(const p of save){if(p===want[i])i++;if(i===want.length)return true}return want.length===0}
function evaluateSaveExpressionRaw(save,expr){
  expr=expr.trim();
  let depth=0;
  for(let i=0;i<expr.length-1;i++){
    if(expr[i]==='(')depth++;else if(expr[i]===')')depth--;else if(depth===0&&expr.slice(i,i+2)==='||')return evaluateSaveExpressionRaw(save,expr.slice(0,i))||evaluateSaveExpressionRaw(save,expr.slice(i+2));
  }
  depth=0;
  for(let i=0;i<expr.length-1;i++){
    if(expr[i]==='(')depth++;else if(expr[i]===')')depth--;else if(depth===0&&expr.slice(i,i+2)==='&&')return evaluateSaveExpressionRaw(save,expr.slice(0,i))&&evaluateSaveExpressionRaw(save,expr.slice(i+2));
  }
  if(expr.startsWith('!'))return!evaluateSaveExpressionRaw(save,expr.slice(1));
  if(expr.startsWith('(')&&expr.endsWith(')'))return evaluateSaveExpressionRaw(save,expr.slice(1,-1));
  if(expr.startsWith('/')&&expr.endsWith('/'))return new RegExp(expr.slice(1,-1)).test(save);
  const wanted=tetrisSort(expr.replace(/\^/g,''));
  const hit=containsSubsequence(save,wanted);
  return expr.startsWith('^')?!hit:hit;
}



// Legacy ezsaves `percent` evaluates an expression against the complete set of
// save outcomes available to one queue.  This is intentionally separate from
// compileSaveExpression(), whose scalar 7-bit predicate remains available for
// distinct-piece internal filters such as fifth; minimals uses exact multiplicity below.
export function savedCodePrepared(caseMeta,solutionCounts){
  let extraMask=0;
  for(let oi=0;oi<7;oi++)if(caseMeta.queueCounts[oi]>solutionCounts[oi])extraMask|=1<<oi;
  return (caseMeta.baseSavedMask&0x7f)|((extraMask&0x7f)<<7);
}

export function saveCodeToString(code){
  const base=code&0x7f,extra=(code>>7)&0x7f;
  let out='';
  for(let oi=0;oi<7;oi++){
    if(base&(1<<oi))out+=ORDER[oi];
    if(extra&(1<<oi))out+=ORDER[oi];
  }
  return out;
}

export function savedStringPrepared(caseMeta,solutionCounts){
  return saveCodeToString(savedCodePrepared(caseMeta,solutionCounts));
}

// Minimals filters operate on one concrete solution at a time.  Unlike the
// historical 7-bit set mask, this code keeps the exact multiplicity of every
// saved tetromino.  Three bits per piece are sufficient for the supported
// queue windows (0..7 copies per tetromino) while keeping the value in a safe
// JavaScript integer.
export function savedMultiplicityCodePrepared(caseMeta,solutionCounts){
  let code=0;
  for(let oi=0;oi<7;oi++){
    const remaining=caseMeta.queueCounts[oi]-solutionCounts[oi];
    if(remaining<0)throw new Error(`solution uses more ${ORDER[oi]} pieces than queue provides`);
    const count=((caseMeta.baseSavedMask&(1<<oi))?1:0)+remaining;
    if(count>7)throw new Error(`saved ${ORDER[oi]} multiplicity ${count} exceeds compact encoding`);
    code|=count<<(oi*3);
  }
  return code;
}

export function saveMultiplicityCodeToString(code){
  let out='';
  for(let oi=0;oi<7;oi++){
    const count=(code>>(oi*3))&7;
    if(count)out+=ORDER[oi].repeat(count);
  }
  return out;
}

// Queue-level save expressions are parsed independently from the scalar
// minimals/fifth predicate below.  The syntax tree represents the observable
// ezsaves percent behavior without reusing the historical Python parser's
// stack representation or control flow.
function tokenizeSaveOutcomeExpression(source){
  const tokens=[];
  for(let index=0;index<source.length;){
    const char=source[index];
    if(/[TILJSZO]/.test(char)){
      let end=index+1;
      while(end<source.length&&/[TILJSZO]/.test(source[end]))end++;
      tokens.push({kind:'match',value:tetrisSortExact(source.slice(index,end))});
      index=end;
      continue;
    }
    if(char==='/'){
      const end=source.indexOf('/',index+1);
      if(end<0)throw new SyntaxError("Wanted Saves: Missing ending '/' in regex queue");
      tokens.push({kind:'regex',value:source.slice(index+1,end)});
      index=end+1;
      continue;
    }
    if(char==='!'){tokens.push({kind:'not'});index++;continue}
    if(char==='^'){tokens.push({kind:'avoid'});index++;continue}
    if(char==='('){tokens.push({kind:'open'});index++;continue}
    if(char===')'){tokens.push({kind:'close'});index++;continue}
    if(char==='&'||char==='|'){
      if(source[index+1]!==char)throw new SyntaxError('Wanted Saves: Operator inputted incorrectly should be && or ||');
      tokens.push({kind:char==='&'?'and':'or'});
      index+=2;
      continue;
    }
    throw new SyntaxError(`Wanted Saves: Input has unknown character '${char}'`);
  }
  return tokens;
}

function parseSaveOutcomeSequence(tokens,cursor=0,nested=false){
  const terms=[];
  let complement=false,absenceTest=false,connector=null;
  while(cursor<tokens.length){
    const token=tokens[cursor];
    if(token.kind==='close'){
      if(!nested)throw new SyntaxError('Wanted Saves: Missing opening parentheses');
      return[{kind:'sequence',terms},cursor+1];
    }
    if(token.kind==='not'){absenceTest=!absenceTest;cursor++;continue}
    if(token.kind==='avoid'){complement=!complement;cursor++;continue}
    if(token.kind==='and'||token.kind==='or'){connector=token.kind;cursor++;continue}

    let expression;
    if(token.kind==='open'){
      [expression,cursor]=parseSaveOutcomeSequence(tokens,cursor+1,true);
    }else if(token.kind==='match'||token.kind==='regex'){
      expression=token;
      cursor++;
    }else{
      throw new SyntaxError('Wanted Saves: Invalid save expression');
    }
    terms.push({expression,complement,absenceTest,connector});
  }
  if(nested)throw new SyntaxError('Wanted Saves: Missing closing parentheses');
  return[{kind:'sequence',terms},cursor];
}

function compileSaveOutcomeAst(source){
  const tokens=tokenizeSaveOutcomeExpression(source);
  return parseSaveOutcomeSequence(tokens)[0];
}

function matchOutcomeAtom(allSaves,node){
  const matched=new Set();
  if(node.kind==='regex'){
    const re=new RegExp(node.value);
    for(const save of allSaves)if(re.test(save))matched.add(save);
    return matched;
  }
  for(const save of allSaves){
    let wantedIndex=0;
    for(const piece of save){
      if(wantedIndex===node.value.length)break;
      if(piece===node.value[wantedIndex])wantedIndex++;
    }
    if(wantedIndex===node.value.length)matched.add(save);
  }
  return matched;
}

function unionSets(left,right){return new Set([...left,...right])}
function complementSet(universe,subset){
  const result=new Set();
  for(const value of universe)if(!subset.has(value))result.add(value);
  return result;
}

function evaluateSaveOutcomeAst(allSaves,node){
  if(node.kind==='match'||node.kind==='regex')return matchOutcomeAtom(allSaves,node);
  let current=new Set();
  for(const term of node.terms){
    let matched=evaluateSaveOutcomeAst(allSaves,term.expression);
    if(term.complement)matched=complementSet(allSaves,matched);
    if(term.absenceTest)matched=matched.size?new Set():new Set(allSaves);
    if(term.connector==='and')current=current.size&&matched.size?unionSets(current,matched):new Set();
    else if(term.connector==='or')current=unionSets(current,matched);
    else current=matched;
  }
  return current;
}

function evaluateSaveOutcomeAstScalar(save,node){
  if(node.kind==='regex')return new RegExp(node.value).test(save);
  if(node.kind==='match')return containsSubsequence(save,node.value);
  let current=false;
  for(const term of node.terms){
    let matched=evaluateSaveOutcomeAstScalar(save,term.expression);
    if(term.complement)matched=!matched;
    if(term.absenceTest)matched=!matched;
    if(term.connector==='and')current=current&&matched;
    else if(term.connector==='or')current=current||matched;
    else current=matched;
  }
  return current;
}

export function parseSaveExpressionSpec(value){
  const raw=String(value??'').trim();
  const hash=raw.indexOf('#');
  const expression=(hash<0?raw:raw.slice(0,hash)).trim();
  const alias=hash<0?null:raw.slice(hash+1).trim();
  if(!expression)throw new SyntaxError('Wanted Saves: Empty save expression');
  return{raw,expression,alias,label:alias||expression};
}

export function compileSaveOutcomeExpression(expr){
  const{expression}=parseSaveExpressionSpec(expr);
  const ast=compileSaveOutcomeAst(expression);
  return allSaves=>evaluateSaveOutcomeAst(allSaves,ast);
}

export function evaluateSaveOutcomeExpression(allSaves,expr){
  return compileSaveOutcomeExpression(expr)(allSaves).size>0;
}

// Compatibility exports retained for callers that adopted the 2.3 WIP names.
export const compileLegacySaveSetExpression=compileSaveOutcomeExpression;
export const evaluateLegacySaveSetExpression=evaluateSaveOutcomeExpression;

export function compareExactSaveStrings(a,b){
  const aa=[...a].map(p=>ORDER_INDEX[p]??99),bb=[...b].map(p=>ORDER_INDEX[p]??99);
  const n=Math.min(aa.length,bb.length);
  for(let i=0;i<n;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];
  return aa.length-bb.length||a.localeCompare(b);
}

// Compile the single-solution predicate used by minimals.  The parser is shared
// with the independently implemented queue-level evaluator, but evaluation is
// scalar: one exact save multiset in, one boolean out.  Results are memoized by
// compact multiplicity code so broad pattern paths do not allocate strings for
// repeated states.
export function compileExactSaveExpression(expr){
  const raw=String(expr??'').trim();
  if(!raw||raw.toUpperCase()==='ALL')return()=>true;
  const{expression}=parseSaveExpressionSpec(raw);
  let predicate=exactExpressionPredicates.get(expression);
  if(predicate)return predicate;
  const ast=compileSaveOutcomeAst(expression);
  const cache=new Map();
  predicate=code=>{
    let value=cache.get(code);
    if(value!==undefined)return value;
    value=evaluateSaveOutcomeAstScalar(saveMultiplicityCodeToString(code),ast);
    cache.set(code,value);
    return value;
  };
  exactExpressionPredicates.set(expression,predicate);
  return predicate;
}

// Save sets have only 2^7 possible values.  Compile each expression once and
// evaluate all future solutions with one 7-bit table lookup.
export function compileSaveExpression(expr){
  const raw=String(expr??'').trim();
  if(raw.toUpperCase()==='ALL')return new Uint8Array(128).fill(1);
  const key=raw.includes('#')?parseSaveExpressionSpec(raw).expression:raw;
  let table=expressionTables.get(key);
  if(table)return table;
  table=new Uint8Array(128);
  for(let mask=0;mask<128;mask++)table[mask]=evaluateSaveExpressionRaw(saveMaskToString(mask),key)?1:0;
  expressionTables.set(key,table);
  return table;
}

// Keep the public string evaluator compatible while routing canonical Tetris
// save strings through the same precompiled truth table used by hot paths.
export function evaluateSaveExpression(save,expr){return!!compileSaveExpression(expr)[saveStringToMask(tetrisSort(save))]}
export function evaluateSaveMask(mask,expr){return!!compileSaveExpression(expr)[mask&0x7f]}
export function filterSolutionsForSave(queue,solutions,analysis,wanted){const table=compileSaveExpression(wanted);return solutions.filter(s=>!!table[savedMask(queue,s,analysis)])}
export function queueCanSave(queue,solutions,analysis,wanted){const table=compileSaveExpression(wanted);return solutions.some(s=>!!table[savedMask(queue,s,analysis)])}
