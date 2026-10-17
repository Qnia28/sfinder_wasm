# Fast refine 동치 최적화 — 개발 병목 screen

출처 표기: GLM. 제품 후보는 S200_OR_D16 / U192_OR_D16 공동 유지.

## 질문과 변경

**같은 Fast 정책에서 refine 내부 계산·할당을 줄이면 실제 공개 API 시간과 tail이 개선되는가?**

제품의 예산·후보 순서·동점 규칙·최대16pass는 그대로 두고 다음을 바꾼다.

- 미충족 행의 coverage를 32비트 word로 묶어 교체쌍 가능 여부 검사.
- 원행 인접 목록으로 후보 집합과 coverage mask 구성. quality0도 membership으로 처리.
- pass/제거쌍/교체쌍 scratch typed array 재사용. 승리 histogram만 snapshot.
- 동점 시 정렬된 선택집합 merge 비교. 승리할 때만 배열 생성·정렬.

S200과 U192_OR_D16의 정책 선택 자체를 확정하는 실험은 아니다. refine 예산 축소·1K 정책은 이번 변경에 섞지 않는다.

## 모집단과 비교

`SCOPE_20261017.json`의 명시13명령 + 기존 source order의 첫 edge ALL / edge per-save / regression =16명령.

- pcinfo030 hard ALL/per-save timeout, pcinfo031·039 ALL/per-save tail.
- pcinfo032·035 bag-plus-next-draw per-save의 느려진 사례.
- row076 실제 품질 회귀, row140·019·312 및 c2-029 proof-only 사례.
- tiny/direct/회귀 경로.

이는 **선택된 개발 병목 screen**이며 전체359명령의 재측정이나 새 mirrorGroup holdout이 아니다. screen의 절감률을 모집단 전체로 일반화하지 않는다. 전체/holdout 단계 전에 동치 변경의 유용성을 저렴하게 확인하는 목적이다.

세 정책 `BASE100`, `S200_OR_D16`, `U192_OR_D16` × refine 이전/신규 구현 ×5반복 = **480 E2E 호출**. 각 명령의 모든 arm·반복은 같은 VM, 호출마다 fresh process. 시작 순서는 hash+반복으로 회전한다.

reference는 과거 전체 commit이 아니다. **현재 checkout을 복제하고 refine 모듈 하나만** `67d90ac6e6e79703cb140fd967e1c3e1f6fef29d`의 파일로 교체한다. 그 외 소스·collector·WASM은 hash로 동일성을 확인한다. 따라서 이후 코드 변경이 이전/신규 비교에 섞이지 않는다.

## 필요한 검증과 비용

1. **새 capture16호출**: 같은 실제 공개 입력의 원행·최소 K proof를 확보해 잘못된 witness끼리 속도를 비교하는 것을 막는다. call300초, 예약350초/호출. 과거 artifact 만료에 의존하지 않는다.
2. **고정 capture-seed refine replay 최대224호출**: capture된 filter마다 이전/신규 각1호출. 이번 변경은 동치 refactor이므로 같은 seed에서 선택 ID·품질·pass 수가 동일해야 한다. primary 변동을 refactor 오류로 오인하는 것을 막는다. call90초, 예약140초/호출. timeout/OOM은 검열이며 동치를 확인했다고 세지 않는다. 이것은 Fast 일반의 seed 고정 요구가 아니다.
3. **E2E480호출**: 미세 단계 개선이 실제 API 비용에서도 유효한지 확인한다. call180초, 예약230초/호출. timing 계측 포함 `policyMs`/`apiMs`, 단계시간, witness, peak 메모리 수집. overhead를 빼지 않는다.

최대720 isolated 호출, **43.933 runner-hours 예약(예상 실행시간 아님)**, 상한48시간. 8shard·최대8VM, job340분, 전체24시간 기한. 호출별3GiB·swap0, startup30초·reap5초, 기존 공통 cgroup executor 재사용.

## 판정 v1: performance-first-seed-variation

- 필수: capture 기준 최소 K·원행 coverage·품질 벡터 정확성, 소스 고정, 프로세스 회수, 증거 완전성.
- 같은 seed의 이전/신규 refine 결과 차이는 **이번 동치 변경의 오류**이므로 중단한다.
- 실제 E2E의 엔진/primary seed·최종 품질·secondary exact 차이는 관측값이다. hash 동일성을 정상 조건으로 요구하지 않는다.
- timeout/OOM은 정상 검열. capture 검열로 실행 불가능한 E2E는 `NOT_RUN_CAPTURE_CENSORED`, 그 외 누락은 `MISSING`/`NOT_RUN`으로 분모에 남긴다.
- 품질 저하는 시간 절감과 함께 평가하고 proof-only 상실과 구분한다. 허용 임계값·성능 승자는 자동 지정하지 않는다.
- 기존 run38947448091의 INVALID 보고서를 변경하거나 재실행하지 않는다. 새 run/clock/source/adjudication manifest다.

## 실행과 회수

로컬에서는 작은 합성 입력 기능 테스트와 solver 없는 dry plan만 수행한다.

```powershell
node --test tests/min-cover-quality-refine.test.mjs tests/fast-refine-plan.test.mjs tests/fast-refine-analysis.test.mjs tests/fast-budget-policy.test.mjs tests/fast-triage-api.test.mjs tests/fast-bench-adapter.test.mjs
node tools/fast-refine/run.mjs prepare NEW_DRY_PLAN_DIR
```

`.github/workflows/fast-refine-comparison.yml`이 전용 브랜치 `experiment/fast-refine-20261017`에서 실행된다. 최초 workflow push 또는 workflow_dispatch. main/release 작업은 없다. run-attempt2는 거부한다.

```powershell
gh run download RUN_ID --repo Qnia28/sfinder_wasm --dir NEW_DOWNLOAD_DIR
node tools/fast-refine/analyze.mjs NEW_DOWNLOAD_DIR/fast-refine-plan NEW_DOWNLOAD_DIR NEW_ANALYSIS_DIR
```

artifact는 `fast-refine-plan`, `fast-refine-shard-0..7`, `fast-refine-analysis`다. sealed snapshot에 원자료·시작기록·terminal 실행·capture 원행·lock·환경·요약이 포함된다. 실패 시 보존된 증거와 원래 clock을 먼저 확인하고 자동 반복 수집하지 않는다.

분석 결과는 ALL/per-save/edge/regression을 분리한 입력별5회 중앙값과 tail, 전체 상태·누락, 호출별 비교, 품질 변화, 동일-seed 동치 결과를 제공한다. 완료쌍 시간에는 검열 편향이 있으므로 상태 분모와 함께 해석한다. E2E 품질 변화의 원행 크기·중간 seed 추가 분석에는 보존된 원행과 raw witness를 사용한다.
