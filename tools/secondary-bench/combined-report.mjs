// One combined publication, but two explicitly separate experimental contracts.
// No solver calls, no imputation of timeout as a completion time.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, identity, ENGINES } from './contracts.mjs';
import { loadHistory } from './plan-wave.mjs';
import { reportCampaign } from './report-campaign.mjs';
import { isTimeout } from './campaign.mjs';

const median = values => {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y), mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const quantile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(q * values.length) - 1] : null;
const conditionId = row => `${row.inputId}::${row.engine}`;
function summarize(plan, rows) {
  const secondary = rows.filter(row => row.action === 'secondary' && row.execution), byCondition = new Map();
  for (const row of secondary) {
    const id = conditionId(row);
    if (!byCondition.has(id)) byCondition.set(id, []);
    byCondition.get(id).push(row);
  }
  const conditions = [...byCondition].map(([id, attempts]) => {
    const exact = attempts.filter(row => row.status === 'EXACT'), times = exact.map(row => row.ms);
    return { id, inputId: attempts[0].inputId, engine: attempts[0].engine,
      attempts: attempts.length, exact: exact.length, timeout: attempts.filter(row => isTimeout(row.status)).length,
      incomplete: attempts.filter(row => row.status === 'INCOMPLETE').length,
      other: attempts.filter(row => row.status !== 'EXACT' && row.status !== 'INCOMPLETE' && !isTimeout(row.status)).length,
      repeats: attempts.map(row => row.repeat).sort((a, b) => a - b),
      medianMs: median(times), minMs: times.length ? Math.min(...times) : null,
      maxMs: times.length ? Math.max(...times) : null, maxMinRatio: times.length >= 2 ? Math.max(...times) / Math.min(...times) : null,
      sourceLock: identity(plan.sourceFiles), allTimedOut: attempts.length >= plan.policy.initialRepeats && attempts.every(row => isTimeout(row.status)),
      runnerIds: [...new Set(attempts.map(row => row.runnerId))] };
  });
  const engines = ENGINES.map(engine => {
    const engineRows = secondary.filter(row => row.engine === engine), exact = engineRows.filter(row => row.status === 'EXACT');
    const measures = conditions.filter(c => c.engine === engine && c.medianMs !== null).map(c => c.medianMs);
    return { engine, attempts: engineRows.length, exact: exact.length, timeout: engineRows.filter(row => isTimeout(row.status)).length,
      incomplete: engineRows.filter(row => row.status === 'INCOMPLETE').length,
      conditionMedians: measures.length, medianOfConditionMediansMs: median(measures), p95OfConditionMediansMs: quantile(measures, 0.95),
      maxObservedExactMs: exact.length ? Math.max(...exact.map(row => row.ms)) : null,
      repeatCounts: Object.fromEntries([...new Set(conditions.filter(c => c.engine === engine).map(c => c.attempts))].sort((a, b) => a - b).map(n =>
        [n, conditions.filter(c => c.engine === engine && c.attempts === n).length])) };
  });
  const winners = Object.fromEntries(ENGINES.map(e => [e, 0])); let allThreeExact = 0;
  const fixtureIds = [...new Set(conditions.map(c => c.inputId))];
  for (const id of fixtureIds) {
    const eligible = conditions.filter(c => c.inputId === id && c.medianMs !== null);
    if (eligible.length !== 3) continue;
    allThreeExact++;
    const fastest = eligible.reduce((a, b) => a.medianMs <= b.medianMs ? a : b); winners[fastest.engine]++;
  }
  return { campaignId: plan.campaignId, variant: plan.campaignVariant ?? 'initial-1m', originUtc: plan.originUtc,
    timeoutSeconds: plan.limits.integrated.callMs / 1000, policy: plan.policy, attempts: secondary.length,
    fixtureCountWithAttempts: fixtureIds.length, engines, conditions,
    fastestObservedMedianAmongThreeProvenEngines: { allThreeExact, counts: winners,
      caveat: 'Information only, not a routing-policy gain or definitive censored-engine loss' } };
}
export function combineReports(firstPlanFile, firstHistory, secondPlanFile, secondHistory) {
  const firstPlan = readJson(firstPlanFile), secondPlan = readJson(secondPlanFile);
  assert.equal(secondPlan.campaignVariant, 'extended-5m');
  assert.equal(secondPlan.reuseCampaignId, firstPlan.campaignId);
  assert.equal(secondPlan.reuseSourceLock, identity(firstPlan.sourceFiles));
  assert.deepEqual(firstPlan.commands, secondPlan.commands);
  const firstRows = loadHistory(firstHistory, firstPlan).rows, secondRows = loadHistory(secondHistory, secondPlan).rows;
  const firstAudit = reportCampaign(firstPlan, firstHistory), secondAudit = reportCampaign(secondPlan, secondHistory);
  const exactWitnesses = new Map(), crossRunIssues = [];
  for (const row of [...firstRows, ...secondRows].filter(row => row.action === 'secondary' && row.status === 'EXACT')) {
    const witness = row.execution.result.verified;
    const signature = JSON.stringify({ selected: witness.selected, qualityHash: witness.qualityHash });
    if (exactWitnesses.has(row.inputId) && exactWitnesses.get(row.inputId) !== signature) crossRunIssues.push({ campaignId: row.campaignId, callId: row.callId, inputId: row.inputId });
    else exactWitnesses.set(row.inputId, signature);
  }
  const first = summarize(firstPlan, firstRows), second = summarize(secondPlan, secondRows);
  const extendedConditions = new Map(second.conditions.map(condition => [condition.id, condition]));
  const recovered = first.conditions.filter(c => c.allTimedOut && extendedConditions.get(c.id)?.exact > 0).map(c =>
    ({ inputId: c.inputId, engine: c.engine, shortAttempts: c.attempts, extended: extendedConditions.get(c.id) }));
  return { schema: 1, kind: 'COMBINED_INFORMATION_REPORT_TWO_SEPARATE_TIMEOUT_CONTRACTS',
    inputMatch: 'SAME_CAPTURED_ORIGINAL_ROWS_K_SEED_STABLE_IDS_BY_HASH', first, second,
    audit: { first: firstAudit, second: secondAudit, crossRunWitness: crossRunIssues.length ? 'FAIL' : 'AGREEMENT_FOR_RECORDED_EXACT_WITNESSES', crossRunIssues },
    recoveredAfterAllShortTimeouts: recovered,
    combinedExactCalls: first.engines.reduce((sum, e) => sum + e.exact, 0) + second.engines.reduce((sum, e) => sum + e.exact, 0),
    totalAttempts: first.attempts + second.attempts,
    warnings: ['60s and300s are separate conditions, not pooled latency samples',
      'Time budget and previous-two-timeouts create unequal repeat counts and censoring',
      'Complete-runner data are not new independent boards; mirror groups and aliases preserved',
      'Cross-engine agreement and product-engine exact proof are not a wholly independent large-matrix oracle',
      'Historical exposure audit means reserved is not automatically fresh validation',
      'No product routing changes or product performance PASS claimed'] };
}
export function combinedMarkdown(report) {
  const lines = ['# 3엔진 광범위 측정 — 통합 최종 보고서', '',
    `총 호출 **${report.totalAttempts}회**, exact 완료 **${report.combinedExactCalls}회**. 두 run은 같은 원행·K·seed·stable-ID 행렬을 사용한다.`, '',
    '## 실행 조건과 결과', '', '| run | timeout | 기본/최대 반복 | 추가 시작/총 예산 | 호출 |', '|---|---:|---|---|---:|'];
  for (const run of [report.first, report.second]) lines.push(`| ${run.campaignId} | ${run.timeoutSeconds}초 | ${run.policy.initialRepeats}/${run.policy.maxRepeats} | ${run.policy.extraAdmissionMs / 3600000}h/${run.policy.overallMs / 3600000}h | ${run.attempts} |`);
  for (const [run, audit] of [[report.first, report.audit.first], [report.second, report.audit.second]]) {
    lines.push('', `### ${run.timeoutSeconds}초 run`, '', `검산: ${audit.witnessAudit}; 수집 상태: ${audit.collectionState}.`, '',
      '| 엔진 | 호출 | exact | timeout | incomplete | 행렬별 중앙값의 중앙값(ms) |', '|---|---:|---:|---:|---:|---:|');
    for (const e of run.engines) lines.push(`| ${e.engine} | ${e.attempts} | ${e.exact} | ${e.timeout} | ${e.incomplete} | ${e.medianOfConditionMediansMs?.toFixed(2) ?? 'N/A'} |`);
    lines.push('', `세 엔진 모두 exact가 관측된 행렬 ${run.fastestObservedMedianAmongThreeProvenEngines.allThreeExact}개에서 가장 작은 관측 중앙값: ` +
      Object.entries(run.fastestObservedMedianAmongThreeProvenEngines.counts).map(([engine, count]) => `${engine} ${count}`).join(', ') + '.');
  }
  lines.push('', '## 두 run의 연결', '', `60초 run의 모든 반복이 timeout이었으나 300초 run에서 exact가 완료된 조건: **${report.recoveredAfterAllShortTimeouts.length}개**.`,
    `두 run exact witness 일치: ${report.audit.crossRunWitness}.`, '',
    '서로 다른 timeout의 시간 표본은 합쳐서 중앙값·변동을 계산하지 않았다. timeout/incomplete는 완료시간으로 넣지 않았다. 최초 기본 반복과 추가 반복·runner ID·누락·회수/OOM 오류는 JSON 부록에 보존했다.', '',
    '## 한계와 다음 단계', '',
    '- 현재 자료는 secondary-only fresh-process-cold 정보 수집이다. 새 Auto 분류 정책의 end-to-end·동시 요청 개선을 증명하지 않는다.',
    '- 행렬 선별은 명령당 비trivial save 하나이며 모든 save의 시간 분포를 대표하지 않는다.',
    '- 시간 상한·직전 두 timeout으로 반복 수가 다르다. 서로 다른 VM의 반복을 독립 보드 표본으로 세지 않는다.',
    '- 노출 감사에서 보류 그룹의 대부분이 과거 자료에 등장했다. 새로운 정책의 fresh 검증에는 추가 독립 데이터가 필요할 수 있다.',
    '- 제품 src/Rust/WASM 및 원본/main은 변경하지 않았다. 이 보고서는 제품 적용·성능 PASS 결정이 아니다.', '');
  return lines.join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [firstPlanFile, firstHistory, secondPlanFile, secondHistory, outputFile, markdownFile] = process.argv.slice(2);
  const report = combineReports(firstPlanFile, firstHistory, secondPlanFile, secondHistory);
  writeJson(outputFile, report); fs.writeFileSync(markdownFile, combinedMarkdown(report), { flag: 'wx' });
  console.log(JSON.stringify({ totalAttempts: report.totalAttempts, combinedExactCalls: report.combinedExactCalls,
    recoveredConditions: report.recoveredAfterAllShortTimeouts.length, crossRunWitness: report.audit.crossRunWitness }));
}
