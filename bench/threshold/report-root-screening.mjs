import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { mergeRootScreening } from './merge-root-screening.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = mergeRootScreening(read('./reports/root-retained.json'), read('./reports/root-resumed.json'), read('./root-resume-selection.json'));
assert.equal(report.samples.length, 1200);
writeFileSync(new URL('./reports/root-screen.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const ratio = n => n === null ? '—' : n.toFixed(3);
const md = [
  '# rootForced 보완 재평가: 중단 후 재개한100입력 screening', '',
  '## 범위와 자료 결합', '',
  '- 이전run에서12호출이모두기록된58개를유지하고,미완료42개를동일조건으로전부재실행했다.',
  ...report.sources.map(s => `- [run ${s.runId}](${s.url}): ${s.retainedCases}개, commit ${s.candidate.slice(0, 7)}.`),
  '- 재실행의최대병렬12VM.모든입력은6비교×1pair×2호출,호출당300초.동일입력ON/OFF는같은run/같은VM의직렬ABBA측정이다.',
  '- 양run의Rust/제품JS/experimentalWASM/입력hash일치를확인했다.과거부분자료120호출은종합통계에서제외하고별도보존했다.',
  '- 100ID는99개핵심행렬/41mirror그룹이다.중복1개를유지했다.통합된실행이며독립적인단일run100검증이라고부르지않는다.',
  '- 1회screening이며반복편차/통계적유의성/최종통합등급을확정하지않는다.기존20개단독screen이나mask16확대·10회재테스트와도합산하지않는다.',
  '', '## 전체측정과비교', '',
  `- 실제1,200호출: EXACT ${report.exact}, TIMEOUT ${report.timeout}.누락을timeout으로치환하지않았다.`,
  '| 비교 | mask | 양측완료/100 | 향상/악화 | 완료군기하평균 | EXACT L/R | paired회귀경보수 |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...report.comparisons.map(c => `| ${c.name} | ${c.leftMask}→${c.rightMask} | ${c.pairedCompleteMatrices} | ${c.faster}/${c.slower} | ${ratio(c.geomean)} | ${c.leftExact}/${c.rightExact} | ${c.pairedRegressions.length} |`),
  '', '비율은왼쪽/오른쪽시간비이며1보다크면오른쪽이빠르다.완료군기하평균은100전체의속도비가아니다.',
  '', '## 해석', '',
  '- 0→4는기존rootForced단독효과,16→20은currentPropagation에대한추가효과다.',
  '- 4→36은정규화중필수후보수집,4→68은kernel중루트커버준비,4→100은두보완의조합이다.',
  '- 16→116이최종mask16후보에보완rootForced를추가하는주비교다.후속후보선정에서이를우선검토한다.',
  '- 보완32/64는oracle/budget/locks/undo검사에서기존rootForced와탐색순서및결과가동일했다.전처리비용만비교하는보완이다.',
  '- trace는별도의bounded진단이며wall time성능근거가아니다.예산소진trace의DFS수를전체탐색량처럼해석하지않는다.',
  '- paired회귀경보는ON시간10%이상증가와paired Δms≥5를함께본다.1회경보는재현된회귀가아니다.',
  '', '### 회귀·완료차이·메모리 경보', '',
  ...report.comparisons.flatMap(c => [
    `- **${c.name}**`,
    `  - paired회귀: ${c.pairedRegressions.join(', ') || '없음'}`,
    `  - side중앙값회귀: ${c.sideRegressions.join(', ') || '없음'}`,
    `  - EXACT→TIMEOUT: ${c.exactToTimeout.join(', ') || '없음'}; 오른쪽만완료pair ${c.onOnlyPairs}`,
    `  - 메모리20%경보: ${c.memoryAlerts.join(', ') || '없음'}`,
  ]),
  '', '## 입력별 결과와 출처', '',
  '| 입력 | 출처run | 0→4 | 16→20 | 4→36 | 4→68 | 4→100 | 16→116 |',
  '|---|---|---:|---:|---:|---:|---:|---:|',
  ...[...new Set(report.samples.map(s => s.caseId))].sort().map(id => {
    const rows = report.perCase.filter(c => c.caseId === id).sort((a, b) => a.comparisonIndex - b.comparisonIndex);
    return `| ${id} | ${rows[0].sourceRunId} | ${rows.map(c => c.pairedComplete ? ratio(c.pairedSpeedupMedian)
      : `${c.paired[0].offStatus}/${c.paired[0].onStatus}`).join(' | ')} |`;
  }),
  '', '## 다음판단과보호대상', '',
  '- 이보고서는요청한기존완료58개+재실행42개의screening종합결과다.후속5회확인·선정입력10회재테스트는별도단계이며완료됐다고주장하지않는다.',
  '- 제품통합·옵션기본값·routing/CP선택정책은변경하지않았다.로컬dev와원격main은보호한다.',
  '- 장기자료: reports/root-screen.json,root-retained.json,root-resumed.json;중단부분자료는root-screen-interrupted.json.',
];
writeFileSync(new URL('./ROOT_FORCED_SCREEN_REPORT_KO.md', import.meta.url), md.join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ exact: report.exact, timeout: report.timeout, comparisons: report.comparisons }, null, 2));
