// Dry planning only: no solver, network, workflow dispatch or benchmark execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { hash } from '../secondary-bench/contracts.mjs';
import { triageCommands, triagePlan } from './planner.mjs';
const output = process.argv[2]; assert(output, 'new output directory required');
const scopePath = 'tools/fast-triage/SCOPE_20261017.json';
const scope = JSON.parse(fs.readFileSync(scopePath));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('branch', '--show-current'), scope.branch);
assert.equal(hash(fs.readFileSync(scope.sourceScope, 'utf8').replace(/\r\n/g, '\n')), scope.sourceScopeSha256);
const commands = triageCommands(scope, JSON.parse(fs.readFileSync(scope.sourceScope)));
const plan = triagePlan(scope, commands, commands.captures.map(command => ({ command, status: 'PENDING_REMOTE_CAPTURE' })));
const populations = {};
for (const c of commands.captures) populations[c.population] = (populations[c.population] ?? 0) + 1;
const summary = { status: 'LOCAL_PREPARATION_COMPLETE_REMOTE_PREFLIGHT_NOT_RUN', repository: scope.repository,
  branch: scope.branch, commit: git('rev-parse', 'HEAD'), scopeSha256: hash(fs.readFileSync(scopePath)),
  commands: commands.captures.length, populations, arms: scope.arms, mainCalls: plan.schedule.filter(c => c.phase === 'e2e').length,
  diagnosticCalls: plan.schedule.filter(c => c.phase === 'trace').length, preflightCalls: 24,
  captureCalls: commands.captures.length, measurementChunks: plan.chunks.length, maxParallel: scope.maxParallel,
  totalReservedRunnerHours: plan.totalReservedSeconds / 3600, reservationIsRuntimePrediction: false,
  scheduleHash: plan.scheduleHash, developmentNotFresh: true, release: false, solverCalls: 0 };
fs.mkdirSync(output, { recursive: false });
for (const [name, value] of Object.entries({ PREPARATION: summary, COMMANDS: commands, DRY_PLAN: plan })) {
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify(summary, null, 2));
