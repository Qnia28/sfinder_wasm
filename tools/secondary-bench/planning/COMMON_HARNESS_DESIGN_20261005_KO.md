# 공통 측정 하네스 및 triage 설계·검증 기반 — 확정 설계

2026-10-05 · 설계 v1 · **설계 확정 / 구현 인계용 / 구현·원격 실행 완료를 뜻하지 않음**

## 1. 결정과 적용 범위

사용자와 논의한 공통화 방향을 Sol의 구현 계약으로 확정한다.

**계획 → 실행 → 저장·전송 → 복구 → 감사 전체를 하나의 공통 하네스로 만들고, 측정 의미는 어댑터, 실험 조건은 동결된 명세로 분리한다.** 기존 부품을 추출·정리하며 전면 재작성하지 않는다.

- 일반적인 새 실험은 manifest·입력 인덱스 추가로 실행한다. workflow, raw reader, 전송 코드를 실험마다 수정하지 않는다.
- 엔진 단독 측정, triage 고정 fixture 비교, 실제 명령 end-to-end 측정에 동일한 실행·저장·감사 기반을 사용한다.
- 실험 이름 F/A, 특정 날짜, GitHub run ID, BOX 사례 수, 모집단 수는 공통 코어의 분기 조건이 될 수 없다.
- 기존 실험의 의미·조건과 source lock은 보존한다. 이 문서는 기존 측정 계획이나 진행 중인 run의 조건을 소급 변경하지 않는다.
- 설계·분류 방향과 결과 해석은 Astra, 구현·측정·감사는 Sol이 담당한다. Sol은 명세상의 모집단·선별·판정 기준을 임의 변경하지 않는다.

v1의 범위는 현재 F/A를 표현하는 공통 실행 기반과 아래 triage 확장 계약이다. 임의 DAG, 범용 플러그인 플랫폼, 새로운 원격 저장 서비스, 과거 모든 실행기의 재작성은 요구하지 않는다.

### 근거 문서

- [일반 ALL 우선 측정 계획](MINIMALS_ALL_FIRST_PLAN_20261005_KO.md)
- [현재 followup 준비·실행 계약](FOLLOWUP_PREPARATION_KO.md)
- [첫 clock 오류 감사](CLOCKFIX_AUDIT_20261005.json)
- [composite schema 오류 감사](TRANSPORTFIX_AUDIT_20261005.json)
- [기존 원자료 연결 설명](CLASSIFIER_RAW_DATA_KO.md)

위 문서의 과거 실행 상태와 본 문서 작성 당시의 실시간 Actions 상태는 구별한다. 여기서는 현재 run 상태를 재판정하지 않는다.

## 2. 현재 구현에서 옮길 경계

| 현재 위치·결합 | 확정된 책임 분리 |
|---|---|
| `followup.mjs`의 `FOLLOWUP_POLICY`, `SHAPE` | 실행 profile + manifest의 확정값 + 공통 예산 검증기 |
| `prepareFollowup`의 날짜·과거 run·110/550·23/191 조건 | F/A 명세 생성 recipe와 해당 명세의 수량 불변식 |
| `dataset === 'A'` 기반 명령·선별 분기 | 명시적 어댑터 ID와 selection 정책 ID |
| `retestDecision`의 1.10, `makeFollowupTasks`의 2/4·300초 | 정책 모듈이 resolved manifest를 읽어 작업·선별 원장을 생성 |
| `activateFollowup`의 특정 원시각 비교 | 부모 lock·continuation 원장으로 공통 검증 |
| `packFollowup`, `runFollowupPart` | 공통 planner, admission, executor |
| `followup-scope.mjs`, `isolation.mjs`, `child.mjs` | 검증된 격리·회수 부품과 측정 어댑터 경계 정리 |
| `followup-checkpoint.mjs`, storage/extract/download 모듈 | 공통 evidence store 및 Actions transport |
| F/A workflow의 clock·matrix·단계 중복 | 공통 reusable workflow와 얇은 launch 진입점 |
| `reportFollowup`의 단계·조건·witness 검사 | 공통 완전성 감사 + 어댑터 검산 + 실험별 분석 |
| 옛 campaign와 followup의 raw 형식 차이 | 원본 보존 + 버전별 읽기 전용 호환 reader |

파일명이 바뀌는 것보다 의존성 분리가 중요하다. 공통 executor/transport는 F/A나 triage cutoff를 몰라야 한다. 구현 내부 파일 배치는 Sol이 조정할 수 있으나 아래 논리 계약과 검증 기준은 유지한다.

## 3. 구성과 의존성

```text
experiment recipe → manifest + input index + analysis protocol
                              ↓ resolve / validate / freeze
                       resolved manifest + locks
                              ↓
common planner → immutable stage plan → common executor → evidence store
                       ↑                       ↓               ↓
                 selection policy       measurement adapter   Actions transport
                       ↑                       ↓               ↓
                  audited history         product calls    receipts / inventory
                       └───────────────────────┴───────────────┘
                                              ↓
                           completeness audit + adapter verification
                                              ↓
                               experiment-specific analysis / report
```

- 공통 코어: 식별자, 시계, 계획, admission, 상태 전이, 작업 실행, 원장, 저장, 복구, 감사.
- 정책: 모집단 선별, 반복 선별, 실행 순서, OOM 후 보류 범위를 명시적으로 구현한 버전 있는 모듈.
- 어댑터: 입력 의미, 제품 호출, 시간 경계, fixture/result schema, 검산.
- recipe: 특정 실험의 입력·보완 목록·과거 자료 연결을 manifest로 생성. 실행 기반을 복제하지 않음.
- 분석: baseline/candidate 비교, routing 해석, 성능 판정. transport나 solver 호출을 수행하지 않음.

v1 모듈은 저장소 내 명시적 registry로 선택한다. manifest에 임의 코드·shell을 넣어 실행하는 구조로 만들지 않는다.

## 4. Manifest와 동결 계약

### 4.1 명세 종류

1. **작성 manifest:** 입력·정책·profile 참조와 실험 조건.
2. **resolved manifest:** 기본값·참조를 모두 해소한 실행 계약. 실행 중 기본값 재해석 금지.
3. **activation lock:** 원시각·종료시각·commit·invocation·runtime 정보를 연결한 실행 증거.
4. **stage plan:** 이전 단계 자료와 정책으로 결정한 실제 작업·호출 목록. 실행 전에 동결.

작성 manifest는 엄격한 schema를 갖고 미지원 필드·정책·조합을 거부한다. schema 검증 외에 시간·자원·측정 의미의 교차 검증이 필수다.

### 4.2 필수 논리 필드

| 영역 | 필수 내용 |
|---|---|
| identity | schemaVersion, campaignId, purpose, 실험 명세 revision |
| implementation | 하네스 revision, 어댑터 ID/version, 정책 ID/version, 제품 revision |
| inputs | command/fixture index 참조·hash, provenance, development/validation 역할·노출 이력 |
| measurement | adapter, lifecycle, 시간 계약 버전, explicit exact quality, 엔진/정책 목록, thread·seed·solver parameters |
| selection | 모집단 조건, fixture 선택 방식, 보완 목록, 필수 진단 목록 |
| repeats | 기본 반복, 추가 반복 선별 규칙·상한, schedule seed, 동일 VM 비교 블록 |
| limits | phase/call/startup/reap 제한, 메모리·swap, CP 내부 제한 |
| budget | campaign wall 예산, job profile, VM 할당, 전체 호출 상한, 전송·setup 여유 |
| evidence | evidence schema, transport profile, 보관기간, archive 요구 |
| continuation | 부모 lock·history 인덱스, 원시각·종료시각, 복구 대상과 근거 |
| analysis | baseline, 비교 층화, 지표, 판정 기준 또는 `INFORMATION_ONLY` |

manifest에 적힌 값과 코드의 숨은 상수를 이중 관리하지 않는다. 허용 값의 제약은 profile에 두되 planner/executor/auditor는 동일한 resolved 값을 사용한다.

### 4.3 Profile

- 첫 compatibility profile은 기존 F/A의 exact Human quality, primary CP2/secondary CP1, 다른 엔진 기존 thread, Rust `stateBudget:null`, CP secondary `max_lp`·seed1, 3GiB/no-swap 조건을 그대로 고정한다.
- bag-family/restricted-split, clear4/hold=true/N+1 및 independent-split 제외는 해당 F/A 실험·어댑터 입력 계약으로 보존한다.
- 새로운 thread/lifecycle/quality 조합은 명시적으로 지원·검증된 새 profile에서만 허용한다. 단순 JSON 수정으로 미지원 측정 의미가 활성화되면 안 된다.
- 실험 수량 110/550, 보완23, 복구191 같은 불변식은 F/A 명세 감사에 남긴다. 공통 schema에 고정하지 않는다.

### 4.4 Hash와 버전

- 입력 bytes, 제품 source/assets, 하네스 source, resolved measurement condition을 별도로 hash하고 aggregate execution lock으로 연결한다.
- 새 v1 구조값 hash는 재귀 key 정렬·UTF-8·유한 숫자만 허용하는 버전 있는 canonical JSON 규칙을 고정한다. 배열 순서는 보존한다. raw 파일은 실제 bytes의 hash를 사용한다.
- 기존 `identity(JSON.stringify(...))` hash나 fixture ID를 새 방식으로 소급 교체하지 않는다. legacy reader가 원 hash 규칙과 원본 포인터를 유지한다.
- timing 경계·상태 의미·특성 정의 변경은 명시적인 contract/schema version 변경이다. 서로 다른 버전의 시간값을 자동 pooling하지 않는다.

## 5. 식별자와 continuation

| 식별자 | 의미 |
|---|---|
| campaignId | 하나의 동결 실험. GitHub run이 바뀌어도 유지 |
| invocationId | 실제 workflow 실행 및 run attempt 연결 |
| stagePlanId | 정책·입력 history에서 생성한 동결 일정 |
| logicalCallId | campaign 내 stage/phase·입력 의미와 hash·variant·조건 hash·반복으로 정한 예정 호출 |
| executionAttemptId | 실제 호출 시도. call 시작 전에 원장에 기록 |
| checkpointId | 봉인한 evidence 집합과 snapshot |
| transportAttemptId | 같은 checkpoint를 전달한 시도 |

- call ID는 chunk 번호·VM·업로드 artifact 이름에 의존하지 않는다. 다시 배치해도 같은 예정 호출을 식별할 수 있어야 한다.
- transport 재시도는 executionAttempt를 만들지 않는다. 동일 logical call의 다른 실행을 bytes가 비슷하다는 이유로 합치지 않는다.
- intentional remeasurement는 새 반복/phase 또는 새 campaign으로 명시한다. recovery 실행도 기존 원기록을 지우지 않고 새 attempt와 근거를 연결한다.
- continuation은 부모 lock과 history를 읽어 원시각·종료시각·이미 실행한 호출을 검증한다. 특정 날짜나 `executedCalls=0` 전용 분기에 의존하지 않는다.
- 실행 시작 증거는 있지만 종료 raw가 없으면 `UNKNOWN_EXECUTION`이다. artifact 부재만으로 미실행을 증명하지 않는다.
- 미실행이 증명된 호출만 일반 recovery 대상으로 삼는다. UNKNOWN을 다시 측정할 경우 별도 명시된 재측정이며 중복 가능성을 기록한다.
- 하네스 교정 시 새 하네스 lock과 부모 lock을 연결한다. 측정조건·입력·제품 의미가 바뀌면 단순 continuation으로 취급하지 않는다.

## 6. Clock·자원·스케줄링

### 6.1 단일 예산 계산

- campaign origin/end는 activation에서 동결한다. queue·setup·교정 대기 시간이 포함되며 continuation에서 재시작하지 않는다.
- job clock은 checkout/setup 전에 확보한다. 프로세스 내부 경과시간은 monotonic clock으로 측정하고 UTC는 provenance에 사용한다.
- startup, call, reap, scope overhead, setup, checkpoint, final flush, receipt audit 예산을 별도 필드로 표현한다.
- planner의 최악 비용과 executor의 admission은 같은 budget 모듈을 사용한다. CP 내부 제한과 외부 wall 제한의 관계도 여기서 검증한다.
- 새 작업 admission은 campaign 잔여시간과 job 잔여시간 모두를 검사하며, 뒤따르는 필수 전송 여유까지 예약한다. 계산 soft boundary와 platform hard timeout을 혼동하지 않는다.
- task가 수용량을 초과하면 실행 전 거부한다. 비교 블록을 조용히 분할하거나 population을 줄이지 않는다.
- GitHub matrix 256 초과 시 v1은 명시적 planning failure로 보고한다. 지원하지 않는 자동 분할/표본추출로 우회하지 않는다.

F/A compatibility profile은 기존 세 task/job, soft125분·reserve5분·setup10분·checkpoint2분×3·packing104분·hard150분·final flush15분·audit3분과 F36h/A108h의 산출·적용 의미를 보존한다. 원본 대비 동등성 검사 후 사용한다.

### 6.2 순서와 비교 블록

- 엔진/정책 실행 순서는 seed와 버전 있는 스케줄 규칙으로 결정하고 기록한다.
- 같은 fixture의 baseline/candidate와 해당 반복 블록은 같은 VM에서 직렬 비교한다. variant별 프로세스 상태는 lifecycle 계약에 따라 격리한다.
- triage A/B 비교는 AB/BA 순서를 균형 배치한다. 기존 F/A는 기존 세 엔진 순서 알고리즘을 그대로 재현한다.
- 엔진/정책의 내부 fallback·race는 어댑터 내부 동작으로 기록하고 전체 owned process tree의 자원 제한에 포함한다.
- OOM 후 격리 범위와 다음 호출 가능 여부는 명시된 정책을 따른다. 회수 실패 후 측정을 계속하지 않는다.

### 6.3 여러 workflow의 VM 합계

- launch group 명세에서 캠페인별 고정 할당을 선언하고 합계 상한을 검사한다. 현재 F8/A12, 총20을 compatibility 사례로 사용한다.
- 계획·보고·검증 job도 VM 소비다. 각 캠페인 내 control job과 측정 matrix가 겹치지 않게 DAG를 구성하여 할당 안에 포함한다.
- full-cap 실행 중 별도 preflight를 자동 추가하지 않는다. 신규 하네스 preflight를 먼저 완료한 뒤 launch한다.
- v1은 고정 할당 방식이다. GitHub `concurrency`를 전역 counting semaphore로 간주하지 않는다. 겹치는 launch group은 공통 실행 진입점에서 직렬화하고, 기존 관련 workflow 실행도 launch 전에 검사한다.

## 7. Actions 구조

공통 reusable workflow의 단계는 다음으로 고정한다.

```text
activate → adapter-preflight → acquire(capture/import)
         → initial → additional → audit/report
```

- 필요 없는 단계는 `NOT_APPLICABLE` 또는 `EMPTY_COMPLETE` stage record를 생성한다. 누락된 plan과 빈 정상 단계를 구분한다.
- 추가 반복은 v1에서 유한한 한 번의 선별 단계로 지원한다. 과거의 임의 다중 wave 실행기를 재현하는 것은 v1 필수가 아니다.
- 단계 실패 시에도 최종 감사·진단 수집을 시도한다. 진단용 단계와 측정 matrix의 VM 중첩이 없게 한다.
- F/A 등의 launch workflow는 manifest/launch group 참조를 전달하는 얇은 wrapper만 둔다. workflow_dispatch를 쓸 수 없는 실험 branch에서는 marker-only push 진입점을 유지할 수 있다.
- Node/runtime/dependency 준비, clock, payload 검증, matrix 설정, 실패 증거 보존은 공통 구현한다.
- composite schema가 허용하지 않는 step 속성을 쓰지 않는다. job hard timeout은 workflow, 전송 deadline은 검증된 native action에서 담당한다.

### Chunk 실행 방식

공통 native chunk action은 동결된 task 목록을 순서대로 실행하고 각 task 종료 뒤 checkpoint한다. solver는 기존 독립 scope/child에서 실행하여 supervisor·deadline·전송 event loop를 막지 않는다. checkpoint 상태를 disk에 기록하고 마지막에 실패·미확인 전송만 flush한다.

처음에는 기존 세-slot composite를 공통 profile로 유지하며 동등성을 확보할 수 있다. 최종 v1은 task 수만으로 YAML 본문을 생성·복제하지 않는 위 chunk action으로 수렴한다. 이 전환은 실제 Actions contract를 통과해야 하며, 기존 측정의 lifecycle이나 per-call 격리를 바꾸면 안 된다.

## 8. 어댑터 계약과 triage 확장

### 8.1 공통 인터페이스

각 어댑터는 `validateInput`, `estimateWorstCost`, `execute`, `verifyResult`, `describeTiming`에 해당하는 명시적 기능을 제공한다. executor에는 command/fixture 참조·조건·출력 경로를 전달하고, 어댑터 결과는 공통 evidence envelope 안에 저장한다.

| 어댑터 | 의미 |
|---|---|
| capture-per-save | queue remainder의 개별 save 의미로 primary-proven fixture 확보 |
| capture-minimals | 일반 minimals의 save expression, ALL 포함, 의미 보존 |
| secondary-fixture | 동결 fixture에서 특정 엔진 직접 실행 |
| triage-fixture | 동결 fixture에서 실제 baseline/candidate triage 코드 실행 |
| minimals-e2e | 실제 명령의 열거·primary·triage·secondary·최종 출력 경로 실행 |

첫 세 어댑터로 F/A 공통화를 완료한다. 뒤 두 어댑터는 triage 단계에서 구현하되 별도 workflow/저장 형식을 만들지 않는다.

- collector 검사는 어댑터의 진단 사례 목록으로 선언한다. 현재 ALL의 BOX 두 사례와 원행 hash 검사는 F/A compatibility 명세에 그대로 남긴다.
- `primaryHard` 여부가 일반 ALL의 nontrivial 모집단 측정 자격을 바꾸지 않도록 해당 선별 계약을 유지한다.
- fixture metadata의 filter semantics, primary backend/kernel/tiny 및 구조 특성 provenance를 잃지 않는다.
- witness 유효성, 엔진 exact 주장, 독립 optimality proof를 구분한다. 공통 검산 성공을 독립 최적성 증명으로 과장하지 않는다.

### 8.2 Triage의 세 단계

1. **offline replay:** 기존 구조 특성에서 후보 선택을 재생하고 기존 엔진 관측값에 연결한다. solver 호출 없음. 부가 비용·fallback·실제 end-to-end 검증으로 표현하지 않는다.
2. **fixture A/B:** 같은 fixture에서 실제 기존/후보 정책을 실행한다. 특성 계산·분기·변환·초기화·fallback을 포함한 secondary 전체 비용을 비교한다.
3. **command e2e A/B:** 실제 제품 명령 경로에서 최종 응답·결과를 비교한다. primary 결과 전달, save 의미, worker/pool/cache 효과를 확인한다.

offline replay에서 선택 엔진의 관측이 없거나 timeout/OOM이면 missing/censored로 남긴다. 이를 정확한 시간이나 승패로 대체하지 않는다.

### 8.3 Triage evidence 필드

- policyId, policyHash, baseline/candidate 역할, featureSchemaVersion.
- 분기에 실제 사용한 특성과 provenance, 선택 규칙 ID·선택 엔진, fallback/race 실행 이력.
- feature/decision/prepare/engine/fallback/total 시간 중 관측 가능한 값과 timing contract.
- 호출 전체 응답시간, process wall, 회수 비용, 원 결과·witness 참조.
- feature 값이 실행 후 감사에서만 산출됐는지, 결정 시점에 실제로 이용 가능했는지 구분.

관측 불가능한 구간은 `UNOBSERVED`로 남긴다. 겹치는 구간을 더해 total을 만들지 않는다. 정책이 쓰지 않는 비싼 진단 특성을 timed path에 추가하지 않는다. 추가 진단은 별도 실행/오프라인 단계로 기록하고 측정 결과에 섞지 않는다.

`fresh-process-cold`와 worker 재사용 경로는 다른 lifecycle profile이다. warmup 횟수·상태 초기화·정책 간 cache 공유 여부를 동결한다. 미구현 lifecycle은 거부하며 cold 결과를 실제 사용자 응답시간으로 대체하지 않는다.

### 8.4 Triage 판정 protocol

검증 전에 baseline/candidate, 입력 역할, 반복, 층화, 지표·집계법, 빠른 사례의 절대/상대 악화 한도, tail 개선 기준, timeout/OOM 취급, 허용 누락과 판정 불가 조건을 동결한다. 이 문서는 다음 triage의 수치 cutoff나 성능 허용치를 새로 결정하지 않는다.

필수 보고 축은 정확성, fast-case regression, tail, timeout/OOM, 변동·fallback, 입력군별 적용 범위다. exact matched subset 비교와 전체 상태 원장을 함께 제시하여 생존한 사례만의 평균으로 결론내리지 않는다.

현재 노출된 자료는 development/회귀 자료로 활용한다. 기존 reserve의 노출 문제를 split 이름 변경으로 없애지 않는다. 독립적인 fresh 판정에는 별도 미노출 입력과 노출 원장이 필요하다. 정보수집 manifest는 `INFORMATION_ONLY`, 사전 판정 기준이 없는 비교는 성능 PASS를 발행하지 않는다.

## 9. Evidence 저장·전송 계약

### 9.1 논리 구조

```text
campaign/
  manifests/                 # 작성본·resolved·lock, append-only revision
  inputs/index.json          # 의미·hash·원출처·실제 object 참조
  plans/<stagePlanId>/       # expected calls, decisions, empty/failure record
  executions/<attemptId>/    # 시작·종료·scope·raw·result/witness 참조
  checkpoints/<id>/          # immutable snapshot 및 file hashes
  transport/                 # upload attempts, receipts, inventories
  audits/<revision>/         # 완전성·검산 결과
  reports/<revision>/        # 조건별 분석·원 raw pointer
```

이는 논리 구조이며 file/call당 GitHub artifact를 만들라는 뜻이 아니다. 물리 ZIP grouping은 transport의 책임이다. immutable index segment가 logical object→artifact backend ID/digest/member path/file hash를 연결하고, stage/final index는 이 segment들의 hash를 참조한다. artifact name/prefix는 발견 수단이지 자료의 정체성이 아니다.

### 9.2 불변식

- raw는 append 후 fsync, checkpoint는 봉인 후 변경 금지. 재분석·수정 보고는 새 revision에 생성한다.
- result bytes·전체 raw hash·개별 raw line bytes·snapshot이 일치하는 동일 execution의 중복 업로드만 alias로 묶는다. canonical/alias 포인터를 보존한다.
- 서로 다른 executionAttempt는 같은 logical call/결과라도 dedup하지 않는다. 예상치 못한 복수 실행으로 보고한다.
- 재전송은 FAILED/PENDING 대상의 같은 bytes만 사용하고 횟수·deadline을 제한한다. solver 모듈에 의존하지 않는다.
- 전송 receipt와 전체 목록도 저장한다. 전송 action 자체가 죽어 마지막 receipt를 못 올린 경우 inventory와 snapshot으로 대조하고 미확정 상태를 숨기지 않는다.
- 다운로드는 pagination 종료까지 목록을 확보하고 digest·file hash를 검증한다. 전송 오류나 rate limit을 자료 없음으로 해석하지 않는다.
- 디스크 admission은 압축·실제 해제 크기·metadata·동시 임시 bytes·reserve를 포함한다. 경로 탈출을 거부하고 가능한 경우 hardlink를 사용한다.
- 공간 부족은 명시적인 incomplete/failure로 남긴다. 임의 sampling이나 기존 evidence 삭제로 통과시키지 않는다.

v1 transport backend는 GitHub Actions artifacts를 유지한다. checkpoint/flush/audit deadline과 retention은 검증된 profile 값이며, storage schema와 독립시킨다.

### 9.3 보존 완료의 두 수준

- `REMOTE_RECEIPT_VERIFIED`: backend receipt·snapshot으로 원격 업로드를 확인함. 영구 보존을 뜻하지 않음.
- `ARCHIVE_VERIFIED`: artifacts 만료 전에 로컬 archive로 내려받아 인덱스·digest·전체 필요한 objects를 검증함.

현재와 같은 30일 artifact 보관은 compatibility 기본값으로 유지한다. 최종 인계에는 archive 위치·인덱스 hash·검증 시각·누락 목록을 기록한다. 전체 네트워크 단절·VM 강제 유실에서 마지막 bytes 보존을 보장하지 않으며 그 상태를 명시한다.

## 10. 감사와 결과 상태

단일 Actions 초록색이나 하나의 PASS로 결과를 표현하지 않는다.

| 축 | 판정 내용 |
|---|---|
| orchestration | workflow/job/adapter가 정상 동작했는가 |
| execution completeness | 모집단·선별·예정 호출 대비 실행/미실행/불명확 상태 |
| evidence completeness | 필요한 raw·fixture·receipt·plan이 존재하고 검증되는가 |
| correctness | 입력 의미·조건·witness·최종 출력 검사 결과 |
| performance | 사전 protocol에 따른 PASS/FAIL/INCONCLUSIVE/NOT_APPLICABLE |

- manifest의 전체 command 모집단부터 capture/proof/selection/expected call/raw까지 연결한다. stage plan을 만들지 못해 expectedCalls가0인 실패를 완전 실행으로 판단하지 않는다.
- 빈 정상 단계, 미선별, primary-unproven, 예산상 NOT_RUN, 실제 TIMEOUT/OOM, UNKNOWN_EXECUTION, MISSING_EVIDENCE를 구분한다.
- 공통 auditor는 plan·원조건·ID·source·transport를 검사하고, correctness는 어댑터 verifier를 독립 호출한다.
- engine/repeat/candidate 간 결과 일치와 원행 witness 검산을 모두 보고한다. mismatch 원본을 보존한다.
- evidence를 수집한 뒤, orchestration 오류·필수 누락·정확성 실패는 별도의 required validity check를 실패시킨다. 정상적인 solver timeout은 기록만으로 workflow 결함이라고 단정하지 않는다.
- performance 판정은 required validity와 별개다. INCOMPLETE/UNKNOWN이 있는 범위에서 허용되는 해석은 사전 protocol을 따른다.

## 11. Sol 구현 순서와 검증 관문

### M0 — 기준 동결

- 기존 branch·제품·실행 template·raw를 보존한다. 현재 F/A의 source lock을 새 구현으로 바꾸지 않는다.
- 동결 계획·fixture·작은 원자료 표본을 이용해 모집단, selection, 호출 조건, 순서, budget, raw 의미의 동등성 기준을 만든다.
- 실제 setup 성능 측정은 Actions에서, 로컬은 경량 계약·오프라인 감사만 수행한다.

### M1 — schema·lock·ID·budget·정책 추출

- 작성/resolved schema, profile, canonical hash, continuation 원장, 공통 admission 구현.
- F/A를 각각 recipe/manifest로 표현. 하네스 코어의 F/A·특정 날짜/run 의존 제거.
- **관문:** 동일 입력 history에서 기존 F/A와 모집단·선별·호출/반복/timeout·순서·VM/clock 예산 일치. 새 ID 형식은 원 ID와 대응표로 검증.

### M2 — 저장·reader·감사 공통화

- evidence index/receipt/archive 계약 구현, 기존 transport/storage 부품 재사용.
- legacy reader는 원본을 변경하지 않고 새 envelope로 읽으며 original file/line/hash를 유지.
- **관문:** 기존 표본의 raw·witness·누락·OOM/NOT_RUN 상태를 손실 없이 재현. ACK 유실·중복 업로드·bytes 변경·디스크 부족·부분 목록을 구분.

### M3 — 공통 Actions와 chunk executor

- reusable workflow·얇은 launcher·공통 native executor를 연결. 초기 호환 단계 후 task별 YAML 복제를 제거.
- workflow와 composite/native action schema, 실제 Bash 명령, SDK runtime 환경을 검사.
- **관문:** 실제 Actions에서 합성 소형 입력으로 activate→진단→acquire→initial→additional/empty→checkpoint→download→audit 전체 성공.
- 의도적 전송 실패/ACK 유실, 실제 Linux OOM·scope 회수, 취소/부분 실행, continuation을 검사. 장애 주입과 실제 transport 검사를 구분해 결과에 명시.
- 실제 수천 artifact를 만들지 않고 pagination 경계는 합성 계약으로 검사하고, backend upload/download는 작은 실제 artifact로 검증한다.
- 테스트 개수나 actionlint 단독 통과를 전체 경로 검증으로 대체하지 않는다.

### M4 — F/A 호환 인계

- 기존 F/A 명세를 새 공통 기반으로 dry-plan하고 차이 원장을 제출한다. 기존 실험을 자동 재실행하지 않는다.
- 실자료 canary/후속 실험은 명시된 실행 범위에서만 launch한다. 기존20VM 측정과 별도 preflight가 충돌하지 않게 한다.
- **관문:** 새 실험의 모집단/VM/timeout/반복 변경이 지원 profile 내 manifest 변경만으로 가능. workflow·reader·transport 변경 없음.
- 이 관문까지를 **공통 하네스 v1 실행 기반 완료**로 본다.

### M5 — triage 설계·검증 확장

- offline replay → triage-fixture A/B → minimals-e2e A/B 순서로 어댑터와 분석 구현.
- 실제 제품의 정책 진입점을 이용한다. 후보 선택 로직을 하네스에 복제해 별도의 가짜 triage를 측정하지 않는다.
- timing/feature/fallback/lifecycle contract를 검사하고 baseline과 candidate의 조건 일치를 감사.
- **관문:** 같은 workflow·evidence/복구 체계로 세 단계 결과를 연결하며, offline 추정과 실제 실행·fresh 판정을 구분.
- 이 관문까지를 **triage 검증 준비 완료**로 본다. 성능 PASS는 별도 후보 검증의 결과다.

## 12. 인계 산출물과 완료 기준

Sol은 각 관문에서 구현 revision, 계약 검사 결과, 원격 smoke run 링크, 동등성 diff, 남은 미지원 조합을 제출한다.

최종 필수 산출물:

1. schema/profile/정책 registry와 지원 조합 문서.
2. F/A manifest 예시 및 원본 계획과의 동등성 감사.
3. 공통 launch/plan/run/download/audit/archive 절차.
4. evidence schema, ID/hash 규칙, legacy 원본 포인터 설명.
5. 복구 운영 절차: 재전송·증명된 미실행·UNKNOWN·의도적 재측정의 구분.
6. 실제 Actions end-to-end·장애 경로 검사 증거.
7. triage replay/fixture/e2e 사용 예시와 timing·판정 protocol 템플릿(M5).

**완료의 핵심 기준:** 새로운 지원 범위의 실험에서 바꾸는 것은 입력·정책·profile 명세이며, workflow와 저장·복구·감사 코드를 다시 설계하지 않는다. 새로운 측정 의미가 필요할 때만 어댑터와 계약을 확장한다.

이 문서는 설계와 구현 순서를 확정한다. 현재 실행 중인 캠페인 변경, 새 대규모 실험 launch, 제품 solver/라우팅 변경 자체를 지시하는 문서는 아니다.
