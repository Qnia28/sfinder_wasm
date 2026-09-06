import { TETRIS_DISPLAY_ORDER, RUST_PIECE_ORDER } from './piece-order.mjs';
import { prepareSaveCase, compileExactSaveExpression, savedMultiplicityCodePrepared } from './saves.mjs';
import { registerNumericCoverage } from './numeric-cover-data.mjs';
import { requirePositiveQuality } from './quality-contract.mjs';

function popcount32(n) { n -= (n >>> 1) & 0x55555555; n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return Math.imul((n + (n >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24; }
const pieceIndices = [...TETRIS_DISPLAY_ORDER].map(piece => RUST_PIECE_ORDER.indexOf(piece));

export function collectCompactMinimals(compact, cases, wantedSave) {
  const { count, geometry, stride, offsets, caseIds, qualities } = compact;
  const saveCases = cases.map(entry => prepareSaveCase(entry.queue, entry.lastBag));
  const matches = compileExactSaveExpression(wantedSave), allKeys = [], rows = new Map(), active = new Set();
  for (let si = 0; si < count; si++) {
    const start = si * stride;
    const masks = [];
    for (let pi = 0; pi < 7; pi++) {
      const lo = geometry[start + pi * 2], hi = geometry[start + pi * 2 + 1];
      masks.push(hi ? hi.toString(16) + lo.toString(16).padStart(8, '0') : lo.toString(16));
    }
    allKeys.push(masks.join(':'));
    const usage = Uint8Array.from(pieceIndices, pi => (popcount32(geometry[start + pi * 2]) + popcount32(geometry[start + pi * 2 + 1])) / 4);
    for (let ei = offsets[si]; ei < offsets[si + 1]; ei++) {
      const ci = caseIds[ei];
      if (!cases[ci]) throw new Error(`invalid compact case ${ci}`);
      if (!matches(savedMultiplicityCodePrepared(saveCases[ci], usage))) continue;
      const q = requirePositiveQuality(qualities[ei], { key: allKeys[si], caseId: cases[ci].caseId });
      if (!rows.has(ci)) rows.set(ci, []); // Preserve historical first-hit case order.
      rows.get(ci).push([si, q]); active.add(si);
    }
  }
  const solutionIds = [...active].sort((a,b) => allKeys[a] < allKeys[b] ? -1 : allKeys[a] > allKeys[b] ? 1 : 0);
  const keys = solutionIds.map(id => allKeys[id]), keyIndex = new Map(keys.map((k,i) => [k,i]));
  const idMap = new Map(solutionIds.map((id,i) => [id,i])), orderedCases = [...rows.keys()];
  const numericRows = [...rows.values()].map(row => row.map(([id,q]) => [idMap.get(id),q]));
  const primaryCases = numericRows.map(row => row.map(([id]) => id));
  const caseIndex = new Map(orderedCases.map((ci,i) => [cases[ci].caseId,i]));
  const rawCases = orderedCases.map(ci => ({ caseId: cases[ci].caseId }));
  const entryCount = numericRows.reduce((n,row) => n+row.length,0), csrOffsets = new Uint32Array(numericRows.length+1);
  const ids = new Uint32Array(entryCount), qs = new Uint32Array(entryCount);
  let position=0,maxQuality=0;
  for(let ci=0;ci<numericRows.length;ci++) {
    csrOffsets[ci]=position;
    for(const [id,q] of numericRows[ci]) { ids[position]=id;qs[position++]=q;maxQuality=Math.max(maxQuality,q); }
  }
  csrOffsets[numericRows.length]=position;
  const prepared={keys,keyIndex,rawCases,cases:numericRows,primaryCases,entryCount,maxQuality};
  const packed={caseCount:numericRows.length,entryCount,offsets:csrOffsets,ids,qualities:qs};
  function keySet(index) {
    const row=primaryCases[index];
    return {size:row.length,has:key=>row.includes(keyIndex.get(key)),*[Symbol.iterator](){for(const id of row)yield keys[id]}};
  }
  const coverage={
    size:numericRows.length,
    *entries(){for(let i=0;i<orderedCases.length;i++)yield [cases[orderedCases[i]].caseId,keySet(i)]},
    *values(){for(let i=0;i<orderedCases.length;i++)yield keySet(i)},
    [Symbol.iterator](){return this.entries()},
    toMap(){return new Map([...this].map(([id,set])=>[id,new Set(set)]))},
  };
  registerNumericCoverage(coverage,prepared,packed);
  const qualityIndex={get(caseId){const row=numericRows[caseIndex.get(caseId)];return row?{get(key){return row.find(([id])=>id===keyIndex.get(key))?.[1]}}:undefined}};
  const allIndex=new Map(allKeys.map((key,id)=>[key,id])), materialized=new Map();
  const byKey={get(key){
    if(materialized.has(key))return materialized.get(key);
    const si=allIndex.get(key);if(si===undefined)return undefined;
    const start=si*stride,masks=[];
    for(let pi=0;pi<7;pi++)masks.push(BigInt(geometry[start+pi*2])|(BigInt(geometry[start+pi*2+1])<<32n));
    const solution={key,masks,orderCount:geometry[start+14],saved:geometry[start+16]};
    materialized.set(key,solution);return solution;
  }};
  return {coverage,qualityIndex,byKey};
}
