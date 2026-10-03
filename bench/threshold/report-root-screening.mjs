import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { mergeRootScreening } from './merge-root-screening.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = mergeRootScreening(read('./reports/root-retained.json'), read('./reports/root-resumed.json'), read('./root-resume-selection.json'));
assert.equal(report.samples.length, 1200);
const execution = read('./reports/root-vm-execution.json');
const fullTraces = report.diagnostics.filter(d => d.results.every(s => s.completed));
const traceWork = [0, 4, 16, 20, 36, 68, 100, 116].map(mask => {
  const rows = fullTraces.map(d => d.results.find(s => s.mask === mask));
  const sum = key => rows.reduce((n, r) => n + r.diagnostics[key], 0);
  return { mask, cases: rows.length, searchedStates: rows.reduce((n, r) => n + r.searchedStates, 0),
    dfsEntries: sum('dfsEntries'), qualityGroupUpdates: sum('qualityGroupUpdates'),
    rootCollectionRows: sum('rootCollectionRows'), rootCoverageWordOrs: sum('rootCoverageWordOrs'),
    rootCoverageWordCopies: sum('rootCoverageWordCopies') };
});
report.execution = execution;
report.traceWork = { commonCompleteCases: fullTraces.length,
  otherBudgetedCases: report.diagnostics.length - fullTraces.length, sums: traceWork,
  note: 'Structural sums on the same36 inputs completed under all eight bounded trace settings. Not a timing speedup estimate; other64 are censored by1000-state trace budget.' };
const flag = process.argv.includes('--replace-generated') ? 'w' : 'wx';
writeFileSync(new URL('./reports/root-screen.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', { flag });
const ratio = n => n === null ? '—' : n.toFixed(3);
const md = [
  '# rootForced 보완 재평가: 중단 후 재개한100입력 screening', '',
  '## 결론', '',
  '**rootForced는 B(추가 테스트 필요)를 유지한다. 이번100입력에서는 긍정적 신호가 있으나1회screening이므로 A 승격 근거로는 부족하다.**',
  '- 기존rootForced 단독(0→4)은완료80개에서1.078배,mask16에추가(16→20)는완료81개에서1.036배였다.',
  '- 추가효과비교에서는54개향상/27개악화,회귀경보4개였다.다음확인후보로는보완본보다기존mask4를우선검토한다.',
  '- 정규화통합수집(4→36)은0.983배,루트커버준비(4→68)는1.007배,두보완(4→100)은0.979배였다.추가보완의확실한성능가치는확인하지못했다.',
  '- 두보완까지mask16에추가(16→116)는1.030배,회귀경보6개였다.기존rootForced추가보다우월하다고주장할근거가없다.',
  '- 이번보완32/64는현단계 C(우선순위낮음)로보류한다.1회관측만으로폐기를확정하거나제품통합하지않는다.',
  '',
  '## 범위와 자료 결합', '',
  '- 이전run에서12호출이모두기록된58개를유지하고,미완료42개를동일조건으로전부재실행했다.',
  ...report.sources.map(s => `- [run ${s.runId}](${s.url}): ${s.retainedCases}개, commit ${s.candidate.slice(0, 7)}.`),
  '- 재실행의최대병렬12VM.모든입력은6비교×1pair×2호출,호출당300초.동일입력ON/OFF는같은run/같은VM의직렬ABBA측정이다.',
  `- 실제측정step 최대동시실행은재실행${execution.runs[1].maxSimultaneousBenchmarkSteps}VM이었다.측정구간${execution.runs[1].benchmarkWindowMinutes.toFixed(1)}분,빌드/CI포함workflow ${execution.runs[1].workflowMinutes.toFixed(1)}분.개별job가120분걸린것이아니라12VM로여러wave를수행한시간이다.`,
  '- 재사용58개는job상태가아닌12실측호출과summary/trace/witness의완전성으로선정했다.취소전에12호출과artifact를완성한job도포함된다.',
  '- 양run의Rust/제품JS/experimentalWASM/입력hash일치를확인했다.과거부분자료120호출은종합통계에서제외하고별도보존했다.',
  '- 100ID는99개핵심행렬/41mirror그룹이다.중복1개를유지했다.통합된실행이며독립적인단일run100검증이라고부르지않는다.',
  '- 1회screening이며반복편차/통계적유의성/최종통합등급을확정하지않는다.기존20개단독screen이나mask16확대·10회재테스트와도합산하지않는다.',
  '', '## 전체측정과비교', '',
  `- 실제1,200호출: EXACT ${report.exact}, TIMEOUT ${report.timeout}.누락을timeout으로치환하지않았다.`,
  '- 19개입력은모든6비교에서양쪽TIMEOUT이었다.pcinfo032/Z는currentPropagation이없는4비교에서양측TIMEOUT,있는2비교에서양측EXACT다.',
  '- pcinfo032/Z에서16→20은약286.2→287.6초(0.995배),16→116은약287.3→290.9초(0.988배)다.완료경계에가까우며rootForced가완료를늘린사례는아니다.',
  '- 모든비교에서왼쪽만/오른쪽만완료pair는0개,메모리20%증가경보도0개였다.',
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
  '- 이campaign의실험WASM은기존mask16 확대검증의바이너리와다르다.이번OFF/ON은동일바이너리지만기존campaign과수치를pool하지않는다.',
  '', '### 비용과탐색감소 진단', '',
  `- trace state budget1000에서8설정모두완료한동일${fullTraces.length}입력만작업량을비교했다.나머지${report.diagnostics.length - fullTraces.length}개는하나이상budget소진으로전체탐색량비교에서제외했다.`,
  '| mask | DFS entries합계 | budget charge포함states | quality그룹갱신 | 추가행스캔 | 루트OR word | 루트copy word |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...traceWork.map(c => `| ${c.mask} | ${c.dfsEntries} | ${c.searchedStates} | ${c.qualityGroupUpdates} | ${c.rootCollectionRows} | ${c.rootCoverageWordOrs} | ${c.rootCoverageWordCopies} |`),
  '- 16→20의DFS는14,579→4,354로약70.1%줄었지만quality그룹갱신은3,267,222→4,022,452로약23.1%늘었다.강제선택이DFS를줄여도상태갱신비용은증가할수있다.',
  '- fused수집은추가행스캔119,157회를0으로,prepared커버는OR17,452word를0으로줄였지만kernel에서새계산을수행하고copy697word가생긴다.작업제거가전체시간향상으로직결되지는않았다.',
  '- kernel중forced membership검사의작업량은별도counter가없으므로OR감소만으로총전처리비용이감소했다고주장하지않는다.단계별wall time도측정하지않았다.',
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
writeFileSync(new URL('./ROOT_FORCED_SCREEN_REPORT_KO.md', import.meta.url), md.join('\n') + '\n', { flag });
console.log(JSON.stringify({ exact: report.exact, timeout: report.timeout, comparisons: report.comparisons }, null, 2));
