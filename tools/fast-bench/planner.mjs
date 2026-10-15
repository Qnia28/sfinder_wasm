import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

export function commandPlan(scope) {
  const captures = scope.allCommands.map(c => ({ ...c, population: 'ALL' }));
  for (const c of scope.allCommands) {
    const copy = { ...c, id: c.id + '/per-save', kind: 'per-save', population: 'per-save' };
    delete copy.wantedSave; captures.push(copy);
  }
  for (const edge of scope.edgeCommands) {
    const base = scope.allCommands.find(c => c.id === edge.baseCommandId);
    const c = { ...base, ...edge, population: 'edge' };
    if (c.kind === 'per-save') {
      c.pattern = expandPatternCasesInternal(base.pattern).map(e => e.queue).sort()[0];
      assert.equal(typeof c.pattern, 'string'); delete c.wantedSave;
    }
    captures.push(c);
  }
  captures.push(...scope.regressionCommands.map(c => ({ ...c, population: 'regression' })));
  captures.forEach((c, captureIndex) => { c.captureIndex = captureIndex; });
  assert.equal(captures.length, 1113);
  assert.equal(new Set(captures.map(c => c.id)).size, captures.length);
  const base = new Set(scope.endToEndBaseCommandIds);
  const e2e = captures.filter(c => c.population === 'edge' || c.population === 'regression'
    || (c.population === 'ALL' ? base.has(c.id) : base.has(c.id.replace(/\/per-save$/, ''))));
  assert.equal(e2e.length, 273);
  return { captures, e2e: e2e.map(c => c.captureIndex) };
}

export function selectFixtures(scope, records) {
  const rank = f => digest(scope.selectionSeed + ':' + f.id);
  const sorted = fs => [...fs].sort((a, b) => rank(a).localeCompare(rank(b)));
  const all = records.flatMap(r => (r.result?.status === 'CAPTURED' ? r.result.filters : [])
    .filter(f => f.status === 'CAPTURED').map(f => ({ ...f, command: r.command, captureIndex: r.command.captureIndex,
      inputArtifact: r.inputArtifact }))).sort((a, b) => a.captureIndex - b.captureIndex || a.id.localeCompare(b.id));
  assert(all.every(f => f.inputArtifact?.id), 'unpublished captured matrix');
  const main = all.filter(f => ['ALL', 'regression'].includes(f.command.population));
  const eligible = all.filter(f => f.command.population === 'per-save' && f.features.nontrivial && !f.primaryHard);
  const cells = [], cellOf = f => [f.features.d <= 8 ? 0 : f.features.d <= 16 ? 1 : f.features.d <= 24 ? 2 : 3,
    f.features.u <= 127 ? 0 : f.features.u <= 511 ? 1 : 2,
    f.command.family === 'restricted-split' ? 1 : 0, f.features.previewEligible ? 1 : 0].join(':');
  for (let d = 0; d < 4; d++) for (let u = 0; u < 3; u++) for (let family = 0; family < 2; family++)
    for (let p = 0; p < 2; p++) {
      const key = [d, u, family, p].join(':');
      cells.push({ key, candidates: sorted(eligible.filter(f => cellOf(f) === key)), selected: [] });
    }
  const counts = new Map(), chosen = new Set();
  const take = cell => {
    const f = cell.candidates.find(f => !chosen.has(f.id) && (counts.get(f.command.mirrorGroup) ?? 0) < 4);
    if (!f) return false;
    chosen.add(f.id); cell.selected.push(f); counts.set(f.command.mirrorGroup, (counts.get(f.command.mirrorGroup) ?? 0) + 1); return true;
  };
  for (const cell of cells) for (let n = 0; n < 8; n++) if (!take(cell)) break;
  while (chosen.size < 384) {
    let progress = false;
    for (const cell of cells) { if (chosen.size === 384) break; progress = take(cell) || progress; }
    if (!progress) break;
  }
  const persave = cells.flatMap(c => c.selected); main.push(...persave);
  const supplemental = [], groups = new Map();
  const add = f => {
    if (!f || supplemental.some(s => s.id === f.id) || (groups.get(f.command.mirrorGroup) ?? 0) >= 4) return false;
    supplemental.push(f); groups.set(f.command.mirrorGroup, (groups.get(f.command.mirrorGroup) ?? 0) + 1); return true;
  };
  add(main.find(f => f.command.population === 'regression' && !f.primaryHard && f.features.previewEligible));
  function fill(pool, target) {
    const queues = [sorted(pool.filter(f => f.command.population !== 'per-save')), sorted(pool.filter(f => f.command.population === 'per-save'))];
    let side = 0;
    while (supplemental.filter(f => pool.includes(f)).length < target && queues.some(q => q.length)) {
      const q = queues[side++ % 2]; if (q.length) add(q.shift());
    }
  }
  const nonhard = main.filter(f => !f.primaryHard);
  fill(nonhard.filter(f => f.features.previewEligible), 48);
  fill(nonhard.filter(f => !f.features.previewEligible), 48);
  fill(nonhard, 96);
  const trace = [];
  for (const isSave of [false, true]) {
    const pool = sorted(main.filter(f => (f.command.population === 'per-save') === isSave));
    const easy = pool.filter(f => f.features.d <= 8 && f.features.previewEligible);
    if (!isSave) {
      const g = pool.find(f => f.command.population === 'regression');
      if (g) { const i = easy.indexOf(g); if (i >= 0) easy.splice(i, 1); easy.unshift(g); }
    }
    const pick = easy.slice(0, 8);
    pick.push(...pool.filter(f => !easy.includes(f)).slice(0, 8));
    pick.push(...pool.filter(f => !pick.includes(f)).slice(0, 16 - pick.length));
    trace.push(...pick);
  }
  return { main, supplemental: supplemental.map(f => f.id), trace: trace.map(f => f.id),
    strata: cells.map(c => ({ key: c.key, population: c.candidates.length, selected: c.selected.map(f => f.id) })),
    denominator: { captured: all.length, perSaveEligible: eligible.length, perSaveSelected: persave.length } };
}

export function measurementPlan(scope, commands, records) {
  const selection = selectFixtures(scope, records), tasks = new Map(), schedule = [];
  const get = index => {
    if (!tasks.has(index)) tasks.set(index, { id: 'command-' + index, command: commands.captures[index],
      capture: records.find(r => r.command.captureIndex === index), calls: [], reservationSeconds: 0 });
    return tasks.get(index);
  };
  function block(task, phase, fixture, arms, repeat, trace) {
    const offset = (parseInt(digest((fixture?.id ?? task.command.id) + ':' + phase).slice(0, 8), 16) + repeat) % arms.length;
    const order = [...arms.slice(offset), ...arms.slice(0, offset)];
    for (const arm of order) {
      const call = { callId: digest([phase, fixture?.id ?? task.command.id, repeat, arm, trace]),
        phase, fixture, arm, repeat, trace, order: order.indexOf(arm),
        reservationSeconds: phase === 'e2e' ? 220 : 100 };
      task.calls.push(call); task.reservationSeconds += call.reservationSeconds;
      schedule.push({ ...call, fixture: fixture ? { id: fixture.id, sha256: fixture.sha256 } : null, taskId: task.id });
    }
  }
  for (const f of selection.main) {
    const task = get(f.captureIndex), arms = scope.matrixArms.map(a => a.id);
    if (selection.supplemental.includes(f.id)) arms.push(...scope.supplementalMatrixArms.map(a => a.id));
    for (let r = 0; r < 3; r++) block(task, 'matrix', f, arms, r, true);
    if (selection.trace.includes(f.id)) for (let r = 0; r < 2; r++) for (const trace of [true, false])
      block(task, 'trace', f, scope.traceScreen.arms, r, trace);
  }
  for (const index of commands.e2e) {
    const task = get(index);
    for (let r = 0; r < 3; r++) block(task, 'e2e', null, scope.endToEndArms, r, false);
  }
  // Whole command groups keep repeated inputs local and OOM suppression across repeats.
  const scheduleById = new Map(schedule.map(c => [c.callId, c]));
  const units = [];
  for (const task of tasks.values()) {
    const groups = new Map();
    for (const call of task.calls) {
      const key = call.fixture?.id ?? 'e2e';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(call);
    }
    let part = 0, current;
    for (const calls of groups.values()) {
      const seconds = calls.reduce((s, c) => s + c.reservationSeconds, 0);
      if (!current || current.reservationSeconds + seconds > 18000) {
        current = { ...task, id: task.id + '-part-' + part++, calls: [], reservationSeconds: 0 }; units.push(current);
      }
      current.calls.push(...calls); current.reservationSeconds += seconds;
      for (const call of calls) scheduleById.get(call.callId).taskId = current.id;
    }
  }
  const chunks = [];
  for (const task of units.sort((a, b) => b.reservationSeconds - a.reservationSeconds || a.id.localeCompare(b.id))) {
    assert(task.reservationSeconds <= 18000, 'one command exceeds five-hour reservation');
    let chunk = chunks.find(c => c.reservationSeconds + task.reservationSeconds <= 18000);
    if (!chunk) { chunk = { index: chunks.length, tasks: [], reservationSeconds: 0 }; chunks.push(chunk); }
    chunk.tasks.push(task); chunk.reservationSeconds += task.reservationSeconds;
  }
  assert(chunks.length <= 256);
  assert(schedule.length <= scope.slots.matrix + scope.slots.traceScreen + scope.slots.endToEnd);
  return { selection, chunks, schedule, scheduleHash: digest(schedule),
    reservationSeconds: chunks.reduce((s, c) => s + c.reservationSeconds, 0) };
}
