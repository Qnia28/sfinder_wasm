import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
assert(process.env.ACTIONS_RUNTIME_TOKEN&&process.env.ACTIONS_RESULTS_URL);
const result=spawnSync('node',[fileURLToPath(new URL('../qb015-action.mjs',import.meta.url)),'run'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
