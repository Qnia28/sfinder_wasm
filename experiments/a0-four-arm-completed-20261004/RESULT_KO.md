# R/A0/M1/M2 — 보완 및 Actions 검산 완료

**완료: [Actions37134463920](https://github.com/Qnia28/sfinder_wasm/actions/runs/37134463920) 성공. 성능4,960calls + 별도작업량20calls 모두독립검산통과. M1의개선신호가M2보다강하지만환경경보·새악화가남아제품통합은보류한다.**

## 실행 및 정확성 결과

- 122입력×10four-arm blocks를5standardrunner에서완료. 환경80calls포함비계측4,960calls, 분리계측20calls, 누락/timeout/OOM/error0.
- Linux원본R/A0와feature-offcontrol은모두전체byte SHA256 `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3` 일치. Rust29tests×3mode×debug/release, 합성oracle4,148calls·Worker16calls·workfixture3calls, 하네스4tests·분석5tests통과.
- M1/M2는A0의states/EXACT-CAPPED/전체가중quality/seed/stableIDs와모두일치. 전체4,980calls중EXACT3,685/CAPPED1,295. 실제primary/PC/threshold0.
- 원시기록14,940개, source246blobs, timing+diagnosticruntime768files, 품질·seed재계산9,960회검증. rawfsync-before-ACK와transferred-probe계약확인.
- 캠페인origin15:41:25Z유지, 최종job15:58:16Z종료. wall16.85분, 첫실패build포함0.618889runner-hours. watcher종료, 추가native없음.

## 환경 경보와 판정 제한

환경40blocks중 **2건 >10%**: reserved/host3/R `1.120414`, reserved/host0/M1 `1.125067`. 예약군88개에서R또는M1을포함한관련비교는환경민감으로유지한다. 경보host를제외하거나좋은host로교체하지않았고전체10blocks를그대로분석했다. M2/A0직접비교는두경보arm을포함하지않지만R대비판정은별도제한된다.

개발군34개에서환경경보없는A0대비일관된개선(전체pairedmedian<1, 최소4/5runner방향일치)은 **M1 18개, M2 5개**다. M2/A0직접비교의전체122개같은방향기준은16개지만그중11개는R관련환경경보로joint판정불가다. **환경민감88개를제거한새모집단PASS는주장하지않는다.**

선택122개전체의입력별within-blockmedianratio를다시중앙값낸기술통계(환경민감포함)는M1/A0 `0.953583`, M2/A0 `1.002553`, M1/R `0.965187`, M2/R `0.999519`다. ratio-of-medians가아니지만선택편향·환경민감때문에전체성능gate로쓸수없다.

## 5개 고정 진단 입력의 비계측 관측과 별도 작업량

시간ratio는10블록의pairedmedian이며1보다작으면분자arm이빠르다. 계측시간은이표에넣지않았다. 앞4개는reserved환경민감, board028은개발군이지만개선방향이4/5runner에못미친다.

| 입력 | A0/R | M1/A0 | M2/A0 | M1/R | M2/R | M1 bound-word 감소 | M2 trail-push 감소 |
|---|---:|---:|---:|---:|---:|---:|---:|
| board106 restricted J | 1.0233 | 0.9627 | 1.0004 | 1.0819 | 1.0519 | 78.91% | 64.12% |
| board119 restricted L | 1.0334 | 0.9790 | 0.9895 | 0.9693 | 1.0686 | 86.91% | 45.61% |
| board115 bag ordinary | 1.1510 | 0.7980 | 0.9687 | 0.9228 | 1.2129 | 25.83% | 42.49% |
| board111 restricted ordinary | 0.7866 | 0.9776 | 0.9812 | 0.7552 | 0.7868 | 45.04% | 16.68% |
| board028 restricted ordinary | 0.9994 | 0.9957 | 1.0049 | 1.0028 | 1.0083 | 3.11% | 3.98% |

5개모두M1의boundCalls/prune/trail은A0동일, 검사candidate/word가감소했다. M2의boundCalls/word/prune은A0동일, 실제trailpush+회피push가A0push와정확히일치했다. states/결과동일. **의도한일을덜한다는증거이지, 모든시간차의배타적인과증명은아니다.** activeWASMcode-layout차이가남는다.

board028의host3(보고CPU EPYC9V45)만 A0/R `1.3814`, M2/R `1.4795`, M1/R `1.0346`의큰arm차이가있었다. 다른runner에서같은크기재현은없다. 이입력의개발군환경control은경보없었지만이를CPU기전증명으로해석하지않는다. host3예약군R환경경보와phase도다르며낮은전체중앙값이host이질성을없애는것은아니다. 같은board028의M1boundword감소3.11%만으로그host의큰시간차전체를설명하지않는다.

board115에서M1의관측개선약20.2%/−4.43ms와M1/R0.9228은신호지만환경민감및M1/R개선방향3/5때문에R악화해소PASS로격상하지않는다. M2/R1.2129도전체>10%지만3/5여서고정4/5magnitude기준미충족이다. board106J/119L의전캠페인악화경보가이번기준재현되지않아도원결과를무효화하지않는다.

## 새 악화 보존

M2/A0직접비교는환경control경보없이두입력에서전체>1.10과≥4/5runner를충족했다:

- board107 bag ordinary: `1.164231`, **+1.831ms**, 4/5runner.
- board119 restricted T: `1.149670`, **+0.814ms**, 4/5runner.

M1/A0도board119T `1.180979`/5hosts, board116ordinary `1.104296`/4hosts의관측악화가있지만관련reserved/M1환경경보로환경민감분류다. M1/R·M2/R의각2개magnitude경보도reserved환경민감이다. 경보를삭제하거나성공재실행값으로대체하지않았다.

## 결론과 다음 범위

**M1은추가검토우선후보, M2는일반적시간개선근거가약하며새악화2개가남는다. 두수정결합/제품적용은하지않았다.** 원reservedp95 `1.197846065695026 > 1.10` 실패는유효하다. 본선택집합실험으로원populationgate를재계산하거나PASS를선언하지않는다.

별도승인없이추가캠페인·232/675전체확인·budget증가·warmup/tier강제·CPU/입력별예외·Dev/main/배포를시작하지않는다. 5runner는10독립host가아니며정식유의성주장도없다. [요약JSON](COMPARISON_SUMMARY.json), [입력별CSV](COMPARISON_BY_INPUT.csv), [교차source/진단계약검사](SUPPLEMENTAL_AUDIT.json), [현재상태](STATUS.json)를참조한다.

## 실행 이력 (보존)

최초Actions37134128882에서Linux원본/control전체byte와Rust검사가통과했으나실제입력진입전선별표fixture가WindowsCRLF/LinuxLF차이로실패했다. 동일선별레코드·input/schedule/reference/Rust를유지하고canonicalJSONhash검사로교정했다. 최종실행source는 `f4716e1f2686fa25c4e844e47b51e88835a980da`다. 최초실제입력calls0이므로성능값치환없으며원origin15:41:25Z/deadline18:21:25Z·18:36:25Z·18:41:25Z와예산을reset하지않았다. 최종Linuxgate도다시통과했다.

최초source `1c26726a0b5b3d47be2da667154e39cc9e050343`, branch `validation/a0-four-arm-20261003`. 원본/control로컬byte일치와합성검사통과후실행했다. 최초bundle/교정bundle/source manifest를각각유지한다.

## 보완1 — 무수정 source-control byte 재현

원준비본에서feature-offcontrol의byte가원본과달랐으므로 ABI/결과만맞는대조로벤치마크를허용하지않는다. 원본 `rust/pc-core/src/min_cover.rs` 및module선언을복원하고실험코드를 `min_cover_four_arm.rs`로분리했다. M1/M2/diag/test는격리된빌드tree에만overlay를적용하며기본control은수정모듈을컴파일하지않는다.

이구조의로컬Windowscontrol은원본재빌드 `aac18952a36ee9112219702ce084a9534ad42a244565cc24e0b8f52a79bcd48c`와**전체byte일치**했다. Linux에서는원본hash `73224bda…`재현과control byte일치를모두필수gate로강제한다. 실패하면**성능·실제입력진단0calls**, 기준완화/좋은host선택없음.

active수정은여전히code-layout이바뀔수있으므로시간만으로인과전체를확정하지않는다.

## 보완2 — 실제작업량20calls 별도고정

새악화3개(board106J/119L/115bag), board111ordinary 개선, board028ordinary공통hotspot을 R/A0/M1/M2로각1회계측한다. 원seed/K/weightedrows/IDs/100Kstates유지. 별도standardrunner에서비계측benchmark뒤에실행한다.

- bound calls/candidates/words/cutoff/prune, trail push/avoided push를raw에함께저장.
- M1은A0와같은states/결과/prune을유지하고검사량절감을확인. M2는bound검사동일및trail기록절감확인.
- 진단API30s/process45s는사전고정계측계약. 시간성능통계에절대합치지않는다. 분석기는diagnostic행입력을거부한다.
- rawfsync-before-ACK→품질/seed/stable-ID검산·transfer spy계약확인. 실제primary/PC/threshold0.

## 실행일정과보호조건

기존122개성능selection/schedule/reference는불변. 비계측4,960calls+별도work20calls=**4,980calls**. build30분+bench5jobs각60분+work30분=상한6runner-hours≤64. maxparallel5, child3GiB/swap0. future workflow최초created_at로새캠페인origin고정, compute160/cancel175/overall180분.

사용자가보완후Actions진행을승인했다. 모든Linux사전검사통과시자동으로동결벤치마크→분리진단으로진행한다. 수정결합·232/675확인·Dev/main/배포는범위외다. mismatch/OOM/protocol/계측timeout·hashgate실패는결과를보존하고중단하며검색예산자동증액없음.

## 원증거

[최초준비](../a0-four-arm-preparation-20261003/RESULT_KO.md)의source4508ddd·봉인은변경하지않는다. [독립exact및이전10쌍재테스트](../a0-proof-retest-completed-20261003/RESULT_KO.md)와원reservedp95=1.197846>1.10실패를유지한다. DevHEADc0cb2a0/main/배포변경없음.

실행및artifact는로컬원문과출판용zip/seal로보존한다. 원sealedpreparation·proof/retest는변경하지않는다.
