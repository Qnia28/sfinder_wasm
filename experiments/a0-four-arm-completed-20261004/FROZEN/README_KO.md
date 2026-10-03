# R / A0 / M1 / M2 — 4군 비교 준비

**사용자 승인으로 두 보완을 완료하고 Linux 사전 gate부터 실행한다. 제품 적용 아님.** 원 준비 증거는별도봉인으로유지한다.

## 보완된 실행 계약

1. feature-off control은Linux원본과 **full-byte 일치가필수**다. 다른경우 `BLOCKED_CONTROL_BINARY_DRIFT`로벤치마크및실제입력진단0calls. 원본 `min_cover.rs`와모듈선언은그대로두고수정은별도 `min_cover_four_arm.rs` overlay를격리빌드tree에만적용한다. 로컬Windowscontrol도원본aac18952…와byte일치했다. M1/M2의feature는overlay빌드에서만활성화한다. 원제품모듈을수정해feature-off 코드배치를흔들지않는다.
2. 비계측4군4,960calls가끝난뒤별도standardrunner에서 **작업량진단20calls**: 새악화3개(board106J/119L/115bag), board111ordinary, board028ordinary ×R/A0/M1/M2. 원K/seed/100K·3GiB/swap0유지. 계측API30s/process45s는시간성능의확대예산이아니라사전고정work-count진단계약이며시간통계에넣지않는다. per-call deadline·rawfsync-before-ACK 유지, 실제primary/PC/threshold0.
3. 전체실제native4,980calls. build30분+bench5×60분+work30분으로runner-hours상한6≤64. 원캠페인시계는reset하지않고새최초workfloworigin을사용한다. build실패/정확성불일치/계측timeout은고정예산에서정지하며자동확대재시도없음.
4. `DIAGNOSTIC_SCHEDULE.json`과 `audit-diagnostics.py`로하한호출/후보/word/cutoff/prune/trail기록·생략을분리검산한다. M1은A0와states/prune동일및검사word감소, M2는A0와하한검사동일및trail감소를확인한다. 진단행을성능분석기에넣으면assertion으로거부한다.

아래최초준비설명중 **미승인/진단0/상한5.5/합성호출4,159**는준비당시상태다. 현재승인계약은이보완과CAMPAIGN/DIAGNOSTIC_SCHEDULE/launch.json이우선하며Linuxgate통과는실제완료뒤에만주장한다. 보완후합성예정WASMcalls4,167=oracle4,148+Worker16+workfixture3이다.

## 1. 가설과 독립 후보

| 군 | Rust 소스/feature | 역할 |
|---|---|---|
| R | 원본c0cb2a0, 비분할 | 제품 기준선 |
| A0 | 원본c0cb2a0, 형제 분할 | 기존 A0 기준선 |
| M1 | A0 + `pc-core/a0-lower-cutoff` | 정확한 max_gain 대신 동일 가지치기 판정의 조기 종료 |
| M2 | A0 + `pc-core/a0-last-sibling` | 마지막 형제/예산 종료 뒤 불필요한 제외 기록 생략 |

M2는 M1을 포함하지 않는다. 두 feature 동시 활성화는 compile_error다. 기본 feature는 모두 off, R에 A0를 결합하지 않는다. Dev/main과 저수준partitioned=false 기본값·Fast·trivial/primaryHard·decomposition·CP60s·전달probe 계약은 변경하지 않는다.

M1 동치식: 남은 행r>0, 남은 선택수s>0일 때 `ceil(r/max_gain)>s`는 `max_gain<ceil(r/s)`와 동치다. 후보의 부분 gain이 ceil(r/s)에 도달하면 해당 하한으로는 prune할 수 없으므로 즉시 반환한다. 선택 순서용 gain, 후보 universe, pivot, state budget은 변경하지 않는다. M2는 다음 형제가 없을 때만 해당 프레임의 새 제외 기록을 생략하고 조상 제외는 보존한다.

## 2. 대상과 일정

- 기존 승인 선별121개(개선/악화tail·원 경보·≥10%변동·6controls)를 **전부 유지**하고 board028 ordinary 공통lower-bound hotspot1개를 추가한122개.
- 원 압축pack·offset/hash·K/seed·가중중복행·stable IDs·aliases·최소K증명 불변. `INPUTS.json`, `SELECTION.json`, `REFERENCES.json`으로 고정.
- 각 입력10blocks, block당 R/A0/M1/M2 각1call.5runner×2blocks. 비교4,880calls+동일variant 환경대조80calls=**4,960calls**, runner당992calls.
- Williams4순서로 위치/직전variant를 균형 배치한다. 입력별10blocks라 완전 동일 횟수는 불가능하지만 각 arm-position 및 서로 다른 arm의 직전관계는2또는3회로 차이≤1이다. 분석은 동일block 비교, host별2blocks를 독립10host로 보지 않는다.
- 환경대조는 기존 hash선별 development/reserved 입력각1개, 각runner·각arm2calls. max/min>1.10경보. 경보host삭제·교체 없음.

## 3. 빌드와 사전 gate

- Linux Rust1.90.0/Node24.13.0, 같은 compiler/release/LTO옵션으로 원본·M1·M2를 빌드. R/A0는 **같은 원본재빌드 WASM**을 사용하고 SHA256 `73224bda…`와 byte 일치해야 시작 가능.
- 원본JS R은c0cb2a0, A0/M1/M2 JS는기존후보f0bc264와 동일. measured exports 동일, diagnostic exports 부재 확인. root제품WASM은 덮어쓰지 않는다.
- 후보source의 feature-off control도 합성 검사한다. 이 control은 다섯번째 성능군이 아니다. 독립binary의 코드배치/compiler차이가 있어 **시간만으로 하한/trail 원인 전체를 확정하지 않는다**.
- Windows 원본재빌드는Linux와 다른 `aac18952…`로 합성ABI 검사에만 사용한다. Windows source-control도원본과byte는달랐으나 결과/states 합성parity확인. Linux byte재현 gate를 완화하거나Windowsbinary를제품에 넣지 않는다.
- frozen 원본Rust참조와 두 histogram설정, 무제한/0/작은/완료state경계에서 결과·states·CAPPED incumbent parity 테스트를 준비했다. 완전탐색oracle, u32최대quality, 중복후보·가중행·조상제외·마지막형제·budget unwind 포함.
- Linux build job에서 Rust debug/release×3mode, WASM합성oracle, 실제Worker IPC/transfer fixture, negative watchdog, 분석기 계약을 **모두 통과한 뒤에만** benchmark jobs를 허용한다.

## 4. 실행 계약과 예산

future workflow 최초run.created_at를새캠페인origin으로고정한다. 구캠페인종료상태유지. compute160분/cancel175분/overall180분,64runner-hours. build30분+5benchjobs각60분=상한5.5runner-hours, maxparallel5≤16.

fresh unpinned Worker당 integrated100K1call, warmup0. child3GiB/swap0, startup30s/API10s/process30s/audit30s, durable ACK10s/reap2s. raw fsync-before-ACK 후 검산·다음호출. threshold는spy계약검사만, 실제primary/PC/threshold0. diagcounter는별도합성빌드에서만검사하며 비계측성능군에포함하지않는다.

block전체668s(환경pair334s) admission, job55분compute guard. 최악예산으로전체호출이맞지않으면NOT_RUN_BUDGET. 진행중미완료block·timeout·오류를보존하고 완전10blocks입력만판정한다. mismatch/OOM/protocol오류는해당runner즉시정지, 전체결론BLOCKED. 자동증액·성공rerun치환·추가host선별 없음. 전체3h절대취소는 `watch.py <runId> <runId>` controller로 감시해야 한다.

## 5. 분석·판정

`audit.py <download-directory>`는Gitblob/build/runtime/hash/raw/fsync원장·원가중quality/seed/IDs·원최소K증명·state/completed/전달계약을검산한다. M1/M2는 A0와 원probe전체가동일해야한다. R은R원참조와비교하며 R/A0의states/completed차이를오류로취급하지않는다.

동일block의 A0/R, M1/A0, M2/A0, M1/R, M2/R, M1/M2를 모두보고한다. 전체쌍median/절대delta/host별2쌍median/variant변동을분리한다. 환경경보는관련arm비교별로표시한다.

- 수정/A0<1이전체및≥4host에서유지: 방향상 개선(통계적유의성 주장아님).
- 수정/A0가개선돼도 수정/R>1.10이전체및≥4host에서남으면 **부분개선, R대비악화잔존**.
- 동시대A0/R악화가관측되고 수정/R이전체및≥4host에서≤1.10으로내려간경우만 `R_GAP_REDUCED_BELOW_ALARM` 기술적분류. 기준안으로내려간것이지R보다빠름을뜻하지않는다.
- 동시대A0/R악화자체가재현되지않으면 “과거악화해소”라고하지않고 새로운절대비교만보고한다.
- memory/CPU·원probe states도보존하며 selected set을전체모집단PASS로바꾸지않는다. 원reserved p95=1.197846>1.10은유지.

## 6. 현재 준비 결과와 실행 전 남은 사항

로컬4군+합성control WASM재빌드, 완전탐색oracle122개·4,148WASMcalls parity(70/252행multiword antichain포함), Worker8합성calls·저장/전달계약, watchdog/일정tests4개, 분석tests4개, Rust3mode의WASM용test컴파일을검사한다. diagnostic합성3calls에서M1bound word9→4, M2trail push5→2이며states6/품질/IDs는동일했다. **실제 입력에서의성능개선 측정은아직0회**다. 최종로컬실행상태는준비결과STATUS.json에기록한다.

Windowsnative Rust harness는실행환경문제로실행불가였으므로 Rust debug/release **실행통과로보고하지않는다**. Linux실행검사는필수preflight gate로남아있다. LinuxWASM hash재현·cgroup·artifact전달의hosted검증도실행전미확인이다.

현재launch.json은없다. 사용자실행승인후에만 해당파일을 `status=AUTHORIZED_EXECUTION`으로작성하고isolated branch를commit/push한다. workflow가build부터시작하며 build실패시벤치마크0calls. 승인된run은절대wall watcher를동시에시작하고완료후artifact를감사한다. 수정결합·전수232/675·Dev/main적용은별도승인사항이다.

공통규칙원문은동결 `TESTING_RULES_KO.md` v1.1이다. 이 문서는4군block순서/40calls를명시하는이번실험의추가계약이며 기존규칙을사후수정하지않는다.
