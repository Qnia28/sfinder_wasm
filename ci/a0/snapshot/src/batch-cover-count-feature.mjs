import { coverTargets } from './batch-cover.mjs';
import { batchReachability, boolMirror, decodedTargets } from './batch-feature-common.mjs';
import { mirrorOperations, normalizeCoverMode } from './batch-orders.mjs';
import { createPatternPrefixSource } from './pattern-prefix-source.mjs';
import { queuesForFinder } from './pattern.mjs';
import { validateTargetLines } from './pc-input.mjs';

// Count is a separate output contract: exact weighted prefixes, no concrete
// covered/failed queue lists and no variants/orders. Target union is evaluated
// BEFORE multiplying by suffix weights (including duplicate branch weights).
export async function calculateCoverCount({
  sourceFumen, pattern, clear = 4, mode = 'normal', mirror = 'no',
  useHold = true, maxBatchPrefixes = 65536,
}) {
  validateTargetLines(clear);
  if (!Number.isInteger(maxBatchPrefixes) || maxBatchPrefixes < 1 || maxBatchPrefixes > 1000000) {
    throw new RangeError('maxBatchPrefixes must be an integer from 1 to 1000000');
  }
  mode = normalizeCoverMode(mode);
  mirror = boolMirror(mirror);
  const finderPattern = queuesForFinder(pattern);
  const targets = decodedTargets(sourceFumen, clear);
  return calculateTargetCoverCount({ targets, pattern, clear, mode, mirror, useHold, maxBatchPrefixes });
}

export async function calculateTargetCoverCount({ targets, pattern, clear = 4, mode = 'normal', mirror = false, useHold = true, maxBatchPrefixes = 65536 }) {
  validateTargetLines(clear);
  if (!Number.isInteger(maxBatchPrefixes) || maxBatchPrefixes < 1 || maxBatchPrefixes > 1000000) throw new RangeError('maxBatchPrefixes must be an integer from 1 to 1000000');
  mode = normalizeCoverMode(mode); mirror = boolMirror(mirror);
  const finderPattern = queuesForFinder(pattern);
  const take = targets.reduce((max, t) => Math.max(max, t.operations.length), 0) + (useHold ? 1 : 0);
  const source = createPatternPrefixSource(finderPattern, take);
  const reachabilityByHeight = new Map();
  for (const height of new Set(targets.map(t => t._batchHeight ?? clear))) {
    reachabilityByHeight.set(height, await batchReachability(height, 'jstris'));
  }
  const reachability = reachabilityByHeight.values().next().value;
  const totals = targets.flatMap(target => {
    const { _batchHeight, variants, orders, ...metadata } = target;
    const rows = [{ ...metadata, mirror: false, mode, coverage: 0n }];
    if (mirror) rows.push({ ...metadata, ...mirrorOperations(target.base, target.operations, _batchHeight ?? clear), mirror: true, mode, coverage: 0n });
    return rows;
  });
  let covered = 0n;
  let evaluatedPrefixes = 0;
  const batch = new Map();
  function flush() {
    if (!batch.size) return;
    const queues = [...batch.keys()];
    const result = coverTargets({
      targets, queues, height: clear, reachability,
      reachabilityForHeight: h => reachabilityByHeight.get(h),
      useHold, mirror, mode, coverageOnly: true,
    });
    const failed = new Set(result.failed);
    for (const queue of queues) if (!failed.has(queue)) covered += batch.get(queue);
    for (let i = 0; i < result.targets.length; i++) {
      for (const queue of result.targets[i].covered) totals[i].coverage += batch.get(queue);
    }
    evaluatedPrefixes += queues.length;
    batch.clear();
  }
  for (const { queue, weight } of source.prefixes()) {
    batch.set(queue, (batch.get(queue) ?? 0n) + weight);
    if (batch.size >= maxBatchPrefixes) flush();
  }
  flush();
  const total = source.total, failed = total - covered;
  const numeric = n => n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n.toString();
  return {
    outputMode: 'count', pathPattern: finderPattern, analysisPattern: pattern, mode, mirror,
    total: numeric(total), covered: numeric(covered), failed: numeric(failed),
    totalExact: total.toString(), coveredExact: covered.toString(), failedExact: failed.toString(),
    percent: total ? Number(covered * 100000000000000n / total) / 1000000000000 : 0,
    evaluatedPrefixes,
    targets: totals.map(t => ({ ...t, coverage: numeric(t.coverage), coverageExact: t.coverage.toString() })),
  };
}
