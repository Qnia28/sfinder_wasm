import assert from 'node:assert/strict';

export const PIECES = [...'TILJSZO'];
export const QB_SEED = 0x71402026;
export const signature = pieces => [...pieces].sort().join('');
export function rng(seed) {
  let state = seed >>> 0; assert(state !== 0);
  return max => {
    assert(Number.isInteger(max) && max > 0);
    const limit = Math.floor(0x100000000 / max) * max;
    let value;
    do { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; value = state >>> 0; } while (value >= limit);
    return value % max;
  };
}
export function shuffle(values, next) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = next(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function qbCondition(setup, policy) {
  const p = policy.runtimePolicy;
  assert.equal(policy.schemaVersion, 2); assert.equal(policy.cycle, 7);
  assert.equal(p.catalogKind, 'cycle7-2plus2-qb'); assert.equal(p.requiredUnplacedPriorPiece, 'T');
  assert.deepEqual(p.setupBuildSegments, [2, 2]); assert.equal(p.executable, true);
  const entries = policy.entries.filter(e => e.candidateSetupIds.includes(setup.id));
  assert.equal(entries.length, 1, 'each physical setup needs exactly one executable condition');
  const entry = entries[0], prior = [...entry.previousBagPieces], pair = entry.nextBagPrefixPieces;
  assert.equal(prior.length, 3); assert(prior.includes('T')); assert.equal(pair.length, 2);
  assert.equal(new Set(pair).size, 2); assert(!pair.includes('T'));
  assert([...prior, ...pair].every(p => PIECES.includes(p)));
  prior.splice(prior.indexOf('T'), 1);
  assert.equal(setup.placements.length, 4);
  assert.equal(signature([...prior, ...pair]), signature(setup.pieceSignature));
  assert.equal(setup.recommendationGroup, entry.id);
  const remaining = PIECES.filter(p => !pair.includes(p));
  return { entryId: entry.id, previousBagPieces: entry.previousBagPieces,
    nextBagPrefixPieces: pair, initialHold: 'T', remainingNextBag: remaining,
    pattern: `T,[${remaining.join('')}]p5,*p1`, cases: 840,
    equivalence: 'Virtual leading T with empty hold represents initial hold T; six placed pieces and one saved piece. Checked by independent finite hold-order language enumeration.' };
}
// Independent tiny finite supply simulator. queue[at] is active. Empty-hold
// swap consumes two queue entries; full-hold swap consumes one. The simulator
// enumerates placement orders only, with no board/solver/pruning code.
export function holdOrders(queue, initialHold, depth) {
  const out = new Set();
  function visit(at, hold, order) {
    if (order.length === depth) { out.add(order.join('')); return; }
    if (at < queue.length) {
      visit(at + 1, hold, [...order, queue[at]]);
      if (hold !== null) visit(at + 1, queue[at], [...order, hold]);
      else if (at + 1 < queue.length) visit(at + 2, queue[at], [...order, queue[at + 1]]);
    } else if (hold !== null) visit(at, null, [...order, hold]);
  }
  visit(0, initialHold, []);
  return [...out].sort();
}
