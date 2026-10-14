import { solveQueuesExistence } from "./pc-enumeration-engine.mjs";
import { MAX_PATTERN_CASES, PatternExpansionError, parsePattern, expandPattern } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

import { createPatternPrefixSource } from "./pattern-prefix-source.mjs";

export function calculateChance(input) {
  const { outputMode = 'queues' } = input;
  if (outputMode === 'count') return calculateChanceCount(input);
  if (outputMode !== 'queues') throw new RangeError(`unsupported chance outputMode '${outputMode}'`);
  const { sourceFumen, pattern, clear = 4, solver, useHold = true } = input;
  const { board } = decodeAndValidate(sourceFumen, clear);
  const empty = clear * 10 - board.toString(2).replaceAll('0','').length;
  const take = Math.max(0, Math.floor(empty / 4)) + (useHold ? 1 : 0);
  // No suffix can be skipped here; retain the cheaper concrete expansion.
  if (parsePattern(pattern).depth <= take) {
    const run = () => {
      const queues = expandPattern(pattern);
      const solved = empty % 4 === 0 ? solveQueuesExistence({ board, queues, solver, useHold }) : queues.map(() => false);
      const failedQueues = queues.filter((_, i) => !solved[i]);
      const total = queues.length, success = total - failedQueues.length;
      return { total, success, failed: failedQueues.length, failedQueues, percent: 100 * success / total };
    };
    return solver.withProbabilitySession ? solver.withProbabilitySession(run) : run();
  }
  const source = createPatternPrefixSource(pattern, take);
  if (source.total > BigInt(MAX_PATTERN_CASES)) throw new PatternExpansionError(MAX_PATTERN_CASES);
  const run = () => {
    let success = 0;
    const failedQueues = [], batch = [];
    function flush() {
      if (!batch.length) return;
      const solved = empty % 4 === 0
        ? solveQueuesExistence({ board, queues: batch.map(entry => entry.queue), solver, useHold })
        : batch.map(() => false);
      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        if (solved[i]) success += Number(entry.weight);
        else for (const completion of entry.completions()) failedQueues.push(completion.queue);
      }
      batch.length = 0;
    }
    for (const entry of source.prefixes()) { batch.push(entry); if (batch.length >= 65536) flush(); }
    flush();
    const total = Number(source.total);
    return { total, success, failed: failedQueues.length, failedQueues, percent: 100 * success / total };
  };
  return solver.withProbabilitySession ? solver.withProbabilitySession(run) : run();
}

// Count-only keeps branch multiplicity, and expands at most the prefix that a
// PC can consume. Suffix permutations contribute exact integer weights.
export function calculateChanceCount({ sourceFumen, pattern, clear = 4, solver, useHold = true, maxBatchPrefixes = 65536 }) {
  if (!Number.isInteger(maxBatchPrefixes) || maxBatchPrefixes < 1 || maxBatchPrefixes > 1000000) {
    throw new RangeError('maxBatchPrefixes must be an integer in 1..1000000');
  }
  const { board } = decodeAndValidate(sourceFumen, clear);
  return calculateChanceCountFromBoard({ board, pattern, clear, solver, useHold, maxBatchPrefixes });
}

export function calculateChanceCountFromBoard({ board, pattern, clear = 4, solver, useHold = true, maxBatchPrefixes = 65536 }) {
  if (!Number.isInteger(maxBatchPrefixes) || maxBatchPrefixes < 1 || maxBatchPrefixes > 1000000) throw new RangeError('maxBatchPrefixes must be an integer in 1..1000000');
  const run = () => chanceCountInSession({ board, pattern, clear, solver, useHold, maxBatchPrefixes });
  return solver.withProbabilitySession ? solver.withProbabilitySession(run) : run();
}
function chanceCountInSession({ board, pattern, clear, solver, useHold, maxBatchPrefixes }) {
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
