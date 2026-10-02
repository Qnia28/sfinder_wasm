import test from 'node:test';
import assert from 'node:assert/strict';
import { manifest, loadFixture } from './fixtures.mjs';
import { settings, defaults, caseIds } from './profiles.mjs';

test('all fixture hashes, seed feasibility and development/validation separation', () => {
  assert.equal(manifest.cases.length,20);
  for (const c of manifest.cases) loadFixture(c.id);
  const dev = new Set(manifest.cases.filter(c=>c.suite==='development').map(c=>c.mirrorGroup));
  assert(manifest.cases.filter(c=>c.suite==='validation').every(c=>!dev.has(c.mirrorGroup)));
});

test('screen compares five single switches to all-off on the same job', () => {
  const pairs = settings('screen',31);
  assert.deepEqual(pairs.map(p=>p.right.mask),[1,2,4,8,16]);
  assert(pairs.every(p=>p.left.engine==='experiment'&&p.left.mask===0));
  assert.deepEqual(defaults('screen'),[3,20]);
});

test('ablation removes exactly one enabled element, baseline/confirm use original', () => {
  const pairs=settings('ablation',21);
  assert.deepEqual(pairs.map(p=>p.left.mask),[0,20,17,5]);
  assert(pairs.every(p=>p.right.mask===21));
  assert.equal(settings('baseline',0)[0].left.engine,'original');
  assert.equal(settings('confirm',21)[0].left.engine,'original');
  assert.equal(caseIds('confirm','all').length,20);
  assert.throws(()=>settings('ablation',0));
  assert.throws(()=>settings('screen',32));
});

test('factorial and diagnostic are explicit opt-in profiles', () => {
  assert.equal(settings('factorial',31).length,31);
  assert.equal(caseIds('factorial').length,6);
  assert(settings('diagnostic',31).every(p=>p.left.engine==='trace'&&p.right.engine==='trace'));
  assert.deepEqual(caseIds('smoke'),['extra000-split-I','pcinfo018-L']);
});
