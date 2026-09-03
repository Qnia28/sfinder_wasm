import { TETRIS_DISPLAY_ORDER } from "./piece-order.mjs";

const ALL = TETRIS_DISPLAY_ORDER;
export const MAX_PATTERN_CASES = 1000000;
export const PIECE_ORDER=ALL;


export class PatternExpansionError extends RangeError {
  constructor(limit) {
    super(`pattern expansion exceeds ${limit} cases`);
    this.name = 'PatternExpansionError';
    this.limit = limit;
  }
}

export class PatternSyntaxError extends Error{
  constructor(message,{branchIndex=null,position=null}={}){
    const where=[branchIndex===null?null:`branch ${branchIndex+1}`,position===null?null:`position ${position+1}`].filter(Boolean).join(', ');
    super(where?`${message} (${where})`:message);
    this.name='PatternSyntaxError';
    this.branchIndex=branchIndex;
    this.position=position;
  }
}

export function complement(set){
  const excluded=set instanceof Set?set:new Set(set);
  return [...ALL].filter(p=>!excluded.has(p)).join('');
}

export function queuesForFinder(pattern){
  // Validate before rewriting so malformed negative sets (for example [^TT])
  // cannot become a different, accidentally valid finder expression.
  parsePattern(pattern);
  return pattern
    .replace(/\*!(?=\s*(?:\{|,|;|$))/g,'*p7')
    .replace(/\[\^([TILJSZO]+)\]/gi,(_,s)=>`[${complement(new Set(s.toUpperCase()))}]`);
}

export function permutations(items,k=items.length){
  const a=[...items],out=[],used=Array(a.length).fill(false),cur=[];
  function rec(){
    if(cur.length===k){out.push(cur.join(''));return}
    for(let i=0;i<a.length;i++)if(!used[i]){
      used[i]=true;cur.push(a[i]);rec();cur.pop();used[i]=false;
    }
  }
  rec();
  return out;
}

function syntax(message,branchIndex,position){
  throw new PatternSyntaxError(message,{branchIndex,position});
}

function parseConstraint(source,index,branchIndex){
  if(source[index]!=='{')return{constraint:null,index};
  const close=source.indexOf('}',index+1);
  if(close<0)syntax('missing closing } for order constraint',branchIndex,index);
  const text=source.slice(index+1,close).trim().toUpperCase();
  if(!text)syntax('empty order constraint',branchIndex,index);
  const rules=text.split(/[,&]/).map(x=>x.trim()).filter(Boolean);
  if(!rules.length)syntax('empty order constraint',branchIndex,index);
  for(const rule of rules)if(!/^[TILJSZO]<[TILJSZO]$/.test(rule))syntax(`unsupported order constraint: ${rule}`,branchIndex,index);
  return{constraint:rules,index:close+1};
}

function parseBagSet(raw,negated,branchIndex,position){
  if(!raw)syntax('empty piece set',branchIndex,position);
  const seen=new Set();
  for(const p of raw){
    if(!ALL.includes(p))syntax(`unknown piece in []: ${p}`,branchIndex,position);
    if(seen.has(p))syntax(`duplicate '${p}' piece in []`,branchIndex,position);
    seen.add(p);
  }
  const pieces=negated?complement(seen):raw;
  if(!pieces.length)syntax('bag contains no pieces',branchIndex,position);
  return pieces;
}

function parseDrawSuffix(source,index,setSize,branchIndex,position){
  if(source[index]==='!')return{drawCount:setSize,index:index+1};
  if(source[index]==='P'||source[index]==='p'){
    const digit=source[index+1];
    if(!digit||!/^[0-9]$/.test(digit))syntax('bag p suffix requires a draw count',branchIndex,index);
    const count=Number(digit);
    if(count<1)syntax('bag draw count must be at least 1',branchIndex,index+1);
    if(count>setSize)syntax(`bag draw count ${count} exceeds set size ${setSize}`,branchIndex,index+1);
    return{drawCount:count,index:index+2};
  }
  return{drawCount:1,index};
}

function finalObservedBag(elements,lastBag){
  if(!lastBag)return null;
  const pieces=new Set();
  let drawCount=0;
  for(let i=elements.length-1;i>=0;i--){
    const element=elements[i];
    const candidates=element.kind==='fixed'?[...element.value]:[...element.pieces];
    const unique=new Set(candidates);
    if(unique.size!==candidates.length||candidates.some(piece=>pieces.has(piece)))break;
    for(const piece of candidates)pieces.add(piece);
    drawCount+=element.depth;
    if(pieces.size===ALL.length)return{pieces,drawCount};
  }
  return{pieces:new Set(lastBag.pieces),drawCount:lastBag.drawCount};
}

function parseBranch(source,branchIndex){
  let i=0;
  const elements=[];
  while(i<source.length){
    const ch=source[i];
    if(ch===','||/\s/.test(ch)){i++;continue}
    if(ALL.includes(ch.toUpperCase())){
      let value='';
      const start=i;
      while(i<source.length&&ALL.includes(source[i].toUpperCase()))value+=source[i++].toUpperCase();
      if(source[i]==='{')syntax('order constraints may only follow bag expressions',branchIndex,i);
      elements.push({kind:'fixed',source:source.slice(start,i),value,depth:value.length});
      continue;
    }
    if(ch==='*'){
      const start=i++;
      let drawCount=1;
      if(source[i]==='!'){
        drawCount=7;
        i+=1;
      }else if(source[i]==='P'||source[i]==='p'){
        const digit=source[i+1];
        if(!digit||!/^[0-9]$/.test(digit))syntax('wildcard p suffix requires a draw count',branchIndex,i);
        drawCount=Number(digit);
        if(drawCount<1)syntax('wildcard draw count must be at least 1',branchIndex,i+1);
        if(drawCount>7)syntax('wildcard draw count cannot exceed 7',branchIndex,i+1);
        i+=2;
      }else if(i<source.length&&/[0-9]/.test(source[i])){
        syntax('wildcard draw count requires p, e.g. *p7',branchIndex,i);
      }
      const c=parseConstraint(source,i,branchIndex);i=c.index;
      elements.push({kind:'bag',source:source.slice(start,i),pieces:ALL,drawCount,depth:drawCount,constraint:c.constraint});
      continue;
    }
    if(ch==='['){
      const start=i++;
      let negated=false;
      if(source[i]==='^'){negated=true;i++}
      const contentStart=i;
      while(i<source.length&&source[i]!==']')i++;
      if(i>=source.length)syntax('missing closing ]',branchIndex,start);
      const raw=source.slice(contentStart,i).toUpperCase();
      const pieces=parseBagSet(raw,negated,branchIndex,start);
      i++;
      const suffix=parseDrawSuffix(source,i,pieces.length,branchIndex,start);i=suffix.index;
      const c=parseConstraint(source,i,branchIndex);i=c.index;
      elements.push({kind:'bag',source:source.slice(start,i),pieces,drawCount:suffix.drawCount,depth:suffix.drawCount,constraint:c.constraint});
      continue;
    }
    if(ch===';' )syntax('unexpected branch separator',branchIndex,i);
    syntax(`unsupported pattern token: ${ch}`,branchIndex,i);
  }
  if(!elements.length)syntax('empty pattern branch',branchIndex,0);
  const depth=elements.reduce((n,e)=>n+e.depth,0);
  const last=elements.at(-1);
  const lastBag=last.kind==='bag'?{pieces:new Set(last.pieces),drawCount:last.drawCount}:null;
  const observedBag=finalObservedBag(elements,lastBag);
  return{index:branchIndex,source:source.trim(),elements,depth,lastBag,observedBag};
}

export function parsePattern(pattern){
  if(typeof pattern!=='string'||!pattern.trim())throw new PatternSyntaxError('pattern is empty');
  // SFinder treats semicolon-separated definitions like separate pattern-file lines.
  // Empty lines are ignored, but all non-empty branches must have the same depth.
  const branchSources=pattern.split(';').map(x=>x.trim()).filter(Boolean);
  if(!branchSources.length)throw new PatternSyntaxError('pattern is empty');
  const branches=branchSources.map((source,index)=>parseBranch(source,index));
  const depth=branches[0].depth;
  for(const branch of branches)if(branch.depth!==depth){
    throw new PatternSyntaxError(`pattern branches must have equal queue length: expected ${depth}, got ${branch.depth}`,{branchIndex:branch.index});
  }
  return{source:pattern,depth,branches};
}

function optionsForElement(element){
  if(element.kind==='fixed')return[element.value];
  let options=permutations(element.pieces,element.drawCount);
  if(element.constraint){
    for(const rule of element.constraint){
      const [a,b]=rule.split('<');
      options=options.filter(q=>!q.includes(a)||!q.includes(b)||q.indexOf(a)<q.indexOf(b));
    }
  }
  return options;
}

export function expandPatternCases(pattern,{maxCases=MAX_PATTERN_CASES}={}){
  if(!Number.isInteger(maxCases)||maxCases<1)throw new RangeError(`invalid pattern expansion limit ${maxCases}`);
  const parsed=parsePattern(pattern),cases=[];
  let totalCases=0;
  for(const branch of parsed.branches){
    const optionGroups=branch.elements.map(optionsForElement);
    let branchCases=1;
    for(const opts of optionGroups){
      if(opts.length===0){branchCases=0;break}
      if(branchCases>Math.floor((maxCases-totalCases)/opts.length))throw new PatternExpansionError(maxCases);
      branchCases*=opts.length;
    }
    totalCases+=branchCases;
    if(totalCases>maxCases)throw new PatternExpansionError(maxCases);
    let queues=[''];
    for(const opts of optionGroups){
      const next=new Array(queues.length*opts.length);
      let write=0;
      for(const prefix of queues)for(const option of opts)next[write++]=prefix+option;
      queues=next;
    }
    for(let i=0;i<queues.length;i++){
      cases.push({
        caseId:`${branch.index}:${i}`,
        queue:queues[i],
        branchIndex:branch.index,
        branchPattern:branch.source,
        lastBag:branch.lastBag?{pieces:new Set(branch.lastBag.pieces),drawCount:branch.lastBag.drawCount}:null,
        observedBag:branch.observedBag?{pieces:new Set(branch.observedBag.pieces),drawCount:branch.observedBag.drawCount}:null,
      });
    }
  }
  return cases;
}

export function expandPattern(pattern,options){
  return expandPatternCases(pattern,options).map(x=>x.queue);
}

export function lastBagInfo(pattern){
  const parsed=parsePattern(pattern);
  if(parsed.branches.length!==1)throw new PatternSyntaxError('pattern union has branch-specific last bags; use expandPatternCases()');
  const info=parsed.branches[0].lastBag;
  if(!info)throw new PatternSyntaxError('pattern does not end in a bag token');
  return{pieces:new Set(info.pieces),drawCount:info.drawCount};
}
