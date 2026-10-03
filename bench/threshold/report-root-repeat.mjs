import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { reviewRootRepeat } from './review-root-repeat.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = read('./reports/root-confirm.json'), screen = read('./reports/root-screen.json');
const review = reviewRootRepeat(report, screen), s = review.summary;
const args = process.argv.slice(2), at = args.indexOf('--verdict');
const verdict = at < 0 ? 'B' : args[at + 1]; assert(['A', 'B', 'C', 'X'].includes(verdict));
const flag = args.includes('--replace-generated') ? 'w' : 'wx';
writeFileSync(new URL('./reports/root-repeat-review.json', import.meta.url), JSON.stringify(review, null, 2) + '\n', { flag });
const ratio = n => n === null ? '—' : n.toFixed(3);
const percent = n => n === null ? '—' : `${(n * 100).toFixed(1)}%`;
const md = [
  '# rootForced 5회 반복 확인 보고서', '',
  '## 결론과 범위', '',
  `**현재 판정: ${verdict}.** 아래 수치는 cycle1에서 기존rootForced를추가한반복검증이며제품전체의일반화나제품통합완료를뜻하지않는다.`,
  `- [확인run ${report.runId}](${report.url}), commit ${report.candidate.slice(0, 7)}.`,
  '- 주비교mask16→20,보완32/64 OFF.기존100ID/99핵심행렬/41mirror그룹을유지했다.',
  '- 입력별5paired repeats,동시Actions benchmark shard최대8,호출당300초.동일VM직렬AB/BA,fresh processes.',
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
  '', '## 최초 회귀4개의 재현 여부', '',
  '| 입력 | 최초비율 | 반복비율 | paired ΔON−OFF(ms) | 빠름/느림pair | paired경보 |',
  '|---|---:|---:|---:|---:|---|',
  ...s.initialRegressionFollowup.map(c => `| ${c.caseId} | ${ratio(c.initialRatio)} | ${ratio(c.repeatRatio)} | ${c.pairedDeltaMs?.toFixed(2) ?? '—'} | ${c.fasterPairs}/${c.slowerPairs} | ${c.pairedRegression} |`),
  '', '## 특이사항과 추가 확인', '',
  `- 4회이상느린material회귀,완료차이,메모리경보에의한추가확인대상: ${s.followup.map(c => `${c.caseId}(${c.reasons.join(', ')})`).join('; ') || '없음'}.`,
  '- 편차10%만으로대규모재테스트를자동시작하지않는다.여기에대상이있으면추가확인전의잠정보고서이며판정에영향주는case만10회확인할수있다.',
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
