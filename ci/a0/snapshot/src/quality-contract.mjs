export const MAX_U32_QUALITY = 0xffffffff;

export function assertQualityProvider(qualityFor) {
  if (qualityFor !== null && typeof qualityFor !== "function") {
    throw new TypeError("qualityFor must be a function or null");
  }
  return qualityFor;
}

export function requirePositiveQuality(value, { key = null, caseId = null, label = "human quality" } = {}) {
  const where = key === null && caseId === null ? "" : ` for ${String(caseId)} / ${String(key)}`;
  if (typeof value !== "number") {
    throw new TypeError(`${label} must be an integer number in 1..${MAX_U32_QUALITY}${where}; got ${String(value)}`);
  }
  if (!Number.isInteger(value) || value < 1 || value > MAX_U32_QUALITY) {
    throw new RangeError(`${label} must be an integer number in 1..${MAX_U32_QUALITY}${where}; got ${String(value)}`);
  }
  return value;
}
