import assert from 'node:assert/strict';
import { commandPlan, digest } from '../fast-bench/planner.mjs';
import { ARM_OPTIONS } from './policies.mjs';

export function routingCommands(scope, historical) {
  const { captures } = commandPlan(historical);
  for (const id of scope.longCommandIds) assert(captures.some(c => c.id === id), 'unknown long command ' + id);
  return { captures, e2e: captures.map(c => c.captureIndex) };
}

export function routingPlan(scope, commands, records) {
  assert.deepEqual(scope.arms, Object.keys(ARM_OPTIONS));
  const byIndex = new Map(records.map(r => [r.command.captureIndex, r]));
  assert.equal(byIndex.size, commands.captures.length);
  assert(commands.captures.every(c => byIndex.has(c.captureIndex)));
  const traceSet = new Set(scope.longCommandIds);
  const ranked = [...commands.captures].sort((a, b) => digest(a.id).localeCompare(digest(b.id)));
  // Diversify diagnostic inputs using capture features only, never arm outcomes.
  const pools = [ranked.filter(c => ['edge', 'regression'].includes(c.population))];
  for (const population of ['ALL', 'per-save']) for (const feature of ['hard', 'small', 'medium', 'large', 'preview']) {
    pools.push(ranked.filter(c => c.population === population && byIndex.get(c.captureIndex).result?.filters?.some(f =>
      f.status === 'CAPTURED' && (feature === 'hard' ? f.primaryHard : feature === 'preview' ? f.features.previewEligible
        : feature === 'small' ? f.features.d <= 8 : feature === 'medium' ? f.features.d > 8 && f.features.d <= 16 : f.features.d > 16))));
  }
  while (traceSet.size < scope.traceCommands) {
    let progress = false;
    for (const pool of pools) {
      if (traceSet.size >= scope.traceCommands) break;
      const c = pool.find(c => !traceSet.has(c.id));
      if (c) { traceSet.add(c.id); progress = true; }
    }
    if (!progress) break;
  }
  for (const c of ranked) { if (traceSet.size >= scope.traceCommands) break; traceSet.add(c.id); }
  const schedule = [], tasks = [];
  for (const command of commands.captures) {
    const long = scope.longCommandIds.includes(command.id);
    const task = { id: 'command-' + command.captureIndex, command, capture: byIndex.get(command.captureIndex), calls: [], reservationSeconds: 0 };
    const block = (phase, repeat, diagnostics) => {
      const offset = (parseInt(digest(command.id + phase).slice(0, 8), 16) + repeat) % scope.arms.length;
      const arms = [...scope.arms.slice(offset), ...scope.arms.slice(0, offset)];
      for (const [order, arm] of arms.entries()) {
        const call = { callId: digest([scope.study, command.id, phase, repeat, diagnostics, arm]),
          commandId: command.id, taskId: task.id, phase, repeat, diagnostics, trace: diagnostics === 'trace',
          arm, order, fixture: null, reservationSeconds: long ? scope.resourceCaps.longCallSeconds : scope.resourceCaps.callSeconds };
        task.calls.push(call); schedule.push(call); task.reservationSeconds += call.reservationSeconds;
      }
    };
    for (let r = 0; r < scope.repeats; r++) block('e2e', r, 'timing');
    if (long) for (let r = scope.repeats; r < scope.longRepeats; r++) block('long-repeat', r, 'timing');
    if (traceSet.has(command.id)) for (let r = 0; r < scope.traceRepeats; r++) {
      const modes = [false, 'timing', 'trace'];
      for (let n = 0; n < modes.length; n++) block('trace', r, modes[(n + r) % modes.length]);
    }
    tasks.push(task);
  }
  // A named long input has 91 calls: 20020 reserved seconds. Preserve its
  // complete paired block on a single VM; normal inputs share smaller chunks.
  const chunks = [];
  for (const task of tasks.sort((a, b) => b.reservationSeconds - a.reservationSeconds || a.id.localeCompare(b.id))) {
    assert(task.reservationSeconds <= 20100);
    let chunk = chunks.find(c => c.reservationSeconds + task.reservationSeconds <= 20100);
    if (!chunk) { chunk = { index: chunks.length, tasks: [], reservationSeconds: 0 }; chunks.push(chunk); }
    chunk.tasks.push(task); chunk.reservationSeconds += task.reservationSeconds;
  }
  assert(chunks.length <= 256);
  const reservationSeconds = chunks.reduce((sum, c) => sum + c.reservationSeconds, 0);
  const totalReservedSeconds = reservationSeconds + commands.captures.length * scope.resourceCaps.captureSeconds
    + 7200 + scope.captureShards * 300 + chunks.length * 900 + 3600;
  assert(totalReservedSeconds <= scope.resourceCaps.maxRunnerHours * 3600, 'campaign budget exceeded');
  return { schema: 1, study: scope.study, selection: { main: records.flatMap(r => (r.result?.filters ?? [])
    .filter(f => f.status === 'CAPTURED').map(f => ({ ...f, command: r.command, inputArtifact: r.inputArtifact }))),
    supplemental: [], trace: [...traceSet], developmentNotFresh: true },
    chunks, schedule, scheduleHash: digest(schedule), reservationSeconds, totalReservedSeconds };
}

export function routingDiagnosticAudit(rows) {
  const groups = new Map(), anomalies = [], variations = [];
  for (const r of rows.filter(r => r.phase === 'trace')) {
    const key = [r.commandId, r.arm, r.repeat].join(':');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
  }
  for (const [key, group] of groups) {
    if (group.length !== 3 || new Set(group.map(r => r.diagnostics)).size !== 3) anomalies.push({ key, error: 'missing/duplicate diagnostic mode' });
    const returned = group.filter(r => r.status.startsWith('RETURNED'));
    const signature = r => digest(Object.fromEntries(Object.entries(r.outcomes ?? {}).map(([f, o]) => [f,
      { status: o.status, K: o.K, qualityExact: o.qualityExact, qualityHash: o.qualityHash, keysHash: o.keysHash, fastDecision: o.fastDecision }])));
    if (new Set(returned.map(signature)).size > 1) variations.push({ key, reason: 'observed E2E variation across diagnostic modes', callIds: group.map(r => r.callId) });
  }
  return { anomalies, variations };
}
