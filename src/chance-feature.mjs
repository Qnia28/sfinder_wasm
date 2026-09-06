import { solveQueuesExistence } from "./pc-enumeration-engine.mjs";
import { expandPattern } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

import { createPatternPrefixSource } from "./pattern-prefix-source.mjs";

export function calculateChance(input) {
  const { outputMode = 'queues' } = input;
  if (outputMode === 'count') return calculateChanceCount(input);
  if (outputMode !== 'queues') throw new RangeError(`unsupported chance outputMode '${outputMode}'`);
  const { sourceFumen, pattern, clear = 4, solver, useHold = true } = input;
  const { board } = decodeAndValidate(sourceFumen, clear);
  const queues = expandPattern(pattern);
  const solved = solveQueuesExistence({ board, queues, solver, useHold });
  let success = 0;
  const failedQueues = [];
  for (let index = 0; index < queues.length; index += 1) {
    if (solved[index]) success += 1;
    else failedQueues.push(queues[index]);
  }
  return {
    total: queues.length,
    success,
    failed: failedQueues.length,
    failedQueues,
    percent: 100 * success / queues.length,
  };
}

// Count-only keeps branch multiplicity, and expands at most the prefix that a
// PC can consume. Suffix permutations contribute exact integer weights.
export function calculateChanceCount({ sourceFumen, pattern, clear = 4, solver, useHold = true, maxBatchPrefixes = 65536 }) {
  if (!Number.isInteger(maxBatchPrefixes) || maxBatchPrefixes < 1 || maxBatchPrefixes > 1000000) {
    throw new RangeError('maxBatchPrefixes must be an integer in 1..1000000');
  }
  const { board } = decodeAndValidate(sourceFumen, clear);
  let occupied = 0;
  for (let bits = board; bits; bits &= bits - 1n) occupied += 1;
  const empty = clear * 10 - occupied;
  const take = Math.max(0, Math.floor(empty / 4)) + (useHold ? 1 : 0);
  const source = createPatternPrefixSource(pattern, take);
  // For large suffix spaces, first prove PC with exactly req queue items.
  // A successful order stays playable after appending items (the last held
  // piece can swap with the new current piece). Only failures need req+1.
  const refineHold = useHold && source.total > 1000000n && source.depth >= take;
  const prefixLength = refineHold ? take - 1 : take;
  let success = 0n;
  let evaluatedPrefixes = 0;
  const batch = new Map();
  function evaluate(entries) {
    const queues = [...entries.keys()];
    const solved = solveQueuesExistence({ board, queues, solver, useHold });
    evaluatedPrefixes += queues.length;
    return { queues, solved };
  }
  function flush() {
    if (!batch.size) return;
    const { queues, solved } = evaluate(batch);
    const extended = new Map();
    function flushExtended() {
      if (!extended.size) return;
      const result = evaluate(extended);
      for (let i = 0; i < result.queues.length; i += 1) if (result.solved[i]) success += extended.get(result.queues[i]);
      extended.clear();
    }
    for (let i = 0; i < queues.length; i += 1) {
      const entry = batch.get(queues[i]);
      if (solved[i]) success += entry.weight;
      else if (refineHold) for (const extend of entry.extensions) for (const child of extend()) {
        extended.set(child.queue, (extended.get(child.queue) ?? 0n) + child.weight);
        if (extended.size >= maxBatchPrefixes) flushExtended();
      }
    }
    flushExtended();
    batch.clear();
  }
  if (empty % 4 === 0) {
    for (const { queue, weight, extend } of source.prefixes(prefixLength)) {
      const entry = batch.get(queue) ?? { weight: 0n, extensions: [] };
      entry.weight += weight;
      if (refineHold) entry.extensions.push(extend);
      batch.set(queue, entry);
      if (batch.size >= maxBatchPrefixes) flush();
    }
    flush();
  }
  const total = source.total;
  const numberOrString = value => value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  return {
    outputMode: 'count',
    total: numberOrString(total), success: numberOrString(success), failed: numberOrString(total - success),
    totalExact: total.toString(), successExact: success.toString(), failedExact: (total - success).toString(),
    percent: total ? Number(success * 100000000000000n / total) / 1000000000000 : 0,
    evaluatedPrefixes,
  };
}
