import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage, popcount, highestOccupiedRow } from '../../src/board.mjs';
import { sha256 } from './engine.mjs';
import { QB_SEED, PIECES, qbCondition, rng, shuffle } from './qb-conditions.mjs';
const [dbPath, policyPath] = process.argv.slice(2); assert(dbPath && policyPath);
const bytes = readFileSync(dbPath), policyBytes = readFileSync(policyPath);
const source = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const policy = JSON.parse(policyBytes.toString('utf8').replace(/^\uFEFF/, ''));
assert.equal(source.length, 356); assert.equal(new Set(source.map(s => s.id)).size, source.length);
const next = rng(QB_SEED);
const eligible = source.map(s => {
  assert.equal(s.cycle, 7); assert.equal(s.reviewStatus, 'reviewed'); assert.equal(s.runtimeEligible, true);
  const condition = qbCondition(s, policy), pages = decoder.decode(s.fumen);
  assert.equal(pages.length, 1); assert(!pages[0].operation); assert(highestOccupiedRow(pages[0]) < 4);
  const board = boardFromFumenPage(pages[0], 4); assert.equal(popcount(board), 16);
  let mirror = 0n;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) if (board & (1n << BigInt(y * 10 + x))) mirror |= 1n << BigInt(y * 10 + 9 - x);
  return { id: s.id, displayName: s.displayName, fumen: s.fumen, family: s.family, pieceSignature: s.pieceSignature,
    recommendationGroup: s.recommendationGroup, occupied: 16, board: `0x${board.toString(16)}`,
    mirrorGroup: `0x${(board < mirror ? board : mirror).toString(16)}`, height: 4, useHold: true,
    ...condition, chooseOneFilter: true };
});
const setups = shuffle(eligible, next).slice(0, 100).map((s, index) => ({ ...s, drawIndex: index, filters: shuffle(PIECES, next) }));
const snapshot = { version: 1, dataset: 'cycle7-2plus2-qb-random100', source: 'cycle-7-2plus2-qb-setups.json',
  sourceSha256: sha256(bytes), policySource: 'cycle-7-2plus2-qb-policy.json', policySha256: sha256(policyBytes),
  entries: source.length, sampleCount: 100, seed: QB_SEED,
  sampling: 'Fisher-Yates/xorshift32 with rejection-sampled bounded draws, sample100 physical DB rows without replacement. Do not deduplicate mirrors or use performance/proof outcomes to select setups. Presampled random filter priority selects first nonempty filter, uniform among eligible filters; prove/measure only that one. Failed setup/K proof stays a reported missing slot, no silent replacement.',
  policy: 'Initial hold T + five unused pieces of the current bag in all120 orders + following bag first piece (7 possibilities), represented as virtual leading T. 840 queues/setup. Four-line PC with hold; single saved-piece matrix per setup.',
  setups };
writeFileSync(new URL('./qb-setups.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ setups: setups.length, mirrorGroups: new Set(setups.map(s => s.mirrorGroup)).size,
  seed: QB_SEED, databaseHash: snapshot.sourceSha256, policyHash: snapshot.policySha256 }, null, 2));
