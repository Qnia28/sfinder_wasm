import fs from 'node:fs';
import path from 'node:path';
import { STAGE, readJson, writeJson } from './common.mjs';

const out = path.join(STAGE, 'artifacts/anchor-0');
const summary = readJson(path.join(out, 'summary.json'));
const rows = fs.readFileSync(path.join(out, 'observations.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.kind === 'OBSERVATION');
const fast = rows.filter(row => row.cell.endsWith(':B403'));
const comparisons = [0, 1].map(repetition => {
  const a = fast.find(row => row.variant === 'REF' && row.repetition === repetition);
  const b = fast.find(row => row.variant === 'M' && row.repetition === repetition);
  return { repetition, complete: a?.status === 'PASS' && b?.status === 'PASS',
    baselineMs: a?.result?.wallMs, candidateMs: b?.result?.wallMs,
    significantRegression: a?.status === 'PASS' && b?.status === 'PASS' && b.result.wallMs - a.result.wallMs > Math.max(.5, .05 * a.result.wallMs) };
});
const proceed = summary.status === 'COMPLETE' && comparisons.every(row => row.complete) && !comparisons.every(row => row.significantRegression);
writeJson(path.join(out, 'ANCHOR_GATE.json'), { proceed, comparisons,
  criterion: 'No correctness failures/incomplete anchor and no two-observation common fixed1 regression above max(0.5ms,5%). This is a provisional screen, not promotion.' });
fs.appendFileSync(process.env.GITHUB_OUTPUT, `proceed=${proceed}\n`);
console.log(JSON.stringify({ proceed, comparisons }));
