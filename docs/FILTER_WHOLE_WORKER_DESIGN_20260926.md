# 다음 구현 단위 — 고정 baseline의 필터 전체 worker

후속 상태: opt-in `filterWorkers:2` 구현 및 Node7/7·기존회귀33/33·Chrome4primary/전체필터결과/하위worker취소 검증 완료. 기본값0을 유지한다. 아래는 구현 전 계약이며 최신 구현·검증은 [구현 보고](FILTER_WHOLE_WORKER_IMPLEMENTATION_20260926.md)를 따른다. 작은12job pilot은 별도 동결 후 Luna 실행 단계다.

## 목표와 한 가지 비교

엔진정책은현재baseline으로고정한다. per-save의 **필터행렬→primary K증명→secondary 품질/tie증명** 전체를worker로옮겨여러필터의탐색을겹친다. CP정책탐색/threshold예산변경과섞지않는다. 향후성능비교는기존실행경로vs전체필터2-worker 두조건,각2회만출발점으로한다. 4-worker비교는자동추가하지않는다.

## 확인된 현재 경로

- `per-save-minimals-core.mjs:255` compact경로와`:393` numeric경로,`:465` 일반경로가각필터에서 `minimumCoverAdaptiveAsync`를await한다. 같은요청의열거·품질수집은이미공유한다.
- `min-cover-adaptive.mjs:164–177`가primary kernel/backend/K를호출스레드에서확정한후`:205–210`에서만secondary를위임한다.
- `exact-secondary-pool.mjs`의auto는2slots이며무거운threshold만위임한다. payload용CSR을slice해서owner의buffer가detach되지않게한다. 현재dispose는queued/active promise를reject하고workers를terminate한다.
- `exact-secondary.worker.mjs`의prepared.primaryCases는빈배열이다. 이것은**secondary전용표현**이므로whole-primary worker로그대로재사용하면안된다. primaryCases가실제원본커버행을가리키는완전한numeric표현을새로만들어야한다.
- `ortools-min-cover.mjs:22–52`는별도nestedworker를만들고내부2-worker를사용한다. 필터2개가동시에실행되면CP-SAT계산worker는최대4개가될수있다. 외부필터worker수와solver내부예산을따로관리해야한다.

## 구현 순서와 소유권

1. `filter-cover-task.mjs`(신규 예정): 요청소유CSR→전송payload→worker내완전한numeric표현복원,반환minimal계약. 순수직렬호출과worker호출이동일한 `minimumCoverAdaptiveAsync`를사용하게한다.
2. `filter-cover.worker.mjs`/`filter-cover-pool.mjs`(신규 예정):WebAssembly.Module공유/각slot독립instance,request/jobID대조,lazy시작,backpressure,오류/취소/종료회수. 기존secondarypool의검증된수명패턴을따르되불완전primary표현은공유하지않는다.
3. per-save의세경로에내부opt-in분배를연결한다. 전체필터pool이활성일때기존secondarypool을동시에만들지않는다. `await`로필터를하나씩끝낼때까지대기하지않고제한된queue에제출한뒤표시순서대로모은다.
4. ordinary minimals에도동일task표현을사용할수있게하지만작업1개를무조건worker로옮기는기본변경은후속측정전하지않는다. 기존tiny/direct로컬경로의동작을유지한다.

owner는board/geometry/byKey/표시순서/pcSuccess/전체큐/coverage복원을보유한다. worker에는직렬화가능한keys,CSR offsets/ids/qualities,case순서·ID,primary요청,quality모드/상태예산만보낸다. solver객체/closure/Map의암묵적class정체성은보내지않는다.

원본중복행과빈실패큐의분모구분을유지한다. CSR로보내는것은활성커버행이며owner의전체큐수와caseID매핑을별도로보유한다. primary kernel결과로원본secondary행/후보를덮어쓰지않는다. primary용numeric/JSfallback표현도실제행을보유해야한다.

## worker·메모리·취소 계약

- 첫구현은명시적opt-in2filter slots,총solver계산예산4이하. Rust/HiGHS1,ORTools2설정유지. auto backend가ORTools일수있는작업은처음부터2토큰예약하는보수적방식을쓴다. 새hardness추정기를추가하지않는다.
- parent요청이끝날때pool도끝나는request-local수명부터시작한다. 영구runtime/cache공유는추가하지않는다.
- 전송용복제는ready slot에보낼때만만들고대기필터의CSR을미리전부복제하지않는다. 원본buffer를transfer해owner의최종결과생성을깨뜨리지않는다. 전송byte와worker RSS/가능한WASM메모리를계측한다.
- requestAbort/jobID/응답세대체크로취소후결과유입을차단한다. 동기Rust중에는협력취소가안되므로worker종료가필요하다. ORTools nestedworker회수가Node/브라우저모두검증되기전에는취소안전하다고판정하지않는다.
- 실패시남은queued/active작업을정리하고요청을명시적으로실패시킨다. 완료하지않은품질을exact로반환하거나동일요청을자동재실행하지않는다.

## 작은 정확성 gate부터

- CSR roundtrip에중복가중행/활성case매핑/stable-ID/원본buffer비detach/JSfallback primary행검증.
- 실제primary K+secondary를통과하는소형fixture로직렬vsworker결과일치. 미리저장된K를입력해secondary만실행하는시험은전체작업검증이아니다.
- 비순서완료후표시순서보존,queue상한/토큰상한,빈필터/tiny/direct경로,worker시작실패·도중오류·취소·nestedworker종료검증.
- primary선택(auto/Rust/HiGHS/ORTools)과fast/exact계약을확인한다. 품질callback을throw-only로대체할경우fast/refinement경로가실제요구하는접근을먼저확인한다.
- 실제host측정은위gate후고정된소형ordinary/per-save회귀만2조건×2회로정한다. 이번95입력secondary행렬을그대로“primary전체성능벤치”라고재사용하지않는다. 새열거/카탈로그전수비교는자동수행하지않는다.

## 담당

Astra가구현·gate·동결,새Luna가승인된작은검증실행·진행확인·보고를담당한다. Sol없음. Luna는시작전notifier capability check,완료후durablequeue통지를사용한다. 본문은성능향상확정이나실행승인이아니다.
