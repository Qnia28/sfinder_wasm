import { popcount } from './board.mjs';
import { bit, coloredOperationSets, fumenOperationMask } from './batch-geometry.mjs';

const MAX_BATCH_HISTORY_HEIGHT = 6;

function fieldOccupiedMask(field, height) {
  let mask = 0n;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      if (field.at(x, y) !== '_') mask |= bit(x, y);
    }
  }
  return mask;
}

function fieldsEqual(left, right) {
  for (let y = 0; y < 23; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      if (left.at(x, y) !== right.at(x, y)) return false;
    }
  }
  return true;
}

function nextFieldAfterPage(page) {
  if (!page.operation || page.flags?.lock === false || page.flags?.mirror || page.flags?.rise) return null;
  try {
    const field = page.field.copy();
    field.fill(page.operation);
    field.clearLine();
    return field;
  } catch {
    return null;
  }
}

function isContinuousTransition(page, nextPage) {
  const expected = nextFieldAfterPage(page);
  return expected !== null && fieldsEqual(expected, nextPage.field);
}

function originalRowForCurrent(currentRow, clearedRows, height) {
  let current = 0;
  for (let original = 0; original < height; original += 1) {
    if (clearedRows & (1 << original)) continue;
    if (current === currentRow) return original;
    current += 1;
  }
  return -1;
}

function liftCurrentMask(mask, clearedRows, height) {
  let lifted = 0n;
  for (let currentY = 0; currentY < height; currentY += 1) {
    const originalY = originalRowForCurrent(currentY, clearedRows, height);
    if (originalY < 0) continue;
    for (let x = 0; x < 10; x += 1) {
      if (mask & bit(x, currentY)) lifted |= bit(x, originalY);
    }
  }
  return lifted;
}

function rowIsFull(mask, y) {
  for (let x = 0; x < 10; x += 1) if (!(mask & bit(x, y))) return false;
  return true;
}

function unfoldAtHeight(pages, height) {
  const base = fieldOccupiedMask(pages[0].field, height);
  const operations = [];
  let clearedRows = 0;

  for (const page of pages) {
    if (!page.operation) continue;
    const currentMask = fumenOperationMask(page.operation, height);
    const originalMask = liftCurrentMask(currentMask, clearedRows, height);
    if (popcount(originalMask) !== 4) return null;
    operations.push({ piece: page.operation.type, mask: originalMask });

    const occupied = fieldOccupiedMask(page.field, height) | currentMask;
    let newlyCleared = 0;
    for (let currentY = 0; currentY < height; currentY += 1) {
      if (!rowIsFull(occupied, currentY)) continue;
      const originalY = originalRowForCurrent(currentY, clearedRows, height);
      if (originalY >= 0) newlyCleared |= 1 << originalY;
    }
    clearedRows |= newlyCleared;
  }

  return { base, operations, _batchHeight: height, operationHistory: true };
}

function requiredHistoryHeight(pages, targetHeight) {
  let required = targetHeight;
  for (const page of pages) {
    for (let y = targetHeight; y < 23; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        if (page.field.at(x, y) !== '_') required = Math.max(required, y + 1);
      }
    }
    if (page.operation) {
      for (const { y } of page.operation.positions()) required = Math.max(required, y + 1);
    }
  }
  if (required > MAX_BATCH_HISTORY_HEIGHT) {
    throw new Error(`Fumen operation history exceeds ${MAX_BATCH_HISTORY_HEIGHT}-line batch domain`);
  }
  return required;
}

function unfoldOperationSequence(pages, targetHeight) {
  const requiredHeight = requiredHistoryHeight(pages, targetHeight);
  for (let height = requiredHeight; height <= MAX_BATCH_HISTORY_HEIGHT; height += 1) {
    try {
      const target = unfoldAtHeight(pages, height);
      if (target) return target;
    } catch (error) {
      if (!(error instanceof Error) || !/Fumen operation exceeds/.test(error.message)) throw error;
    }
  }
  throw new Error(`Fumen operation history exceeds ${MAX_BATCH_HISTORY_HEIGHT}-line batch domain`);
}

function staticPageTargets(page, height) {
  const { base, operationSets } = coloredOperationSets(page, height, { assembleOperation: true });
  return operationSets.map((operations) => ({ base, operations, sourcePage: page }));
}

export function decodedCoverTargets(pages, height) {
  if (!pages.length) throw new Error('input Fumen has no pages');
  const targets = [];

  for (let start = 0; start < pages.length;) {
    let end = start;
    while (end + 1 < pages.length && isContinuousTransition(pages[end], pages[end + 1])) end += 1;

    if (end > start) {
      const target = unfoldOperationSequence(pages.slice(start, end + 1), height);
      if (target.operations.length) targets.push(target);
    } else {
      targets.push(...staticPageTargets(pages[start], height));
    }
    start = end + 1;
  }

  return targets;
}
