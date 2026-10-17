// JavaScript actions receive artifact runtime credentials; shell steps do not.
// Spawn setup-node's pinned binary, not the potentially newer action host.
const { spawn } = require('node:child_process');
const path = require('node:path');
for (const name of ['ACTIONS_RUNTIME_TOKEN', 'ACTIONS_RESULTS_URL']) {
  if (!process.env[name]) throw new Error(`Missing ${name}; no measurement admitted`);
}
const mode = process.env.INPUT_MODE;
if (!['plan', 'measure'].includes(mode)) throw new Error('Invalid continuation mode');
const child = spawn('node', [path.resolve(__dirname, '../continue.mjs'), mode, process.env.INPUT_SHARD ?? '0'],
  { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
