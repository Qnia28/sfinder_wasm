import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage, highestOccupiedRow, popcount } from '../../src/board.mjs';
import { expandPatternCases } from '../../src/pattern.mjs';
const db = JSON.parse(readFileSync(new URL('./cycle1-setups.json', import.meta.url)));
const policy = JSON.parse(readFileSync(new URL('./selection-policy.json', import.meta.url)));

test('DB snapshot preserves 45 reviewed valid fields and required queue length', () => {
  assert.equal(db.entries, 45); assert.equal(db.setups.length, 45);
  assert.equal(new Set(db.setups.map(s => s.id)).size, 45);
  assert.equal(new Set(db.setups.map(s => s.mirrorGroup)).size, 41);
  for (const s of db.setups) {
    const pages = decoder.decode(s.fumen), board = boardFromFumenPage(pages[0], 4);
    assert.equal(pages.length, 1); assert(!pages[0].operation);
    assert(highestOccupiedRow(pages[0]) < 4);
    assert.equal(`0x${board.toString(16)}`, s.board);
    assert.equal(popcount(board), s.pieceSignature.length * 4);
    assert.equal(s.reviewStatus, 'reviewed');
    assert.equal(new Set(s.filters).size, 7);
    const remaining = new Set([...'TILJSZO'].filter(p => !s.pieceSignature.includes(p)));
    for (const c of expandPatternCases(s.pattern)) {
      assert.equal(c.queue.length, (40 - s.occupied) / 4 + 1);
      assert.deepEqual(new Set(c.queue.slice(0, remaining.size)), remaining);
      assert.equal(new Set(c.queue.slice(remaining.size)).size, 4);
    }
  }
});
test('validation groups are frozen, mutually distinct and absent from historical capture evidence', () => {
  assert.equal(policy.databaseHash, db.sourceSha256);
  assert.equal(policy.validation.length, 8);
  assert.equal(new Set(policy.validation.map(s => s.mirrorGroup)).size, 8);
  for (const s of policy.validation) {
    assert(!policy.historicalGroups.includes(s.mirrorGroup));
    assert.equal(db.setups.find(e => e.id === s.setupId).mirrorGroup, s.mirrorGroup);
  }
});
