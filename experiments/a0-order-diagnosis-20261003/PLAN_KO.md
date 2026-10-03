# Astra 후속 단일 입력 원인 탐색 계획

## 승인과 질문

사용자: “Astra에 따라 구체적인 탐색 계획을 세우고 실행하라.”

목표는 board-028의 Cold R3.82초/A5.73초 차이를 **자기 반복 실행이 아니라 선행 타 variant 실행/프로세스 수명** 으로 설명할 수 있는지 구분하는 것이다. 큰 benchmark를 다시 수행하지 않는다.

직전 자료 재분석: block0 공유 세션에서 A는 자신의 첫 warmup부터3.819초였다. 선행R은3.839초였다. Cold R/A 순서는교차했으나 R빠름/A느림이 유지됐다. 최초 A가 이미 빠르므로 “A를4회 warmup했기 때문”으로 설명할 수 없다. block1 CPU는9V74,block0은9V45다. 큰 입력은직전coreprofile대상이아니었다.

## 고정 설계

- 입력1개: `board-028--restricted-split--ordinary`. 원compressedsegment/weightedrows/K/seed/primaryproof/stableIDs불변.
- WASM `73224bda…`, 제품R/A불변. R은보호baseline JS, A는기존minimalcandidate JS. 변경은진단코드뿐이다.
- 총16개freshprocess session: R단독,A단독,R→A,A→R 각4회. 총24개nativeintegrated100Kcall.
- 모든조건에서동일createWasmSolver loader경로와새Worker를사용한다. pair에서첫Worker는두번째call완료까지살아있지만재호출하지않는다. 자기warmup은0이다.
- 4block에각조건을1개씩배치하는고정Latin순서. 임의host선택/retry/성공결과치환없음.
- 한publicstandardrunner에서직렬실행. 각Worker의호출OSthread는같은허용logicalCPU에고정한다. threadCPU와processCPU를구분한다. compilerthread/CPU주파수/SMT경쟁은고정하지않는다.
- 최저allowedCPU는sourcefreeze이후runner환경에서기계적으로선택하고원장에기록한다. 좋은CPU를찾아선별하지않는다.

## 질문과 판정

1. A단독 vs A첫번째(AR) — 같은첫호출이므로경로통제확인.
2. R단독 vs R첫번째(RA) — 대칭확인.
3. A단독 vs R후A(RA) — 선행R효과.
4. R단독 vs A후R(AR) — 선행A효과.
5. 결과결정성/100K/원quality/stableIDs를모두감사한다. states수동일은상태당작업량동일의증거가아니다.

원인선별ratio 중하나라도0.9~1.1밖이면계측RA/AR를각1session추가한다(4call). 이10%는**진단구간선택기준**이지제품PASSgate가아니다. 계측결과로24개일반결과를대체하지않는다. coreexportwall은Rust전처리+탐색+runtime이다. getter마다timer를넣지않는다.

최대28개call. 후속engineflags/compilationtrace/내부Rusttimer/browser실험은이번자동실행범위밖이다. 새자료로확정할수없는기전은미확정으로종료한다.

## 운영/보존

- API10초/process30초/startup30초/audit30초/writerACK10초/reap2초는독립calltimer. 이전call시간으로다음예산을깎지않는다.
- raw는별도writer의append/fsync후ACK하고검산한다. timeout/partial/오류도보존하고재실행하지않는다.
- session전체cgroup3GiB/swap0. pair에서peak는두Worker를포함한누적값이고제품memorygate가아니다.
- compute10분/job15분/runner상한0.25h/maxparallel1. 시간부족은NOT_RUN_BUDGET으로봉인한다. 전체캠페인3h/64h보다작다.
- workflow는분리validationbranch의launch.json push에만기동한다. 새workflow는defaultbranch에없으므로defaultbranch를수정하거나merge해dispatch하지않는다. 증거commit은launchpath를변경하지않아재실행되지않는다.
- source/harness/workflow/actionhash/schedule/input은LOCK에동결한뒤nativecall을허용한다.
- 실제primary/PC/threshold/공식232확인/제품변경/Dev적용/mainmerge/배포0. 미검증exact1개는이번범위밖이고미해결그대로다.

## 대응 결정

- 선행export이후두번째call만큰폭변화 → process내공유실행상태가설강화,실제module/코드tier확인계획을제안.
- 고정CPU에서차이소멸 → CPU고정과새host가동시에바뀌었으므로CPU원인으로확정하지않음. 관측조건의비재현으로보고.
- 고정조건에서도A첫call이반복적으로느림 → cold특유codepath/tier가설강화,core구간계측으로위치확인.
- core에지속차이가남음 → 그때Rust내부계측제안. 바로trail최적화하지않음.
- 어떤경우에도기존p95failure를PASS로바꾸거나warmup/ID예외/게이트완화를제품에추가하지않음.
