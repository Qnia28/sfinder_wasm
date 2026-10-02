import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage, popcount, highestOccupiedRow } from '../../src/board.mjs';
import { sha256 } from './engine.mjs';

const path = process.argv[2];
assert(path, 'usage: node bench/threshold/freeze-db.mjs <cycle-1-setups.json>');
const bytes = readFileSync(path), entries = JSON.parse(bytes);
const setups = entries.map(entry => {
  const pages = decoder.decode(entry.fumen);
  assert.equal(pages.length, 1);
  assert(!pages[0].operation, 'setup must be a field, not a pending operation');
  assert(highestOccupiedRow(pages[0]) < 4);
  const board = boardFromFumenPage(pages[0], 4), occupied = popcount(board);
  assert.equal(occupied, entry.pieceSignature.length * 4);
  assert.equal(new Set(entry.pieceSignature).size, entry.pieceSignature.length);
  let mirror = 0n;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) {
    if (board & (1n << BigInt(y * 10 + x))) mirror |= 1n << BigInt(y * 10 + 9 - x);
  }
  const remaining = [...'TILJSZO'].filter(piece => !entry.pieceSignature.includes(piece));
  const pattern = remaining.length === 1 ? `${remaining[0]},*p4` : `[${remaining.join('')}]p${remaining.length},*p4`;
  assert.equal(remaining.length + 4, (40 - occupied) / 4 + 1);
  return { id: entry.id, displayName: entry.displayName, family: entry.family,
    fumen: entry.fumen, pieceSignature: entry.pieceSignature, reviewStatus: entry.reviewStatus,
    occupied, board: `0x${board.toString(16)}`, mirrorGroup: `0x${(board < mirror ? board : mirror).toString(16)}`,
    height: 4, useHold: true, pattern, filters: [...'TILJSZO'] };
});
assert.equal(new Set(setups.map(s => s.id)).size, setups.length);
writeFileSync(new URL('./cycle1-setups.json', import.meta.url), JSON.stringify({ version: 1,
  source: 'cycle-1-setups.json', sourceSha256: sha256(bytes), entries: entries.length,
  policy: 'Original fumen; remaining first-bag permutations plus next bag *p4; four-line PC with hold; all seven exact save filters.',
  setups }, null, 2) + '\n', { flag: 'wx' });
console.log(`Frozen ${setups.length} setups / ${new Set(setups.map(s => s.mirrorGroup)).size} mirror groups.`);
