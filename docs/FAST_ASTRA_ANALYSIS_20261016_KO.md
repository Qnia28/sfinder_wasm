# Fast 예산 v2 — Astra 분석 v1

> 저장 구조 변경: 사용자 요청에 따라 최종 자료는 `D:/AI/sfinder-wasm/fast2nd/20261015/final-database/benchmark.sqlite`, 분석·도구는 인접 `astra-analysis/`로 분리했다. DB는 최종30,480호출과 원자료, 입력2,321개를 자체 포함하며 무결성 검증을 통과했다. 이전 실행 폴더와 불완전 패키지는 삭제했다. 아래 기존 패키지·이력 보존 설명은 분석 당시 기록이며 현재 경로는 이 안내를 따른다. 최종 TIMEOUT39건은 유지한다.

분석자: GPT-6 Astra (현재 세션). 원격 추가 실행·로컬 solver 실행 0회. 개발 모집단에 대한 기술적 분석이며 fresh holdout 검증이나 제품 채택 승인이 아니다.

## 결론

1. **BASE100을 유지한다.** 낮은 고정 예산은 전체 완료쌍 비용을 줄일 수 있지만 품질 회귀와 일부 큰 지연을 만든다. 최소 K/coverage 유지와 품질 동등은 서로 다른 조건이다.
2. **다음 정책 설계의 우선 후보는 integrated 예산과 보조 예산을 분리하는 방향**이다. `I10_FIXED_AUX`는 B10보다 회귀가 적고 시간 절감 가능성이 크다. 그러나 ALL 한 입력에서 품질·시간이 모두 나빠져 일괄 적용은 보류한다.
3. **DIRECT 일반 대체 및 GRACE 일괄 제거는 지지하지 않는다.** 탐색을 생략해도 refine 비용이 커지고 품질이 나빠질 수 있다.
4. 현재 특징만으로 안전한 조건부 정책이 검증됐다고 말할 수 없다. previewEligible=false에 절감 기회와 회귀가 함께 있다. 관측 회귀 ID만 예외 처리하는 정책은 모집단 과적합이다.

## 자료·유효성

- 패키지: `D:/AI/sfinder-wasm/fast2nd/20261015/agent-analysis-v4/`.
- 최종 호출30,480개 모두 고유 schedule ID와 일치하며 원 raw 위치를 찾았다. SQLite integrity_check 통과. 원자료1,680 artifact 보존.
- 선택 결과: EXACT16,248 / APPROX14,133 / EMPTY60 / TIMEOUT39. 새 감사 오류0. 부모 INVALID 감사와 취소·UNKNOWN 이력은 보존한다.
- ALL548명령 중2개는 EMPTY이므로 matrix는546개다. 빠진 것은 측정 누락이 아니다. 해당 명령은 `c7-2plus2-qb-row-005/all/bag`, `c7-2plus2-qb-row-251/all/bag`이며 capture summary10/24에서 EMPTY 확인.
- 주 matrix931개=ALL546+per-save384+regression1. 추가96개는 별도 대조군3개를 위한 부분집합이다. e2e273명령, trace32입력.
- 비교는 동일 입력·repeat·trace 조건에서 BASE100과 pairing. 실제 정렬 품질 벡터를 사전식 비교한다. e2e 다중 필터에서 개선/회귀가 섞이면 MIXED_FILTERS로 기록한다.
- 시간은 입력별 반복 중앙값을 먼저 구한 후 입력 간 중앙값을 보고한다. 아래 시간비는 개별 입력 중앙 시간비의 중앙값이며 총시간 비율이 아니다. TIMEOUT 포함쌍은 시간·품질 비교에서 censored로 표시하고 분모에는 남긴다.

## 주 판단: ALL matrix

각 군546입력×3회=1,638쌍. 기준이 timeout인3쌍은 censored. 품질 회귀 입력 수는 반복을 중복 집계하지 않았다.

|군|시간비 중앙값 (후보/BASE100)|시간차 중앙값 ms|품질 회귀 입력|판정|
|---|---:|---:|---:|---|
|B1|0.989|-0.092|11|큰 축소의 이득이 일반적이지 않고 회귀 다수|
|B10|0.967|-0.377|7|보조 예산까지 줄이는 방식 보류|
|B40|0.954|-0.583|2|소폭 중앙 개선, 무회귀 아님|
|I10_FIXED_AUX|0.955|-0.596|1|우선 연구 후보, 일괄 채택 보류|
|DIRECT|2.814|+23.829|13|일반 대체 부적합|
|NO_PREVIEW|0.987|-0.331|0|작은 중앙 차이만으로 제거 근거 부족|
|NO_GRACE|0.999|-0.042|10|GRACE 제거 지지 안 함|
|I_ONLY|0.974|-0.444|10|preview/GRACE 동시 제거 지지 안 함|

완료쌍 시간차 합계는 B10 약−276.5초, I10_FIXED_AUX −262.5초, B40 −180.5초다(각 입력3반복 합). DIRECT도 합계는−188.4초지만 대부분 입력에서는 느리다. 일부 큰 비용 입력이 총합을 지배하므로 평균/총합만으로 DIRECT를 선택하면 잘못된 판단이다. 합계는 검열된 입력 비용을 포함한 전체 기대비용이 아니다.

## 실제 회귀 원인 사례

`c7-2plus2-qb-row-076/all/bag/ALL`은 I10_FIXED_AUX의 유일한 주 matrix 품질 회귀 입력이다. 세 반복 모두 회귀했다. primaryHard=false, previewEligible=false, S118/N5018/E52224/F11/d12/u107.

repeat0 원자료:
- BASE100: integrated61,966states에서 exact, policy96.50ms.
- I10_FIXED_AUX: integrated10K 미완료→GRACE5K 미완료→refine, policy243.82ms, 품질 회귀.
- B40: integrated40K→GRACE4K→refine, policy286.22ms, 품질 회귀.
- DIRECT: refine210.60ms, 품질 회귀.

즉 '예산 감소=항상 빠름'이 아니다. exact 조기 종료 기회를 잃고 후속 refine가 더 비싸진다. 상세 stage 기록은 `ASTRA_CASE_076.json`; 모든 중간 seed/witness는 SQLite raw locator로 조회할 수 있다. 이 사례 한 개로 일반화된 임계값을 확정하지 않는다.

## 보조 근거: per-save·특징 층화

- per-save384입력: I10_FIXED_AUX 시간비 중앙0.865, 시간차 중앙−49.56ms, 품질 회귀0. B40은0.901/−3.56ms, 회귀0. per-save Worker 배분 효과를 측정한 것은 아니다.
- 전체 주 matrix에서 previewEligible=false355입력: I10_FIXED_AUX 시간비 중앙0.772, 회귀1개. previewEligible=true576입력은0.994, 회귀0개. 가장 큰 절감 층에서 회귀도 발생한다.
- primaryHard=true17입력은 adapter상 probe를 건너뛰어 정책 경로가 같으므로 작은 시간 차이를 예산 효과로 해석하지 않는다. 공통 timeout 입력도 이 층에 있다.
- NO_PREVIEW는 완료 품질이 모두 같았지만 전체 주 matrix 시간비 중앙0.998, per-save에서는1.012이다. preview 제거의 실질적 이득을 확인하지 못했다.
- 추가96입력의 I1_FIXED_AUX는 품질 회귀0, 시간비 중앙0.871이다. ALL은 그중48개뿐이고 주 회귀 입력 포함 여부가 다르므로 전체931개 결과보다 안전하다고 비교할 수 없다.
- I10_NO_GRACE/P_ONLY_2x2는 각각 추가96개 중2개에서 회귀했다. 주군과 다른 분모를 섞어 순위를 만들지 않는다.

## e2e 공개 API

273명령×3반복, trace OFF. matrix와 달리 공개 파이프라인 비용을 포함한다.

|군|시간비 중앙값|시간차 중앙 ms|품질 회귀 명령|TIMEOUT 호출|
|---|---:|---:|---:|---:|
|BASE100|1|0|기준|3|
|B1|1.003|+0.417|1|3|
|B10|0.999|−0.338|0|2|
|B40|0.990|−2.005|0|2|
|DIRECT|1.170|+36.158|6|3|

완료쌍 기준 B10/B40의 e2e 품질 회귀가 없다는 사실은 matrix 회귀를 무효화하지 않는다. 모집단·primary seed·비용 경계가 다르며 제품 API 내부 seed는 UNOBSERVED다. I10_FIXED_AUX는 e2e 측정군에 없으므로 제품 파이프라인 개선을 주장할 수 없다. B40의 e2e 중앙 개선은 약1%로 제한적이다.

## 완료 범위·불확실성

- TIMEOUT39개는 matrix26/e2e13. matrix는 모두 `cycle1-pcinfo-030/all/restricted-split/ALL`, e2e는 모두 `command-967-part-0`에 집중된다. 군별 횟수는 `ASTRA_TIMEOUTS.json`에 보존했다. I10_FIXED_AUX 및 e2e B10/B40의 한 호출 추가 반환만으로 timeout 개선을 확정하지 않는다.
- trace screen192쌍 중24쌍이 사전 기준 max(5ms, OFF의5%)를 넘었다. 이는 두 반복 descriptive screen이며 확정된 overhead가 아니다. trace 상태·품질·keys·states·decision 불일치는 감사에서 없었다. 시간 보정/임계값 변경/선택적 재측정은 하지 않았다.
- APPROX가 같은 품질을 반환하는 것과 exact proof를 보유하는 것은 다르다. 예를 들어 주 matrix EXACT 호출은 BASE1001,821, B401,761, I10_FIXED_AUX1,761이다. 상태 원자료를 품질 동등으로 덮어쓰지 않는다.
- 반복3개, alias/mirror, 동일 명령의 save별 상관, 이미 노출된 개발 모집단 때문에 유의성/일반화 보장은 없다. bootstrap confidence interval이나 독립 표본 수를 임의로 만들지 않았다.

## 채택 보류와 후속 분석 우선순위

현재 제품 변경 없음. 후보를 검증된 최적 정책으로 선언하지 않는다.

1. 보조 예산을 유지하면서 integrated 비용만 줄이는 조건부 정책을 설계할 가치가 있다. 다만 cheap observable에서 exact 완료 가능성과 refine 비용을 구분하는 근거가 필요하다.
2. 먼저 기존 raw의 단계별 비용·seed 변화·GRACE 성과를 활용해 위 회귀와 큰 절감 사례를 함께 설명한다. 회귀 ID 특례를 규칙으로 채택하지 않는다.
3. 설계가 고정된 후에만 별도 승인된 fresh holdout 및 해당 정책 e2e 검증으로 넘어간다. 이번 분석에서는 추가 측정을 실행하지 않았다.

## 에이전트용 산출물

- README.md: 데이터 사전·SQL 예시·제약.
- analysis.sqlite: calls/fixtures/quality/attempts/raw_locations.
- paired-quality-time.csv53,480행: 실제 품질 우열·상태 전이·시간차.
- SUMMARY.json 및 ASTRA_STRATA.json: phase/모집단/특징별 집계.
- ASTRA_REGRESSIONS.csv: 회귀 호출 및 기준 callId.
- ASTRA_TIMEOUTS.json, ASTRA_CASE_076.json: 검열 상태와 원인 사례.
- 원 AUDIT/PLAN/CONTINUATION/ATTEMPTS와 scalar-analysis/trace-pairs.csv.

`agent-analysis-v1`~`v3`은 생성기 수정/실행시간 제한으로 중단된 패키지다. 완성본은 **v4만** 사용한다.
