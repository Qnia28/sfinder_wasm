import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';
const bytes = readFileSync(new URL('./reports/root-screen-interrupted.json', import.meta.url));
const report = JSON.parse(bytes);
assert.equal(report.conclusion, 'cancelled'); assert.equal(report.perCase.length, 100);
const cases = report.perCase.filter(c => c.recordedCalls !== 12)
  .map(c => ({ caseId: c.caseId, previousRecordedCalls: c.recordedCalls, previousExact: c.exact,
    reason: c.recordedCalls ? 'rerun-whole-partial-case' : 'no-previous-artifact' }));
assert.equal(cases.length, 42);
writeFileSync(new URL('./root-resume-selection.json', import.meta.url), JSON.stringify({
  sourceRunId: report.runId, sourceReportHash: sha256(bytes), manifestHash: report.manifestHash,
  profile: 'root-screen', mask: 4, pairs: 1, timeoutSeconds: 300, maxParallel: 12,
  wasmHash: report.wasmHashes.experiment, sourceDigest: report.sourceDigest,
  reuseCompleteCases: report.perCase.filter(c => c.recordedCalls === 12).map(c => c.caseId),
  rule: 'Retain all58 complete twelve-call cases, including actual TIMEOUTs. Rerun all42 incomplete/no-artifact cases from scratch. Do not combine old partial calls with new pairs or select faster runs.',
  cases,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ retained: 58, rerun: cases.length, calls: cases.length * 12, maxParallel: 12 }, null, 2));
