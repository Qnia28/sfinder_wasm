import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, filesUnder, digest, safePath, sha256, strict, artifactDigest } from '../contracts.mjs';
import { activate, validateLock } from '../manifest.mjs';
import { planStage } from '../planner.mjs';
import { runChunk } from '../executor.mjs';
import { audit } from '../audit.mjs';
import { deadlineClient } from '../evidence.mjs';
import { requireDisk, materializeFixture } from '../../followup-storage.mjs';
import { resolveManifest } from '../manifest.mjs';
import { validateLaunchGroup } from '../budget.mjs';
import { checkAllocation } from '../allocation.mjs';

// A separate explicit performance profile; information profile semantics stay
// unchanged. Both use this established JavaScript action's SDK credentials.
if(['triage','product-integration'].includes(process.env.INPUT_PROTOCOL)) {
  process.env.INPUT_ARTIFACT_ID=process.env['INPUT_ARTIFACT-ID'];
  process.env.INPUT_ASSET_ID=process.env['INPUT_ASSET-ID'];
  process.env.INPUT_JOB_STARTED_MS=process.env['INPUT_JOB-STARTED-MS'];
  process.env.JOB_STARTED_MS=process.env['INPUT_JOB-STARTED-MS'];
  process.env.CONFIG_ID=process.env['INPUT_CONFIG-ARTIFACT-ID'];
  process.env.CONFIG_DIGEST=process.env['INPUT_CONFIG-DIGEST'];
  assert(process.env.ACTIONS_RUNTIME_TOKEN&&process.env.ACTIONS_RESULTS_URL,'Actions artifact runtime credentials required');
  const script=process.env.INPUT_PROTOCOL==='product-integration'?'../triage/product-action.mjs':'../triage/action.mjs';
  const result=spawnSync('node',[fileURLToPath(new URL(script,import.meta.url))],{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  process.exit(result.status??1);
}

const client = (await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode = process.env.INPUT_MODE, stage = process.env.INPUT_STAGE;
const output = (name, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
const repository = process.env.GITHUB_REPOSITORY, runId = process.env.GITHUB_RUN_ID;
let watchdog;
async function upload(name, directory, ms = 180000) {
  return deadlineClient(client, ms).uploadArtifact(name, filesUnder(directory), path.resolve(directory), { retentionDays: 30 });
}
async function download(directory, id = Number(process.env['INPUT_ARTIFACT-ID']), hash = process.env.INPUT_DIGEST) {
  assert(Number.isSafeInteger(id) && id > 0); hash = artifactDigest(hash);
  const staging = directory + '-zip'; fs.mkdirSync(staging);
  const metadata = JSON.parse(execFileSync('gh', ['api', `repos/${repository}/actions/artifacts/${id}`], { encoding: 'utf8', timeout: 120000 }));
  assert.equal(metadata.id, id); assert.equal(artifactDigest(metadata.digest), hash); assert(!metadata.expired);
  requireDisk(staging, metadata.size_in_bytes); // Admit compressed bytes BEFORE SDK writes the ZIP.
  const result = await client.downloadArtifact(id, { path: path.resolve(staging), expectedHash: hash, skipDecompress: true });
  assert(!result.digestMismatch, 'payload hash mismatch');
  const members = fs.readdirSync(staging); assert.equal(members.length, 1);
  const archive = path.join(staging, members[0]);
  execFileSync('python', [fileURLToPath(new URL('../../followup-extract.py', import.meta.url)), archive, directory, String(4 * 1024 ** 3)], { timeout: 120000 });
  fs.unlinkSync(archive); fs.rmdirSync(staging);
}
function history(campaignId) {
  execFileSync(process.execPath, [fileURLToPath(new URL('../../download-artifacts.mjs', import.meta.url)), repository, runId, 'history', `common-data-${campaignId}-`],
    { stdio: 'inherit', timeout: 80 * 60000, env: { ...process.env, FOLLOWUP_STORAGE_GUARD: '1' } });
}
function restoreInputs() {
  for (const ref of readJson('common-lock/INPUT_LOCATIONS.json')) {
    const source = safePath('common-lock', ref.member), destination = safePath(process.cwd(), ref.file);
    assert.equal(sha256(fs.readFileSync(source)), ref.sha256);
    if (fs.existsSync(destination)) assert.equal(sha256(fs.readFileSync(destination)), ref.sha256);
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      materializeFixture(source, destination, { size: fs.statSync(source).size, bytes: () => fs.readFileSync(source) });
    }
  }
}
let campaignId = null;
try {
  if (mode === 'launch-plan') {
    assert.equal(process.env.INPUT_CONFIRM, 'RUN_COMMON_HARNESS');
    const entry = readJson(safePath(process.cwd(), process.env.INPUT_MANIFEST));
    if (entry.campaigns) { strict(entry, ['schemaVersion', 'vmCap', 'campaigns'], 'launch group'); assert.equal(entry.schemaVersion, 1); assert(Array.isArray(entry.campaigns) && entry.campaigns.length); }
    const paths = entry.campaigns ?? [process.env.INPUT_MANIFEST];
    const manifests = paths.map(file => resolveManifest(readJson(safePath(process.cwd(), file))));
    validateLaunchGroup(manifests, entry.vmCap ?? 20);
    assert(manifests.every(m => m.approval), 'all campaign manifests need approval');
    output('matrix', JSON.stringify({ include: paths.map(manifest => ({ manifest })) }));
  } else if (mode === 'activate') {
    assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'rerun requires explicit continuation');
    assert.equal(process.env.INPUT_CONFIRM, 'RUN_COMMON_HARNESS');
    if (process.env['INPUT_CONFIG-ARTIFACT-ID']) await download(path.dirname(process.env.INPUT_MANIFEST),
      Number(process.env['INPUT_CONFIG-ARTIFACT-ID']), process.env['INPUT_CONFIG-DIGEST']);
    const authored = readJson(safePath(process.cwd(), process.env.INPUT_MANIFEST)); campaignId = authored.campaignId;
    assert.equal(authored.profile,'exact-cold-v1','performance requires explicit protocol: triage');
    // Include queued/waiting runs: they may consume their frozen reservation later.
    const active = ['in_progress', 'queued', 'waiting', 'requested', 'pending'].flatMap(status => {
      const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repository}/actions/runs?status=${status}&per_page=100`], { encoding: 'utf8', timeout: 120000 }));
      return pages.flatMap(p => p.workflow_runs);
    });
    const allocation = checkAllocation(authored, [...new Map(active.map(r => [r.id, r])).values()], runId);
    const run = JSON.parse(execFileSync('gh', ['api', `repos/${repository}/actions/runs/${runId}`], { encoding: 'utf8' }));
    const lock = activate(authored, 'common-lock', { createdUtc: run.created_at, invocationId: runId, commit: process.env.GITHUB_SHA, confirm: true });
    writeJson('common-lock/VM_ALLOCATION.json', allocation);
    const locations = [];
    for (const ref of lock.manifest.inputs.fixtures) {
      const source = safePath(process.cwd(), ref.file), member = `inputs/${ref.sha256}.json`, destination = safePath('common-lock', member);
      assert.equal(sha256(fs.readFileSync(source)), ref.sha256);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (!fs.existsSync(destination)) materializeFixture(source, destination, { size: fs.statSync(source).size, bytes: () => fs.readFileSync(source) });
      locations.push({ file: ref.file, member, sha256: ref.sha256 });
    }
    if (lock.manifest.continuation) {
      const c = lock.manifest.continuation;
      for (const file of [c.parentLock, ...filesUnder(c.history).map(f => f.replaceAll('\\', '/'))]) {
        const source = safePath(process.cwd(), file), member = 'continuation/' + file, destination = safePath('common-lock', member);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (!fs.existsSync(destination)) materializeFixture(source, destination, { size: fs.statSync(source).size, bytes: () => fs.readFileSync(source) });
        locations.push({ file, member, sha256: sha256(fs.readFileSync(source)) });
      }
    }
    writeJson('common-lock/INPUT_LOCATIONS.json', locations);
    const result = await upload('common-lock-' + lock.manifest.campaignId, 'common-lock'); output('artifact-id', result.id); output('digest', 'sha256:' + result.digest);
    output('max-parallel', lock.manifest.budget.maxParallel);
  } else if (mode === 'plan' || mode === 'audit') {
    await download('common-lock'); const lock = validateLock(readJson('common-lock/LOCK.json')); campaignId = lock.manifest.campaignId;
    restoreInputs(); history(lock.manifest.campaignId);
    if (mode === 'plan') {
      const plan = planStage(lock, 'history', 'bundle', stage), receipts = [];
      for (let chunk = 0; chunk < plan.chunks; chunk++) {
        const root = path.join('bundle', 'chunks', String(chunk)), result = await upload(`common-payload-${lock.manifest.campaignId}-${stage}-${chunk}`, root);
        receipts.push({ chunk, artifactId: result.id, digest: 'sha256:' + result.digest });
      }
      writeJson('bundle/PUBLISH_RECEIPT.json', { schemaVersion: 1, stagePlanId: plan.stagePlanId, artifacts: receipts });
      fs.mkdirSync('stage-evidence');
      for (const file of ['STAGE_PLAN.json', 'PUBLISH_RECEIPT.json']) fs.copyFileSync('bundle/' + file, 'stage-evidence/' + file);
      await upload(`common-data-${lock.manifest.campaignId}-plan-${stage}`, 'stage-evidence');
      output('matrix', JSON.stringify({ include: receipts })); output('has-work', String(receipts.length > 0));
      output('max-parallel', lock.manifest.budget.maxParallel); output('job-minutes', lock.manifest.budget.job.jobMinutes);
    } else {
      const report = audit(lock, 'history', 'report'); await upload('common-final-audit-' + lock.manifest.campaignId, 'report');
      if (report.validity !== 'PASS') process.exitCode = 1;
    }
  } else if (mode === 'run') {
    await download('bundle'); const lock = validateLock(readJson('bundle/LOCK.json')); campaignId = lock.manifest.campaignId;
    const jobStartedMs = Number(process.env['INPUT_JOB-STARTED-MS']), j = lock.manifest.budget.job;
    const remaining = jobStartedMs + j.jobMs + j.finalTransportMs + j.transportAuditMs - Date.now();
    assert(remaining > 0, 'job deadline expired during setup');
    watchdog = setTimeout(() => { console.error('Common native executor deadline; pending evidence retained'); process.exit(1); }, remaining);
    const report = await runChunk('bundle', 'results', client, { jobStartedMs });
    if (report.status !== 'ALL_DURABLE' || report.quarantine.fatal) process.exitCode = 1;
  } else throw Error('unsupported common action mode');
} catch (error) {
  console.error(error); process.exitCode = 1;
  const dir = 'common-failure'; fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'FAILURE.json'), { schemaVersion: 1, mode, stage: stage ?? null, error: error.message, stack: error.stack });
  try { await upload(`common-data-${campaignId ?? 'unactivated'}-failure-${mode}-${stage || 'activation'}-${digest(process.env.GITHUB_JOB).slice(0, 12)}`, dir); }
  catch (transportError) { console.error('Failure evidence UNDELIVERED', transportError); }
} finally { clearTimeout(watchdog); }
// SDK may retain sockets after a timed-out operation. All completed receipts have
// already been fsynced; do not let a stale transport keep the job running forever.
process.exit(process.exitCode ?? 0);
