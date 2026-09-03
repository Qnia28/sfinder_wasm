import { visitCaseSolutions } from "./pc-enumeration-engine.mjs";
import { expandPatternCases, queuesForFinder } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";
import {
  compareExactSaveStrings,
  compileSaveOutcomeExpression,
  parseSaveExpressionSpec,
  prepareSaveCase,
  prepareSolutionPieceCounts,
  saveCodeToString,
  savedCodePrepared,
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
}) {
  const { board } = decodeAndValidate(sourceFumen, clear);
  const pathPattern = queuesForFinder(pattern);
  const cases = expandPatternCases(pattern);
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
  const outcomeCodes = Array.from({ length: cases.length }, () => new Set());
  const saveCases = cases.map((entry) => prepareSaveCase(entry.queue, entry.lastBag));
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
      outcomeCodes[caseIndex].add(savedCodePrepared(saveCases[caseIndex], usage));
    },
  });

  const total = cases.length;
  const baseResult = { pathPattern, analysisPattern: pattern, total };

  if (allMode) {
    let success = 0;
    const failedQueues = [];
    const counts = new Map();
    for (let index = 0; index < cases.length; index += 1) {
      const codes = outcomeCodes[index];
      if (codes.size) success += 1;
      else failedQueues.push(cases[index].queue);
      for (const code of codes) {
        const save = saveCodeToString(code);
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
  for (let index = 0; index < cases.length; index += 1) {
    const allSaves = new Set([...outcomeCodes[index]].map(saveCodeToString));
    for (let expressionIndex = 0; expressionIndex < evaluators.length; expressionIndex += 1) {
      if (evaluators[expressionIndex](allSaves).size > 0) stats[expressionIndex].success += 1;
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
