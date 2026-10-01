import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { decodeAndValidate } from '../src/pc-input.mjs';
import { expandPattern } from '../src/pattern.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';
import { calculatePathFeature } from '../src/path-feature.mjs';
import { calculateChance } from '../src/chance-feature.mjs';
import { solveOnePc, solveAllPc, solvePerSaveAllPc } from '../src/pc-solve.mjs';

const MIDDLE_ROW_STAGE7 = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';
const BOTTOM_ROW_STAGE4 = 'v115@9gB8HeB8HeB8HeJ8JeAgH';
const MIDDLE_ROW_STAGE4 = 'v115@9gB8HeB8HeL8ReAgH';
const pattern = 'T,*p3';
const serialize = (value) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);

// All comparisons retain the original Fumen board. Normalizing the input in
// JavaScript would change returned piece masks from original to search rows.
test('middle completed line: legal pack and no-legal reference agree across commands', async () => {
  const { board } = decodeAndValidate(MIDDLE_ROW_STAGE7);
  assert.equal(board, 0xf0f83fffc7n);
  const queues = expandPattern(pattern);
  const guarded = await createWasmSolver(4);
  const reference = await createWasmSolver(4, { legal: false });
  try {
    assert.ok(guarded.legalCount(7) > 0, 'test must exercise a populated legal stage');
    assert.equal(queues.length, 210);
    const patternExists = guarded.canPcPatternMany(board, queues, true);
    const expectedPattern = reference.canPcPatternMany(board, queues, true);
    assert.deepEqual(patternExists, expectedPattern);
    assert.equal(patternExists.filter(Boolean).length, 190);
    assert.deepEqual(guarded.canPcMany(board, queues, true), reference.canPcMany(board, queues, true));
    assert.deepEqual(guarded.canPcManyScalar(board, queues, true), reference.canPcManyScalar(board, queues, true));
    const solutions = guarded.enumeratePcPattern(board, queues, true);
    assert.equal(serialize(solutions), serialize(reference.enumeratePcPattern(board, queues, true)));
    // A solution is expressed in the ORIGINAL Fumen row coordinates.
    // Each piece type occupies a multiple of four new cells, together filling the target.
    assert.equal(solutions.length, 18);
    for (const solution of solutions) {
      let occupied = board;
      for (const pieceMask of solution.masks) {
        assert.equal(pieceMask & occupied, 0n, 'piece overlaps the original field');
        if (pieceMask) assert.equal(pieceMask.toString(2).replaceAll('0', '').length % 4, 0);
        occupied |= pieceMask;
      }
      assert.equal(occupied, (1n << 40n) - 1n, 'not a PC in original row coordinates');
    }
    assert.equal(serialize(guarded.enumeratePcPath(board, queues, true)),
      serialize(reference.enumeratePcPath(board, queues, true)));

    for (const wantedSave of ['ALL', 'TILJS']) {
      const input = { sourceFumen: MIDDLE_ROW_STAGE7, pattern, wantedSave };
      const actual = calculateSaves({ ...input, solver: guarded });
      const expected = calculateSaves({ ...input, solver: reference });
      assert.deepEqual(actual, expected);
      if (wantedSave === 'ALL') assert.equal(actual.success, 190);
    }
    const pathInput = { sourceFumen: MIDDLE_ROW_STAGE7, pattern };
    assert.deepEqual(calculatePathFeature({ ...pathInput, solver: guarded }),
      calculatePathFeature({ ...pathInput, solver: reference }));
    assert.deepEqual(calculateChance({ ...pathInput, solver: guarded }),
      calculateChance({ ...pathInput, solver: reference }));

    for (const fn of [solveOnePc, solveAllPc]) {
      const input = { sourceFumen: MIDDLE_ROW_STAGE7, pattern: 'TTJ' };
      const actual = fn({ ...input, solver: guarded });
      assert.deepEqual(actual, fn({ ...input, solver: reference }));
      assert.ok(actual.solutionCount > 0);
    }
    const input = { sourceFumen: MIDDLE_ROW_STAGE7, pattern: 'TTIJ' };
    assert.deepEqual(solvePerSaveAllPc({ ...input, solver: guarded }),
      solvePerSaveAllPc({ ...input, solver: reference }));
    assert.equal(guarded.canPc(board, 'TTIJ', true), true);
    assert.deepEqual(guarded.enumeratePcGeometry(board, 'TTIJ', true),
      reference.enumeratePcGeometry(board, 'TTIJ', true));
    assert.equal(guarded.probeCanPc(board, 'TTIJ', true, 10000).value, true);
  } finally {
    guarded.close();
    reference.close();
  }
});

test('completed bottom and middle rows at a stage without a legal table still work', async () => {
  const guarded = await createWasmSolver(4);
  const reference = await createWasmSolver(4, { legal: false });
  try {
    assert.equal(guarded.legalCount(4), 0);
    for (const fumen of [BOTTOM_ROW_STAGE4, MIDDLE_ROW_STAGE4]) {
      const { board } = decodeAndValidate(fumen);
      assert.equal(board.toString(2).replaceAll('0', '').length, 16);
      assert.equal(guarded.canPc(board, 'IIIIIII', true), true);
      assert.equal(guarded.canPc(board, 'IIIIIII', true), reference.canPc(board, 'IIIIIII', true));
      assert.deepEqual(guarded.enumeratePcGeometry(board, 'IIIIIII', true),
        reference.enumeratePcGeometry(board, 'IIIIIII', true));
    }
  } finally {
    guarded.close();
    reference.close();
  }
});
import { calculatePerSaveMinimalsAsync } from '../src/per-save-minimals.mjs';
import { calculateSaveMinimals } from '../src/minimals-feature.mjs';

test('normalization preserves Hold semantics and original geometry for 2..6 rows', async () => {
  const pack = rows => rows.reduce((b, r, y) => b | (BigInt(r) << BigInt(y * 10)), 0n);
  for (let height = 2; height <= 6; height++) {
    const guarded = await createWasmSolver(height), reference = await createWasmSolver(height, {legal:false});
    try {
      // Two incomplete rows leave precisely an O hole. Move all full rows
      // between/above/below them while keeping their relative order unchanged.
      for (let a = 0; a < height; a++) for (let b = a + 1; b < height; b++) {
        const rows = Array(height).fill(1023); rows[a] = rows[b] = 1020;
        const board = pack(rows), canonical = pack([...Array(height - 2).fill(1023),1020,1020]);
        for (const useHold of [false,true]) {
          const queues = ['O','I','IO','OI','OO','IO'];
          const expected = reference.canPcManyScalar(canonical, queues, useHold);
          assert.deepEqual(expected,[true,false,useHold,true,true,useHold]);
          assert.deepEqual(guarded.canPcManyScalar(board,queues,useHold),expected);
          assert.deepEqual(guarded.canPcPatternMany(board,queues,useHold),expected);
          const solutions = guarded.enumeratePcPattern(board,queues,useHold);
          assert.ok(solutions.length);
          assert.equal(serialize(solutions),serialize(reference.enumeratePcPattern(board,queues,useHold)));
          for (const solution of solutions) {
            let occupied = board;
            for (const mask of solution.masks) { assert.equal(occupied & mask,0n); occupied |= mask; }
            assert.equal(occupied,(1n << BigInt(height * 10)) - 1n);
          }
        }
      }
      const full = (1n << BigInt(height * 10)) - 1n;
      assert.equal(guarded.canPc(full,'',true),true);
    } finally { guarded.close(); reference.close(); }
  }
});

test('complete-row fix reaches minimals and exact per-save workers without changing output coordinates',async()=>{
  const guarded=await createWasmSolver(4),reference=await createWasmSolver(4,{legal:false});
  const input={sourceFumen:MIDDLE_ROW_STAGE7,pattern:'T,*p3',Primary:'Rust',exactHumanQuality:'true'};
  try {
    const expected=await calculatePerSaveMinimalsAsync({...input,solver:reference,secondaryWorkers:0});
    assert.equal(expected.pcSuccess,190);
    for(const secondaryWorkers of [0,'auto',2])assert.deepEqual(await calculatePerSaveMinimalsAsync({...input,solver:guarded,secondaryWorkers}),expected);
    assert.deepEqual(await calculateSaveMinimals({...input,analysisPattern:input.pattern,wantedSave:"T",solver:guarded}),await calculateSaveMinimals({...input,analysisPattern:input.pattern,wantedSave:"T",solver:reference}));
  } finally {guarded.close();reference.close();}
});

