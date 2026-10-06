// GitHub exposes artifact runtime credentials to JavaScript actions, not shell
// steps. Pass them only to the outer pinned runtime; policy scopes omit them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

assert(process.env.ACTIONS_RUNTIME_TOKEN && process.env.ACTIONS_RESULTS_URL,
  'Actions artifact runtime credentials are required');
const result = spawnSync('node', [fileURLToPath(new URL('../action.mjs', import.meta.url))],
  { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
