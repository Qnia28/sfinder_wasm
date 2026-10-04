# dev-branch 현재 상태 — 2026-09-29

## 2026-10-04 threshold 최소 통합 후 작업 상태

현재 제품 작업본은 `integration/threshold-minimal-20261004` branch다.
Saves A5+A4를 유지한 기준 `c0cb2a0` 위에 currentPropagation + rootForced를 선별 통합했고 제품 기본값은 **B(rootForced ON)**다.
A(rootForced만 OFF)와 현재 Rust reference(두 기능 OFF)는 독립 재빌드로 선택한다. 요청별 runtime toggle은 없다.
평가 Linux B asset을 hash·source·exports 대조 후 설치했으며 JS wrapper/3체제 routing/CP/Worker/batch asset은 변경하지 않았다.
고유 Node 185개 및 최종 제품 WASM/실제 브라우저 회귀 통과. 새 성능 캠페인, main merge·push·배포는 하지 않았다.
[통합·rollback·검증 제한 기록](THRESHOLD_INTEGRATION_20261004.md).

## 2026-10-02 saves 최소 통합 후 작업 상태

당시 제품 작업본은 `integration/saves-minimal-20261002` branch였다. 아래의 `main` 표기는 2026-09-29 시점의 이력이다.
A5 alias 파싱 수정과 A4 캐시 상한만 선별 반영하고 기존 Rust/WASM 및 3체제 정책은 유지했다.
local main `187fbf9`와 remote main `03b6377`은 업데이트하지 않았다.
[통합 범위·결정 기록](SAVES_INTEGRATION_20261002.md), [원시 증거·아카이브](../../archive/saves-experiments-20261002/README_KO.md).
다음 작업은 이 작업본에서 3체제 개선을 이어가되 minimum K·원본중복행 가중 품질·stable-ID proof·취소/worker 회수 계약을 유지한다.

## 작업본과 이름

`D:\AI\sfinder-wasm\release3.0-20260906`을 `D:\AI\sfinder-wasm\dev-branch`로 이동했다.
이 폴더는 3.0 기반의 개발 작업본이다. Git branch 이름은 `main`이며 폴더 이름과 별개다.
이동 당시 HEAD는 `f4fd90180e1a05b96899663bcc4dff1493d8e8c8`이었다.
이동 전후 Git 상태 134항목이 일치했고 기존 수정·미추적 파일을 모두 보존했다.
새 release 배포 또는 commit을 수행한 상태는 아니다.

## 현재 코드에 채택된 동작

- exact secondary: trivial proof → integrated 100K → threshold.
- `primaryHard`이면 threshold부터 시작한다.
- `secondary:auto`는 secondary 60초 뒤 CP1을 보조로 합류시키는 기존 정책이다.
  `secondary:rust`는 CP 보조 없이 integrated→threshold를 사용한다.
  `integrated`, `threshold`, `cpsat` 명시 선택도 지원한다.
- 최소 K, 원본 중복행 가중 품질, stable-ID까지 증명해야 exact로 반환한다.
- CP 결과 검산, 취소와 worker 회수, CP 실패 시 기존 Rust 지속 처리가 들어 있다.
- saves 기본값: `filterWorkers:0`, `outcomeCache:false`, `singleSaveMask:true`.
- C3/C4/C5/C6는 성능 근거의 한계·회귀 때문에 제품 분류로 승격하지 않았다.
  100K/60초 역시 최적 분류 기준이라는 뜻은 아니다.

## 이번에 반영한 확정 기반

`src/min-cover-components.mjs`의 `inspectTrivialSecondary`는 기존 trivial 검사에서
원본 singleton을 찾는 동안 구조 요약을 함께 반환한다.
기존 `findTrivialSecondary`의 result/null 반환 계약은 유지한다.

```js
const { result, structure } = inspectTrivialSecondary(coverage, count, qualityFor);
// result: 기존 trivial 증명 결과 또는 null
// structure: 아래의 요청별 scalar 요약 또는 유효하지 않은 입력일 때 null
```

| 필드 | 의미 |
|---|---|
| candidateCount | secondary 원본 universe의 후보 수 n |
| count | 전달된 최소 K |
| rowCount | 원본 행 수, 중복 행 포함 |
| entryCount | 원본 edge 수, 중복 entry 포함 |
| forcedCount | 원본 singleton 행에서 증명한 서로 다른 강제 후보 수 F |
| unforcedSlots | K−F |
| unforcedCandidates | n−F |

- CP OR 변수, 품질 클래스, 연결 성분을 추가로 분석하지 않는다.
- all-candidates 단축 경로는 singleton 검사를 하지 않으므로 F와 파생 두 필드를
  `null`로 표시한다. 결과가 자명하다고 F=K라고 만들어내지 않는다.
- 유효한 최소K가아닌호출에서 F>K이면 `unforcedSlots`는음수일수있다. 요약은K의
  증명이나feasibility검사를대체하지않는다.
- 요약은 생성 시 freeze된 scalar 객체다(worker 메시지의 structured clone은 freeze
  속성을 보존하지 않는다). 입력행·Set·buffer 참조를 보관하거나 전역 cache로
  재사용하지 않는다. 다른 요청이나 worker의 proof로 취급하지 않는다.
- 강제 후보로 coverage가 충족된 행도 모든 품질 계산에 남긴다.
- `solveExactSecondary`가 동기·지연 실행 결과에 `secondaryStructure`로 이 요약을 붙인다.
  단독 검사에서 얻은 같은 요약을 반환에 재사용한다. worker 경계를 넘으면 새 소유
  행렬에서 다시 검사하며 전달된 요약을 신뢰해 증명을 생략하지 않는다.

## 검증 대기 중인 설계

원본singleton 이후의 선택 여지로 빠른 integrated를 보호하고, 불확실한 입력에만
짧은 same-search 관측을 수행한 뒤 후속 엔진 하나를 고르는 방향이다.
다중 sfinder 요청에 맞춰 요청 내부 race를 기본 해법으로 삼지 않는 것이 설계 목표다.
그러나 새 cutoff, 조기 관측 API, threshold/CP 직행, 기존60초 보조 정책의 대체는
아직 검증되지 않았다. 현재 `auto`가 이미 단일 엔진 정책으로 바뀌었다고 보면 안 된다.

역할: Astra 기존 자료 분석·특징 선정·설계 확정·제품 핵심 구현,
SOL 상세 실험 설계·실험용 시제품·조건 비교·검증.
상세 설계: `../../tools/validation/secondary-routing-design-20260929/DESIGN_KO.md`.

## 경로와 검증 기록

`tools/activate.ps1`의 SFINDER_ROOT는 새 경로를 가리킨다.
검증 도구 및 snapshot 의존성의 junction 9개를 새 대상으로 갱신했고,
`git worktree repair`로 baseline-3.0의 주 저장소 연결을 복구했다.
과거 동결 실험의 코드·manifest·hash에는 당시 경로가 남는다. 이들은 실행 시점의
기록이며 전역 문자열 치환 대상으로 삼지 않는다. 후속 실험은 새 경로와새snapshot을쓴다.

이번 수정의 검증 기록은 `../../tools/validation/dev-branch-confirmed-20260929/`에 보관한다.

- 기존 Node 회귀53개 통과, 실패/skip0. 실제CP,weighted quality/stable-ID,
  worker전송/취소/회수와exhaustive Rust oracle 검사를 포함했다.
- 새구조요약의packed/Map,중복ID/행,입력변경후cache부재,all-candidates 미관측F,
  동기/지연실행전달의5개contract smoke를 확인했다.
- SOL 위임은 공급자HTTP400/모델미지원으로시작전에실패했다. 이번기존회귀실행과
  작은contract smoke는Astra가수행했고,SOL이검증했다고표기하지않는다.
- 브라우저 성능/새분류정책 실험은 이 수정의 검증 범위가 아니다.
