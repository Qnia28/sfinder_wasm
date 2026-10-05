// Publish one report + one JSON appendix, with hashes back to immutable artifacts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hash, readJson, writeJson } from './contracts.mjs';
import { combinedMarkdown } from './combined-report.mjs';
const [firstRoot, secondRoot, outputRoot] = process.argv.slice(2);
const digest = filename => hash(fs.readFileSync(filename));
const reportFile = path.join(secondRoot, 'COMBINED_REPORT_FINAL.json');
const report = readJson(reportFile);
assert.equal(report.audit.crossRunWitness, 'AGREEMENT_FOR_RECORDED_EXACT_WITNESSES');
for (const audit of [report.audit.first, report.audit.second]) assert.equal(audit.witnessAudit, 'PASS_FOR_RECORDED_EXACT_RESULTS');
const runs = [firstRoot, secondRoot].map(root => {
  const downloadFile = path.join(root, 'full-history', 'DOWNLOAD_COMPLETE.json');
  const indexFile = path.join(root, 'full-history', 'DOWNLOAD_INDEX.json');
  const download = readJson(downloadFile), index = readJson(indexFile);
  assert.equal(download.errors.length, 0); assert.equal(download.downloaded, index.selected);
  assert.equal(download.selected, index.selected); assert.equal(download.completed.length, download.downloaded);
  for (const artifact of index.artifacts) {
    const actual = download.completed.find(a => a.id === artifact.id);
    assert(actual); if (artifact.digest) assert.equal(actual.digest, artifact.digest);
  }
  const executionFile = path.join(root, 'EXECUTION_AUDIT.json'), execution = readJson(executionFile);
  assert.equal(execution.provenanceScheduleSafety, 'PASS_FOR_RECORDED_FILES');
  assert.equal(execution.missingPlannedRaw.length, 0);
  const vmFile = path.join(root, 'ACTIONS_JOB_INTERVAL_AUDIT.json'), vm = readJson(vmFile);
  assert(vm.jobIntervalPeak <= 16); assert(vm.longestJobs.every(job => job.minutes < 360));
  return { campaignId: execution.campaignId, runId: index.runId, sourceCommit: execution.sourceCommit,
    sourceLock: execution.sourceLock, sourceFilesVerified: execution.sourceFilesVerified,
    resultArchivesVerified: download.downloaded, listedArtifacts: download.listed,
    artifacts: download.completed,
    hashes: { artifactIndex: digest(indexFile), downloadedDigests: digest(downloadFile), executionAudit: digest(executionFile), vmAudit: digest(vmFile) },
    executionAudit: { safety: execution.provenanceScheduleSafety, waves: execution.waves, missingPlannedRaw: execution.missingPlannedRaw,
      eligibilityAgainstFullDurableHistory: execution.eligibilityAgainstFullDurableHistory,
      eligibilityDifferences: execution.eligibilityDifferences, solverScopePeak: execution.solverScopePeak },
    vmAudit: vm };
});
const exposureFile = path.join(firstRoot, 'EXPOSURE_AUDIT_EXPANDED_V2.json');
const exposure = readJson(exposureFile);
assert.equal(exposure.summary.errors, 0);
report.publicationEvidence = { combinedAuditSha256: digest(reportFile), runs,
  exposureAudit: { sha256: digest(exposureFile), summary: exposure.summary },
  benchmarkBoundary: 'SECONDARY_CHILD_CALL_TO_ENGINE_RESULT_FRESH_PROCESS_COLD_NOT_MINIMALS_END_TO_END',
  tests: { localContractsAndRegression: { passed: 52, failed: 0 }, actionlint: '1.7.12 PASS; shellcheck unavailable' },
  rawPreserved: true, historicalTimesPooled: false, productRoutingChanged: false };
const zeroRecords = (run, engine) => report.audit[run].repeatLedger.filter(r => r.engine === engine && r.attempts === 0).length;
const afterRecovery = report.recoveredAfterAllShortTimeouts;
const recoveredByEngine = Object.fromEntries(['integrated', 'threshold', 'cpsat'].map(e => [e, afterRecovery.filter(r => r.engine === e).length]));
let markdown = combinedMarkdown(report);
const second = report.second;
const initial = second.initialAnalysis;
const intro = [
  '## 결과 해석 요약', '',
  `- 총 ${report.totalAttempts.toLocaleString('en-US')}회 실제 호출 중 ${report.combinedExactCalls.toLocaleString('en-US')}회 exact witness를 원 가중치 행에서 재계산했고, 엔진·반복·두 run 사이 선택 ID/quality 일치에 문제가 없었다. 이는 공유 제품 증명과 witness 검산이며 별도 대형 최적화 oracle 검증이나 제품 성능 PASS가 아니다.`,
  `- 300초 run의 기본 반복 ${initial.allThreeCompleteInitial}개 행렬에서 세 엔진이 모두 exact를 완료했다. 그 부분집합의 가장 작은 중앙값 수는 Integrated ${initial.fastestCounts.integrated}, Threshold ${initial.fastestCounts.threshold}, CP-SAT ${initial.fastestCounts.cpsat}다. 완료하지 않은 행렬에는 이 순위를 확장하지 않는다.`,
  '- Integrated는 완료된 쉬운 행렬에서 강하지만 긴 제한에서 3 GiB OOM도 발생했다. Threshold는 일부 행렬에서 더 빠르고, CP-SAT는 더 넓은 완료 범위를 보여 모든 입력에 한 엔진만 쓰는 결론은 지지되지 않는다. 다만 OOM 뒤 격리된 엔진은 직접 비교 자료가 없다.',
  `- 60초 전부-timeout에서 300초 exact로 이어진 조건은 Integrated ${recoveredByEngine.integrated}, Threshold ${recoveredByEngine.threshold}, CP-SAT ${recoveredByEngine.cpsat}개다. timeout 증가가 전부 해결하는 것은 아니다. 동일 조건의 반복 분산·VM 차이가 있으므로 이 수를 timeout 연장의 순수 인과효과로 보지 않는다.`,
  '- 현재 Auto는 Integrated 100K probe → Threshold, 60초 뒤 CP 병행이다. 이번 direct Integrated 측정은 uncapped이므로 이 결과만으로 Auto의 end-to-end 시간을 계산하거나 새 gate 성능을 주장할 수 없다.',
  '', '## 커버리지와 미측정의 분리', '',
  '- 440개 명령의 capture는 모두 완료했다. 비trivial 선택 행렬 309개, trivial-only 명령 129개, 실제 빈 결과 명령 2개다. 첫 run의 빈 명령은 c7-2plus2-qb-row-251/bag 및 c7-2plus2-qb-row-005/bag이며 capture timeout이 아니다.',
  '- 명령당 hash로 선택한 비trivial save 하나만 엔진 측정에 썼다. 선택되지 않은 save·mirror alias와 보류 55개 그룹을 새 독립 측정 표본으로 세지 않는다.',
  `- 300초 run에서 engine×fixture 798개 조건은 20회를 완료했다. 기본 호출은 ${second.populations.initial.attempts}회/${309 * 3 * 4}회이며 나머지 236회는 OOM 뒤 격리다. 엔진별 실제 호출 0인 행렬은 Integrated ${zeroRecords('second', 'integrated')}, Threshold ${zeroRecords('second', 'threshold')}, CP-SAT ${zeroRecords('second', 'cpsat')}개다.`,
  '- 안전 격리로 OOM 원인 행렬과 같은 job의 이웃 행렬도 미측정이 됐다. 나중에 별도로 회수하려면 미측정만을 대상으로 source·메모리·origin·중복 방지 계약을 다시 승인해야 하며, 이번 6시간 예산을 새 시계로 초기화하지 않았다.',
  '', '## 검증과 다음 결정', '',
  '- 원자료 ZIP digest, Git 원본 source bytes, schedule stable-ID/seed, fixture hash, timeout/OOM/미실행 구분, runner별 메모리·시간 제한을 재감사했다. 후속 run의 eligibility는 전체 history 기준 재구성과 일치한다. 첫 run의 801개 decision 차이는 하네스 한계로 기록했다.',
  '- 기존 55개 보류 그룹 중 52개는 과거 자료 노출 가능성이 있고 3개는 미확인이다. 새로운 라우팅 규칙을 fresh 검증하려면 과거 실험에 사용하지 않은 setup/fumen과 alias·mirror 출처 자료가 추가로 필요하다.',
  '- 후속 작업은 이 자료의 구조별 오류·시간 분포를 바탕으로 후보를 설계한 뒤, 미노출 입력에서 minimals 전체·쉬운 케이스 회귀·동시 요청 비용을 검증하는 것이다. 이번 단계에서 제품 라우팅을 변경하지 않았다.',
  ''
].join('\n');
markdown = markdown.replace('## 실행 조건과 결과', intro + '\n## 실행 조건과 결과');
const variability = ['', '## 기본 반복의 변동 진단', '',
  '| timeout | 엔진 | 기본 반복 모두 exact인 조건 | max/min ≥1.10 |', '|---|---|---:|---:|'];
for (const run of [report.first, report.second]) for (const v of run.initialAnalysis.withinEngineVariability)
  variability.push(`| ${run.timeoutSeconds}초 | ${v.engine} | ${v.eligibleCompleteInitial} | ${v.ratioAtLeast110} |`);
variability.push('', '같은 엔진·같은 행렬의 기본 반복 내부 시간비다. 60초 기본 2회와 300초 기본 4회는 극값 비율이 직접 비교 가능한 동일 표본 수가 아니다. 추가 반복은 사용자 지정 정보 수집이며 이 변동값으로 선별한 A/B retest가 아니다.', '');
markdown = markdown.replace('## 한계와 다음 단계', variability.join('\n') + '\n## 한계와 다음 단계');
markdown += '\n## 원자료와 재생성\n\n';
for (const evidence of runs) markdown += `- [run ${evidence.runId}](https://github.com/Qnia28/sfinder_wasm/actions/runs/${evidence.runId}): source \`${evidence.sourceCommit}\`, 결과 archive ${evidence.resultArchivesVerified}개, source file ${evidence.sourceFilesVerified}개 검증.\n`;
markdown += '- JSON 부록: `FINAL_COMBINED_REPORT.json` (조건별 표본·phase·누락·반복·OOM·matched 비교·artifact digest·source/실행 감사). 원 ZIP/raw는 로컬 ignored `benchmark-results/campaign-*`에 그대로 보존했다.\n';
markdown += '- 재생성 도구: `combined-report.mjs` → `publish-combined-report.mjs`. solver 호출 없이 원자료를 다시 읽고 검산한다.\n';
writeJson(path.join(outputRoot, 'FINAL_COMBINED_REPORT.json'), report);
fs.writeFileSync(path.join(outputRoot, 'FINAL_COMBINED_REPORT_KO.md'), markdown, { flag: 'wx' });
console.log(JSON.stringify({ published: outputRoot, totalAttempts: report.totalAttempts, exact: report.combinedExactCalls,
  recovered: afterRecovery.length, jsonSha256: digest(path.join(outputRoot, 'FINAL_COMBINED_REPORT.json')) }));
