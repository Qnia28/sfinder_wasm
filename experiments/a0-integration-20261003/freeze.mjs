import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, read, write, jsonSha } from './common.mjs';
const summary = read(path.join(ROOT, '.a0/smoke-summary/SUMMARY.json'));
assert.equal(summary.status, 'PASS'); assert.equal(summary.observedRuns, 128); assert.equal(summary.mayFreezeForReserved, true);
write(path.join(ROOT, '.a0/freeze/FREEZE.json'), { status: 'FROZEN_FOR_RESERVED_NOT_PRODUCT_APPROVAL', buildSha256: jsonSha(summary.build), candidateCommit: summary.build.candidateCommit,
  wasmSha256: summary.build.wasmSha256, frozenVariant: 'A0 only on existing ordinary True probe', smokeSummarySha256: jsonSha(summary), smokeCensoring: summary.censored,
  productRoutePromotionEvidenceComplete: summary.productRoutePromotionEvidenceComplete, retuningPermitted: false, devApplyAuthorized: false });
console.log('One unchanged A0 candidate frozen for reserved verification; dev application is not authorized.');
