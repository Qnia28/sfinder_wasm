const freezeProfile = (profile) => Object.freeze({ ...profile });

export const PC_ROUTING_PROFILES = Object.freeze({
  existence: freezeProfile({
    fourLinePatternMinCases: 2048,
    tallPatternMinCases: 256,
  }),
  full: freezeProfile({
    fourLinePatternMinCases: 64,
    tallPatternMinCases: 8,
  }),
  path: freezeProfile({
    fourLinePatternMinCases: 64,
    tallPatternMinCases: 4,
  }),
});

export function routingProfile(name) {
  const profile = PC_ROUTING_PROFILES[name];
  if (!profile) throw new Error(`unknown PC routing profile ${name}`);
  return profile;
}

export function patternMinCases(name, height, overrides = null) {
  const profile = routingProfile(name);
  const fourLine = overrides?.fourLinePatternMinCases ?? profile.fourLinePatternMinCases;
  const tall = overrides?.tallPatternMinCases ?? profile.tallPatternMinCases;
  return height <= 4 ? fourLine : tall;
}

export function shouldUsePatternBackend({
  profile,
  height,
  caseCount,
  available = true,
  fourLinePatternMinCases,
  tallPatternMinCases,
}) {
  if (!available) return false;
  return caseCount >= patternMinCases(profile, height, {
    fourLinePatternMinCases,
    tallPatternMinCases,
  });
}
