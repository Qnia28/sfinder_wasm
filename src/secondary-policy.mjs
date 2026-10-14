// Public minimals policy; engine names below are private execution details.
export function resolveSecondaryPolicy(secondary = 'auto', exactHumanQuality = undefined) {
  if (exactHumanQuality !== undefined) {
    throw new Error('exactHumanQuality is no longer supported for minimals; use secondary="auto" or secondary="quality"');
  }
  const mode = String(secondary).trim().toLowerCase();
  const policies = {
    auto: ['fast', 'auto'],
    quality: ['true', 'auto'],
    '2x2': ['2x2', 'rust'],
    nocpsat: ['true', 'rust'],
    integrated: ['true', 'integrated'],
    threshold: ['true', 'threshold'],
    cpsat: ['true', 'cpsat'],
  };
  if (!Object.hasOwn(policies, mode)) throw new Error('invalid secondary policy: ' + secondary);
  const [exactQuality, engine] = policies[mode];
  return { mode, exactQuality, engine };
}
