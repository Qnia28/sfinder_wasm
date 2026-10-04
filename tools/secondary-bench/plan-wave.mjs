// Offline planner for one finite Actions wave. Does not dispatch or solve.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, hash, identity, validateFixture } from './contracts.mjs';
import { validateCampaign, campaignTimes, policyFor, jobShape, roundTasks, packTasks, worstCallMs } from './campaign.mjs';
import { verifyFiles } from './run.mjs';

export function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'artifact symlink forbidden');
    return entry.isDirectory() ? filesUnder(filename) : [filename];
  });
}
export function loadHistory(directory, plan) {
  const files = filesUnder(directory), rows = [];
  for (const filename of files.filter(f => path.basename(f) === 'raw.jsonl')) {
    const lines = fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const row = JSON.parse(line);
      assert.equal(row.campaignId, plan.campaignId, 'foreign campaign artifact');
      assert.equal(row.sourceLock, identity(plan.sourceFiles), 'history source mismatch');
      rows.push(row);
    }
  }
  const attempted = new Set();
  for (const row of rows.filter(r => r.execution)) {
    const key = row.action === 'capture' ? row.inputId : `${row.inputId}/${row.engine}/${row.repeat}`;
    assert(!attempted.has(key), 'duplicate attempt retained; audit before continuation: ' + key);
    attempted.add(key);
  }
  return { files, rows };
}
export function chooseFixtures(plan, files) {
  const commands = new Map(plan.commands.map(c => [c.id, c])), groups = new Map(), seen = new Set(), ledger = [];
  for (const filename of files.filter(f => /[\\/]fixtures[\\/][^\\/]+\.json$/.test(f))) {
    const bytes = fs.readFileSync(filename), fixture = validateFixture(readJson(filename));
    const commandId = fixture.origin?.command?.id, command = commands.get(commandId);
    assert(command, 'captured fixture has no frozen command');
    assert.deepEqual(fixture.origin.command, command, 'capture options differ from frozen command');
    const sha256 = hash(bytes);
    if (seen.has(sha256)) continue; seen.add(sha256);
    const descriptor = { id: fixture.id, sha256, bytes, filename, commandId, filter: fixture.origin.filter,
      identity: fixture.contentIdentity, trivial: fixture.trivial, structure: fixture.structure,
      aliases: command.sourceAliases ?? [], contractHash: identity({ command, filter: fixture.origin.filter }) };
    if (!groups.has(commandId)) groups.set(commandId, []);
    groups.get(commandId).push(descriptor);
  }
  const selected = [];
  for (const command of plan.commands) {
    const candidates = (groups.get(command.id) ?? []).sort((a, b) => hash(plan.scheduleSeed + a.id).localeCompare(hash(plan.scheduleSeed + b.id)) || a.id.localeCompare(b.id));
    const nontrivial = candidates.filter(f => !f.trivial);
    const take = plan.fixtureSelection === 'ONE_PER_COMMAND_HASH' ? nontrivial.slice(0, 1) : nontrivial;
    selected.push(...take);
    ledger.push({ commandId: command.id, captured: candidates.length, trivial: candidates.length - nontrivial.length,
      nontrivial: nontrivial.length, selected: take.map(f => f.id), excluded: nontrivial.filter(f => !take.includes(f)).map(f => ({ id: f.id, reason: 'FROZEN_SAVE_FILTER_SAMPLE' })),
      noFixtureReason: candidates.length ? null : 'EMPTY_OR_CAPTURE_INCOMPLETE_REVIEW_RAW',
      captureComplete: 'SEE_CAPTURE_RAW_NOT_INFERRED_FROM_FIXTURE_PRESENCE' });
  }
  if (plan.campaignVariant === 'extended-5m') {
    const actual = selected.map(f => ({ id: f.id, sha256: f.sha256 })).sort((a, b) => a.id.localeCompare(b.id));
    const expected = [...plan.reusedFixtureLock].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(actual, expected, 'extended campaign must use exactly the first-run frozen matrices');
  }
  return { selected, ledger };
}
export function planWave(planFile, historyDir, outputDir, stage, now = Date.now()) {
  const plan = validateCampaign(readJson(planFile)); verifyFiles(plan.sourceFiles);
  const policy = policyFor(plan), shape = jobShape(plan);
  const times = campaignTimes(plan, now), history = loadHistory(historyDir, plan);
  fs.mkdirSync(outputDir, { recursive: false });
  writeJson(path.join(outputDir, 'campaign.json'), plan);
  let tasks = [], decisions = [], selection = null;
  if (stage === 'capture') {
    const attempted = new Set(history.rows.filter(r => r.action === 'capture' && r.execution).map(r => r.inputId));
    if (now < times.end - plan.policy.finishReserveMs) tasks = plan.commands.filter(c => !attempted.has(c.id))
      .sort((a, b) => hash(plan.scheduleSeed + a.id).localeCompare(hash(plan.scheduleSeed + b.id)))
      .map(command => ({ id: hash(command.id).slice(0, 20), action: 'capture', command, worstMs: worstCallMs(plan.captureLimits) }));
  } else {
    const round = Number(stage); assert(round >= policy.initialRepeats && round <= policy.maxRepeats && round % policy.repeatStep === 0);
    const reuseFiles = plan.campaignVariant === 'extended-5m' ? filesUnder(path.join(historyDir, '..', 'reused-capture')) : [];
    selection = chooseFixtures(plan, reuseFiles.length ? reuseFiles : history.files);
    fs.mkdirSync(path.join(outputDir, 'fixtures'));
    const fixtures = selection.selected.map(({ bytes, filename, ...fixture }) => {
      const relative = `fixtures/${fixture.sha256}.json`;
      if (!fs.existsSync(path.join(outputDir, relative))) fs.writeFileSync(path.join(outputDir, relative), bytes, { flag: 'wx' });
      return { ...fixture, path: relative };
    });
    const planned = roundTasks(plan, fixtures, history.rows.filter(r => r.action === 'secondary'), round, now);
    tasks = planned.tasks; decisions = planned.decisions;
  }
  const chunks = packTasks(tasks, policy.jobSoftMs - policy.finishReserveMs, shape.maximumTasks);
  for (const chunk of chunks) writeJson(path.join(outputDir, `chunk-${chunk.id}.json`), { ...chunk, stage, campaignId: plan.campaignId,
    manifestSha256: hash(fs.readFileSync(planFile)), sourceLock: identity(plan.sourceFiles), plannedUtc: new Date(now).toISOString() });
  const summary = { campaignId: plan.campaignId, stage, plannedUtc: new Date(now).toISOString(), elapsedMs: times.elapsedMs,
    tasks: tasks.length, chunks: chunks.length, calls: tasks.reduce((n, t) => n + (t.calls?.length ?? 1), 0),
    fixtureSelection: plan.fixtureSelection, selection: selection?.ledger ?? null, decisions,
    historyFiles: history.files.length, historyRows: history.rows.length, maxParallel: 16 };
  writeJson(path.join(outputDir, 'WAVE_PLAN.json'), summary);
  return summary;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, historyDir, outputDir, stage] = process.argv.slice(2);
  const result = planWave(planFile, historyDir, outputDir, stage);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `matrix=${JSON.stringify({ include: Array.from({ length: result.chunks }, (_, chunk) => ({ chunk })) })}\nhas_work=${result.chunks > 0}\nstop_epoch=${Math.floor(campaignTimes(readJson(planFile)).end / 1000)}\n` +
    `job_minutes=${policyFor(readJson(planFile)).jobHardMinutes}\ntask_minutes=${jobShape(readJson(planFile)).taskStepMinutes}\ntask_seconds=${jobShape(readJson(planFile)).taskScopeSeconds}\ncheckpoint_minutes=${jobShape(readJson(planFile)).checkpointMinutes}\nparts=${jobShape(readJson(planFile)).maximumTasks}\n`);
  console.log(JSON.stringify({ stage, chunks: result.chunks, calls: result.calls, elapsedMs: result.elapsedMs }));
}
