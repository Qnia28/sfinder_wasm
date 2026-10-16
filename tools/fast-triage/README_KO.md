# Fast triage E2E 비교 — 실행 전 준비

## 목적과 비교군

예산 triage의 **특징 계산비를 포함한 공개 API 전체 비용**, 최종 품질, 최소 K·coverage, secondary proof와 tail을 비교한다.

| arm | integrated | preview / GRACE |
|---|---|---|
| BASE100 | 100K | 2.5K / 5K |
| I10_FIXED_AUX | 10K | 2.5K / 5K |
| U192 | u≥192이면10K, 나머지100K | 2.5K / 5K |
| U228_OR_D16 | u≥228 또는 d≥16이면10K | 2.5K / 5K |
| U192_OR_D16 | u≥192 또는 d≥16이면10K | 2.5K / 5K |
| S200_OR_D16 (GLM) | S≥200 또는 d≥16이면10K | 2.5K / 5K |

기존 tiny / 단일큐 / hard 우회와 preview 적격 가드는 적용된다. preview exact 뒤에는 특징을 계산하지 않는다. F는 **원 singleton 행의 서로 다른 후보 수**, u=S−F, d=K−F다. F≤K bound와 스캔 조기 종료를 쓰며, 부분 관측값의 F/u/d는 `null`이다.

## 옵션 계약

`minimumCoverAsync`, adaptive, ALL minimals 및 per-save 공개 API:

- `fastPolicy`: 기본 `legacy`. 비교군 외 단순 대조 `U228`, `S200`도 지원하며 `S200`은 기존 `S>200` 규칙이다.
- `fastStateBudget`: 명시하면 정책보다 우선한다. 기존 0/default→100K와 preview/grace 비례 축소 계약을 유지한다. 0을 stage 비활성화로 해석하지 않는다.
- `fastPreviewBudget`, `fastGraceBudget`: 독립된 비음수 정수 override. 이 두 옵션의 0은 해당 보조 단계 생략이다.
- 명시 integrated 예산이 없는 opt-in 정책은 preview2.5K·GRACE5K를 유지한다.
- `fastDiagnostics`: 기본 false, `timing`은 단계 시간·정책/부분 특징/실제 예산, `trace`는 각 단계의 입력 seed와 출력 witness/품질 벡터까지 보존한다.
- `fastTelemetry.appliedBudgets`의 0은 **실행되지 않은 단계**다. 기존 `fastProbeBudget`만으로 실제 integrated 실행을 판정하지 않는다.
- compact tiny와 단일큐 직행 결과는 `fastBypass`로 식별한다. 이 경로의 부재한 내부 시간은 0ms로 추정하지 않는다.

제품 기본 정책은 legacy다. `secondary:'auto'` 경로로 비교하며 exact/명시2x2 의미와 refine 알고리즘은 기존 계약을 따른다.

## 고정 모집단과 순서

`SCOPE_20261017.json`은 다음 합집합이다.

1. 기존 273 E2E 명령
2. 원 DB의 nonhard u168..228 또는 d14..17에 해당하는 142필터/116명령
3. row-076/bag, row-140/restricted-split/per-save, pcinfo-030 hard timeout, pcinfo-039 per-save tail

합계 **359명령 ×6arm ×3회 =6,462 main 호출**. 12명령에서 OFF/timing/trace ×6arm ×2회 =432진단 호출. 별도359 capture와24 preflight 호출을 합하면 최대7,277개 isolated 호출이다. ALL/per-save/edge/regression의 분모를 각각 유지한다. per-save 명령의 모든 출력 필터를 검증한다.

과거 분석으로 선택한 **개발/회귀 모집단**이다. 새 mirrorGroup holdout이나 독립 일반화 검증이 아니다. 새 그룹 전이 검증은 후속 범위다.

같은 명령의 전 arm·반복을 같은 VM에 배정하고 매 호출은 fresh child process다. arm 시작 순서는 명령 hash와 반복에 따라 회전한다. main은 timing 계측을 포함하며, OFF/timing/trace 비교를 별도로 제공한다. 2회 overhead screen은 기술통계이며 overhead를 빼서 성능을 보정하거나 screen 초과를 이유로 재시험하지 않는다.

## 워크플로

`.github/workflows/fast-triage-comparison.yml`

- 저장소: `Qnia28/sfinder_wasm`
- 전용 브랜치: `experiment/fast-triage-20261017`
- 최초 브랜치 push에서 위 workflow 파일이 추가되면 실행된다. 이후 workflow_dispatch도 지원한다.
- main ref에서는 bootstrap이 실행되지 않는다. 권한은 contents/actions read이며 release 생성 단계는 없다.
- bootstrap: 로컬과 같은 기능/계획 테스트 후 **원격 실제 capture/API preflight24호출**. 예산·원행 witness·계측 계약이 통과해야 다음 단계로 간다. 후보의 품질 회귀 자체는 preflight 실패 조건이 아니다.
- capture32shard → frozen plan → measure96chunk → audit. 최대동시16VM.
- 호출별3GiB cgroup, capture300초/측정180초 call timeout, startup30초, teardown5초. 계획 예약은 capture340초/측정220초다.
- 전체 예약 약484.87 runner-hours(상한1200), 기원시각부터96시간 제한. **예약은 예상 실행시간이 아니다.**
- 잘못된 K/coverage/witness, 옵션 전달 오류, 소스 변경, 수거되지 않은 프로세스는 중단한다. timeout/OOM은 결과로 보존하고 누락·미실행도 분모에 남긴다.
- 실패 원인은 Actions Summary에 표시한다. 완료 상태는 정책 채택/성능 승리 선언이 아니다.
- 과거 artifact나 과거 실행 기한에 의존하지 않고 새 capture·새 clock으로 시작한다. run-attempt2 재실행은 금지하고, 불완전 결과는 원본을 보존한 뒤 별도 continuation을 설계한다.

## 시간과 증거

- `policyMs`: WASM 초기화 시작부터 공개 API·인코딩 종료까지. 검증과 전송은 제외한다.
- `apiMs`: WASM 초기화 후, API 모듈 import부터 API·인코딩 종료까지.
- 필터별 `prepare/primary/features/preview/integrated/grace/refine` 시간. primary에는 kernelization과 최소 K 풀이가 포함된다. WASM 단계 내부 packing/search는 분리하지 않은 합계다.
- trace는 primary seed, 버려진 preview 출력, integrated→GRACE→refine seed와 최종 품질을 보존한다. 원행 검증은 timed boundary 뒤 수행한다.
- 원 입력 gzip, K proof, 원본 hash, raw execution, 상태·메모리·분기/예산, 업로드 receipt와 SNAPSHOT을 보존한다.

## 로컬 준비 검증 — population benchmark 없음

```powershell
node --test tests/fast-budget-policy.test.mjs tests/fast-triage-plan.test.mjs tests/fast-triage-api.test.mjs tests/fast-triage-analysis.test.mjs tests/fast-bench-adapter.test.mjs tests/fast-bench-transport.test.mjs tests/fast-bench-planner.test.mjs tests/filter-cover-worker.test.mjs tests/secondary-three-engine.test.mjs
node tools/fast-triage/check-historical.mjs D:/AI/sfinder-wasm/fast2nd/20261015/final-database/benchmark.sqlite
node tools/fast-triage/prepare.mjs D:/AI/sfinder-wasm/fast2nd/20261016/fast-triage-preparation
```

첫 명령은 작은 합성 fixture의 기능/회귀 테스트다. 두 번째는931원입력의 singleton 구조만 읽어4정책/3,724판정을 검산하며 solver를 호출하지 않는다. 세 번째는 원격 capture 전의 dry plan만 저장한다.

실행 승인 후 브랜치를 push하면 preflight부터 시작된다:

```powershell
git push -u origin experiment/fast-triage-20261017
```

## 수집 후 재분석

```powershell
node tools/fast-bench/download-results.mjs RUN_ID NEW_DOWNLOAD_DIR --full
node tools/fast-triage/analyze.mjs NEW_DOWNLOAD_DIR NEW_ANALYSIS_DIR
```

`SUMMARY.json`의 collectionStatus/누락/상태를 먼저 확인한다. 분석은 ALL/per-save를 분리하고, 입력별3회 중앙값의 합계·p95/p99·최대 지연·느려진 입력, 모든 호출의 상태·메모리, 필터별 단계/특징비를 출력한다. timing 완주쌍만의 통계에는 검열 편향이 있으므로 전체 상태표와 함께 읽는다.

`quality-pairs.jsonl`은 사전식 품질 관계·정렬 첫 차이·실제 원행 하락/상승 수와 크기·secondary proof 상실을 별도 기록한다. 품질 call 수는 unique 입력 수가 아니다. trace seed 후속 분석은 raw delta의 `fastTelemetry.stages`를 사용한다. 품질 허용 임계값이나 자동 승자 선정은 설정하지 않았다.
