# 전체 필터 worker opt-in 구현

## 최신 pilot 결과

Luna가 12/12 jobs를 약85초에 완료했다. Astra 감사에서 105파일 해시와 6대응쌍·원본가중품질이 일치했다. 작은 명시적dispatch는 +67~69ms 회귀, 실제 J/T행렬묶음은 약1.5~2.0% 감소였다. **기본filterWorkers=0 유지, opt-in2만 보존**한다. 추가반복/4-worker 비교는 수행하지 않는다. [독립 감사와 결정](../../tools/validation/filter-whole-worker-audit-20260926/ASTRA_AUDIT_KO.md).

## 반영

- `filter-cover-task.mjs`: 원본CSR전송/실제primaryCases복원/quality callback복원. K를외부에서받지않고 `minimumCoverAdaptiveAsync`를호출한다. 중복행가중치/stable-ID/활성case순서를보존한다.
- `filter-cover-pool.mjs`/`filter-cover.worker.mjs`: request-local2slots,지연시작,최대7outstanding필터,ready시점에전송복제. 요청원본buffer비detach,jobID검증,queued/active오류전파와dispose. Auto도2solver토큰예약하는보수적상한으로최대4계산worker설정을유지한다.
- per-save compact/numeric/일반경로의`filterPending`결과를표시순서대로해결한다. 전체필터pool활성시secondary-only pool을생성하지않는다. tiny/direct로컬최적화는유지한다.
- `filterWorkers:0|2`와AbortSignal을per-save공개계산API에서전달한다. **기본0,기존엔진정책유지**. UI기본설정변경이나CP secondary활성화가아니다.
- ORTools cardinality에선택적signal을추가했다. worker의stop요청은controller.abort→ORTools nestedworker terminate/join→stopped ack→외부worker terminate순서다. 동기Rust가응답못하면1500ms유예후외부worker를종료한다.
- 기존secondarypool의WASM모듈컴파일cache를공유한다. WASM재빌드는없다.

## 검증

`tools/validation/filter-whole-worker-20260926/`에원자료를보존했다.

- Node새계약7/7:원본가중품질/K증명,4primary모드/fast/exact/cardinality-only,재사용/버퍼보존,취소/실패/queue회수,세per-save경로/표시순서/tiny/direct.
- 기존회귀33/33:parallel-secondary7,secondary-components14,secondary-portfolio12.
- Chrome154:Rust/HiGHS/ORTools/Auto결과일치,per-save결과일치,실제ORTools nestedtarget관측후취소·새worker0개잔존.
- browser001은CDPtarget생성시빈URL때문에관측검증이실패했다. targetInfoChanged도수신하도록검증기를보완한002가통과했다. 기존실패기록을보존했다.
- pilotrunner구문4개와두조건소형correctness smoke통과. 이smoke시간을성능비교에사용하지않는다.

## 작은 성능 pilot

`filter-whole-worker-20260926`에서3시나리오×2조건×2회=12jobs만계획한다. 요청전체wall상한10분,child90초,오류/timeout중단·재시도없음.

1. 64queue tiny end-to-end 회귀.
2. 같은소형입력의실제dispatch end-to-end 경로(tiny0/Rust).
3. 실제ALT JAWS J/T원본필터행렬두개로primary부터다시증명하는matrix-stage작업묶음. 저장K는사후검증용이며입력증명으로주입하지않는다. 열거비용을포함하지않으므로실제per-save요청전체가속률로표현하지않는다.

결과가나오기전기본승격은하지않는다. 메모리계측의processRss는프로세스전체RSS이며worker별peak가아니다. browser검증은현재지원JSPI/COOP·COEP환경의소형정확성/취소검증이다. 일반minimals단일작업의기본worker이동은아직적용하지않았다.
