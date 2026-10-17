import assert from 'node:assert/strict';
import { commandPlan, digest } from '../fast-bench/planner.mjs';

export function refinePlan(scope, historical) {
  const pool = commandPlan(historical).captures;
  const commands = [...scope.commandIds.map(id => {
    const command = pool.find(c => c.id === id); assert(command, 'unknown command ' + id); return command;
  }), pool.find(c => c.population === 'edge' && c.kind === 'minimals'),
  pool.find(c => c.population === 'edge' && c.kind === 'per-save'), pool.find(c => c.population === 'regression')];
  assert(commands.every(Boolean));
  assert.equal(commands.length, 16); assert.equal(new Set(commands.map(c => c.id)).size, 16);
  const arms = scope.policies.flatMap(policy => scope.implementations.map(implementation => ({ policy, implementation })));
  const tasks = commands.map((command, index) => {
    const calls = [];
    for (let repeat = 0; repeat < scope.repeats; repeat++) {
      const offset = (parseInt(digest(command.id).slice(0, 8), 16) + repeat) % arms.length;
      for (let order = 0; order < arms.length; order++) {
        const arm = arms[(offset + order) % arms.length];
        calls.push({ ...arm, repeat, order, phase: 'e2e', diagnostics: 'timing', commandId: command.id,
          callId: digest([scope.study, command.id, 'e2e', repeat, arm]) });
      }
    }
    // Worst-case: seven filters, two isolated capture-seed replays each.
    const overheadMs = scope.limits.startupMs + 2 * scope.limits.reapMs + 10000;
    const reservedMs = calls.length * (scope.limits.callMs + overheadMs) + scope.captureMs + overheadMs
      + 14 * (scope.replayMs + overheadMs);
    return { index, shard: index % scope.shards, command, calls, reservedMs };
  });
  const totalReservedHours = (tasks.reduce((n, t) => n + t.reservedMs, 0) + (scope.shards * 900 + 3600) * 1000) / 3600000;
  assert(totalReservedHours <= scope.maxRunnerHours);
  for (let shard = 0; shard < scope.shards; shard++) {
    assert(tasks.filter(t => t.shard === shard).reduce((n, t) => n + t.reservedMs, 0) <= 320 * 60000);
  }
  return { schema: 1, study: scope.study, population: scope.population, tasks,
    scheduleHash: digest(tasks), expectedE2E: tasks.reduce((n, t) => n + t.calls.length, 0),
    maxCaptureCalls: commands.length, maxReplayCalls: commands.length * 14, totalReservedHours };
}
