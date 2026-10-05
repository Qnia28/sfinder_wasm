// Offline join, not a benchmark or classifier. Original matrices/raw remain unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, hash, identity, validateFixture } from './contracts.mjs';
import { filesUnder, chooseFixtures } from './plan-wave.mjs';
import { validateCampaign } from './campaign.mjs';

export function originalStructure(fixture) {
  validateFixture(fixture);
  const forced = new Set(fixture.rows.filter(row => row.length === 1).map(row => row[0][0]));
  const result = { n: fixture.keys.length, K: fixture.K, R: fixture.rows.length,
    E: fixture.rows.reduce((sum, row) => sum + row.length, 0), F: forced.size,
    d: fixture.K - forced.size, u: fixture.keys.length - forced.size };
  assert(result.d >= 0 && result.u >= 0);
  for (const id of forced) assert(fixture.seed.includes(id), 'original singleton absent from feasible primary seed');
  const mapping = { n: 'candidateCount', K: 'count', R: 'rowCount', E: 'entryCount',
    F: 'forcedCount', d: 'unforcedSlots', u: 'unforcedCandidates' };
  for (const [key, recordedKey] of Object.entries(mapping)) if (fixture.structure?.[recordedKey] != null)
    assert.equal(result[key], fixture.structure[recordedKey], 'captured structure differs: ' + key);
  return { ...result, capturedF: fixture.structure?.forcedCount ?? null,
    capturedD: fixture.structure?.unforcedSlots ?? null, capturedU: fixture.structure?.unforcedCandidates ?? null,
    FSource: 'OFFLINE_ORIGINAL_SINGLETON_SCAN_NOT_PRIMARY_KERNEL' };
}
const META = ['fixtureId', 'commandId', 'setupId', 'fumen', 'pattern', 'family', 'save', 'mirrorGroup',
  'commandKind', 'wantedSave', 'filterSemantics', 'primaryHard', 'primaryBackend', 'primaryKernelStats', 'tinyEligible',
  'clear', 'hold', 'piecesNeeded', 'queueLength', 'savedPieceCount', 'n', 'K', 'R', 'E', 'F', 'd', 'u',
  'capturedF', 'capturedD', 'capturedU', 'FSource', 'selectedForMeasurement', 'trivial', 'fixtureSha256', 'fixtureFile'];
const CSV = value => {
  if (value == null) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
};
function table(directory, name, columns) {
  const csvFile = path.join(directory, name + '.csv'), jsonFile = path.join(directory, name + '.jsonl');
  const csv = fs.openSync(csvFile, 'wx'), json = fs.openSync(jsonFile, 'wx'); let rows = 0;
  fs.writeSync(csv, columns.join(',') + '\n');
  return { add(row) { fs.writeSync(csv, columns.map(c => CSV(row[c])).join(',') + '\n');
    fs.writeSync(json, JSON.stringify(row) + '\n'); rows++; },
  close() { fs.fsyncSync(csv); fs.fsyncSync(json); fs.closeSync(csv); fs.closeSync(json);
    return { name, rows, files: [csvFile, jsonFile].map(filename => ({ file: path.basename(filename),
      bytes: fs.statSync(filename).size, sha256: hash(fs.readFileSync(filename)) })) }; } };
}
const commandMeta = c => ({ commandId: c.id, setupId: c.id.split('/')[0], fumen: c.sourceFumen,
  commandKind: c.kind, wantedSave: c.wantedSave ?? null,
  filterSemantics: c.kind === 'per-save' ? 'QUEUE_REMAINDER_ONE_PIECE_NOT_GENERIC_SAVES_EXPRESSION' : 'LAST_BAG_EXACT_MULTIPLICITY_EXPRESSION',
  pattern: c.pattern, family: c.family, mirrorGroup: c.mirrorGroup ?? null, clear: c.clear, hold: c.useHold,
  piecesNeeded: c.piecesNeeded, queueLength: c.queueLength, savedPieceCount: c.savedPieceCount });
export function exportClassifierRaw(firstRoot, secondRoot, outputDir, { workspace = process.cwd(), databaseDir = 'tools/secondary-bench/setupdata' } = {}) {
  assert(!fs.existsSync(outputDir), 'export needs a NEW directory');
  fs.mkdirSync(outputDir, { recursive: true });
  const relative = filename => path.relative(workspace, path.resolve(filename)).replaceAll('\\', '/');
  const firstPlanFile = path.join(firstRoot, 'basic-two-plan', 'campaign.json');
  const secondPlanFile = path.join(secondRoot, 'basic-four-plan', 'campaign.json');
  const first = validateCampaign(readJson(firstPlanFile)), second = validateCampaign(readJson(secondPlanFile));
  assert.deepEqual(first.commands, second.commands); assert.equal(second.reuseCampaignId, first.campaignId);
  assert.equal(second.reuseSourceLock, identity(first.sourceFiles));
  const commands = new Map(first.commands.map(c => [c.id, c]));
  const firstFiles = filesUnder(path.join(firstRoot, 'full-history'));
  const selected = chooseFixtures(first, firstFiles).selected;
  assert.deepEqual(selected.map(({ id, sha256 }) => ({ id, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
    [...second.reusedFixtureLock].sort((a, b) => a.id.localeCompare(b.id)));
  const selectedIds = new Set(selected.map(f => f.id)), metadata = new Map(), inputFiles = [];
  const fixtureTable = table(outputDir, 'fixtures', META);
  // ONLY capture artifacts are original acquisition, not selected fixture copies.
  for (const filename of firstFiles.filter(f => /[\\/]secondary-results-capture-[^\\/]+[\\/]/.test(f)
      && /[\\/]fixtures[\\/][^\\/]+\.json$/.test(f)).sort()) {
    const bytes = fs.readFileSync(filename), fixture = JSON.parse(bytes.toString('utf8'));
    const sha256 = hash(bytes), command = commands.get(fixture.origin.command.id);
    assert(command, 'foreign fixture command'); assert.deepEqual(fixture.origin.command, command);
    if (metadata.has(fixture.id)) { assert.equal(metadata.get(fixture.id).fixtureSha256, sha256); continue; }
    const row = { fixtureId: fixture.id, ...commandMeta(command), save: fixture.origin.filter,
      primaryHard: fixture.primaryHard ?? null, primaryBackend: fixture.cardinalityProof.backend,
      primaryKernelStats: fixture.cardinalityProof.kernelStats ?? null, tinyEligible: fixture.keys.length <= 48,
      ...originalStructure(fixture), selectedForMeasurement: selectedIds.has(fixture.id), trivial: fixture.trivial ?? null,
      fixtureSha256: sha256, fixtureFile: relative(filename) };
    metadata.set(fixture.id, row); fixtureTable.add(row);
    inputFiles.push({ file: relative(filename), sha256, kind: 'ORIGINAL_CAPTURE_FIXTURE' });
  }
  assert.equal([...metadata.values()].filter(f => f.selectedForMeasurement).length, selected.length);
  for (const f of selected) assert.equal(metadata.get(f.id).fixtureSha256, f.sha256);
  const calls = table(outputDir, 'calls', [...META, 'campaignId', 'runId', 'sourceLock', 'timeoutMs', 'phase', 'stage',
    'engine', 'repeat', 'callId', 'position', 'chunkId', 'runnerId', 'executed', 'status', 'ms', 'reaped',
    'cpLimitMs', 'childResponseMs', 'initMs', 'fixtureMs', 'packingMs', 'wrapperNativeAndSearchMs', 'modelAndSearchMs',
    'auditMs', 'cleanupMs', 'searchedStates', 'statesMeaning', 'cpuUserUs', 'cpuSystemUs', 'maxRssKiB', 'oomKillsBefore', 'oomKillsAfter',
    'runnerNode', 'runnerCpuModels', 'memoryMax', 'swapMax', 'scopeStartedUtc', 'scopeFinishedUtc',
    'rawFile', 'rawLine', 'eventsFile', 'stdoutFile', 'stderrFile', 'runnerFile']);
  const captures = table(outputDir, 'capture_commands', ['commandId', 'setupId', 'fumen', 'pattern', 'family', 'mirrorGroup',
    'clear', 'hold', 'piecesNeeded', 'queueLength', 'savedPieceCount', 'status', 'capturedFixtures', 'filters', 'rawFile', 'rawLine']);
  const stats = {}, seen = new Set(), captureIds = new Set();
  for (const [root, plan] of [[firstRoot, first], [secondRoot, second]]) {
    const runId = String(path.basename(root).replace('campaign-', ''));
    stats[runId] = { executed: 0, notRun: 0, statuses: {}, initial: 0, additional: 0 };
    for (const filename of filesUnder(path.join(root, 'full-history')).filter(f => path.basename(f) === 'raw.jsonl').sort()) {
      const bytes = fs.readFileSync(filename); inputFiles.push({ file: relative(filename), sha256: hash(bytes), kind: 'ORIGINAL_RAW' });
      const directory = path.dirname(filename), runnerFile = path.join(directory, 'RUN_LOCK.json'), completeFile = path.join(directory, 'COMPLETE.json');
      const runner = fs.existsSync(runnerFile) ? readJson(runnerFile) : null;
      const complete = fs.existsSync(completeFile) ? readJson(completeFile) : null;
      for (const [index, line] of bytes.toString('utf8').split(/\r?\n/).entries()) {
        if (!line) continue;
        const raw = JSON.parse(line);
        assert.equal(raw.campaignId, plan.campaignId); assert.equal(raw.sourceLock, identity(plan.sourceFiles));
        if (raw.action === 'capture') {
          assert.equal(plan.campaignId, first.campaignId); assert(!captureIds.has(raw.inputId)); captureIds.add(raw.inputId);
          const command = commands.get(raw.inputId); assert(command);
          captures.add({ ...commandMeta(command), status: raw.status, capturedFixtures: raw.execution?.result?.fixtures?.length ?? null,
            filters: raw.execution?.result?.filters ?? null, rawFile: relative(filename), rawLine: index + 1 }); continue;
        }
        assert.equal(raw.action, 'secondary');
        const f = metadata.get(raw.inputId); assert(f?.selectedForMeasurement, 'unselected measurement');
        const unique = `${plan.campaignId}/${raw.inputId}/${raw.engine}/${raw.repeat}`;
        assert(!seen.has(unique), 'duplicate raw repetition including NOT_RUN'); seen.add(unique);
        const executed = raw.execution !== undefined;
        const result = raw.execution?.result, timings = result?.timings ?? {};
        if (raw.status !== 'EXACT') assert.equal(raw.ms, null);
        if (executed) assert.equal(raw.condition.fixtureSha256, f.fixtureSha256);
        const logFile = suffix => { const target = path.join(directory, raw.callId + suffix); return fs.existsSync(target) ? relative(target) : null; };
        const row = { ...f, campaignId: plan.campaignId, runId, sourceLock: raw.sourceLock,
          timeoutMs: plan.limits[raw.engine].callMs, phase: raw.repeat <= plan.policy.initialRepeats ? 'INITIAL' : 'ADDITIONAL',
          stage: raw.stage, engine: raw.engine, repeat: raw.repeat, callId: raw.callId, position: raw.position ?? null,
          chunkId: raw.chunkId, runnerId: raw.runnerId, executed, status: raw.status, ms: raw.ms,
          reaped: raw.execution?.reaped ?? null, cpLimitMs: raw.engine === 'cpsat' ? plan.cpLimitMs : null,
          childResponseMs: result?.responseMs ?? null,
           ...Object.fromEntries(['initMs', 'fixtureMs', 'packingMs', 'wrapperNativeAndSearchMs', 'modelAndSearchMs', 'auditMs', 'cleanupMs'].map(k => [k, timings[k] ?? null])),
          searchedStates: raw.engine === 'cpsat' ? null : result?.result?.searchedStates ?? null,
          statesMeaning: raw.engine === 'cpsat' ? 'UNOBSERVED_CP_SEARCH_STATES_ZERO_IS_NOT_A_MEASUREMENT' : 'RETURNED_COMPLETED_OR_BOUNDED_RUST_STATES',
          cpuUserUs: result?.cpuUs?.user ?? null, cpuSystemUs: result?.cpuUs?.system ?? null, maxRssKiB: result?.maxRssKiB ?? null,
          oomKillsBefore: raw.execution?.memoryEvents?.beforeOom ?? null, oomKillsAfter: raw.execution?.memoryEvents?.afterOom ?? null,
          runnerNode: runner?.environment.node ?? null, runnerCpuModels: runner?.environment.cpuModels ?? null,
          memoryMax: runner?.memoryScope.memoryMax ?? null, swapMax: runner?.memoryScope.swapMax ?? null,
          scopeStartedUtc: runner?.startedUtc ?? null, scopeFinishedUtc: complete?.finishedUtc ?? null,
          rawFile: relative(filename), rawLine: index + 1, eventsFile: logFile('.events.jsonl'), stdoutFile: logFile('.stdout.log'),
          stderrFile: logFile('.stderr.log'), runnerFile: runner ? relative(runnerFile) : null };
        calls.add(row); const s = stats[runId]; s.statuses[row.status] = (s.statuses[row.status] ?? 0) + 1;
        s[executed ? 'executed' : 'notRun']++; if (executed) s[row.phase === 'INITIAL' ? 'initial' : 'additional']++;
      }
    }
  }
  assert.equal(captureIds.size, commands.size, 'capture command missing');
  const decisions = table(outputDir, 'wave_decisions', [...META, 'campaignId', 'runId', 'engine', 'stage', 'plannedUtc', 'eligible', 'reason', 'repeats', 'planFile']);
  const decisionKeys = new Set();
  for (const [root, plan] of [[firstRoot, first], [secondRoot, second]])
    for (const filename of filesUnder(path.join(root, 'all-wave-plans')).filter(f => path.basename(f) === 'WAVE_PLAN.json').sort()) {
      const wave = readJson(filename); inputFiles.push({ file: relative(filename), sha256: hash(fs.readFileSync(filename)), kind: 'ORIGINAL_WAVE_PLAN' });
      assert.equal(wave.campaignId, plan.campaignId);
       for (const decision of wave.decisions) {
         const f = metadata.get(decision.inputId); assert(f?.selectedForMeasurement);
         assert(['integrated', 'threshold', 'cpsat'].includes(decision.engine), 'wave decision engine missing');
         const key = `${plan.campaignId}/${decision.inputId}/${decision.engine}/${wave.stage}`;
         assert(!decisionKeys.has(key), 'duplicate engine/fixture/stage decision'); decisionKeys.add(key);
         decisions.add({ ...f, campaignId: plan.campaignId, runId: path.basename(root).replace('campaign-', ''), stage: wave.stage,
           engine: decision.engine,
          plannedUtc: wave.plannedUtc, eligible: decision.eligible, reason: decision.reason, repeats: decision.repeats ?? null, planFile: relative(filename) });
      }
    }
  const db = new Map();
  for (const filename of filesUnder(databaseDir).filter(f => f.endsWith('.json'))) for (const entry of readJson(filename))
    db.set(path.basename(filename) + '/' + entry.id, entry);
  const aliases = table(outputDir, 'aliases', ['commandId', 'representativeSetupId', 'representativeFumen', 'pattern', 'family', 'mirrorGroup',
    'aliasId', 'database', 'aliasFumen', 'aliasBoardHex', 'sameFumenAsMeasuredInput', 'separateMeasurement']);
  for (const command of first.commands) for (const alias of command.sourceAliases ?? []) {
    const original = db.get(alias.source + '/' + alias.id); assert(original, 'alias missing from original database');
    aliases.add({ commandId: command.id, representativeSetupId: command.id.split('/')[0], representativeFumen: command.sourceFumen,
      pattern: command.pattern, family: command.family, mirrorGroup: command.mirrorGroup, aliasId: alias.id, database: alias.source,
      aliasFumen: original.fumen, aliasBoardHex: alias.boardHex, sameFumenAsMeasuredInput: original.fumen === command.sourceFumen,
      separateMeasurement: false });
  }
  const tables = [fixtureTable, calls, captures, decisions, aliases].map(t => t.close());
  const manifest = { schema: 1, kind: 'LOSSLESS_IDENTIFIERS_AND_PER_CALL_SCALARS_JOIN_NOT_AGGREGATED_TIMINGS',
    workspace: path.resolve(workspace), firstCampaign: first.campaignId, secondCampaign: second.campaignId,
    selectedFixtures: selected.length, allCapturedFixtures: metadata.size, captureCommands: captureIds.size, runs: stats, tables,
    inputPlans: [firstPlanFile, secondPlanFile].map(file => ({ file: relative(file), sha256: hash(fs.readFileSync(file)) })),
    originalInputFiles: inputFiles, originalRawModified: false,
    unmeasuredSaveFilters: 'IN_FIXTURES_TABLE_SELECTED_FALSE_NO_INVENTED_ENGINE_ROWS',
    unknownCapturedSingletonValues: [...metadata.values()].filter(f => f.capturedF === null).length,
    aliasWarning: 'aliases are linkage only, not independent engine measurements or mirrored-pattern runtime evidence' };
  writeJson(path.join(outputDir, 'MANIFEST.json'), manifest);
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [firstRoot, secondRoot, outputDir] = process.argv.slice(2);
  const manifest = exportClassifierRaw(firstRoot, secondRoot, outputDir);
  console.log(JSON.stringify({ outputDir, selectedFixtures: manifest.selectedFixtures, allCapturedFixtures: manifest.allCapturedFixtures,
    tables: manifest.tables.map(t => ({ name: t.name, rows: t.rows })), runs: manifest.runs }));
}
