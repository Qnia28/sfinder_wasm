# Fast fixed-K 입력 준비 재사용

## 목적과 구현

preview → integrated → GRACE 전환 시 동일 입력의 후보 인덱스·품질 행렬 패킹과 WASM 전송을 재사용한다. 제품 정책 채택과 별개의 구현 최적화다.

- `pc-wasm-min-cover.mjs`: 요청 단위 `createMinimumCoverAtCountSession(coverage, { qualityFor })`. 첫 실제 probe에서 지연 준비하며, 이후 fixed-K 호출은 seed/lock 버퍼만 갱신한다. 탐색은 기존 WASM export를 호출한다.
- `pc-wasm-cover-matrix.mjs`: 버퍼 소유권과 명시적 해제를 제공하는 `allocateWasmU32Buffers`. 부분 할당 실패 시에도 할당분을 해제한다. 기존 scoped helper도 이 경로를 사용한다.
- `min-cover-adaptive.mjs`: Fast의 동기 probe 구간에서 session을 사용하고 `finally`에서 해제한다. refine 경로는 dense 작업 공간을 만들기 전에 먼저 해제한다. session 메서드가 없는 solver 구현도 지원한다.

session은 solver보다 먼저 닫아야 한다. coverage와 quality provider의 의미는 session 동안 불변이어야 한다. 서로 다른 호출/filter/solver의 입력을 전역 캐시에 보관하지 않는다. WASM memory growth에 취약한 TypedArray view를 보관하지 않고 포인터만 보관한다. JS 패킹 배열은 업로드 후 session에서 유지하지 않는다.

기존 numeric 입력은 JS 패킹을 이미 재사용하므로 추가 이득 대상은 WASM 행렬 할당·복사다. 일반 Map 입력은 universe 및 품질 패킹도 재사용한다. Rust 내부의 search 자료구조 재구성 비용까지 제거한 것은 아니다.

## 검증

```powershell
node --test tests/fixed-count-session.test.mjs tests/fast-routing.test.mjs tests/fast-budget-policy.test.mjs tests/fast-triage-api.test.mjs tests/threshold-product-default.test.mjs
```

17개 기능 테스트 통과. 소형 합성 입력으로 검사했고 로컬 population benchmark는 실행하지 않았다.

- 실제 WASM Map/numeric 입력: preview/integrated/threshold, bounded exit, proof progress/lock, session 사용 전후의 keys·qualityVector·searchedStates 등 전체 결과 동등성.
- API: compact/numeric/Map 경로, Fast 정책·seed 전달 계약.
- 메모리: 단계마다 강제 memory growth, session 격리, 중복 close, 부분 할당 실패, 탐색 예외, 조기 exact 종료, refine fallback, DIRECT 무할당.
- 세 probe의 고정 입력 행렬 준비·전송은3회→1회. 테스트의 WASM 할당 호출 수는15회→9회(행렬3개×1 + seed/lock2개×3)이며 실행시간 감소율을 뜻하지 않는다.

실제 API 성능·peak 메모리 변화는 아직 측정하지 않았다. 원격 비교 시 동일 정책에서 baseline/context만 바꿔 평가해야 한다. 현재 telemetry의 단계 시간에는 해당 단계가 부담한 준비·전송·탐색이 함께 포함되며, 첫 단계가 공유 준비를 부담하므로 단계 간 시간 이동을 전체 절감과 혼동하지 않는다.
