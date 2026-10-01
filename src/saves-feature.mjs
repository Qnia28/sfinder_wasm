import { visitCaseSolutions } from "./pc-enumeration-engine.mjs";
import { expandPatternCasesInternal, queuesForFinder } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";
import { createSaveOutcomeCache } from "./save-outcome-cache.mjs";
import { popcount } from "./board.mjs";
import { RUST_PIECE_ORDER, TETRIS_DISPLAY_ORDER } from "./piece-order.mjs";
import {
  compareExactSaveStrings,
  compileSaveOutcomeExpression,
  compileSaveOutcomeMaskExpression,
  parseSaveExpressionSpec,
  prepareSaveCase,
  prepareSolutionPieceCounts,
  saveCodeToString,
  savedCodePrepared,
  saveMaskToString,
  tetrisSortExact,
  unusedPiecePrepared,
} from "./saves.mjs";

function splitWantedSaveExpressions(value) {
  const source = String(value ?? "");
  const parts = [];
  let start = 0;
  let inRegex = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "/") { inRegex = !inRegex; continue; }
    if (char === "," && !inRegex) {
      const part = source.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

export function calculateSaves({
  sourceFumen,
  pattern,
  wantedSave,
  clear = 4,
  solver,
  useHold = true,
  outcomeCache = false,
  singleSaveMask = true,
}) {
  const { board } = decodeAndValidate(sourceFumen, clear);
  const pathPattern = queuesForFinder(pattern);
  const cases = expandPatternCasesInternal(pattern);
  for (const entry of cases) {
    if (!entry.lastBag) {
      throw new Error(`save analysis branch ${entry.branchIndex + 1} does not end in a bag token`);
    }
  }

  const requested = Array.isArray(wantedSave)
    ? wantedSave.map((value) => String(value).trim()).filter(Boolean)
    : splitWantedSaveExpressions(wantedSave);
  const allMode = requested.length === 0 || (requested.length === 1 && requested[0].toUpperCase() === "ALL");
  if (requested.length > 1 && requested.some((value) => value.toUpperCase() === "ALL")) {
    throw new SyntaxError("Wanted Saves: ALL cannot be combined with save expressions");
  }
  const saveSpecs = allMode ? [] : requested.map(parseSaveExpressionSpec);
  const evaluators = saveSpecs.map((spec) => compileSaveOutcomeExpression(spec.expression));
  // Placement count uses the ORIGINAL occupied cells, including complete rows,
  // matching save_outcomes_pattern_packed; search normalizes rows separately.
  const required = singleSaveMask ? (clear * 10 - popcount(board)) / 4 : 0;
  const masks = singleSaveMask && required > 0 && Number.isInteger(required)
    && cases.every(entry => entry.queue.length === required + 1) ? new Uint8Array(cases.length) : null;
  const maskFactories = masks ? saveSpecs.map(spec => compileSaveOutcomeMaskExpression(spec.expression)) : null;
  const outcomeCodes = masks ? null : Array.from({ length: cases.length }, () => new Set());
  const saveCases = cases.map((entry) => prepareSaveCase(entry.queue, entry.lastBag));
  const addOutcome = (caseIndex, usage) => {
    if (masks) {
      const piece = unusedPiecePrepared(saveCases[caseIndex].queueCounts, usage);
      masks[caseIndex] |= 1 << TETRIS_DISPLAY_ORDER.indexOf(piece);
    } else outcomeCodes[caseIndex].add(savedCodePrepared(saveCases[caseIndex], usage));
  };
  const packed = solver.saveOutcomesPattern?.(board, cases.map((entry) => entry.queue), useHold);
  if (packed != null) {
    // Each record contains one used-piece multiset and its playable case IDs.
    // Convert the counter order once per record, not once per geometric solution.
    const usage = new Uint8Array(7);
    for (let offset = 0; offset < packed.length;) {
      const counts = packed[offset++];
      const length = packed[offset++];
      for (let index = 0; index < 7; index += 1) {
        usage[index] = (counts >>> (4 * RUST_PIECE_ORDER.indexOf(TETRIS_DISPLAY_ORDER[index]))) & 15;
      }
      const end = offset + length;
      for (; offset < end; offset += 1) {
        const caseIndex = packed[offset];
        addOutcome(caseIndex, usage);
      }
    }
  } else {
    const usageByKey = new Map();
    visitCaseSolutions({
      board,
      cases,
      solver,
      useHold,
      collectByKey: false,
      trackCaseSolutions: false,
      visit: (_entry, caseIndex, solution) => {
        let usage = usageByKey.get(solution.key);
        if (!usage) {
          usage = prepareSolutionPieceCounts(solution);
          usageByKey.set(solution.key, usage);
        }
        addOutcome(caseIndex, usage);
      },
    });
  }

  const total = cases.length;
  const baseResult = { pathPattern, analysisPattern: pattern, total };
  // Codes are opaque number|string keys; an empty save string is a valid hit.
  // Keep the cache request-local so broad patterns do not retain their outcomes.
  const saveStrings = new Map();
  const cachedSaveString = (code) => {
    let save = saveStrings.get(code);
    if (save === undefined) {
      save = saveCodeToString(code);
      saveStrings.set(code, save);
    }
    return save;
  };
  // At most 128 last-bag base masks, each with seven exact (possibly repeated
  // piece) strings. Dictionaries/evaluators are request-owned and created lazily.
  const dictionaries = new Map();
  const dictionaryFor = index => {
    const baseMask = saveCases[index].baseSavedMask;
    let dictionary = dictionaries.get(baseMask);
    if (!dictionary) {
      const base = saveMaskToString(baseMask);
      const saves = [...TETRIS_DISPLAY_ORDER].map(piece => tetrisSortExact(base + piece));
      dictionary = { saves, evaluate: maskFactories.map(bind => bind(saves)) };
      dictionaries.set(baseMask, dictionary);
    }
    return dictionary;
  };

  if (allMode) {
    let success = 0;
    const failedQueues = [];
    const counts = new Map();
    for (let index = 0; index < cases.length; index += 1) {
      const codes = masks ? null : outcomeCodes[index];
      if (masks ? masks[index] !== 0 : codes.size) success += 1;
      else failedQueues.push(cases[index].queue);
      if (masks) {
        const saves = dictionaryFor(index).saves;
        for (let bit = 0; bit < 7; bit++) {
          if (!(masks[index] & (1 << bit))) continue;
          const save = saves[bit];
          counts.set(save, (counts.get(save) ?? 0) + 1);
        }
      } else for (const code of codes) {
        const save = cachedSaveString(code);
        counts.set(save, (counts.get(save) ?? 0) + 1);
      }
    }
    return {
      ...baseResult,
      success,
      failed: failedQueues.length,
      failedQueues,
      percent: total ? 100 * success / total : 0,
      saveResults: [...counts]
        .sort(([a], [b]) => compareExactSaveStrings(a, b))
        .map(([save, count]) => ({
          save,
          success: count,
          total,
          percent: total ? 100 * count / total : 0,
        })),
    };
  }

  const stats = saveSpecs.map((spec) => ({
    saveExpression: spec.expression,
    saveAlias: spec.alias,
    saveLabel: spec.label,
    success: 0,
    failedQueues: [],
  }));
  // Opt-in pending bounded measurements; ALL and public Set evaluators are unchanged.
  const cache = outcomeCache && !masks ? createSaveOutcomeCache(evaluators) : null;
  for (let index = 0; index < cases.length; index += 1) {
    if (masks) {
      const dictionary = dictionaryFor(index);
      for (let expressionIndex = 0; expressionIndex < dictionary.evaluate.length; expressionIndex++) {
        if (dictionary.evaluate[expressionIndex](masks[index])) stats[expressionIndex].success++;
        else stats[expressionIndex].failedQueues.push(cases[index].queue);
      }
      continue;
    }
    const allSaves = new Set([...outcomeCodes[index]].map(cachedSaveString));
    const matches = cache?.match(allSaves);
    for (let expressionIndex = 0; expressionIndex < evaluators.length; expressionIndex += 1) {
      if (matches ? matches[expressionIndex] : evaluators[expressionIndex](allSaves).size > 0) stats[expressionIndex].success += 1;
      else stats[expressionIndex].failedQueues.push(cases[index].queue);
    }
  }

  const wantedSaveResults = stats.map((entry) => ({
    ...entry,
    total,
    failed: entry.failedQueues.length,
    percent: total ? 100 * entry.success / total : 0,
  }));

  if (wantedSaveResults.length === 1) return { ...baseResult, ...wantedSaveResults[0] };
  return { ...baseResult, wantedSaveResults };
}
