import { shouldUseRustCongruent } from "./batch-routing-policy.mjs";
import { PIECES, allGeometricPlacements, aggregateMasks, tilingKey } from "./batch-geometry.mjs";
import { buildVariants, createQueueOrderProjector } from "./batch-orders.mjs";

function popcountBigInt(value) {
  let count = 0;
  for (; value; value &= value - 1n) count += 1;
  return count;
}

export function maxPieceCounts(queues) {
  const max = Object.fromEntries(PIECES.map((piece) => [piece, 0]));
  for (const queue of queues) {
    const counts = Object.fromEntries(PIECES.map((piece) => [piece, 0]));
    for (const piece of queue) counts[piece] += 1;
    for (const piece of PIECES) max[piece] = Math.max(max[piece], counts[piece]);
  }
  return max;
}

export function enumerateTilings({
  fill,
  height = 4,
  maxCounts = Object.fromEntries(PIECES.map((piece) => [piece, 10])),
  maxSolutions = 20000,
}) {
  if (fill === 0n) return [[]];

  const byCell = new Map();
  for (const piece of PIECES) {
    for (const mask of allGeometricPlacements(piece, height)) {
      if ((mask & fill) !== mask) continue;
      for (let index = 0; index < height * 10; index += 1) {
        const bit = 1n << BigInt(index);
        if (!(mask & bit)) continue;
        const placements = byCell.get(index) ?? [];
        placements.push({ piece, mask });
        byCell.set(index, placements);
      }
    }
  }

  const output = [];
  const keys = new Set();
  const counts = Object.fromEntries(PIECES.map((piece) => [piece, 0]));

  function visit(remaining, operations) {
    if (output.length >= maxSolutions) return;
    if (remaining === 0n) {
      const key = tilingKey(operations);
      if (!keys.has(key)) {
        keys.add(key);
        output.push([...operations]);
      }
      return;
    }

    // MRV: branch on the remaining cell with the fewest currently legal placements.
    let bestCandidates = null;
    for (let index = 0; index < height * 10; index += 1) {
      const bit = 1n << BigInt(index);
      if (!(remaining & bit)) continue;
      const candidates = [];
      for (const operation of byCell.get(index) ?? []) {
        if (counts[operation.piece] >= maxCounts[operation.piece]) continue;
        if ((operation.mask & remaining) !== operation.mask) continue;
        candidates.push(operation);
      }
      if (!candidates.length) return;
      if (bestCandidates === null || candidates.length < bestCandidates.length) {
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }

    for (const operation of bestCandidates) {
      counts[operation.piece] += 1;
      operations.push(operation);
      visit(remaining ^ operation.mask, operations);
      operations.pop();
      counts[operation.piece] -= 1;
    }
  }

  visit(fill, []);
  if (output.length >= maxSolutions) {
    throw new Error(`congruent tiling limit ${maxSolutions} reached`);
  }
  return output;
}

export function findCongruentSolutions({
  base,
  fill,
  queues,
  height = 4,
  reachability,
  useHold = true,
}) {
  const pieceCount = popcountBigInt(fill) / 4;
  const accelerated = shouldUseRustCongruent({ pieceCount, reachability })
    ? reachability.congruent({ base, fill, queues, useHold })
    : null;

  if (accelerated !== null && accelerated !== undefined) {
    return accelerated.map(({ operations, orders }) => {
      const preferred = orders.includes("ZIS") ? "ZIS" : [...orders].sort().at(-1);
      return {
        operations,
        masks: aggregateMasks(operations),
        orders,
        comment: preferred,
        key: tilingKey(operations),
      };
    });
  }

  const maxCounts = maxPieceCounts(queues);
  const tilings = enumerateTilings({ fill, height, maxCounts });
  const output = [];
  const projector = createQueueOrderProjector(queues);

  for (const operations of tilings) {
    const variants = buildVariants({ base, operations, height, reachability });
    const orders = [...new Set(variants.map((variant) => variant.order))];
    const valid = projector.validOrders(orders, useHold);
    if (!valid.length) continue;
    const validSet = new Set(valid);
    const preferred = valid.includes("ZIS") ? "ZIS" : [...valid].sort().at(-1);
    output.push({
      operations,
      masks: aggregateMasks(operations),
      orders: valid,
      variants: variants.filter((variant) => validSet.has(variant.order)),
      comment: preferred,
      key: tilingKey(operations),
    });
  }
  return output;
}
