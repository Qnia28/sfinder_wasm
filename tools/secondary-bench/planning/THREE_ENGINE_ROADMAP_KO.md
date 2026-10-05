# Minimals 3체제 분류 개선 — 로드맵과 작업 원칙

> **최신 단계 결정(2026-10-05):** 광범위 60초/300초 측정 이후 Astra의 해석·분류 방향은 [ASTRA_ROUTING_DIRECTION_20261005_KO.md](ASTRA_ROUTING_DIRECTION_20261005_KO.md)를 따른다. 아래 v1.4의 역할·계약 원칙은 유지하며, “측정 미시작” 등의 상태는 작성 당시 기록이다. 후속 구현·실험은 Sol 단계이며 현재는 계획·해석만 완료했다.

- 문서 ID: SECONDARY-ROUTING-ROADMAP-001
- 버전: 1.4 / 작성·갱신: 2026-10-05
- 역할: **Astra / Plan**, **Sol / Build** — 이 세션의 에이전트 전환으로 사용. 서브에이전트 생성 금지.
- 상태: 방향·단계 수립. 새 후보 구현·성능 캠페인은 아직 시작하지 않음.
- 작업 루트: `D:/AI/sfinder-wasm/`
- 원격 실행 저장소: <https://github.com/Qnia28/sfinder_wasm>

이 문서는 이후 설계·구현·측정·해석에서 계속 참조할 기준이다. 구체적인 입력 수, checkpoint, cutoff, timeout, 성능 gate와 실행 예산은 단계별 계획에서 고정한다. 이 로드맵을 실행 예산이 확정된 캠페인 manifest로 취급하지 않는다.

## 1. 목표와 성공의 의미

**기존 Integrated / Threshold / CP-SAT를 더 적합하게 선택하여 minimals의 실제 응답시간과 다중 요청 처리 비용을 줄인다.**

대상은 **Human quality가 exact인 secondary 경로**이며, 상위 Auto에서 실제 exact로 분기된 경우도 포함한다. 이번 벤치는 품질 옵션을 명시적으로 exact로 유지한다. feature의 `exactHumanQuality: 'true'`, minimum-cover의 `exactQuality: 'true'`를 사용하고 엔진 선택 `secondary: 'auto'`와 구분한다. 현재 quality 문자열 `'auto'`는 Fast로 정규화되므로 exact 벤치 설정으로 사용하지 않는다.

설계 방향:

```text
기존 빠른 완료 경로와 trivial proof
  → 기존 스캔에서 얻은 저비용 구조 특징으로 분류
  → 불확실한 입력에만 한정된 same-search 관측
  → 탐색 지속 또는 후속 엔진 하나 선택
  → quality와 stable-ID까지 exact 증명, 결과 반환·Worker 회수
```

- 빠른 Integrated 입력에는 분류·CP profile·Worker 준비 비용이 과하게 붙지 않아야 한다.
- 어려운 입력에는 불필요한 Integrated 선행 비용과 늦은 엔진 선택 비용을 줄인다.
- 목표 정책은 **secondary 행렬 하나당 활성 탐색 하나**다. 서로 다른 save 행렬이나 서로 다른 명령의 병렬 실행은 별개이며 전체 처리 비용으로 평가한다.
- 분류 적중률보다 **실제 절약 시간, 오선택 손실, 긴 지연, CPU·메모리**를 우선한다.
- 최소 K, 원본 중복행 가중 품질, stable-ID 최종 동률 증명, 취소·회수 계약을 유지한다.
- 첫 가설이 성립하지 않으면 근거와 함께 종료·보류할 수 있다. cutoff 반복 조정 자체를 진척으로 보지 않는다.

이번 범위는 기존 3체제의 분류·선택·전환이다. 신규 SAT/PB 엔진, 종료한 Integrated A0/M1 연구, 이미 완료한 Threshold 내부 개선은 별도 주제다.

## 2. 역할과 협업 방식

| 담당 | 책임 |
|---|---|
| Astra / Plan | 전체 흐름·기존 근거 분석, 가설·평가 기준·단계 설계, 후보 선별, 결과 해석, 다음 단계·종료 판단, 본 문서 관리 |
| Sol / Build | 독립 작업본·branch 생성, 상세 실행 계획과 호출 예산 산출, 입력 장부, 하네스·계측·시제품 구현, 로컬 회귀, Actions 실행·회수, 원자료·감사·재현 자료 작성 |

작업 순서:

1. Astra가 해당 단계의 질문, 범위, 비교 계약, 종료 기준을 정한다.
2. Sol이 구현·입력·일정·자원 계획을 구체화한다. 미정 항목은 실제 입력 측정 전에 Astra와 확정한다.
3. Sol이 동결된 계획을 실행하고 원자료와 짧은 결과 요약을 제공한다.
4. Astra가 정확성, 측정 유효성, 성능, 일반화 수준을 구분하여 다음 행동을 결정한다.

Sol은 경로·인자·하네스 오류처럼 스스로 교정 가능한 문제를 공통 지침 안에서 수정하고 재시도한다. 정상 성능값, 검색 timeout, OOM, 정확성 불일치를 좋은 재측정값으로 바꾸거나, 결과를 본 뒤 표본·gate·예산을 변경하지 않는다.

**Sol은 이 세션의 에이전트 전환 기능으로 사용하는 Build 담당이다. 서브에이전트로 생성하거나 별도 child session에 위임하지 않는다.** Astra가 계획·판단 기록을 남기면 전환된 Sol이 이어서 실무를 수행하고, Astra로 전환한 뒤 결과를 해석한다. Actions의 병렬 VM은 이 에이전트 역할 구분과 별개다.

문서 작성 시점에는 Sol 실행 단계로 전환하지 않았다. 과거 문서의 queued/agent 역할 기록은 현재 실행 지시가 아니다.

## 3. 보호할 원본과 기준점

2026-10-05 읽기 전용 확인 결과:

| 항목 | 기준 |
|---|---|
| 제품 작업본 | `dev-branch/` |
| branch | `integration/threshold-minimal-20261004` |
| HEAD | `7ef62d18e1d155b6479e00d651c851ff3baa7112` |
| 작업트리 | clean |
| Threshold | currentPropagation + rootForced ON |
| `wasm/pc_wasm.wasm` SHA-256 | `15bcd1171821d53c0e44d7b556d7d0680e957bbca5630643b34155c44b5923fd` |

Sol의 첫 실무 단계:

- 원본을 다시 확인한 뒤 위 commit에서 **독립 복사 저장소와 새 실험 branch**를 만든다. 원본의 checkout·파일·WASM·branch를 변경하지 않는다.
- 경로 예시: `sol/secondary-routing-20261005/`, branch 예시: `experiment/secondary-routing-20261005`. 이미 존재하면 내용을 확인하고 새 이름을 정한다.
- 원본 Git 관리정보를 건드리지 않는 독립 clone을 우선한다. `node_modules`·빌드 출력·junction을 원본과 공유할 경우 쓰기가 원본으로 전파되지 않도록 구조를 확인한다. 의존성·빌드 출력은 독립 경로를 기본으로 한다.
- 원격 push·Actions 실행은 새 실험 branch만 대상으로 한다. **GitHub main과 원본 dev branch에는 push·merge·수정·배포하지 않는다.**
- 원격 main이 아니라 위 로컬 통합 commit이 제품 비교 기준이다. 해당 commit/source를 Actions에서 재현할 수 있도록 복사 branch 이력 또는 hash 검증 가능한 source bundle로 제공한다.
- Rust 재빌드가 필요하면 baseline/candidate의 toolchain·feature·빌드 조건을 맞춘다. 현재 설치 asset과 재빌드 asset의 차이는 별도 기록하고 실행 동등성을 확인한다.

### 3.1 명칭과 기존 측정자료 활용

- 앞으로 엔진 이름은 **Integrated / Threshold / CP-SAT**로 통일한다. 기존 문서의 A/B 등은 당시 빌드 구분이며 앞으로의 엔진 명칭으로 사용하지 않는다. 재현에 필요한 과거 원자료의 label·hash는 그대로 보존한다.
- **사용자 확인:** 현재 Threshold와 과거 Threshold의 성능 편차는 크지 않고, 차이가 큰 case도 5% 이내다. 이 문서 작성 중 새로 측정한 수치는 아니다.
- 따라서 기존 3엔진 비교측정자료를 **분류 설계·비용 분석·후보 선별의 주 근거로 재사용**한다. 과거 자료를 단순 가설 수준으로만 제한하거나, Threshold 통합 때문에 전량 재측정하지 않는다.
- 과거 입력·K·seed·엔진 옵션·lifecycle·측정 경계·원결과 상태를 연결하고, 사용 가능한 자료와 실제 공백을 구분한다. 서로 다른 계약의 시간을 하나의 paired 측정처럼 합치지 않는다.
- 근소한 승패가 설계 결론을 좌우하는 경우에는 편차 민감도를 검토하고 필요한 항목을 보강한다. 5%를 모든 미래 입력의 보장이나 새 성능 gate로 취급하지 않는다.
- 새 실측의 주 용도는 **기존 자료 공백 보강, 새 관측·전환 비용, 실제 후보 정책, 명령 전체·동시 요청, 일반화 검증**이다. 직접 3엔진 재측정은 그 질문에 필요한 범위에서 계획한다.

기존 자료는 당시 분류 cutoff 조정에 사용한 특정 case에 편중됐을 수 있다. **재사용 가능성과 대표성은 별도 판단**이다. 이전 자료를 활용한다는 이유로 초기 광범위 3엔진 측정을 생략하지 않는다. P1에서 전체 입력 장부와 기존 측정의 분포를 대조하고, 현재는 P2의 기본 실행안으로 광범위 초기 비교를 준비한다. 충분한 대표성과 비교 계약을 갖춘 기존 자료가 확인되면 그 부분의 중복 호출을 줄인다.

## 4. minimals 전체를 기준으로 한 작업 범위

### 4.1 실행 흐름

```text
명령/API 옵션·Worker 진입
  → 입력·패턴·저장 조건 해석
  → 단일 queue / pattern / compact 열거
  → 원본 coverage·quality와 stable-ID 구성
  → direct / tiny exact 빠른 완료 또는 primary 최소 K 증명
  → Fast 또는 exact secondary
  → 직접 실행 / secondary pool / whole-filter pool
  → 저장미노별 결과 취합
  → coverage 기반 표시 순서·Fumen·메타데이터 반환
```

### 4.2 경로별 주의점

| 경로 | 현재 구조와 검토 대상 |
|---|---|
| 일반 minimals | `minimals-wrapper.mjs` → `minimals-feature.mjs` → `minimumCoverAsync`. 제품 기본 Fast와 달리 이번 벤치는 명시 exact |
| per-save minimals | feature → `per-save-minimals.mjs` → core → adaptive. 기본 품질 모드는 exact. 한 명령에서 여러 save 행렬 생성 |
| 단일 queue / tiny | `perSaveBest`, 작은 후보군의 통합 exact로 secondary 분류 전에 완료 가능 |
| exact 공통 경로 | trivial → Integrated 100K → Threshold. `primaryHard`이면 trivial 이후 Threshold부터 시작 |
| 현행 Auto | secondary 경과 60초 후 CP1 보조 합류. 새 순차 정책의 대조군 |
| secondary pool | 기본 `secondaryWorkers:'auto'`는 무거운 후속 작업을 지연 전송. 명시 크기는 처음부터 secondary를 전송할 수 있음 |
| whole-filter pool | `filterWorkers:2`는 primary까지 Worker에서 수행. secondary pool과 중첩하지 않음. 제품 기본은 0 |
| Fast | 공통 exact 분류 경로와 예산·품질 보장 수준이 다름. 필요 시 호환 회귀로 확인하며 이번 3엔진 성능 모집단에는 포함하지 않음 |
| 명시 엔진 | `integrated` / `threshold` / `cpsat`는 직접 비교와 진단 기준. trivial shortcut 여부를 기록 |
| 기타 공유 소비자 | fifth와 Legacy API 등 공통 함수를 쓰는 경로의 영향·회귀 확인 |

분류 판단 단위는 **고정 K를 가진 secondary 원본 행렬**이다. 보드 이름·저장미노·명령 이름을 승자 예외 규칙으로 사용하지 않는다. 명령 전체의 스케줄링·출력 비용은 별도로 측정한다.

구현 전 Sol은 관련 Rust/WASM 호출과 회귀 검사까지 읽고 다음을 경로표로 남긴다:

- primary와 secondary가 사용하는 행렬의 차이, 중복행·후보 ID·seed의 유래.
- 요청/행렬/job ID, buffer 소유권·복사·전송, Worker 부모·자식 관계.
- 초기 분류 시점의 특징 가용성, 중복 스캔·packing·준비 비용.
- 선택 이유·관측·엔진·시간 정보가 결과 조립에서 소실되는 위치와 실험용 전달 방법.
- 취소 시 활성/대기 작업 처리, 하위 Worker 회수 확인, 다음 요청 재시작.

## 5. 사용할 특징과 관측 원칙

| 특징 | 뜻 |
|---|---|
| n | secondary 원본 후보 universe 크기 |
| K | primary가 증명한 최소 선택 개수 |
| R | 원본 행 수, 중복 행 포함 |
| E | 원본 행-후보 연결 수, 중복 entry 포함 |
| F | 원본 singleton 행으로 강제된 서로 다른 후보 수 |
| d | K−F, 강제 후보 외에 선택할 개수 |
| u | n−F, 강제되지 않은 후보 수 |

- `inspectTrivialSecondary`가 이 구조 요약을 이미 만든다. 재구현보다 소비 위치·중복 비용을 먼저 검토한다.
- all-candidates 단축 경로의 F/d/u는 미관측 `null`이다. primary dominance 이후 singleton이나 seed 선택을 F로 대신하지 않는다.
- 작은 d는 빠른 Integrated 보호 가설이다. `d<=2` 등은 아직 검증된 제품 cutoff가 아니다.
- CP 모델 크기는 비용 특징이지 승자 증명이 아니다. 별도 profile·hash·그래프 분석을 모든 입력의 필수 비용으로 추가하지 않는다.
- 불확실 영역을 명시적으로 허용한다. 구조만으로 유리함을 구분할 수 없으면 제한된 관측과 보수적 경로를 평가한다.
- 관측이 필요하면 native 준비와 search를 분리하고, 사전에 고정한 소수 checkpoint에서 states/mass/unique/elapsed 등을 얻는다.
- same-search 지속은 native 실행 안에서 이어져야 한다. budget 반환 후 재호출을 resume으로 취급하지 않는다. 동기 WASM 실행 중 JS timer에 정밀 관측·중단을 의존하지 않는다.
- 관측만 켠 비교에서는 결과·전체 states가 동일한지 먼저 검증한다. 관측 비용은 비계측 실행과 별도로 측정한다.

## 6. 3엔진 측정 설계

### 6.0 데이터 출처와 초기 측정 목적

- 사용자 제공 `files/setupdata/`의 `cycle-1-id-fumen.json`(45개), `cycle-2-id-fumen.json`(48개), `cycle-7-2plus2-qb-id-fumen.json`(356개)을 사용한다.
- 총 449개 ID, 문자열 기준 411개 Fumen이다. 독립 보드·mirror group·행렬 수는 별도 감사한다. DB의 `id/fumen`에서 실제 command pattern·save 조건을 만드는 규칙을 명시한다.
- 기존 측정의 편중을 피하도록 세 DB 전체를 장부화한 뒤 넓은 개발군과 별도 미노출 검증군을 구성한다. 자료가 부족하면 부족한 유형·규모를 제시해 사용자에게 추가 요청한다.
- 초기 광범위 직접 엔진 측정은 **단순 성능 정보 수집**이며, 재테스트는 같은 조건 max/min ≥ 1.10 항목에 적용한다. 후속 현행 Auto 대 후보 정책은 **A/B 성능 비교**로 별도 규칙을 적용한다.
- 초기·재테스트 횟수와 runner 배치는 목적·비용을 제시해 협의 후 확정한다. 상세 실무 계획은 [Sol 인계](SOL_BENCH_HANDOFF_KO.md)를 따른다.

### 6.1 입력을 한 번 확보해 재사용

기존 비교측정자료와 검증된 fixture를 우선 재사용하고 K 증명·입력 identity를 확인한다. 새 fixture가 필요한 경우 열거·primary를 한 번 수행해 저장한다. 새 직접 비교를 수행할 때의 공통 입력 구조는 다음과 같다.

```text
원본 secondary 행렬 + weighted rows + stable-ID universe + K + primary seed
    ├─ Integrated 직접 실행
    ├─ Threshold 직접 실행
    └─ CP-SAT 직접 실행
```

세 직접 엔진은 **같은 원본 quality 행렬·K·seed**로 각각 독립 실행한다. primary 축소 kernel을 secondary에 대신 넣지 않는다. 직접 비교끼리는 동시에 돌리지 않아 요청 내부 자원 경쟁을 피한다. 직접 엔진 승자가 다른 엔진의 seed를 개선해 주는 순서 의존성도 만들지 않는다.

실측은 반복 캠페인을 줄일 수 있도록 **충분히 넓은 표본과 공통 하네스**로 계획한다. 빠른군·긴 지연·큰 모델·각 패턴 유형·반례·명령 전체를 처음부터 장부에 넣고, 재사용할 측정과 새 호출을 함께 배치한다. 소수 사례만 확인한 뒤 비슷한 대상을 조금씩 덧붙이는 방식을 기본으로 삼지 않는다.

넓은 범위와 무제한 탐색은 구분한다. 비교 pair·호출별 상한·최대 호출 수를 사전 고정하고, 후속 표본을 단계적으로 선택할 때도 선택 규칙을 먼저 적는다. 미실행·timeout은 패배로 간주하지 않으며, 세 결과가 없는 입력은 완전한 3엔진 승자 label이 아니다.

### 6.2 서로 다른 세 질문을 직접 측정

| 계층 | 비교와 목적 |
|---|---|
| 직접 엔진 | Integrated / Threshold / CP의 준비+탐색 비용과 반례. 사후 최선 완료 엔진은 진단용 기준 |
| secondary 정책 | 현행 Auto vs 후보의 실제 실행. 분류·관측·seed 변화·전환·fallback·회수까지 포함 |
| minimals 명령 전체 | 열거·primary·pool 대기·각 save·출력·회수를 포함한 단독/복수 요청 완료시간 |

- 직접 3엔진 중 사후 최선 시간은 무료로 선택 가능한 제품 정책이 아니다.
- 직접 엔진 시간의 합이나 과거 race 시간을 새 순차 정책 시간으로 대신하지 않는다.
- 오프라인 분석에 사용한 실행시간·완료 정보는 제품이 처음부터 알 수 있는 특징이 아니다. 각 판단 시점까지 얻을 수 있는 정보만 후보 규칙에 사용한다.
- trivial/direct/tiny 완료는 실제 제품 이득에 포함하되, 엔진 탐색이 수행된 것처럼 label하지 않는다.

### 6.3 측정 경계

하네스는 가능한 범위에서 다음을 개별 기록하고, 전체 경계도 직접 잰다:

`queue / init / JS packing / native prep / search / profile / IPC / transition / cleanup / end-to-end`

- API 반환, 명령 결과 반환, Worker 회수 완료의 시점을 구분한다. 회수 비용을 보고서 밖으로 숨기지 않는다.
- cold, compiled-module reuse, warm-instance는 별도 lifecycle이다. 실제 제품 경로를 대표하는 계약을 주 비교로 먼저 정한다.
- 최소 K 증명·열거 시간은 secondary-only 비교에서 제외한다. 명령 전체 비교에서는 포함한다.
- partial timer median의 합을 전체 median으로 쓰지 않는다.
- 반복 순서는 사전 고정·균형 배치하고 runner/block ID를 기록한다. A/B 비교는 동일 runner/lifecycle의 인접 pair와 pair ID를 사용한다.
- 초기 직접 3엔진 정보 수집은 input×engine block으로 기록할 수 있다. 같은 block에 있다는 이유만으로 임의의 두 호출을 사후 A/B pair로 만들지 않는다.
- wall time, CPU, 메모리는 scope를 명시한다. 특히 process RSS를 Worker별 메모리처럼 합산하지 않는다. 관측할 수 없는 값은 미관측으로 둔다.
- CP 지원 조건(JSPI, SharedArrayBuffer, 브라우저 isolation)과 실제 엔진 실행 여부를 확인한다. 미지원 fallback을 CP 실행시간으로 집계하지 않는다.

## 7. 비효율적인 cutoff 반복을 막는 실험 방식

**기존 자료 통합·공백 보강 → 오프라인 후보 선별 → 넓은 표본에서 소수 후보 실제 실행 → 동결 검증**을 따른다. 제한하는 것은 설명 없이 늘어나는 후보 수와 반복 횟수이며, 실측 입력 범위를 지나치게 좁히려는 것이 아니다.

1. 기존 입력·정적 특징·직접 엔진 측정자료를 먼저 통합한다. source·asset 차이만으로 일괄 폐기하거나 재측정하지 않고, §3.1에 따라 후보 선별의 실질 근거로 사용한다.
2. 동적 관측이 필요하면 관측 지점·비용 상한을 먼저 고정해 진단 자료를 수집한다. 기록하지 않은 이른 checkpoint 값을 보간해 사실처럼 사용하지 않는다.
3. Astra가 저장 자료에서 단순 규칙의 비용·오선택 손실·판단 불가 영역을 분석한다. 넓은 cutoff grid 탐색으로 노출 표본에 맞추지 않는다.
4. 한 라운드에서 실제 정책 성능 비교에 올릴 후보는 **최대 2개**로 제한한다. 후보 간 차이는 설명 가능한 가설이어야 한다.
5. 전환 시 seed·prefix·준비 비용이 달라지는 영역은 오프라인 추정에 한계 표시를 남기고 실제 정책으로 검증한다.
6. 결과 후 규칙을 바꾸면 새 revision과 변경 근거를 남긴다. 실패 반례를 이후 표본에서 빼거나 검증 표본을 다시 fresh로 부르지 않는다.
7. 추가 라운드는 새 근거·해결할 질문·남은 예산이 있을 때 Astra가 계획한다. 같은 입력에서 수치만 계속 바꾸는 자동 반복은 하지 않는다.

개발/검증 분리는 mirror group을 기준으로 한다. 기존 63개 노출 group뿐 아니라 후속 Threshold 등 모든 확인 가능한 노출 이력을 대조한다. 수동 검토·오프라인 튜닝에 사용한 입력도 노출이다.

## 8. 단계별 로드맵

| 단계 | Astra / Plan | Sol / Build | 다음 단계 조건 |
|---|---|---|---|
| P0. 기준·전체 경로 | 영향 범위와 계약 정리 | 독립 clone/branch, source lock, minimals 경로·기존 검사 지도 작성 | 원본 보존·기준 재현·분류 삽입 위치 확인 |
| P1. 입력·측정 계약 | 가설·충분한 표본 범위·개발/검증 분할·gate 결정 | 기존 측정/fixture/노출 장부, 재사용·공백 구분, 비교 pair·일정·상한·예산·하네스 준비 | manifest 고정, 경량 계약 검사 통과 |
| P2. 광범위 3엔진 기준 측정 | 기존 자료의 대표성·편중 평가, 넓은 입력군의 비용·승패·미완료 해석 | 재사용 가능한 기록과 새 직접 측정을 연결해 성능 지도 확보, 최대 16 VM 활용 | 기준값 튜닝에 편중되지 않은 자료 확보, 유망 가설과 불확실 영역 설명 가능 |
| P3. Integrated 보호·Threshold 선택 | 정적 분류와 제한 관측의 필요성 판단, 최대 2후보 선정 | 같은 탐색 지속/조기 전환 시제품, 현행 Auto 대비 paired 측정 | 빠른 경로 손실과 전환 포함 이득이 사전 기준 충족 |
| P4. Threshold·CP 선택 | CP가 필요한 영역과 profile 비용 가치 판단 | Rust 종료 후 CP 순차 실행, seed/proof/fallback·회수 검증 | Threshold 대비 CP 이득과 자원 비용 근거 확보 |
| P5. 후보 동결·일반화 | 후보 1개 동결, 미노출 group·큰 모델 등 검증 계획 | 고정 표본 paired 비교·재확인, 실제 명령·동시 요청·브라우저 회귀 | 정확성·성능·일반화·회수 기준 충족 |
| P6. 결론·보존 | 채택 후보/보류/종료와 근거 정리 | 재현 bundle·raw·audit·최종 commit 봉인 | 원본 적용 여부를 별도 결정할 수 있는 근거 완비 |

P3와 P4는 선택 문제를 나눠 원인을 확인하는 단계이며, 하네스·입력 준비·자료 수집까지 중복 수행하라는 뜻은 아니다. 두 단계가 요구하는 관측과 표본을 P1에서 함께 설계하고 기존 직접 엔진 자료를 공통으로 활용한다. source/asset 차이는 §3.1에 따라 기록·평가하고, lifecycle이 다른 시간을 동일 계약처럼 합치지 않는다. P2에서는 과거 CP 우세 사례뿐 아니라 새 광범위 개발 표본에도 CP 직접 비교를 포함하여, 기존 규칙이 놓친 CP 유리 영역을 관측할 기회를 확보한다.

### 첫 실행의 우선순위

1. 독립 작업본과 전체 minimals 경로를 확인하고 기존 자료의 입력·측정 계약·노출 이력을 감사한다.
2. 기존 winner나 cutoff 통과 여부에 의존하지 않는 폭넓은 개발 표본을 구성한다. 패턴 유형·높이·규모·빠른 경로·구조 특징의 범위를 확보하고 mirror 중복은 독립 표본처럼 세지 않는다. 별도 미노출 검증 group은 결과 열람 전부터 분리한다.
3. 각 비자명 행렬의 최소 K·primary seed를 고정하여 세 secondary 엔진을 독립 실행한다. 정상 trivial/direct/tiny 경로도 별도 집계하여 실제 명령에서 3엔진 분류에 도달하는 비율을 파악한다.
4. 광범위 비교의 입력 수·엔진별 호출 상한·반복·최대 호출 수·runner-hours를 사전 산출한다. 최대 16 VM에 독립 입력/block을 분배하고 pair는 같은 VM에 유지한다. 예상 예산을 넘으면 실행 전에 설계를 조정한다.
5. 우세 영역·근소한 차이·장기 미완료·준비 비용을 분석한 뒤 정적 분류와 동적 관측의 필요성을 결정한다. 분류 규칙이나 관측 API를 먼저 구현해 놓고 그 규칙에 맞춰 표본을 고르지 않는다.
6. 후보 정책은 현행 Auto와 실제 실행으로 비교하고, 이후 동결 후보의 별도 검증·명령 전체·동시 요청 평가로 진행한다.

P2에서 광범위하게 측정하고 결과를 해석한 group은 개발 노출군이다. 이후 일반화 검증용 fresh holdout으로 다시 사용하지 않는다. 직접 엔진 간 차이가 작으면 억지로 단일 winner를 붙이기보다 비용 차이와 불확실성을 기록한다. timeout은 해당 상한에서 미완료였다는 근거이며 정확한 완료시간이나 모든 조건에서의 열세를 뜻하지 않는다.

P6의 실험 완료가 dev/main 적용을 뜻하지 않는다. 이 로드맵의 실무 산출물은 별도 branch의 검증된 후보와 판단 근거다.

### 반드시 포함할 대표 반례

- 빠른 Integrated 보호: QB266 독립 Z·제한 I, 작은 d군.
- Integrated 연장 가치: ELEPHANT J, ALT SHOES L.
- 곧 끝남과 최선 선택의 차이: QB157 제한 S, pcinfo018 제한 L.
- Integrated 선행 비용: pcinfo030 I, QB059 독립 I.
- CP/Threshold 구별: QB235 독립 Z vs QB059 독립 I, JAWS J vs O.
- 과거 CP 조기 선택 이득: QB277 제한 J, QB157 독립 S.

이 목록은 개발·회귀용 반례이며 현재 승자 확정 목록이나 fresh holdout이 아니다. bag/제한 split/독립 split, 비자명 bag·큰 모델·여러 높이·빠른 완료 경로를 포함할 범위와 제외 이유는 P1에서 고정한다. 과거 4×4 BOX bag 제외를 새 계획에 자동 복사하지 않는다.

## 9. 로컬과 GitHub Actions의 분담

### 로컬

- source/fixture 검사, 정적 분석, 경량 synthetic·계약 검사.
- 변경과 직접 관련된 짧은 회귀, 최소 재현·하네스 오류 교정.
- 입력 장부·원자료 파싱·오프라인 분석.

로컬 시간은 기능 진단용이며 정식 성능 근거와 분리한다. 검사가 연산량이 크거나 오래 걸리면 Actions로 옮긴다.

### GitHub Actions

- 비교적 일정한 VM이 필요한 벤치마크, 실제 입력의 연산량 있는 검사, 무거운 정확성 oracle·전체 회귀.
- `Qnia28/sfinder_wasm`의 **새 실험 branch**에서 전용 workflow 실행.
- public 표준 runner와 동일 OS image·Node/Rust/browser·빌드 옵션을 고정하고 실제 image/runtime/CPU 정보를 저장한다. hosted runner가 동일 물리 CPU·성능을 보장한다고 가정하지 않는다.
- 기본 branch 수정 없이 실행한다. 새 workflow가 default branch에 없어 수동 dispatch가 불가능하면 새 실험 branch에만 제한한 push trigger 등으로 구성한다.
- 기존 `batch-performance.yml`은 다른 실험과 옛 baseline용이다. 그대로 실행하거나 main에 등록하기 위해 변경하지 않는다.
- 측정 pair 내부는 직렬 실행한다. 동시 요청 시험은 별도 고정 일정에서만 수행한다.
- branch/commit, source·asset·입력 hash, workflow/run/job ID, 도구 버전, 원결과·실패·회수 기록을 artifact로 보존한다.
- manifest 동결 이후 단순 문서 push로 벤치마크가 반복되지 않도록 trigger와 실행 조건을 구성한다. 진행 중 작업의 자동 취소도 캠페인 기록에 남긴다.

**사용자가 허용한 현재 병렬 실행 한도는 GitHub Actions VM 최대 16개다.** 변경 시 사용자 지시를 반영한다. 동시에 진행되는 이 작업의 workflow들을 합쳐 16개 이내로 배치하고, 충분한 표본을 효율적으로 처리하도록 독립 입력/block/shard를 병렬 분배한다. 각 비교 pair는 같은 VM 안에 유지한다. 정상 측정의 VM 병렬 처리와 의도적으로 여러 요청을 한 VM에서 실행하는 동시 요청 시험을 구별한다.

나머지 자원·검증 규칙은 `TESTING_RULES_KO.md` v2.0을 따른다. public 표준 Actions, child 3GiB/swap 0을 기본 제약으로 하고, 실제 총 job 수·호출 수·runner-hours를 산출한다. 병렬 16 VM은 총 job 수 16개 제한이 아니다. 공통 상한 wall 3h/64 runner-hours는 캠페인마다 자동 부여되는 예산이 아니므로 전체 일정에 맞춰 명시한다.

실제 입력 실행 전에 call별 startup/search/전체 호출/audit/저장 ACK/reap 상한과 캠페인 전체 예산을 정한다. 최악 호출 비용이 남은 예산을 넘으면 새 호출을 시작하지 않는다. workflow 재시작으로 캠페인 시계를 초기화하지 않는다.

### exact 장시간 입력의 필수 timeout

- 일부 셋업은 시간 단위 탐색이 발생한다. Integrated·Threshold·CP-SAT **모두 유한한 외부 호출 timeout**을 설정하며, 미설정·무한 실행을 하네스가 거부해야 한다.
- exact 목표를 유지하면서 시간만 제한한다. 직접 엔진 비교에 Fast fallback이나 Auto의 Integrated 100K probe cap을 대신 적용하지 않는다. 현행 Auto 내부 probe는 그 정책의 일부로 별도 기록한다.
- startup·전체 secondary 호출·자식 Worker 회수 상한을 분리하고, CP 내부 검색 제한과 외부 watchdog 상한도 구분한다. 신규 열거/primary·명령 전체·job·캠페인에도 상한을 둔다.
- 동기 WASM이 막는 event loop와 독립된 watchdog으로 종료를 강제하고 하위 Worker까지 회수한다. timeout 원결과 저장과 회수 확인 후 다음 호출을 시작한다.
- timeout은 미완료로 보존하며 exact나 실제 완료시간으로 바꾸지 않는다. 반복 횟수·구체적인 시간 상한은 Sol이 비용을 제시하고 협의 후 실행 전에 고정한다.

## 10. 정확성·성능 판단 기준

### 정확성

- primary의 최소 K 증명을 보존한다. secondary 비교를 위해 primary·열거를 매번 재실행하지 않는다.
- 원본 중복행 가중치와 stable-ID universe를 보존한다. 이미 coverage가 충족된 행도 품질 계산에서 유지한다.
- 원행 coverage·선택 개수·전체 quality vector를 독립 재계산하고, 더 좋은 품질과 더 우선하는 동률 해가 없다는 증명을 확인한다.
- 작은 입력은 exhaustive oracle, 큰 입력은 별도 exact 경로의 증명과 공유 primitive 범위를 기록한다. 반복 일치·witness 유효성만으로 최적성을 주장하지 않는다.
- CP FEASIBLE 또는 quality-only는 EXACT가 아니다. incomplete 결과를 완전 증명으로 승격하지 않는다.
- 정책 전환·오류 fallback·취소에서 buffer 소유권, seed 유효성, prefix 증명 출처, Worker 종료를 검사한다.

### 성능

- 기본 비교: 현행 Auto 대비 정책 end-to-end. 보조 비교: 직접 엔진 대비 선택 손실·비용 원인.
- 평균/중앙값뿐 아니라 빠른 경로의 절대 ms 손실, 긴 지연, timeout/미완료, 명령 묶음 완료시간, CPU·메모리를 확인한다.
- A/B 재테스트 대상은 개선 폭 상위 10% ∪ 악화 폭 상위 10% ∪ 같은 조건 max/min ≥ 1.10 ∪ 개선·악화가 기존 gate에 영향을 주는 입력이다. 단순 성능 정보 수집은 같은 조건 max/min ≥ 1.10 항목을 재테스트한다.
- 최초·재테스트 횟수는 목적에 따라 협의 후 고정한다. 일률적인 4쌍/10쌍을 적용하지 않는다. 재테스트는 별도 일정·원결과로 남기고 대조·warmup 등 추가 비용도 예산에 포함한다.
- 정상 capped, timeout, error, OOM, missing, proof pending, 미실행을 구별한다. 완료한 일부 결과만으로 전체 PASS를 선언하지 않는다.
- 기존 A0의 수치 gate를 자동 복사하지 않는다. P1에서 빠른 경로·전체 시간·긴 지연·CPU·메모리의 허용 손실과 개선 기준을 숫자로 고정한다.
- `Actions success`, `harness/audit PASS`, `correctness PASS`, `performance PASS`, `적용 결정`은 별도 상태다.

정확성 불일치·OOM·원자료 저장/protocol 오류에서는 관련 실행을 중단하고 원인을 보존한다. 성능 목표 미달은 다음 라운드의 새 가설 또는 종료 사유이지 반복 재측정으로 없앨 값이 아니다.

## 11. 산출물과 문서 유지

계획 기준 문서는 이 파일이다. Sol은 실험 branch에 사용할 버전의 복사본과 hash를 보존한다. 원본 제품 repo 안에 계획을 쓰기 위해 변경을 만들지 않는다.

권장 증거 루트: `tools/validation/secondary-routing-<campaign-id>/`. 과거 실험 디렉터리를 재사용·덮어쓰지 않는다.

필수 산출물의 역할:

| 산출물 | 내용 |
|---|---|
| `CODE_PATHS_KO.md` | 전체 minimals 경로, 계약, 메타데이터·취소·Worker 경계 |
| `PLAN_KO.md` / `MANIFEST.json` | 해당 단계 질문, 가설, 표본·옵션·예산·gate·종료 조건 |
| `SOURCE_LOCK.json` | baseline/candidate commit·빌드·asset·도구·지침 hash |
| `INPUTS.json` | 행렬 hash·K 증명·seed·weighted rows·ID·aliases·mirror·노출·선정 사유 |
| `SCHEDULE.json` | 비교 pair·runner/block·순서·반복·deadline·최대 호출 수 |
| raw / failure ledger | 호출별 원결과·실패·환경·시간·회수 기록. 저장 완료 후 다음 호출 |
| `AUDIT.json` | 입력·일정·결과·증명·원자료 완결성 검산 |
| `RESULT_KO.md` / `DECISION_KO.md` | Sol 결과 요약과 Astra 해석·다음 단계 결정 |
| source bundle / 원격 commit / seal | 재현 코드·동결 자료·hash 목록 |

실험 하네스·실행에 필요한 파일은 복사 branch에서 버전 관리하고, 로컬 자료·Actions artifact 사이의 대응을 기록한다. 목록의 구체적인 파일 구조는 같은 정보를 보존하는 범위에서 Sol이 정한다.

각 단계 시작 전 이 문서의 목표·범위·측정 계약을 다시 확인한다. 방향 변경은 Astra가 이유와 버전을 추가한다. 봉인된 과거 manifest·원결과는 고치지 않고 새 revision에서 참조한다.

## 12. Sol에게 넘길 첫 작업 묶음

1. §3의 기준 확인과 독립 복사 저장소·실험 branch 생성.
2. minimals 전체 호출 경로, Rust/WASM 접점, 빠른 완료·Fast/exact·pool·출력·취소 계약 지도 작성.
3. 기존 3엔진 측정자료·fixture·반례·노출 이력을 연결하고 재사용 범위·공백·선정 편중·현재 엔진 재현 가능성 점검.
4. 직접 엔진 / secondary 정책 / 명령 전체를 분리 측정할 하네스 설계와 경량 계약 검사.
5. P1 계획 초안 제출: 광범위 초기 3엔진 비교의 개발 표본과 별도 검증 group, 기존 자료 재사용과 새 호출 목록, 비교 pair·호출 상한·반복·최대 16 VM 배치·총 예산·gate 제안·Actions workflow 구성·미해결 항목.

첫 작업 묶음의 완료 기준은 **원본을 보존한 재현 가능한 작업본과 P2 실행 전 고정할 수 있는 계획**이다. 실제 입력 벤치마크는 해당 계획과 예산을 동결한 뒤 시작한다.

## 13. 참고 자료

- [인계와 현재 제품 계약](handoff.md)
- [현재 제품 상태](dev-branch/docs/DEV_BRANCH_STATUS.md)
- [Threshold 통합 기록](dev-branch/docs/THRESHOLD_INTEGRATION_20261004.md)
- [기존 분류 설계·반례](tools/validation/secondary-routing-design-20260929/DESIGN_KO.md)
- [공통 테스트 지침 v2.0](tools/validation/TESTING_RULES_KO.md)
- [Sol 하네스·데이터 선별 인계](SOL_BENCH_HANDOFF_KO.md)
- [실험 인덱스](tools/validation/README_KO.md)
- [종료 연구와 아카이브 안내](NEXT_WORK_KO.md)

현재 사용자 지시와 이 로드맵의 역할·범위가 과거 분류 문서의 역할·작업 지시보다 우선한다. 측정 상세는 공통 지침과 해당 캠페인의 동결 manifest를 함께 따른다.

### 변경 기록

- v1.4 (2026-10-05): Human quality exact 옵션 고정, quality Auto와 secondary Auto 구분, 세 엔진의 유한 timeout·외부 watchdog·회수 제한 필수화.
- v1.3 (2026-10-05): 사용자 제공 3개 DB 지정, Sol 하네스·선별 인계 연결, 초기 정보 수집과 후속 A/B 재테스트 규칙 분리, 반복 횟수 협의와 공통 지침 v2.0 반영.
- v1.2 (2026-10-05): 기존 자료의 case 선정 편중 가능성 반영. 초기 광범위 3엔진 성능 지도 확보를 P2 기본안으로 설정하고, 개발/미노출 검증 분리와 규칙 구현 전 측정 우선순위 명시.
- v1.1 (2026-10-05): 사용자 지시 반영. 엔진 명칭을 Threshold로 통일, 기존 3엔진 측정자료의 적극 재사용, 충분한 실측 범위·중복 작업 최소화, 세션 내 에이전트 전환과 서브에이전트 금지, 병렬 Actions VM 최대 16개 명시.
- v1.0 (2026-10-05): Astra/Plan·Sol/Build 역할, minimals 전체 범위, 복사 branch·Actions 정책, 재사용 자료 기반 단계별 로드맵 수립.
