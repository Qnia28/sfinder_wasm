import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readJson, writeJson, sha256 } from './contracts.mjs';
import { resolveManifest, activate } from './manifest.mjs';
import { planStage } from './planner.mjs';
import { audit, verifyArchive } from './audit.mjs';
import { indexHistory } from './evidence.mjs';
import { convertFollowup } from './recipes/followup.mjs';

const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === 'resolve') writeJson(args[1], resolveManifest(readJson(args[0])));
  else if (mode === 'convert-followup') convertFollowup(args[0], args[1]);
  else if (mode === 'activate') {
    assert.equal(process.env.GITHUB_RUN_ATTEMPT ?? '1', '1', 'rerun is not continuation');
    activate(readJson(args[0]), args[1], { createdUtc: args[2], invocationId: args[3], commit: process.env.GITHUB_SHA ?? null, confirm: args[4] === '--confirm' });
  } else if (mode === 'plan') planStage(readJson(args[0]), args[1], args[2], args[3]);
  else if (mode === 'audit') {
    const r = audit(readJson(args[0]), args[1], args[2]); console.log(JSON.stringify(r));
    if (r.validity !== 'PASS') process.exitCode = 1;
  } else if (mode === 'index-history') indexHistory(args[0], args[1]);
  else if (mode === 'archive') verifyArchive(args[0], args[1], args[2], args[3]);
  else throw Error('commands: resolve, convert-followup, activate, plan, audit, index-history, archive');
} catch (error) {
  const output = ['plan', 'audit'].includes(mode) ? args[2] : null;
  if (output) writeJson(path.join(output, 'FAILURE.json'), { schemaVersion: 1, mode, error: error.message, stack: error.stack });
  console.error(error); process.exitCode = 1;
}
