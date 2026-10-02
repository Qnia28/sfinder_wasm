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

// Node budgets, not elapsed-time deadlines, keep the decision reproducible.
export const EXISTENCE_PROBE = Object.freeze({ samples: 16, nodesPerQueue: 256 });

export function chooseExistenceBackend({ height, caseCount, multisetCount, probes, fallback }) {
  if (!probes.length) return fallback;
  const completed = probes.filter((probe) => probe.completed);
  const meanNodes = probes.reduce((sum, probe) => sum + probe.nodes, 0) / probes.length;
  // Sparse multiset groups have little geometry sharing. Keep the established
  // choice when a sample is inconclusive instead of creating many pattern DAGs.
  const shared = caseCount / Math.max(1, multisetCount);
  if (height <= 4) {
    // The 4L corpus contains small geometry DAGs whose scalar samples look
    // cheap but whose aggregate scalar cost is higher. Do not promote those
    // using a per-queue node estimate alone.
    return fallback;
  }
  if (caseCount >= 64 && shared >= 16 && (completed.length < probes.length || meanNodes >= 256)) return true;
  if (completed.length === probes.length && meanNodes <= 64) return false;
  return fallback;
}
