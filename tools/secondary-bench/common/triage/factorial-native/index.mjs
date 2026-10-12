import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
assert(process.env.ACTIONS_RUNTIME_TOKEN&&process.env.ACTIONS_RESULTS_URL);
const r=spawnSync('node',[fileURLToPath(new URL('../factorial-action.mjs',import.meta.url)),'run'],{stdio:'inherit',env:process.env});
if(r.error)throw r.error;
process.exit(r.status??1);
