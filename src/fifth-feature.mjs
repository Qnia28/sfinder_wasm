import { fifthMinimalsPerSaves, fifthMinimalsPerSavesAsync, encodeFifthCombined } from "./fifth.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

export function calculateLegacyFifthFeature({
  sourceFumen,
  pattern,
  title = "",
  clear = 4,
  solver,
  useHold = true,
}) {
  const context = decodeAndValidate(sourceFumen, clear);
  if (clear !== 4) throw new Error("5th is clear=4 only");
  const calculation = fifthMinimalsPerSaves({
    sourceFumen,
    analysisPattern: pattern,
    solver,
    useHold,
  }, context);
  const encoded = encodeFifthCombined({ sourceFumen, title, calculation }, context.page);
  return {
    total: calculation.queues.length,
    bestsave: calculation.bestsave,
    usages: calculation.usages,
    pageCounts: encoded.pageCounts,
    fumen: encoded.fumen,
  };
}

export async function calculateFifthFeature({
  sourceFumen,
  pattern,
  title = "",
  clear = 4,
  solver,
  useHold = true,
  exactHumanQuality = "true",
  primary = undefined, Primary = undefined,
  useHiGHS = undefined,
  UseHiGHS = undefined,
  fastStateBudget = undefined,
}) {
  const context = decodeAndValidate(sourceFumen, clear);
  if (clear !== 4) throw new Error("5th is clear=4 only");
  const calculation = await fifthMinimalsPerSavesAsync({
    sourceFumen,
    analysisPattern: pattern,
    solver,
    useHold,
    exactHumanQuality,
    primary: primary ?? Primary,
    useHiGHS: useHiGHS ?? UseHiGHS ?? "auto",
    fastStateBudget,
  }, context);
  const encoded = encodeFifthCombined({ sourceFumen, title, calculation }, context.page);
  return {
    total: calculation.queues.length,
    bestsave: calculation.bestsave,
    usages: calculation.usages,
    pageCounts: encoded.pageCounts,
    fumen: encoded.fumen,
  };
}

export const calculateFifthFeatureAsync = calculateFifthFeature;
export const calculateFifthFeatureSync = calculateLegacyFifthFeature;

