import assert from 'node:assert/strict';
import { manifest } from './fixtures.mjs';

export const PROFILES = ['smoke','baseline','screen','ablation','confirm','confirm-onoff','factorial','diagnostic'];
export function settings(profile, mask) {
  assert(PROFILES.includes(profile), 'unknown benchmark profile');
  assert(Number.isInteger(mask) && mask >= 0 && mask <= 31);
  const off = { engine: 'experiment', mask: 0 };
  if (profile === 'baseline') return [{ left: { engine: 'original', mask: 0 }, right: off }];
  if (profile === 'smoke') return [{ left: { engine: 'original', mask: 0 }, right: off },
    { left: off, right: { engine: 'experiment', mask: 31 } }];
  if (profile === 'screen') return [1,2,4,8,16].map(bit => ({ left: off, right: { engine: 'experiment', mask: bit } }));
  if (profile === 'confirm') return [{ left: { engine: 'original', mask: 0 }, right: { engine: 'experiment', mask } }];
  if (profile === 'confirm-onoff') {
    assert(mask > 0, 'on/off confirmation requires an enabled candidate');
    return [{ left: off, right: { engine: 'experiment', mask } }];
  }
  if (profile === 'ablation') {
    assert(mask > 0, 'ablation needs a nonzero candidate mask');
    return [{ left: off, right: { engine: 'experiment', mask } },
      ...[1,2,4,8,16].filter(bit => mask & bit).map(bit => ({
        left: { engine: 'experiment', mask: mask & ~bit }, right: { engine: 'experiment', mask }, removedBit: bit,
      }))];
  }
  if (profile === 'factorial') return Array.from({ length: 31 }, (_, i) => ({ left: off,
    right: { engine: 'experiment', mask: i + 1 } }));
  return [{ left: { engine: 'trace', mask: 0 }, right: { engine: 'trace', mask } }];
}

export function defaults(profile) {
  return {
    smoke: [1, 10], baseline: [3, 20], screen: [3, 20], ablation: [3, 30],
    confirm: [5, 60], 'confirm-onoff': [5, 300], factorial: [2, 10], diagnostic: [1, 20],
  }[profile];
}

export function caseIds(profile, suite = 'development') {
  assert(['development','validation','all','smoke'].includes(suite));
  if (profile === 'smoke' || suite === 'smoke') return manifest.smoke;
  if (profile === 'factorial') return manifest.factorial;
  return manifest.cases.filter(x => suite === 'all' || x.suite === suite).map(x => x.id);
}
