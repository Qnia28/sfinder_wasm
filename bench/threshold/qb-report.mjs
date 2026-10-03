import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { manifest, loadFixture } from './fixtures.mjs';
import { sha256 } from './engine.mjs';
const base = process.env.THRESHOLD_QB_RESULTS || 'bench/threshold/results';
const initialBytes = readFileSync(`${base}/qb-review/review.json`), initial = JSON.parse(initialBytes);
const selection = JSON.parse(readFileSync(`${base}/qb-review/selection.json`));
assert.equal(selection.reviewHash, sha256(initialBytes));
const repeated = existsSync(`${base}/qb-recheck-review/review.json`)
  ? JSON.parse(readFileSync(`${base}/qb-recheck-review/review.json`)) : null;
assert.equal(Boolean(repeated), selection.cases.length > 0);
if (repeated) {
  assert.equal(repeated.pairs, 10); assert.equal(repeated.manifestHash, initial.manifestHash);
  assert.deepEqual(repeated.wasmHashes, initial.wasmHashes); assert.deepEqual(repeated.sourceDigest, initial.sourceDigest);
  assert.equal(repeated.auditedMatrices, selection.cases.length);
}
const details = [...selection.details];
// Both comparisons are rerun for a selected input. Do not hide a new alert in
// the comparison that did not originally trigger that input's selection.
for (const row of repeated?.perCase || []) if (row.recheckReasons.length
  && !details.some(d => d.caseId === row.caseId && d.comparisonIndex === row.comparisonIndex)) {
  details.push({ caseId: row.caseId, comparisonIndex: row.comparisonIndex, reasons: row.recheckReasons, firstFlaggedInRepeat: true });
}
const resolved = details.map(detail => {
  const before = initial.perCase.find(r => r.caseId === detail.caseId && r.comparisonIndex === detail.comparisonIndex);
  const after = repeated.perCase.find(r => r.caseId === detail.caseId && r.comparisonIndex === detail.comparisonIndex); assert(after);
  return { ...detail, initialRatio: before.pairedSpeedupMedian, repeatRatio: after.pairedSpeedupMedian,
    initialDeltaMs: before.pairedDeltaMs, repeatDeltaMs: after.pairedDeltaMs,
    repeatCompletePairs: after.pairedComplete, repeatFasterPairs: after.fasterPairs, repeatSlowerPairs: after.slowerPairs,
    repeatedMaterialRegression: (after.sideRegression || after.pairedRegression) && after.slowerPairs >= 8,
    repeatedCompletionDiscordance: after.completionDiscordance,
    repeatedMemoryAlert: after.memoryReview,
    repeatedLongSlowdown: after.longSlowdown && after.slowerPairs >= 8,
    repeatedLargeGain: after.largeGain && after.fasterPairs >= 8,
    repeatEarlyStop: after.earlyStop };
});
const F = manifest.cases.map(c => c.F), K = manifest.cases.map(c => c.K);
const coverage = { distinctSetups: manifest.cases.length, mirrorGroups: new Set(manifest.cases.map(c => c.mirrorGroup)).size,
  noForced: F.filter(f => f === 0).length, minForced: Math.min(...F), maxForced: Math.max(...F),
  minK: Math.min(...K), maxK: Math.max(...K), rows: [Math.min(...manifest.cases.map(c => c.rows)), Math.max(...manifest.cases.map(c => c.rows))],
  candidates: [Math.min(...manifest.cases.map(c => c.n)), Math.max(...manifest.cases.map(c => c.n))],
  qualityLevels: [Math.min(...manifest.cases.map(c => c.qualityLevels)), Math.max(...manifest.cases.map(c => c.qualityLevels))],
  forcedCoverage: manifest.cases.map(c => {
    const { matrix } = loadFixture(c.id);
    const forced = new Set(matrix.rows.filter(row => new Set(row.map(([id]) => id)).size === 1).map(row => row[0][0]));
    return { caseId: c.id, forced: forced.size, rows: matrix.rows.length,
      coveredRows: matrix.rows.filter(row => row.some(([id]) => forced.has(id))).length };
  }) };
const decisionAlerts = resolved.filter(r => r.repeatedMaterialRegression || r.repeatedCompletionDiscordance || r.repeatedMemoryAlert);
const smallConsistentSlowdowns = (repeated?.perCase || []).filter(r => r.slowerPairs >= 8 && r.pairedDeltaMs > 0 && r.pairedDeltaMs < 5);
const fmt = (x, n = 3) => x === null || x === undefined ? '-' : x.toFixed(n);
const lines = [
  '# Cycle7 QB 독립 데이터 100개 검증', '',
  `- 실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/${initial.runId}`,
  `- 소스: \`${initial.candidate}\`; experiment WASM: \`${initial.wasmHashes.experiment}\`.`,
  `- 원본356개에서 seed ${manifest.seed}로 setup100개 무복원 추출. mirror는 제거하지 않음. 선정 setup을 시간/K/성능으로 교체하지 않음.`,
  '- QB: 초기 HOLD T + 현재 bag의 남은5개 순열 + 다음 bag 첫1개 = setup당840큐. 가상 선행 T와 실제 초기 HOLD의6미노 배치 순서 집합 동등성을12,600조건에서 확인.',
  '- 필터: 사전에 정한 무작위 우선순위에서 첫 nonempty 하나. 비어 있는 필터만 건너뛰며 K증명 실패에 따라 다른 필터/setup으로 바꾸지 않음.',
  `- 생성 ${initial.generatedMatrices}/100, 실패 ${initial.generationFailures.length}. 최대 동시 shard10. 0↔20 및16↔20 각각3쌍, fresh process, 같은 VM에서 직렬 OFF/ON, 호출당300초.`,
  `- 기본 요청 ${initial.requestedSamples}, 실행 ${initial.executedSamples} = EXACT ${initial.exact} + solver TIMEOUT ${initial.timeout}, 미실행 ${initial.skippedSamples}.`,
  '- 양측각2회 solver TIMEOUT이며 어느 쪽에도 EXACT가 없을 때만 해당 비교 조기종료. 미실행은 TIMEOUT이 아님. 시간초과 입력은 완료 속도비에 넣지 않음.',
  '', '## 기본 측정', '',
  '| 비교 | 행렬 | 완전3쌍 | 하나 이상 완료쌍 | 기하평균 speedup | 완전3쌍만 | 빠름/느림 | OFF-only/ON-only 쌍 | 조기종료 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...initial.comparisons.map(c => `| ${c.left.mask}→${c.right.mask} | ${c.cases} | ${c.fullyPairedMatrices} | ${c.pairedMatrices} | ${fmt(c.geomean, 6)} | ${fmt(c.fullyPairedGeomean, 6)} | ${c.faster}/${c.slower} | ${c.offOnlyPairs}/${c.onOnlyPairs} | ${c.earlyStopped} |`),
  '', 'speedup=OFF nativeMs/ON nativeMs. 각 입력의 paired ratio 중앙값을 사용. nativeMs에는 Rust ABI 변환/정규화/준비/검색이 포함되며 JS 포장/fixture IO/witness 검사는 제외. VM 간 절대 시간을 합산하지 않음.',
  '', '## 특이 입력 재확인', '',
  selection.criteria,
  `추출 ${selection.cases.length}개 입력; 각 비교10개의 새 쌍. 기본 측정과 합산하지 않고 별도 평가. ${repeated ? `요청 ${repeated.requestedSamples}, 실제 ${repeated.executedSamples}, EXACT ${repeated.exact}, TIMEOUT ${repeated.timeout}, 미실행 ${repeated.skippedSamples}.` : '조건에 해당하는 입력이 없어 추가 실행 없음.'}`,
  '', '| 입력/비교 | 선정 이유 | 기본 ratio | 반복 ratio | 반복 Δms(ON−OFF) | 완료쌍/빠름/느림 | 반복 material 회귀 / 완료차이 / 메모리 |',
  '|---|---|---:|---:|---:|---:|---|',
  ...resolved.map(r => `| ${r.caseId} / ${r.comparisonIndex} | ${r.reasons.join(', ')} | ${fmt(r.initialRatio)} | ${fmt(r.repeatRatio)} | ${fmt(r.repeatDeltaMs)} | ${r.repeatCompletePairs}/${r.repeatFasterPairs}/${r.repeatSlowerPairs} | ${r.repeatedMaterialRegression}/${r.repeatedCompletionDiscordance}/${r.repeatedMemoryAlert} |`),
  '', `반복 material 회귀는 ≥10%+≥5ms이며≥8/10쌍 느림. 반복 의사결정 경보 ${decisionAlerts.length}개 비교. 경보가 없더라도3쌍 측정만으로 모든 작은 회귀/경계 변동을 배제하지 않음.`,
  '', '### 재확인 전체 비교 (선정 이유가 없던 쪽도 포함)', '',
  '| 입력 | 비교 | 반복 ratio | OFF ms | ON ms | paired Δms | 빠름/느림 |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...(repeated?.perCase || []).map(r => `| ${r.caseId} | ${r.left.mask}→${r.right.mask} | ${fmt(r.pairedSpeedupMedian)} | ${fmt(r.leftMedianMs)} | ${fmt(r.rightMedianMs)} | ${fmt(r.pairedDeltaMs)} | ${r.fasterPairs}/${r.slowerPairs} |`),
  '', `≥8/10쌍 느리지만 paired 증가가5ms 미만인 비교 ${smallConsistentSlowdowns.length}개: ${smallConsistentSlowdowns.map(r => `${r.caseId}(${r.left.mask}→${r.right.mask}, ratio ${fmt(r.pairedSpeedupMedian)}, +${fmt(r.pairedDeltaMs)}ms)`).join('; ') || '없음'}. 이는 material 기준 미달일 뿐, 모든 입력에서 빨라졌다는 뜻이 아님. 재확인7개는 경보에 따른 선택 표본이며 대표표본이 아니므로 전체 speedup에 합치지 않음.`,
  '', '## 구조 및 제한', '',
  `- 생성된 행렬의 mirror 그룹 ${coverage.mirrorGroups}; singleton forced가 없는 입력 ${coverage.noForced}, forced ${coverage.minForced}–${coverage.maxForced}, K ${coverage.minK}–${coverage.maxK}.`,
  `- 후보수 ${coverage.candidates.join('–')}, 행수 ${coverage.rows.join('–')}, quality level ${coverage.qualityLevels.join('–')}. 행렬과 forced coverage 전체값은 JSON에 보존.`,
  '- 100개는 DB physical rows이지 독립 무작위 보드100개가 아님. 미러/동형 및 정책 class 상관이 남음. 원래cycle1 보고서와 분리하며 다른 실험 바이너리의 시간/비율을 섞지 않음.',
  '- 같은 소스/바이너리를 최초 측정과 재확인에 사용했고 완료된 모든 original-row witness, stable-ID/quality hash, input/build/source hash, 반복 수와 조기종료를 독립 감사.',
  '- 제품 경로 성능, 기본 옵션 변경, 라우팅, CP 선택 및 제품 통합은 이번 작업에 포함되지 않음. mask16 또는20의 제품 채택은 별도 판단/검증 필요.',
  '', '## 전체 입력 결과', '',
  '| 입력 | 비교 | paired ratio | OFF ms | ON ms | Δms | 빠름/느림 | EXACT L/R | peak RSS L/R KiB | WASM L/R bytes |',
  '|---|---|---:|---:|---:|---:|---:|---:|---|---|',
  ...initial.perCase.map(r => `| ${r.caseId} | ${r.left.mask}→${r.right.mask} | ${fmt(r.pairedSpeedupMedian)} | ${fmt(r.leftMedianMs)} | ${fmt(r.rightMedianMs)} | ${fmt(r.pairedDeltaMs)} | ${r.fasterPairs}/${r.slowerPairs} | ${r.leftExact}/${r.rightExact} | ${r.leftPeakRssMedianKiB}/${r.rightPeakRssMedianKiB} | ${r.leftWasmMemoryMedianBytes}/${r.rightWasmMemoryMedianBytes} |`),
  '', '## 생성 실패', '',
  ...initial.generationFailures.map(f => `- ${f.setupId}: enumeration=${f.enumerationStatus}; ${JSON.stringify(f.records)}`),
];
const out = `${base}/qb-final`; mkdirSync(out, { recursive: true });
const flag = process.argv.includes('--replace') ? 'w' : 'wx';
writeFileSync(`${out}/report.md`, lines.join('\n') + '\n', { flag });
writeFileSync(`${out}/resolution.json`, JSON.stringify({ coverage, selection, resolved, decisionAlerts,
  smallConsistentSlowdowns: smallConsistentSlowdowns.map(r => ({ caseId: r.caseId, leftMask: r.left.mask, rightMask: r.right.mask,
    pairedSpeedupMedian: r.pairedSpeedupMedian, pairedDeltaMs: r.pairedDeltaMs, fasterPairs: r.fasterPairs, slowerPairs: r.slowerPairs })),
  initialReviewHash: sha256(initialBytes), repeatReviewHash: repeated ? sha256(readFileSync(`${base}/qb-recheck-review/review.json`)) : null }, null, 2) + '\n', { flag });
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.slice(0, lines.indexOf('## 전체 입력 결과')).join('\n') + '\n');
console.log(JSON.stringify({ generated: initial.generatedMatrices, comparisons: initial.comparisons, rechecked: selection.cases.length, decisionAlerts }, null, 2));
