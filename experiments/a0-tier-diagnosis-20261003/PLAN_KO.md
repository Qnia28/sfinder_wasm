# Astra 후속 — 한 입력의 엔진 실행 단계 개입과 컴파일 추적

사용자: “이어서 진행하라. 계획에 있는 것은 끊지 말고 계속 진행해도 됨.”

## 목표

board-028의 CPU 실행 시간이 엔진 코드 생성 단계에 따라 크게 달라지는지 직접 확인한다. 9V45에서 기록된 Cold R3.82초/A5.73초의 기전을 특정하지 않은 상태를 그대로 유지하며, 새 호스트에서 추정만으로 기전을 확정하지 않는다.

직전 9V74 단일 입력24호출에서는 모든 독립 첫 호출이 약6초였고 선행 실행 효과는1% 미만이었다. 일반적인 대형 공유 효과는 관측되지 않았다. 호스트가 바뀌어 affinity가 원인이라고 귀속할 수 없었다.

## 고정 실험

- 입력1개, 동일WASM73224bda…/원seed/K/weightedrows/primaryproof 불변. R/A제품코드 불변.
- 각 호출은 fresh launcher+engine process+fresh Worker이며 자기 반복/선행 타 variant 호출이 없음.
- DEFAULT: 기본Node24.13.0의엔진정책.
- LIFTOFF_ONLY: `--liftoff-only`, 진단용으로 최적화 compiler 사용을 막는 설정.
- OPTIMIZED_FIRST: `--no-liftoff --no-wasm-lazy-compilation`, 최적화 compiler와 eager compilation을 선택하는 설정.
- 위 명칭은 **요청한 설정**이다. 실제 compiler 종류는 별도 추적 로그로 확인한다. 컴파일 완료만으로 모든 실행 frame의 tier를 직접 관측했다고 주장하지 않는다.
- 3개 고정block×3mode×R/A = 비계측18호출. mode순서는Latin배치, R/A순서도교차한다.
- 별도trace3mode×R/A =6호출. 합계최대24호출. trace는비계측뒤에수행하고시간비교자료로대체하지않는다.
- trace flags: `--trace-wasm-compilation-times --trace-wasm-lazy-compilation`. trace호출에서만core/alloc facade계측을함께사용한다. getter마다timer를넣지않는다.
- Worker시작/초기화완료/API시작/API반환 marker를로그에기록한다. 로그수신시간은engine내부이벤트정확한발생시간이아니므로경계근처순서를과도해석하지않는다.
- tracestdout/stderr은별도writer append/fsync로보존. wasmexport functionindex와body크기는정적section parser로기록한다. binary에Rust함수이름section이없으므로export를DFS내부함수명으로잘못명명하지않는다.
- 한표준publicrunner에서직렬실행. 호출Worker OSthread는최저허용logicalCPU에고정한다. 다른compilerthread/주파수/SMT경쟁을고정하지않는다. 좋은호스트가나올때까지실행하지않는다.

## 바뀐 진단 제한과 예산

엔진flags로느린실행이발생할수있어이번진단만API30초/process45초/startup45초/audit30초/durableACK10초/reap2초로고정한다. 모든mode에동일하다. 제품10초/30초정책과직전원장은변경하지않는다.

startup은sessionready이전45초와call시Worker준비45초를독립으로포함할수있다. percalladmission 최악177초. 전체상한으로모든call완료를보장하지않는다.

- compute17분/job20분/runnercap1/3h/maxparallel1,보존여유3분.
- **캠페인시계는최초원인진단run37096100399의2026-10-03T04:18:25Z부터계속계산한다.** compute06:58:25Z/취소07:13:25Z/전체07:18:25Z이며새workflow로초기화하지않는다.
- 직전실제runner0.34583h+0.04833h. 이번최대1/3h를더해도전체64h이하. paidservice없음.
- 시간소진은NOT_RUN_BUDGET,mode별timeout은기록하고다음독립call의예산을온전히유지한다. timeout원결과를성공결과로치환하거나자동예산상향하지않는다.
- OOM/원quality/stableIDs/seed계약오류/protocol/persistence오류는중단. 실패artifact도보존한다.

## 판정과 다음 단계

1. 강제tier간큰차이가나고compiler로그가설정과일치하면 **engine코드생성단계가이입력의실행비용에영향** 을준다는가설이강해진다. 과거9V45기전까지같다고확정하지않는다.
2. 양variant가같은tier에서비슷하면고정적인A0검색관리비용만으로큰차이를설명하는가설은약해진다. 작은native비용까지배제하지않는다.
3. 같은tier에서도A만지속적으로느리면그때native내부구간계측을검토한다. states동일을상태당작업량동일로취급하지않는다.
4. trace가actualtier를확인하지못하면미확인으로보고한다. 로그형식에맞춘분석수정은원로그불변으로수행하며nativecall을재실행하지않는다.
5. timeout/partial도답이다. 성공한호스트/flag만골라보고하지않는다.

원인진단계획내추가분석은계속할수있지만제품JS/Rust변경/브라우저전체route실험/공식232재벤치마크/675효과campaign/미검증exactthreshold확대/Dev적용/mainmerge/배포는이번범위밖이다. flags를제품정책으로채택하지않는다.

source/harness/workflow/actionhash/input/schedule/환경설정을nativecall전에LOCK에동결하고실행후독립검산·증거봉인을수행한다. 이전seal/failure는불변이다.
