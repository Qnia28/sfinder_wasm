import assert from 'node:assert/strict';
import { commandPlan, digest } from '../fast-bench/planner.mjs';

export const ARM_OPTIONS = Object.freeze({
  BASE100: {}, I10_FIXED_AUX: { fastPolicy: 'I10_FIXED_AUX' },
  U192: { fastPolicy: 'U192' }, U228_OR_D16: { fastPolicy: 'U228_OR_D16' },
  U192_OR_D16: { fastPolicy: 'U192_OR_D16' }, S200_OR_D16: { fastPolicy: 'S200_OR_D16' },
});

export function triageCommands(scope, historical) {
  const old = commandPlan(historical);
  const ids = new Set([...old.e2e.map(i => old.captures[i].id), ...scope.boundaryCommandIds, ...scope.requiredCommandIds]);
  for (const id of ids) assert(old.captures.some(c => c.id === id), 'unknown frozen command ' + id);
  const captures = old.captures.filter(c => ids.has(c.id)).map((c, captureIndex) => ({ ...c,
    historicalCaptureIndex: c.captureIndex, captureIndex }));
  return { captures, e2e: captures.map(c => c.captureIndex) };
}

export function triagePlan(scope, commands, records) {
  assert.deepEqual(scope.arms, Object.keys(ARM_OPTIONS));
  const byIndex = new Map(records.map(r => [r.command.captureIndex, r]));
  assert.equal(byIndex.size, commands.captures.length);
  const traceSet = new Set(scope.requiredCommandIds);
  const priority = [commands.captures.find(c => c.population === 'regression'),
    commands.captures.find(c => c.population === 'edge' && c.kind === 'per-save'),
    commands.captures.find(c => c.population === 'edge' && c.kind === 'minimals'),
    ...commands.captures.filter(c => scope.boundaryCommandIds.includes(c.id))];
  for (const c of priority) {
    if (traceSet.size >= scope.traceCommands) break;
    if (c) traceSet.add(c.id);
  }
  for (const c of [...commands.captures].sort((a, b) => digest(a.id).localeCompare(digest(b.id)))) {
    if (traceSet.size >= scope.traceCommands) break;
    traceSet.add(c.id);
  }
  const schedule = [], tasks = [];
  for (const command of commands.captures) {
    const task = { id: 'command-' + command.captureIndex, command, capture: byIndex.get(command.captureIndex), calls: [], reservationSeconds: 0 };
    function block(phase, repeat, diagnostics) {
      const offset = (parseInt(digest(command.id + phase).slice(0, 8), 16) + repeat) % scope.arms.length;
      const arms = [...scope.arms.slice(offset), ...scope.arms.slice(0, offset)];
      for (const arm of arms) {
        const call = { callId: digest([scope.study, command.id, phase, repeat, diagnostics, arm]),
          commandId: command.id, taskId: task.id, phase, repeat, diagnostics, trace: diagnostics === 'trace',
          arm, order: arms.indexOf(arm), fixture: null, reservationSeconds: scope.resourceCaps.callSeconds };
        task.calls.push(call); schedule.push(call); task.reservationSeconds += call.reservationSeconds;
      }
    }
    for (let r = 0; r < scope.repeats; r++) block('e2e', r, 'timing');
    if (traceSet.has(command.id)) for (let r = 0; r < scope.traceRepeats; r++) {
      // Rotate diagnostics order too; retain raw paired differences without subtracting overhead.
      const modes = [false, 'timing', 'trace'];
      for (let n = 0; n < modes.length; n++) block('trace', r, modes[(n + r) % modes.length]);
    }
    tasks.push(task);
  }
  const chunks = [];
  for (const task of tasks.sort((a, b) => b.reservationSeconds - a.reservationSeconds || a.id.localeCompare(b.id))) {
    assert(task.reservationSeconds <= 18000);
    let chunk = chunks.find(c => c.reservationSeconds + task.reservationSeconds <= 18000);
    if (!chunk) { chunk = { index: chunks.length, tasks: [], reservationSeconds: 0 }; chunks.push(chunk); }
    chunk.tasks.push(task); chunk.reservationSeconds += task.reservationSeconds;
  }
  assert(chunks.length <= 256);
  const reservationSeconds = chunks.reduce((s, c) => s + c.reservationSeconds, 0);
  // Includes captures, bootstrap cap, per-job control allowances and plan/audit jobs.
  const totalReservedSeconds = reservationSeconds + commands.captures.length * scope.resourceCaps.captureSeconds
    + 7200 + scope.captureShards * 300 + chunks.length * 900 + 3600;
  assert(totalReservedSeconds <= scope.resourceCaps.maxRunnerHours * 3600);
  return { schema: 1, study: scope.study, selection: {
    main: records.flatMap(r => (r.result?.filters ?? []).filter(f => f.status === 'CAPTURED')
      .map(f => ({ ...f, command: r.command, inputArtifact: r.inputArtifact }))),
    supplemental: [], trace: [...traceSet], developmentNotFresh: true,
  }, chunks, schedule, scheduleHash: digest(schedule), reservationSeconds, totalReservedSeconds };
}

export function outcomeSignature(record) {
  return Object.fromEntries(Object.entries(record.outcomes ?? {}).map(([filter, o]) => [filter, {
    status: o.status, K: o.K, qualityExact: o.qualityExact, qualityHash: o.qualityHash, keysHash: o.keysHash,
    fastDecision: o.fastDecision, fastProbeStates: o.fastProbeStates,
  }]));
}

export function triageTraceAudit(rows) {
  const groups = new Map(), anomalies = [];
  for (const r of rows.filter(r => r.phase === 'trace')) {
    const key = [r.commandId, r.arm, r.repeat].join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, group] of groups) {
    if (group.length !== 3 || new Set(group.map(r => r.diagnostics)).size !== 3) anomalies.push({ key, error: 'missing/duplicate diagnostic mode' });
    const completed = group.filter(r => r.status.startsWith('RETURNED'));
    if (new Set(completed.map(r => digest([r.status, outcomeSignature(r)]))).size > 1) anomalies.push({ key, error: 'diagnostics changed result' });
  }
  return anomalies;
}
