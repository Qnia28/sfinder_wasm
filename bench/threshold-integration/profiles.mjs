import assert from 'node:assert/strict';
import { manifest } from './fixtures.mjs';
export function settings(profile, mask = 0) {
  assert.equal(mask, 0, 'product candidates do not use experiment masks');
  const compare = (name, left, right) => ({ name, left: { engine: left, mask: 0 }, right: { engine: right, mask: 0 } });
  if (profile === 'product-confirm') return [compare('Dev-to-current', 'D', 'A'), compare('current-to-both', 'A', 'B')];
  assert.equal(profile, 'product-control'); return [compare('tracked-asset-to-rebuilt-Dev', 'S', 'D'), compare('Dev-to-off-control', 'D', 'C')];
}
export const defaults = profile => [profile === 'product-control' ? 1 : 5, 300];
export const caseIds = () => manifest.cases.map(c => c.id);
