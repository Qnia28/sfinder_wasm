// Final report generator. Initial100 and outcome-selected retest66 remain
// separate; it never replaces an initial estimate with whichever looks better.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';
const firstBytes = readFileSync(new URL('./reports/expanded100.json', import.meta.url));
const first = JSON.parse(firstBytes), retest = JSON.parse(readFileSync(new URL('./reports/retest10.json', import.meta.url)));
const selected = JSON.parse(readFileSync(new URL('./retest-selection.json', import.meta.url)));
const execution = JSON.parse(readFileSync(new URL('./reports/vm-execution.json', import.meta.url)));
assert.equal(selected.sourceReportHash, sha256(firstBytes));
assert.equal(retest.manifestHash, first.manifestHash);
assert.equal(retest.wasmHashes.experiment, first.wasmHashes.experiment);
assert.equal(retest.pairs, 10); assert.equal(retest.perCase.length, selected.cases.length);
const median = xs => {
  const a = [...xs].sort((a, b) => a - b), at = Math.floor(a.length / 2);
  return a.length % 2 ? a[at] : (a[at - 1] + a[at]) / 2;
};
const initialById = new Map(first.perCase.map(c => [c.caseId, c]));
const rows = retest.perCase.map(c => {
  const before = initialById.get(c.caseId); assert(before);
  const reasons = selected.cases.find(s => s.caseId === c.caseId).reasons;
  const complete = c.paired.filter(p => p.speedup !== null);
  const pairedDeltaMs = complete.length ? median(complete.map(p => p.onMs - p.offMs)) : null;
  const pairedRegression = c.pairedSpeedupMedian !== null && c.pairedSpeedupMedian <= 1 / 1.1 && pairedDeltaMs >= 5;
  return { caseId: c.caseId, reasons, initialRatio: before.pairedSpeedupMedian, retestRatio: c.pairedSpeedupMedian,
    initialRegressionFlag: before.regressionReview, retestRegressionFlag: c.regressionReview,
    pairedRegression, pairedDeltaMs, offExact: c.leftExact, onExact: c.rightExact,
    offSpread: c.offSpread, onSpread: c.onSpread, ratioSpread: c.ratioSpread,
    fasterPairs: c.fasterPairs, slowerPairs: c.slowerPairs,
    noisy: [c.offSpread, c.onSpread, c.ratioSpread].some(s => s !== null && s >= 0.1),
    directionChanged: before.pairedSpeedupMedian !== null && c.pairedSpeedupMedian !== null
      && (before.pairedSpeedupMedian > 1) !== (c.pairedSpeedupMedian > 1) };
});
const summary = { initial: first.stats, retest: retest.stats,
  retested: rows.length, stillNoisy: rows.filter(r => r.noisy).length,
  directionChanges: rows.filter(r => r.directionChanged).map(r => r.caseId),
  initialRegressionFollowup: rows.filter(r => r.initialRegressionFlag).map(r => ({
    caseId: r.caseId, initialRatio: r.initialRatio, retestRatio: r.retestRatio,
    pairedDeltaMs: r.pairedDeltaMs, sideMedianFlag: r.retestRegressionFlag, pairedRegression: r.pairedRegression,
    noisy: r.noisy })),
  retestPairedRegressions: rows.filter(r => r.pairedRegression).map(r => r.caseId),
  repeatedGains: rows.filter(r => r.retestRatio >= 1.1 && r.fasterPairs >= 8).map(r => r.caseId),
  note: 'Retest66 is selected using initial effects/noise, not an independent representative 100-case run. Do not pool or cherry-pick first/retest ratios. Range-based noise threshold is descriptive, not a statistical significance test.' };
writeFileSync(new URL('./reports/expanded-final-review.json', import.meta.url), JSON.stringify({ summary, rows }, null, 2) + '\n');
const ratio = n => n === null ? '—' : n.toFixed(3);
const percent = n => n === null ? '—' : `${(n * 100).toFixed(1)}%`;
const md = [
  '# Threshold 확대 검증 최종 보고: 100행렬 + 선택66행렬 10회 재테스트',
  '',
  '## 결론과 범위',
  '',
  '**currentPropagation(mask16)은 일부 입력에서 개선을 보이나 모든 입력을 개선하지 않는다. 자동 통합·기본값 변경은 하지 않는다.**',
  `최초100에서는 양측 완료80개 중57개에서 향상이 관찰됐다. 선정66개를10회 재테스트한 결과는45개 향상/21개 악화이며, 1.10배 이상인10개는 모두8회 이상 빨랐다. 최초 회귀경보3개는 동일 경보기준으로 재현되지 않았다.`,
  `다만${summary.stillNoisy}개는 반복편차가10% 이상이고 ${summary.directionChanges.length}개는 속도방향이 바뀌었다. 따라서 작은 차이는 확정적 효과라고 주장하지 않는다.`,
  '로컬 dev와 원격 main은 수정하지 않았다. 실험 브랜치에서만 실행·보고한다.',
  '',
  `- 최초100: [run ${first.runId}](${first.url}), 입력별5쌍, OFF/ON각5회, 호출당300초.`,
  `- 재테스트${rows.length}: [run ${retest.runId}](${retest.url}), 입력별10쌍, OFF/ON각10회, 호출당300초.`,
  '- 같은 experimental WASM의 OFF(mask0)/ON(mask16)을 동일 VM에서 직렬 AB/BA 비교. 입력별 최대20VM 병렬.',
  `- 실제 측정step의 최대 동시실행: 최초${execution.runs[0].maxSimultaneousBenchmarkSteps}VM, 재측정${execution.runs[1].maxSimultaneousBenchmarkSteps}VM. 측정 구간은 각각${execution.runs[0].benchmarkWindowMinutes.toFixed(1)}분/${execution.runs[1].benchmarkWindowMinutes.toFixed(1)}분(전체workflow 대기·CI시간과는 구분).`,
  '- 재테스트의 Rust/제품JS/실험WASM/입력hash는 최초100과 동일. 완료 witness는 원본행과 최초실행hash로 재검산.',
  '- 100개 ID는99개 핵심행렬/41개 보드·반전그룹이다. grace-system-a/O와b/O는중복이며 사용자지시에따라 유지했다.',
  '- 최초20확인의 original↔candidate 비교와 이번 same-binary OFF↔ON 비교는 다른실험이다. 비율을합산하지않는다.',
  '',
  '## 최초100 전체결과 (재테스트로 대체하지 않음)',
  '',
  `- ${first.stats.samples}호출: EXACT ${first.stats.exact}, TIMEOUT ${first.stats.timeout}; OFF완료 ${first.stats.offExact}/500, ON완료 ${first.stats.onExact}/500.`,
  `- 양측완료80개 중57개향상,23개악화. 속도비≥1.10은23개, 시간감소≥10%는22개.`,
  `- 완료80의 paired-median비율 기하평균 ${first.stats.geomeanCompletedRatios.toFixed(3)}배. 100전체비율이아니다.`,
  '- ON-only완료1개(pcinfo032/Z, 5회모두약294~298초), 양측timeout19개. OFF-only완료없음.',
  '- ON-only입력의witness는검산됐지만 완료한OFF최적해와교차확인하지못했다. 5분경계에가까워추가완료를일반화하지않는다.',
  `- 기존회귀경보3개: ${first.stats.regressionReview.join(', ')}. 메모리20%증가경보없음.`,
  '',
  '## 재테스트 선정',
  '',
  `- 양측5쌍완료80개의OFF/ON속도비 상위/하위10%(R7): P90=${selected.cutoff.p90Speedup.toFixed(6)}, P10=${selected.cutoff.p10Speedup.toFixed(6)}; 각8개.`,
  '- 반복편차는 (최대−최소)/중앙값이며 OFF nativeMs, ON nativeMs, paired비율중하나라도≥10%를선정했다.',
  `- 극단성능·편차합집합${rows.length}개. 성과기반선정이므로 새로운무작위검증군/전체100재실행이아니다.`,
  '- timeout을300초완료시간으로대체하지않았다. 기존중복/입력은교체하지않았다.',
  '',
  '## 10회 재테스트 결과',
  '',
  `- ${retest.stats.samples}호출: EXACT ${retest.stats.exact}, TIMEOUT ${retest.stats.timeout}.`,
  `- OFF완료 ${retest.stats.offExact}/${rows.length * 10}, ON완료 ${retest.stats.onExact}/${rows.length * 10}.`,
  `- 양측완료${retest.stats.pairedCompleteMatrices}개: 향상${retest.stats.fasterMatrices}개, 악화${retest.stats.slowerMatrices}개; 완료군기하평균 ${ratio(retest.stats.geomeanCompletedRatios)}배.`,
  `- 10회에서도편차≥10%인입력 ${summary.stillNoisy}/${rows.length}. 최초와속도방향이바뀐입력 ${summary.directionChanges.length}개.`,
  `- side별시간중앙값기준회귀경보: ${retest.stats.regressionReview.join(', ') || '없음'}.`,
  `- 같은pair시간차중앙값≥5ms이면서paired비율로ON시간≥10%증가인회귀: ${summary.retestPairedRegressions.join(', ') || '없음'}.`,
  '- 두회귀기준은다를수있다: OFF시간중앙값/ON시간중앙값의비율과 개별paired비율중앙값은동일한통계량이아니다.',
  '- 편차는 range 기반이라 5회보다10회에서 극단값을 포함할 기회도 늘어난다. 편차가 줄지 않았다는 사실만으로 구현이 불안정하다고 단정하지 않는다.',
  '',
  '### 1.10배 이상 + 8/10회 이상 ON이 빠른 입력',
  '',
  '| 입력 | 최초비율 | 재측정비율 | 빠른pair | OFF 중앙값(ms) | ON 중앙값(ms) |',
  '|---|---:|---:|---:|---:|---:|',
  ...retest.perCase.filter(c => summary.repeatedGains.includes(c.caseId)).map(c =>
    `| ${c.caseId} | ${ratio(initialById.get(c.caseId).pairedSpeedupMedian)} | ${ratio(c.pairedSpeedupMedian)} | ${c.fasterPairs}/10 | ${c.leftMedianMs.toFixed(2)} | ${c.rightMedianMs.toFixed(2)} |`),
  '',
  '### 최초 P90 개선·악화 입력의 후속 결과',
  '',
  '| 입력 | 최초 선정 | 최초비율 | 재측정비율 | 빠른pair |',
  '|---|---|---:|---:|---:|',
  ...rows.filter(r => r.reasons.some(s => s.startsWith('p90-'))).map(r =>
    `| ${r.caseId} | ${r.reasons.includes('p90-fast') ? '개선 상위10%' : '악화 상위10%'} | ${ratio(r.initialRatio)} | ${ratio(r.retestRatio)} | ${r.fasterPairs}/10 |`),
  '',
  '### 최초 회귀3개의 재현 여부',
  '',
  '| 입력 | 최초비율 | 재측정비율 | paired ΔON−OFF(ms) | side회귀경보 | paired회귀 | 편차≥10% |',
  '|---|---:|---:|---:|---|---|---|',
  ...summary.initialRegressionFollowup.map(r => `| ${r.caseId} | ${ratio(r.initialRatio)} | ${ratio(r.retestRatio)} | ${r.pairedDeltaMs?.toFixed(2) ?? '—'} | ${r.sideMedianFlag} | ${r.pairedRegression} | ${r.noisy} |`),
  '',
  '### 재테스트 전체 입력 (최초와재측정 별도)',
  '',
  '| 입력 | 이유 | 최초비율 | 재측정비율 | 빠른pair/완료pair | OFF편차 | ON편차 | 비율편차 |',
  '|---|---|---:|---:|---:|---:|---:|---:|',
  ...rows.map(r => `| ${r.caseId} | ${r.reasons.join(', ')} | ${ratio(r.initialRatio)} | ${ratio(r.retestRatio)} | ${r.fasterPairs}/${r.offExact < r.onExact ? r.offExact : r.onExact} | ${percent(r.offSpread)} | ${percent(r.onSpread)} | ${percent(r.ratioSpread)} |`),
  '',
  '## 최종 판단과 한계',
  '',
  '- 개선과회귀를동시에보고한다. 10회반복만으로통계적유의성이나모든입력비회귀를증명하지않는다.',
  '- 짧은입력의큰비율/편차는VM잡음·JIT·메모리할당등의영향을받을수있다. paired비율/절대ms/방향일관성을함께본다.',
  '- 19개양측timeout의정확한완료시간과최적witness는미확인이다. 메모리값은완료호출의RSS/WASMcommittedmemory이며nativepeakheap은아니다.',
  '- 추가80과재테스트66은동일보드·반전그룹에서연관된행렬을포함한다. 독립보드100개라고주장하지않는다.',
  '- currentPropagation의 일부 큰 개선은 재현돼 후속 통합 검토 가치가 있다. 최초 경보3개가 같은 기준으로 재현되지 않은 점은 긍정적이지만, 작은 악화/방향 혼재/높은 편차/timeout을 고려해 무조건ON 권고는 보류한다. 제품 승격은 별도 승인과 회귀 검증이 필요하다.',
  '- 원본raw/환경/witness는Actions artifact에,장기요약은reports/expanded100.json,retest10.json,expanded-final-review.json에보존한다.',
  '- 로컬dev/GitHubmain/제품routing/CP선택정책/제품WASM은변경하지않았다.',
];
writeFileSync(new URL('./EXPANDED_FINAL_REPORT_KO.md', import.meta.url), md.join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
