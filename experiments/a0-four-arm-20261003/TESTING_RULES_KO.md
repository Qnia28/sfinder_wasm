# 공통 테스트·증명·재확인 지침

**문서 ID: SFINDER-TEST-001 / 버전: 1.1 / 발효: 2026-10-03**

v1.1 변경: 사용자의 “스스로 해결 가능한 오류는 수정하고 재시도, 단순 실수는 별도 보존 불필요” 지시를 반영했다. 하네스/API 인자/경로 등 교정 가능한 실행 오류는 fixture 확인 후 같은 예산에서 자율 재시도할 수 있다(§8). **성능값·검색 timeout·정확성 불일치를 좋은 값으로 치환하거나 gate/표본/상한을 바꾸는 것은 여전히 금지**다. 적용 시작은 a0-proof-retest-20261003의 qualityFor 교정이다. v1.0 원문은 experiment-review-20261003/DOCS_SNAPSHOT.zip 및 각 동결 실행 복사본에 남아 있다. tail 선별·10쌍 규칙은 변경하지 않았다.

이 문서가 향후 sfinder-wasm 성능 실험의 공통 지침이다. 사용자가 승인한 “개선/악화 상위 10% 및 반복 편차 10% 이상을 10회 확인”을 포함한다. 세부 수식·동률 처리·host 배치 등은 아래 v1.0 기본값으로 명시한다. 과거 결과에는 당시 동결한 규칙을 적용하며, 이 문서로 소급 판정을 바꾸지 않는다.

읽기 순서: [실험 인덱스](README_KO.md) → [현재 종합 해석](experiment-review-20261003/SYNTHESIS_KO.md) → 이 문서 → 각 캠페인의 동결 manifest. 제품 승격·Dev 적용·main merge·배포는 각각 별도 결정이다.

## 1. 목적과 판정을 분리한다

각 캠페인은 다음 중 목적을 명시한다.

| 목적 | 답할 질문 | 다른 목적을 대신할 수 없는 것 |
|---|---|---|
| 정확성/독립 exact 증명 | 유효성·최적 quality·stable-ID 동률 선택이 맞는가 | 반복 일치나 좋은 성능은 최적성 증명이 아님 |
| 원인 진단 | 어느 실행 조건/구간이 비용에 영향을 주는가 | 결과로 선택한 소표본·계측 호출은 모집단 성능 증명이 아님 |
| 성능 screening | 고정 모집단에서 어느 입력을 재확인할 것인가 | 단발 극단값은 곧바로 원인이나 개선 효과가 아님 |
| 10쌍 재확인 | 선택한 변화·변동이 여러 runner에서 유지되는가 | 선택 표본의 개선을 전체 p95 PASS로 전용할 수 없음 |
| 공식 성능 확인 | 미리 정의한 대상 전체가 gate를 충족하는가 | 일부 성공 입력만 집계하거나 새 값으로 나쁜 값만 교체할 수 없음 |

`Actions success`, `harness/audit PASS`, `correctness PASS`, `performance PASS`, `promotion APPROVED`는 별도 필드다. 하나의 success로 합치지 않는다.

## 2. 실행 전 고정해야 하는 manifest

모든 native 캠페인은 실행 전에 다음을 기록·hash 고정한다.

1. campaign ID, 이 문서 버전/hash, 목적·검증할 가설·종료 조건.
2. baseline/candidate commit, WASM 및 도구 hash, Node/V8/Rust/browser 버전, compiler flags.
3. 모집단·분할(development/reserved 등), 입력 ID·identity/hash·원 bytes·aliases·mirror group, 노출 이력.
4. 입력별 K와 기존 최소-K 증명, 원 seed, weighted rows, stable-ID universe 및 동률 규칙.
5. 비교할 엔진/옵션·state budget·lifecycle·측정 경계. warmup 수와 비용도 별도 고정.
6. 호출/쌍/runner/block ID, 순서, variant의 실제 코드와 표시 label, selection reason.
7. 독립 phase deadline·회수 제한·cgroup·최대 호출 수·job 수·wall/runner-hour/artifact 예산.
8. 지표 수식·quantile·bootstrap seed/단위·gate·대조 경보·결측 처리.
9. 보존 위치, 원결과 writer/ACK protocol, 독립 검산기, 승인 범위와 아직 미승인인 작업.

fixture 검사 → 대상 목록/예산 산출 → manifest 동결 → native 실행 → 독립 감사 → 결과/결정 → 봉인 순서다. 실제 입력 시작 뒤 결과를 보고 순서·표본·gate를 수정하지 않는다.

## 3. 정확성 및 결과 상태

- K/coverage/quality는 원래 weighted rows에서 독립 재계산한다. 중복 행 가중치·aliases·stable IDs를 삭제하거나 재번호화하지 않는다.
- 원 seed보다 나쁘지 않은지와 R 대비 후보의 bounded quality/states 계약을 별도로 검사한다.
- 반복 결정성은 시간 제외: selected IDs, full quality vector, K, completed, searchedStates 등을 비교한다.
- 정상 `CAPPED100K`는 완료한 bounded probe다. 시간 비교에 포함한다. timeout/오류와 합치지 않는다.
- `TIMEOUT_*`, `OOM`, `ERROR`, `MISSING`, `PROOF_PENDING`, `MISMATCH`는 독립 상태다. timeout은 관측 한계값으로 기록하며 그 값이 실제 완료 시간이라고 대입하지 않는다.
- 후보만 EXACT이면 독립 exact 참조가 필요하다. 같은 solver 10회 일치는 독립 증명이 아니다.
- EXACT 증명은 고정 K에서 더 좋은 quality vector 부재와 동일 quality에서 더 우선하는 stable-ID 해 부재를 모두 확인한다. witness 검사만으로 충분하지 않다.
- 독립 경로의 알고리즘/공유 코드 범위를 적는다. baseline threshold도 공통 primitive를 공유할 수 있으므로 “모든 구현이 독립”이라고 과장하지 않는다.
- proof timeout/CAPPED/UNKNOWN은 미확인 유지. primary/PC 재계산은 secondary 증명을 위해 자동 허용되지 않는다.

정확성 불일치·OOM·원자료 저장/protocol 오류는 중단·보존한다. correctness/proof 미해결인 입력을 성능 재테스트 PASS로 승인하지 않는다.

## 4. 측정 계약과 환경

### 4.1 기본 측정

- R과 A를 시간상 인접한 **쌍**으로 실행한다. 각 쌍은 같은 runner와 같은 lifecycle이다.
- 새 screening 기본값은 입력당4쌍 이상, 가능한 경우 독립 runner job2개에2쌍씩 배치한다. 정확한 수는 실행 전에 고정한다.
- cold/compiled-module reuse/warm-instance는 서로 다른 계약이다. 섞어 평균내거나 warm을 cold 실패의 대체값으로 쓰지 않는다.
- integrated API 기준은 coverage 생성 후 wrapper 진입~readback 반환이다. decode/import/init/coverage/IPC/저장/검산은 별도 기록한다.
- 전체 제품 응답시간은 별도 route/end-to-end 측정으로 주장한다. 부분 timer의 median들을 더해 전체 median이라고 하지 않는다.
- wall, calling-thread CPU, process CPU, 메모리 scope, CPU 모델·affinity·PID/TID·런타임을 가능한 범위에서 함께 기록한다.
- 계측/profile 호출은 비계측 호출과 별도 일정·표로 보존한다. 계측을 켰을 때 성능/최적화 진행이 달라질 수 있다.
- compiler 생성 로그는 실행 frame의 tier가 아니다. 도구가 식별하지 못한 tier·함수 CPU는 `UNOBSERVED`로 둔다.

### 4.2 host 통제

표준 public GitHub Actions만 사용한다. 요청한 runner job이 물리적으로 서로 다른 서버인지 보장되지 않으므로 **독립 runner job**이라고 기록한다. CPU 모델을 골라 재시도하지 않는다. calling-thread affinity를 사용하면 R/A에 동일 적용하고 이전 미고정 자료와 구분한다. 주파수/SMT/배경 compiler까지 고정했다고 간주하지 않는다.

동일 variant 대조(R/R 또는 A/A)는 알고리즘 차이 없는 환경 경보다. 재테스트 대조 입력과는 구별한다(§5.4). 작은 대조 표본에서 p95가 거의 최대값이라는 점과 표본 부족을 명시한다.

## 5. 10회 재테스트 규칙 — 핵심

### 5.1 수식과 모집단

입력 i, 쌍 j에 대해 `q_ij = T_Aij / T_Rij`, `r_i = median(q_ij)`, `d_i = log(r_i)`.

시간은 동일 경계의 양수 값이어야 한다. 기존 자료가 동결된 pair ID를 제공하지 않으면 시간 순서만으로 짝을 추정하지 않는다. 그 자료의 원지표 `median(T_A)/median(T_R)`를 selection 전용 fallback으로 사용하고 `LEGACY_UNPAIRED`로 표시한다. 새 실험은 pair ID를 반드시 제공한다.

모집단/분할/측정 경계/lifecycle/동일 binary별로 따로 선별한다. development와 reserved를 합쳐 tail을 가리지 않는다. 기준 입력은 모두 예정된 screening 결과가 정상 반환된 입력이다. 정상 capped 포함, 오류/누락은 §5.3에 별도 등록한다.

### 5.2 개선·악화 양쪽 tail

v1.0에서 “상위 10%”는 **개선군과 악화군 각각의 크기**를 분모로 한다.

- 개선군 `I = {i | r_i < 1}`: `ceil(0.10 * |I|)`개를 d_i 오름차순으로 선택.
- 악화군 `W = {i | r_i > 1}`: `ceil(0.10 * |W|)`개를 d_i 내림차순으로 선택.
- `r_i = 1`은 tail 양쪽에서 제외. 빈 군은0개.
- 경계와 수치가 같은 입력은 모두 포함한다. 예산 산출은 동률 확장 후 한다. 출력 순서는 matrixId의 UTF-8 byte 순서로 고정한다.
- 이는 느린 실행시간 상위10%나 “10% 넘게 개선”과 다르다. 변화 폭의 양쪽 꼬리를 확인하는 규칙이다.
- 결과를 보고 가상의 epsilon을 넣어 작은 변화의 tail을 없애지 않는다. 절대 ms는 함께 보고한다.

### 5.3 변동 및 추가 대상

다음의 합집합을 대상 S로 한다. 겹쳐도 입력당 재테스트10쌍은 한 번뿐이며 모든 selection reason을 남긴다.

1. §5.2의 양쪽 tail.
2. R 또는 A의 같은 측정 계약 반복에서 `max(T)/min(T) >= 1.10`인 입력. 각 variant의 유효 반복2개 미만이면 비교 불충분으로 표시한다. 같은 runner 내와 runner 간/전체 변동을 각각 기록하고 어느 쪽이든 기준을 넘으면 포함한다. 서로 다른 lifecycle의 시간 차이로 선별하지 않는다.
3. 원 규칙의 입력별 성능/메모리 경보 기준을 넘는 입력. A0의 경우 입력 ratio>1.10을 포함한다. 전체 sum/CI gate가 실패했다는 이유로 “기여한 몇 개”를 사후 임의 선택하지 않는다.
4. R-only/A-only exact, 반복 완료상태 불일치 등 결과 상태 전환 입력은 증명·계약 검증 우선 대상으로 표시한다. 독립 proof 통과 전 performance-only PASS 처리 금지.

오류·OOM·mismatch·누락·timeout은 모집단에서 지우지 않는다. **자동 10쌍 rerun으로 성능/정확성 실패를 숨기지 않고 `BLOCKED/INCOMPLETE` 원장에 남긴다.** 검색 timeout·OOM·mismatch 등은 새 범위 승인 없이 재측정값으로 치환하지 않는다. 단순 하네스 오류의 자율 교정은 §8의 예외를 따른다.

### 5.4 선택 편향 대조

S 밖의 정상 입력에서도 고정 대조 C를 선택한다. 분할별 기본값은 최대8개다.

- baseline median 시간의 사분위 × baseline EXACT/CAPPED의 최대8개 층을 만든다(사분위 경계는 해당 분할 전체 정상 입력의 baseline으로 계산).
- 각 비어 있지 않은 층에서 `SHA256(selectionSeed + '\n' + matrixId)`가 가장 작은 비선별 입력1개를 선택한다. 동률은 matrixId 순서. 빈 층은 보충하지 않는다.
- selectionSeed와 층 경계를 manifest에 고정한다. 후보 개선값으로 대조를 고르지 않는다.
- C도 R/A10쌍을 실행한다. 대조가 극단값 선별 후 평균 회귀의 규모를 완전히 추정해 주는 것은 아니다.

별도 동일 variant 환경 대조는 C가 있으면 각 분할 C 중 hash 최저 입력1개에 대해 각 runner에서 R/R1쌍과 A/A1쌍을 실행한다. C가 없으면 정상 입력 중 baseline 시간 median에 가장 가까운 입력을 고르고 ID로 동률을 푼다. 실제 호출 예산에 포함한다. 같은 variant 쌍의 max/min>1.10이면 해당 runner의 환경 경보로 표시한다. 경보 때문에 그 runner를 삭제하거나 교체하지 않는다.

### 5.5 10회 = R/A 10쌍

입력당 **R10회+A10회=20 native calls**를 수행한다. 이전4회에6회를 보태는 의미가 아니다.

- 독립 runner job5개에 입력당2쌍씩 배치한다.
- 각 runner에서 RA1쌍·AR1쌍, 어느 순서를 먼저 할지도 seed/hash로 미리 고정한다.
- 호출 수명은 screening과 동일하다. fresh Worker 측정이면 모든 호출 fresh, instance warmup은 자동 추가하지 않는다.
- 모든5개 runner에서 같은 S∪C를 측정한다. 큰 일정은 사전에 block/shard 배치를 고정하되, 비교가 다른 host에서 이루어지지 않도록 한다.
- 최대 native 호출 수 = `20 * |S∪C| + 20 * 환경대조를 두는 분할 수`(분할별5runner×RR/AA각2calls). 추가 fixture/warmup은 별도 장부에 더한다.
- 예산이 부족하면 대상이나 반복을 결과에 따라 줄이지 않고 실행 전 일정 재설계·승인, 실행 중에는 NOT_RUN_BUDGET으로 종료한다.
- 반복10쌍 종료 뒤 결과가 모호하다는 이유로11번째를 자동 실행하지 않는다.

## 6. 재테스트 결과 해석

입력별 모든10개 q, 절대 시간차, host별2쌍의 median, 전체 median, variant별 max/min, CPU·메모리·상태를 함께 보고한다. 불완전10쌍에서 성공한 표본만으로 확정 판정을 내리지 않는다.

v1.0의 기술적 분류(유의성 검정이나 제품 gate와 별개):

- `DIRECTION_REPLICATED`: 완전10쌍, 환경경보 없음, 5개 host median 중4개 이상에서 screening과 같은 방향. 변화 크기의 gate 충족 여부는 별도다. 약1%처럼 작은 값은 그대로 수치로 보고하며 “통계적으로 확정”이라고 하지 않는다.
- `REGRESSION_THRESHOLD_REPLICATED`: 위 조건에 더해 candidate slowdown의 사전 입력 기준을 host4개 이상과 전체에서도 초과. A0 기준은>1.10. 절대 ms도 함께 제시한다.
- `ENVIRONMENT_SENSITIVE`: 동일 variant 대조 경보, host마다 방향/크기가 달라지는 패턴이 관측됨. host 모델의 인과 효과로 단정하지 않는다.
- `NOT_REPLICATED_OR_UNCERTAIN`: screening 방향이 유지되지 않거나 변동에 비해 차이가 작아 위 분류를 충족하지 않음. PASS의 동의어가 아니다.
- `INCOMPLETE/PROOF_PENDING/MISMATCH`: 필요한 결과/증명이 부족하거나 불일치. 성능 확정 불가.

host간 차이가 있는지와 회귀 크기는 서로 독립 필드로 보고한다. 5host×2쌍은 독립표본10host가 아니다. 표준오차 계산에서 반복/관련 mirror 입력을 독립 모집단으로 세지 않는다. CI를 사용하면 resampling 단위를 manifest에 고정하고 host와 mirror group의 교차 군집을 반영하거나 각 축의 민감도 한계를 명시한다. 이 소규모 자료의 CI만으로 확정적 population 보장을 하지 않는다.

## 7. gate와 선택적 재측정의 관계

**금지:** 원 모집단에서 나쁜 행만 재측정값으로 교체하여 p95/sum/CI를 다시 계산하고 PASS 선언.

유지할 장부:

1. 원 screening/공식 확인 결과와 당시 gate.
2. 고정된 선택 대상의 새로운10쌍 재확인 결과.
3. 원 결과가 좋은/나쁜 양쪽에서 재현됐는지와 대조 결과.
4. 정확성/proof 및 제품 적용 결정.

선택표본 자체의 p95를 전체 모집단 p95라고 부르지 않는다. 전체 성능 확인이 필요하면 **새로 승인한 고정 대상 전체의 확인 일정**을 사용한다. 모든 입력을 반드시 재실행하라는 자동 명령은 아니며, 제한된 재확인만으로 전체 gate를 대체하지 못한다는 뜻이다.

A0에 현재 유효한 기존 formal 기준은 sum ratio≤1.05, matrix ratio p95≤1.10, mirror-group clustered95%CI upper≤1.05, memory p95 ratio≤1.10 또는 p95 증가≤32MiB다. 모집단·통계량의 당시 정의까지 원 manifest를 따른다. 새 지침은 이 수치를 완화하지 않는다. 과거 benchmark의 별도 bridge/쉬운군 gate도 그 실험에 계속 유효하다.

새 공식 확인의 quantile 기본은 nearest rank `sorted[ceil(p*n)-1]`; median 짝수 표본은 가운데2개의 평균이다. 입력별 쌍비율 지표와 `sum(matrix median A)/sum(matrix median R)`는 다른 지표다. bootstrap 재현 seed/PRNG/입력 정렬/군집 단위를 저장한다. 과거 자료의 original quantile을 새 방식으로 조용히 바꾸지 않는다.

과거 reserved는 결과가 노출된 regression set이다. 이후 이름이 reserved여도 fresh holdout이라 부르지 않는다. 추가64개도 전체 노출 감사 없이 untouched holdout이라고 하지 않는다.

## 8. 자원·deadline·재시도

- 표준 public Actions만 사용. maxparallel16 이하, child3GiB/swap0, paid서비스·subagent·유리한host선별 없음(별도 명시 승인 없이는 변경하지 않음).
- 캠페인 기본 상한은wall3h/64runner-hours이나, 이는 매번 자동 부여되는 예산이 아니다. campaign의 새 승인 범위·origin·compute/cancel/overall 시각과 기존 비용 포함 범위를 명시한다.
- workflow를 새로 띄운다고 같은 캠페인의 시계가 초기화되지 않는다. 이미 끝난 캠페인을 새 이름으로 조용히 이어 쓰지 않는다.
- call별 startup/API/process/audit/profile-export/durable-ACK/reap timer는 독립이다. 이전 호출 때문에 다음 호출 budget을 줄이지 않는다. 남은 전체 예산이 call 최악 상한보다 적으면 새 호출을 시작하지 않는다.
- 성능 확인의 timer는 원 비교 계약을 따르며 진단용으로 늘린 제한을 제품 정책에 적용하지 않는다. timer 값은 각 manifest에 모두 쓴다.
- raw 결과 append/fsync/ACK 후 검산 및 다음 호출. profile도 저장 ACK 후 다음 호출. 외부 watchdog/writer는 solver event loop와 독립이어야 한다.
- **자율 교정 허용:** 누락 API 인자, 잘못된 경로, parser/IPC/업로드 등 스스로 해결 가능한 하네스 오류는 수정 → 관련 synthetic/계약 검사 → source 재고정 → 미완료 호출 재시도를 수행할 수 있다. 단순 실수를 위해 별도 실패보고·봉인·사용자 승인을 반복할 필요 없다. 기존에 이미 봉인된 자료는 삭제/덮어쓰지 않는다.
- 같은 캠페인 origin·예산·실제 입력/seed/K/state budget·측정 경계·gate·선별 일정은 유지한다. 교정 과정에서 변하면 비교 계약 변경으로 별도 검토한다. 이미 정상 측정된 호출은 재실행해 대체하지 않으며, 불필요한 중복 탐색도 피한다.
- search timeout·OOM·정확성/quality/stable-ID 불일치·반복 방향이 불리한 성능값은 “단순 실수” 예외가 아니다. 이들 원결과와 부분증거는 보존하고 미완료/실패 판정을 유지한다. 성공할 때까지 반복하거나 검색 제한을 자동 증액하지 않는다.

## 9. 결과물과 재현성

필수: PLAN/MANIFEST, SOURCE_LOCK, INPUTS/SELECTION(포함·제외 사유), SCHEDULE, 원호출/실패 원장, 환경/도구 정보, 독립 AUDIT, ANALYSIS, RESULT_KO, DECISION, source bundle/원격 commit, 파일 seal.

원 artifact의 byte/hash를 지킨다. 예쁜 포맷으로 원 JSON/줄바꿈/공백을 고치지 않는다. parser 교정은 별도 버전의 분석과 이유를 남기고 native를 재실행하지 않는다. 원 실험 디렉터리를 이동/삭제해 봉인/절대경로 참조를 깨지 않는다. 탐색용 인덱스에서 연결한다.

봉인 밖의 공통 지침/인덱스만 갱신하며, 규칙 변경 시 버전·변경 이유·적용 시작 캠페인을 명시한다. 각 실행 manifest에는 당시 문서의 복사본 또는 hash를 남긴다. 과거 문서를 고쳐 새 규칙이 처음부터 있었던 것처럼 만들지 않는다.

## 10. 현재 A0에 대한 적용 순서

1. `board-111--restricted-split--ordinary` 한 입력의 독립 fixed-K exact 증명.
2. 증명 결과를 별도 원장에 추가하고 기존 p95 실패 유지.
3. 기존 enlarged168개(개발64/예약104)의 원 timing으로 위 규칙의 selection 목록·대조·call/runner 예산 산출. 기존 원지표를 사용할 경우 LEGACY_UNPAIRED 명시.
4. native 실행 전 새 캠페인 manifest/예산을 확정. 10쌍 재확인 수행.
5. 정확성·재확인·전체 gate·제품 승인 결과를 구분해 후속 결정. 232/675 전수캠페인이나 Dev 적용을 자동 시작하지 않는다.

Sol 인계의 구체적 입력/참조 위치는 [HANDOFF_SOL_KO.md](experiment-review-20261003/HANDOFF_SOL_KO.md)에 있다.
