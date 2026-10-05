import { checkpoint, flushCheckpoints, transportDeadline } from '../followup-checkpoint.mjs';
const release = transportDeadline(Number(process.env['INPUT_TIMEOUT-SECONDS']));
try {
const client = (await import('../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode = process.env.INPUT_MODE;
if (mode === 'checkpoint' || mode === 'audit') {
  const state = await checkpoint(client, process.env.INPUT_PATH, process.env.INPUT_NAME, process.env.INPUT_STATE);
  if (state.status !== 'UPLOADED') { console.error('Checkpoint upload failed; immutable bytes retained for final flush'); process.exitCode = 1; }
} else if (mode === 'flush') {
  const report = await flushCheckpoints(client, process.env.INPUT_PATH, process.env.INPUT_STATE, process.env.INPUT_NAME,
    { stage: process.env.INPUT_STAGE, chunk: process.env.INPUT_CHUNK });
  if (report.status !== 'ALL_DURABLE') { console.error('Undelivered checkpoint; audit receipt retained'); process.exitCode = 1; }
} else throw new Error('invalid checkpoint transport mode');
} finally { release(); }
