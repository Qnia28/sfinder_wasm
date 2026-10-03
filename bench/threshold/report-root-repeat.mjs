import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { reviewRootRepeat } from './review-root-repeat.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = read('./reports/root-confirm.json'), screen = read('./reports/root-screen.json');
const review = reviewRootRepeat(report, screen), s = review.summary;
const args = process.argv.slice(2), at = args.indexOf('--verdict');
const verdict = at < 0 ? 'B' : args[at + 1]; assert(['A', 'B', 'C', 'X'].includes(verdict));
const flag = args.includes('--replace-generated') ? 'w' : 'wx';
const execution = read('./reports/root-repeat-execution.json');
assert.equal(execution.runId, report.runId); assert(execution.maxSimultaneousBenchmarkSteps <= 8);
review.execution = execution;
review.decision = { classification: verdict, scope: 'cycle1 repeat confirmation only; no product default change',
  integrationApproval: false, independentDatasetValidation: false,
  basis: 'Repeat improvement, no material regression/completion-discordance/memory flags; small slowdowns and boundary failures retained in report.' };
writeFileSync(new URL('./reports/root-repeat-review.json', import.meta.url), JSON.stringify(review, null, 2) + '\n', { flag });
const ratio = n => n === null ? '—' : n.toFixed(3);
const percent = n => n === null ? '—' : `${(n * 100).toFixed(1)}%`;
const md = [
  '# rootForced 5회 반복 확인 보고서', '',
  '## 결론과 범위', '',
  `**현재 판정: ${verdict}.** 아래 수치는 cycle1에서 기존rootForced를추가한반복검증이며제품전체의일반화나제품통합완료를뜻하지않는다.`,
  ...(verdict === 'A' ? ['**A는cycle1 기준의조건부통합가치판정이다.** 개선신호가반복재현돼후속통합후보로올릴가치가있으나,제품전체기본ON승인은독립데이터와실제품경로검증전까지보류한다.'] : []),
  `- [확인run ${report.runId}](${report.url}), commit ${report.candidate.slice(0, 7)}.`,
  '- 주비교mask16→20,보완32/64 OFF.기존100ID/99핵심행렬/41mirror그룹을유지했다.',
  '- 입력별5paired repeats,동시Actions benchmark shard최대8,호출당300초.동일VM직렬AB/BA,fresh processes.',
  `- 실제측정step최대동시실행${execution.maxSimultaneousBenchmarkSteps}개,측정구간${execution.benchmarkWindowMinutes.toFixed(1)}분,전체workflow ${execution.workflowMinutes.toFixed(1)}분.가장긴개별측정job ${execution.longestJobMinutes.toFixed(1)}분.`,
  '- 양측각2회solver TIMEOUT이며관측EXACT가없으면조기종료했다.어느쪽이라도EXACT를관측하면5쌍모두계속했다.미실행은TIMEOUT이아니다.',
  '- 실험WASM/Rust/제품JS/입력hash는screening과일치한다.완료witness는원본행/기존최적hash로검산했다.',
  '- 신규데이터없이반복만확인했다.5회로통계적유의성이나모든제품입력의비회귀를증명하지않는다.',
  '', '## 측정 결과', '',
  `- 요청1000호출,실제${s.actualCalls}호출: EXACT ${s.exact}, TIMEOUT ${s.timeout};미실행${s.skippedCalls}호출.`,
  `- 조기종료${s.earlyStoppedCases.length}개.양측5회완료${s.fullyPairedCases}개.`,
  `- 완료군속도비기하평균${ratio(s.geomeanFullyPaired)}배,향상${s.faster}개/악화${s.slower}개.`,
  `- 4/5회이상ON이빠른입력${s.consistentFaster}개,느린입력${s.consistentSlower}개.`,
  `- 중앙속도비≥1.10이고4회이상빠른입력${s.repeatedGains110.length}개.`,
  `- range/median≥10%인입력${s.noisy}개,screening과방향이바뀐입력${s.directionChanged}개.`,
  `- side시간중앙값회귀경보: ${s.sideRegressions.join(', ') || '없음'}.`,
  `- paired비율/시간차회귀경보: ${s.pairedRegressions.join(', ') || '없음'}.`,
  '- 회귀경보는ON시간10%증가+절대시간차≥5ms.각side중앙값과paired중앙비율/시간차는다른통계량이다.',
  '- 최초1pair screening의추가효과1.036배와이번5pairs를분리보고한다.더좋은비율을선택하거나합산하지않는다.',
  '- 최초screening의완료81개와이번완료80개는다르다.공통80개로계산한screening기하평균도1.036배였으며,반복확인은1.056배다.',
  '- 1.056배는완료입력별비율의기하평균이지전체100의총실행시간이5.6%줄었다는뜻이아니다.',
  '', '## 최초 회귀4개의 재현 여부', '',
  '| 입력 | 최초비율 | 반복비율 | paired ΔON−OFF(ms) | 빠름/느림pair | paired경보 |',
  '|---|---:|---:|---:|---:|---|',
  ...s.initialRegressionFollowup.map(c => `| ${c.caseId} | ${ratio(c.initialRatio)} | ${ratio(c.repeatRatio)} | ${c.pairedDeltaMs?.toFixed(2) ?? '—'} | ${c.fasterPairs}/${c.slowerPairs} | ${c.pairedRegression} |`),
  '', '## 특이사항과 추가 확인', '',
  `- 4회이상느린material회귀,완료차이,메모리경보에의한추가확인대상: ${s.followup.map(c => `${c.caseId}(${c.reasons.join(', ')})`).join('; ') || '없음'}.`,
  ...(s.followup.length ? ['- 추가확인전의잠정보고서다.판정에영향주는case만10회확인할수있으며편차10%만으로대규모재테스트를시작하지않는다.']
    : ['- 사전정한추가확인기준에해당하는특이사항이없어5회결과로보고서를완성했다.불필요한10회확인은하지않았다.']),
  '- pcinfo032/Z는screening의16→20에서양측약286~288초에완료됐지만이번에는양측첫2쌍모두300초timeout이었다.양측공통완료변동이며ON만악화한증거는없으나,완료경계와환경변동한계로명시한다.',
  '- 작은악화를없다고표현하지않는다.6p-pco/I는0.876배/paired +0.59ms,grace-system-a/S는0.847배/+1.31ms로4/5회느렸다.비율악화는크지만5ms material경보기준아래다.',
  '- 가장긴완료입력pcinfo030/Z는0.997배/paired +712ms이고4/5회느렸다.비율차이는약0.3%지만절대시간차는작지않다.모든긴입력에큰이득이있는구현이라고주장하지않는다.',
  '', '### 1.10배 이상이고4/5회 이상빠른입력', '',
  '| 입력 | 반복비율 | 빠른pair | OFF중앙값(ms) | ON중앙값(ms) | paired ΔON−OFF(ms) |',
  '|---|---:|---:|---:|---:|---:|',
  ...review.rows.filter(c => s.repeatedGains110.includes(c.caseId)).map(c => `| ${c.caseId} | ${ratio(c.pairedSpeedupMedian)} | ${c.fasterPairs}/5 | ${c.leftMedianMs.toFixed(2)} | ${c.rightMedianMs.toFixed(2)} | ${c.pairedDeltaMs.toFixed(2)} |`),
  '', '## 입력별 결과', '',
  '| 입력 | 최초비율 | 반복비율 | EXACT OFF/ON | 실행/요청pairs | 빠름/느림 | ΔON−OFF(ms) | OFF편차 | ON편차 | 비율편차 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...review.rows.sort((a, b) => a.caseId.localeCompare(b.caseId)).map(c => `| ${c.caseId} | ${ratio(c.initialRatio)} | ${ratio(c.pairedSpeedupMedian)} | ${c.leftExact}/${c.rightExact} | ${c.executedPairs}/${c.requestedPairs} | ${c.fasterPairs}/${c.slowerPairs} | ${c.pairedDeltaMs?.toFixed(2) ?? '—'} | ${percent(c.offSpread)} | ${percent(c.onSpread)} | ${percent(c.ratioSpread)} |`),
  '', '## 한계', '',
  '- timeout과조기종료입력의완료시간은알수없다.최초2쌍실패후늦은반복에서완료될가능성을시험하지않는운영정책이다.',
  '- 보드/반전/필터의관련성이있으며독립보드100개가아니다.반복은VM잡음재현성확인이며데이터편향을해결하지않는다.',
  '- 큰paired차이와절대ms/방향일관성을함께해석한다.짧은입력의큰비율만으로일반적효과를주장하지않는다.',
  '- 제품dev/main/기본값/routing/CP선택정책은변경하지않았다.제품기본ON은독립데이터와실제품경로검증및별도승인이필요하다.',
  '- 원자료는Actions artifacts,장기검산요약은reports/root-confirm.json,root-repeat-review.json에보존한다.',
];
writeFileSync(new URL('./ROOT_FORCED_REPEAT_REPORT_KO.md', import.meta.url), md.join('\n') + '\n', { flag });
console.log(JSON.stringify(s, null, 2));
