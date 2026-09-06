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
  decodeAndValidate(sourceFumen, clear);
  if (clear !== 4) throw new Error("5th is clear=4 only");
  const calculation = fifthMinimalsPerSaves({
    sourceFumen,
    analysisPattern: pattern,
    solver,
    useHold,
  });
  const encoded = encodeFifthCombined({ sourceFumen, title, calculation });
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
  decodeAndValidate(sourceFumen, clear);
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
  });
  const encoded = encodeFifthCombined({ sourceFumen, title, calculation });
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

