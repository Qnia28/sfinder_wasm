import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage, popcount } from '../../src/board.mjs';
import { expandPatternCases } from '../../src/pattern.mjs';
import { PIECES, QB_SEED, holdOrders } from './qb-conditions.mjs';
import { settings } from './profiles.mjs';
const db = JSON.parse(readFileSync(new URL('./qb-setups.json', import.meta.url)));
test('QB snapshot has100 distinct random physical rows with exact2+2 composition and840 queues', () => {
  assert.equal(db.seed, QB_SEED); assert.equal(db.entries, 356); assert.equal(db.setups.length, 100);
  assert.equal(new Set(db.setups.map(s => s.id)).size, 100);
  for (const s of db.setups) {
    assert.equal(s.initialHold, 'T'); assert.equal(s.nextBagPrefixPieces.length, 2);
    assert(!s.nextBagPrefixPieces.includes('T'));
    assert.equal(new Set(s.filters).size, 7); assert(s.filters.every(p => PIECES.includes(p)));
    const board = boardFromFumenPage(decoder.decode(s.fumen)[0], 4);
    assert.equal(popcount(board), 16); assert.equal(`0x${board.toString(16)}`, s.board);
    const queues = expandPatternCases(s.pattern); assert.equal(queues.length, 840);
    for (const { queue } of queues) {
      assert.equal(queue.length, 7); assert.equal(queue[0], 'T');
      assert.deepEqual([...queue.slice(1, 6)].sort(), [...s.remainingNextBag].sort());
      assert.equal(new Set(queue.slice(1, 6)).size, 5); assert(PIECES.includes(queue[6]));
    }
  }
});
test('virtual leading T and genuine initial hold T accept identical six-piece order languages for all QB queues', () => {
  // All15 possible unordered non-T prefixes, all120 remaining permutations,
  // all7 following-bag pieces: 12,600 distinct supply scenarios.
  const pieces = PIECES.filter(p => p !== 'T'); let checked = 0;
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const remaining = PIECES.filter(p => p !== pieces[i] && p !== pieces[j]);
    for (const { queue } of expandPatternCases(`T,[${remaining.join('')}]p5,*p1`)) {
      assert.deepEqual(holdOrders(queue.slice(1), 'T', 6), holdOrders(queue, null, 6)); checked++;
    }
  }
  assert.equal(checked, 12600);
});
test('independent campaign compares total0/20 and incremental16/20 using one uninstrumented binary', () => {
  assert.deepEqual(settings('qb-confirm', 20).map(c => [c.left.mask, c.right.mask]), [[0, 20], [16, 20]]);
  const config = JSON.parse(readFileSync(new URL('./qb-run.json', import.meta.url)));
  assert.equal(config.pairs, 3); assert.equal(config.maxParallel, 10); assert.equal(config.timeoutSeconds, 300);
  assert.equal(config.recheckPairs, 10);
});
