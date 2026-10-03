import assert from 'node:assert/strict';
import { manifest } from './fixtures.mjs';

export const PROFILES = ['smoke','baseline','screen','ablation','confirm','confirm-onoff','factorial','diagnostic',
  'root-screen', 'root-confirm'];
export function settings(profile, mask) {
  assert(PROFILES.includes(profile), 'unknown benchmark profile');
  assert(Number.isInteger(mask) && mask >= 0 && mask <= (profile === 'root-confirm' ? 100 : 31));
  const off = { engine: 'experiment', mask: 0 };
  const compare = (name, left, right) => ({ name,
    left: { engine: 'experiment', mask: left }, right: { engine: 'experiment', mask: right } });
  if (profile === 'root-screen') return [
    compare('old-root-alone', 0, 4), compare('old-root-incremental', 16, 20),
    compare('fused-collection', 4, 36), compare('prepared-root-coverage', 4, 68),
    compare('both-refinements', 4, 100), compare('refined-root-incremental', 16, 116),
  ];
  if (profile === 'root-confirm') {
    assert([4, 36, 68, 100].includes(mask), 'freeze a root-only candidate mask');
    return [compare('root-incremental-confirm', 16, mask | 16)];
  }
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
    'root-screen': [1, 300], 'root-confirm': [5, 300],
  }[profile];
}

export function caseIds(profile, suite = 'development') {
  assert(['development','validation','all','smoke'].includes(suite));
  if (profile === 'smoke' || suite === 'smoke') return manifest.smoke;
  if (profile === 'factorial') return manifest.factorial;
  return manifest.cases.filter(x => suite === 'all' || x.suite === suite).map(x => x.id);
}
