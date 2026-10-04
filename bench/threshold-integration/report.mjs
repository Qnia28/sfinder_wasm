import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
const root = process.env.THRESHOLD_INTEGRATION_RESULTS || 'bench/threshold-integration/results';
const initial = JSON.parse(readFileSync(`${root}/review/review.json`));
const selection = JSON.parse(readFileSync(`${root}/review/selection.json`));
const control = JSON.parse(readFileSync(`${root}/control/control-review.json`));
const correctness = JSON.parse(readFileSync(`${root}/correctness/abi.json`));
const browser = JSON.parse(readFileSync(`${root}/correctness/browser.json`));
assert.deepEqual(control.wasmHashes, initial.wasmHashes);
assert.equal(correctness.matrices, 200); assert(correctness.currentActivation > 0 && correctness.rootActivation > 0);
assert.deepEqual(browser.map(r => r.mode), ['S', 'D', 'C', 'A', 'B']);
for (const r of browser) { assert.equal(r.wasmHash, initial.wasmHashes[r.mode]); assert(r.cancellation.reclaimed && r.restarted); }
const repeated = existsSync(`${root}/recheck-review/review.json`) ? JSON.parse(readFileSync(`${root}/recheck-review/review.json`)) : null;
assert.equal(Boolean(repeated), selection.cases.length > 0);
const rows = repeated?.perCase || [], resolutions = rows.map(r => ({ caseId: r.caseId, cohort: r.cohort,
  comparison: `${r.left.engine}/${r.right.engine}`, ratio: r.pairedSpeedupMedian, deltaMs: r.pairedDeltaMs,
  faster: r.fasterPairs, slower: r.slowerPairs, completePairs: r.pairedComplete,
  material: (r.sideRegression || r.pairedRegression) && r.slowerPairs >= 8,
  completionDiscordance: r.completionDiscordance, memoryAlert: r.memoryReview,
  smallConsistentSlowdown: r.slowerPairs >= 8 && r.pairedDeltaMs > 0 && r.pairedDeltaMs < 5 }));
const fmt = x => x === null || x === undefined ? '-' : x.toFixed(3);
const lines = ['# 제품 threshold 후보 통합 검증', '',
  `- Actions: https://github.com/Qnia28/sfinder_wasm/actions/runs/${initial.runId}`,
  `- 준비 소스 ${initial.candidate}. D=원본Dev,C=비활성대조,A=currentPropagation,B=A+rootForced. 제품 기본feature는OFF이며Dev/main/배포변경없음.`,
  '- D는현재DevRust의재빌드기준이다. 기존추적WASM(S)에는DevRust에이미있는export4개가없어별도보존/동등성검사하며,기존asset그대로와의속도개선이라고주장하지않음.',
  '- 기존제품API/ABI로비교. candidateA/B는실험mask16/20과별도동등성검사. 라우팅/100K/CP60초정책변경없음.',
  `- 기본선정32입력각5쌍. 요청 ${initial.requestedSamples},실제 ${initial.executedSamples},EXACT ${initial.exact},TIMEOUT ${initial.timeout},미실행 ${initial.skippedSamples}.`,
  '- 같은VM직렬fresh process,고정작은warm-up,AB/BA교대,호출당300초,동시최대10shard. 완료비율과timeout을별도로보고함.',
  '- targeted16cycle1+16QB이며모집단성능추정이아님. cohort별/기본·재확인별분리. 서로다른WASM의시간을옛실험캠페인과합치지않음.', '',
  '| cohort | 비교 | 완료쌍있는입력 | 완전5쌍 | geomean | 빠름/느림 | OFF-only/ON-only쌍 |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...initial.comparisons.map(c => `| ${c.cohort} | ${c.left.engine}→${c.right.engine} | ${c.pairedMatrices}/${c.cases} | ${c.fullyPairedMatrices} | ${fmt(c.geomean)} | ${c.faster}/${c.slower} | ${c.offOnlyPairs}/${c.onOnlyPairs} |`), '',
  '## 재빌드·비활성 대조 bridge', '',
  `고정6개짧은입력 S/D 및D/C각5쌍,실행 ${control.executedSamples},EXACT ${control.exact},TIMEOUT ${control.timeout}. 주32개측정과합산하지않음.`,
  ...control.comparisons.map(c => `- ${c.cohort} ${c.left.engine}→${c.right.engine}: geomean ${fmt(c.geomean)},빠름/느림 ${c.faster}/${c.slower}.`), '',
  '## 정확성·활성화', '',
  `- 보존행렬 ${correctness.matrices},독립synthetic oracle ${correctness.synthetic},검사 ${correctness.checks}. 실제product ABI에서A/C states차이 ${correctness.currentActivation},B/A차이 ${correctness.rootActivation}: 비활성route만시험한것이아님.`,
  '- native C/A/B예산·locks·상태undo및제품Worker/portfolio/실제CP회귀는각artifact에보존. Chromium S/D/C/A/B는실제제품모듈API와Worker취소/회수/재실행을검사했다. S는원래없는progress API의통과로계산하지않음.', '',
  '## 재확인', '', selection.criteria,
  `추출입력 ${selection.cases.length}. ${repeated ? `새10쌍요청 ${repeated.requestedSamples},실행 ${repeated.executedSamples},EXACT ${repeated.exact},TIMEOUT ${repeated.timeout},미실행 ${repeated.skippedSamples}.` : '경보기준해당입력없어추가측정없음.'}`,
  '| 입력 | 비교 | ratio | paired Δms | 빠름/느림 | 완료쌍 | material/완료차이/메모리 |', '|---|---|---:|---:|---:|---:|---|',
  ...resolutions.map(r => `| ${r.caseId} | ${r.comparison} | ${fmt(r.ratio)} | ${fmt(r.deltaMs)} | ${r.faster}/${r.slower} | ${r.completePairs} | ${r.material}/${r.completionDiscordance}/${r.memoryAlert} |`), '',
  'material 재현은≥10%+≥5ms이며≥8/10느림. 5ms미만작은반복지연도JSON에보존하고실제작업의반복호출영향을따로판단함. 새재확인에서처음발견된경보도제외하지않음.', '',
  '## 기본 입력별 결과', '', '| 입력 | 비교 | ratio | OFF native ms | ON native ms | paired Δms | OFF/ON product ms | EXACT L/R | 빠름/느림 |', '|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ...initial.perCase.map(r => `| ${r.caseId} | ${r.left.engine}→${r.right.engine} | ${fmt(r.pairedSpeedupMedian)} | ${fmt(r.leftMedianMs)} | ${fmt(r.rightMedianMs)} | ${fmt(r.pairedDeltaMs)} | ${fmt(r.leftProductMedianMs)}/${fmt(r.rightProductMedianMs)} | ${r.leftExact}/${r.rightExact} | ${r.fasterPairs}/${r.slowerPairs} |`), '',
  '## 범위', '',
  '- 브라우저검사는실제Chromium에서기존제품모듈/API/Worker/취소/회수/재실행을수행하는엔진라이브러리검사다. 이저장소에는소비앱UI가없으므로최종소비앱의입력UI/렌더링검증완료라고주장하지않는다.',
  '- 성능nativeMs에는Rust ABI변환/준비/검색이포함되고productMs=solverMs에는변경없는제품minimumCoverAtCount의JS검증/packing/결과회수가포함됨. 요청metadata준비는측정밖이며호출당threshold export는1회로검사함. Browser worker왕복시간은분리된correctness artifact의설명적수치이며5paired benchmark와합산하지않음.',
  '- raw witness·모든input/build/source hash·기존최적witness hash·실행/미실행count를감사함. GitHub동시성과소스blob의추가로컬감사는workflow완료후수행한다.',
];
mkdirSync(`${root}/final`, { recursive: true });
writeFileSync(`${root}/final/report.md`, lines.join('\n') + '\n', { flag: 'wx' });
writeFileSync(`${root}/final/resolution.json`, JSON.stringify({ selected: selection, resolutions,
  decisionAlerts: resolutions.filter(r => r.material || r.completionDiscordance || r.memoryAlert),
  smallConsistentSlowdowns: resolutions.filter(r => r.smallConsistentSlowdown) }, null, 2) + '\n', { flag: 'wx' });
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.slice(0, lines.indexOf('## 기본 입력별 결과')).join('\n') + '\n');
console.log(JSON.stringify({ comparisons: initial.comparisons, resolutions }, null, 2));
