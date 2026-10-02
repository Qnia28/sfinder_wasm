// Internal, request-owned cache of final expression success vectors, not public Set results.
// Inputs must be COMPLETE, last-bag-resolved outcome string Sets.
export function createSaveOutcomeCache(evaluators, {
  maxEntries = 256, maxBytes = 65536, maxOutcomes = 32,
} = {}) {
  for (const value of [maxEntries, maxBytes, maxOutcomes]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('invalid save outcome cache budget');
  }
  const cache = new Map();
  const stats = { hits: 0, misses: 0, bypasses: 0, entries: 0, payloadBytes: 0 };
  const evaluate = saves => Object.freeze(evaluators.map(run => run(saves).size > 0));
  return {
    match(saves) {
      // The entry cap bounds Map/array overhead; payloadBytes budgets UTF-16 keys
      // and conservative eight-byte Boolean slots, not total process heap/RSS.
      const valueBytes = evaluators.length * 8;
      if (!maxEntries || saves.size > maxOutcomes || valueBytes > maxBytes) {
        stats.bypasses++; return evaluate(saves);
      }
      let minimumKeyBytes = 4;
      for (const save of saves) minimumKeyBytes += 2 * (save.length + 3);
      if (minimumKeyBytes + valueBytes > maxBytes) { stats.bypasses++; return evaluate(saves); }
      // JSON separates empty universe/empty string and avoids delimiter collisions.
      // Sort a copy: neither insertion order nor caller mutation is a cache identity.
      const key = JSON.stringify([...saves].sort());
      const hit = cache.get(key);
      if (hit !== undefined) { stats.hits++; return hit; }
      stats.misses++;
      // Always evaluate first. Failed/lazy regex evaluations are never cached.
      const result = evaluate(saves), bytes = 2 * key.length + valueBytes;
      if (cache.size < maxEntries && stats.payloadBytes + bytes <= maxBytes) {
        cache.set(key, result); stats.entries++; stats.payloadBytes += bytes;
      } else stats.bypasses++;
      return result;
    },
    stats: () => ({ ...stats }),
  };
}
