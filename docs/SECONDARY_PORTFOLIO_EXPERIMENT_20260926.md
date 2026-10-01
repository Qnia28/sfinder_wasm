# Exact secondary 3엔진 전환 실험 — 2026-09-26

## 측정 완료 및 후속 결정

LUNA가 계약 10개/oracle 25개 통과 후 300회를 완료했다. Astra가 원자료·로그·원본 행렬에서 K/커버/품질, 완료 CP의 각 정수 objective/bound를 다시 검사했다. 138개 동결 파일 유지, 261개 완료 결과 불일치 0, ERROR 0이다. 감사 자료는 측정 폴더의 `audit-results.mjs`, `ASTRA_AUDIT.json`이다.

| 정책 | 60초 이내 exact / 75 | 미완료 | timeout |
|---|---:|---:|---:|
| baseline100k | 55 | 0 | 20 |
| i200k-cp | 70 | 5 | 0 |
| i200k-t20k-cp | 70 | 5 | 0 |
| i200k-t300k-cp | 66 | 9 | 0 |

CP는 기존 미완료 입력의 증명을 개선했지만 후보를 그대로 기본 적용하지 않는다. ordinary ALT JAWS T의 중앙값은 baseline 27.35초, CP 직행 57.77초, threshold20k→CP 59.31초다. threshold300k는 27.93초로 이 회귀를 피하지만 다른 어려운 입력의 시간을 소모해 완료율이 낮아졌다. full split I는 539→665ms, pcinfo-018 L은 168→246ms로 threshold20k 후보도 느려졌다. 이는 integrated 100k 추가 탐색 등 실제 정책 비용을 포함한다. 일부 빠른 입력에서는 검산/준비 비용도 개선 과제로 남는다.

다음 실험은 **integrated를 100k로 되돌리고**, threshold20k에서 완료한 품질 증명을 CP에 전달하는 기능만 off/on 비교한다. 100k를 최종 최선값으로 확정하는 것은 아니다. 앞선 sibling partition의 이득도 아직 기본값에 합치지 않는다. 정책 변경과 알고리즘 변경을 한꺼번에 섞지 않고 효과를 분리한다. 상세: [증명 구간 재사용 실험](SECONDARY_PROOF_REUSE_20260926.md).

아래는 이번 측정 전 고정한 계약과 구현 설명이다.

## 구현 범위

`src/min-cover-secondary-portfolio.mjs`에 명시적으로 호출하는 비동기 실험 경로를 추가했다. 기존 `solveExactSecondary`와 제품 호출 경로·WASM·primary·per-save worker 정책은 변경하지 않았다. CP 모델은 검증 폴더의 기존 모델을 그대로 쓰며 제품 기본 CP backend 연결은 아직 아니다.

입력은 증명된 최소 K, 원본 coverage/quality, feasible seed다. trivial 증명 → bounded integrated → 선택적 bounded threshold → CP-SAT 순서이며 각 Rust 단계는 한 번만 실행한다. 이전 단계의 최선 feasible seed를 전달하되 DFS나 threshold 증명 prefix를 재개한다고 주장하지 않는다. 원본 중복 행 가중치를 유지하고 반환 K/커버/품질을 검사한다. 미완료 결과가 더 나쁘면 기존 seed를 보존한다. CP의 품질 증명만으로 exact를 반환하지 않고 stable-ID tie 증명까지 요구한다. 시간 예산 종료는 `completed:false`, `qualityExact:false`다.

Rust는 동기 함수라 내부 JS 시계로 중단할 수 없다. 상태 예산은 전처리 시간을 제한하지 않는다. 프로세스/worker 외부 종료가 hard limit을 담당해야 한다. 이 실험은 요청 전체 취소 및 브라우저 worker 통합을 완료했다는 뜻이 아니다.

## 비교 조건

실행 루트: `D:/AI/sfinder-wasm/tools/validation/secondary-portfolio-20260926`.

앞선 직접 엔진 비교의 15입력 × 4조건 × 5회 = 300회다. 기존 Rust WASM을 사용하며 sibling partition·분해를 섞지 않는다. 모든 입력은 기존 primaryHard=false 사례이며 새 미관측 검증 집합은 아니다.

| 조건 | integrated | threshold | 이후 |
|---|---:|---:|---|
| baseline100k | 100,000상태 | 기존 무제한 | 기존 정책 |
| i200k-cp | 200,000상태 | 생략 | CP 1-worker |
| i200k-t20k-cp | 200,000상태 | 20,000상태 | CP 1-worker |
| i200k-t300k-cp | 200,000상태 | 300,000상태 | CP 1-worker |

200,000은 ELEPHANT J/O의 기존 integrated 완료 157,931/144,914상태를 포함하되 다른 회귀군의 불필요한 추가 탐색 비용을 확인하기 위한 후보값이다. 20,000 threshold는 기존 빠른 비교군의 최대 16,901상태를 포함하며, 300,000은 ordinary ALT JAWS T의 255,741상태를 포함하는 대조값이다. seed가 바뀌면 실제 상태 수도 달라질 수 있다. 이 값들은 개발 입력에서 나온 실험 후보이며 최종 임계값이 아니다. ID별 라우팅 규칙은 없다.

모든 조건의 전체 secondary 목표는 60초, engine-start 이후 외부 종료는 65초다. CP에는 앞선 준비/탐색 비용을 뺀 잔여 시간을 전달한다. CP 모델·runtime은 해당 단계에 도달한 경우에만 생성/초기화하고 engine 시간에 포함한다. Rust runtime 초기화는 공통으로 별도 initMs에 기록한다. 이전의 CP 사전 초기화 단독 엔진 시간과 이번 시간을 그대로 비교하지 않는다. 이번 조건들끼리 비교한다.

새 프로세스 직렬 실행, 조건 순서 정방향/역방향 교대, Node/V8·CPU·해시·단계 로그·호스트 부하 기록을 유지한다. EXACT_LATE/INCOMPLETE/TIMEOUT을 구분하고 20초 이내 완료 수도 따로 센다. 공통 완료 집합의 입력별 중앙값/범위, 전체 완료율, CP 도달률, 준비 및 엔진 단계별 비용을 사용한다. 제한에 걸린 표본을 제외한 평균만으로 빠르다고 판단하지 않는다.

## 검증과 적용 기준

새 전환 계약 테스트 10개와 기존 25개 완전탐색/65후보 tie oracle을 새 portfolio+CP adapter를 거쳐 실행한다. 모두 통과해야 300회 측정을 시작한다. 미완료 seed 전달, 더 나쁜 incumbent 거부, 품질만 증명한 CP의 미완료 처리, invalid result, 중복 행, 예산 검사를 포함한다. 25개 oracle은 작은 행렬의 독립 정답이며 실제 15입력 reference는 기존 감사된 완료 witness다. reference 없는 입력이 새로 완료되면 반복/엔진 간 일치를 별도 확인한다.

문법 검사와 snapshot 준비를 완료하고 138개 파일을 해시로 동결했다. 기존 15입력·CP 모델과의 해시 일치, 제품 WASM 불변도 확인했다. 새 테스트/벤치는 아직 실행하지 않았다. 사용자 수동 전달 후 LUNA가 한 번 실행한다. 실패하면 원자료를 보존하고 중지한다. runner·snapshot·입력은 위임 후 수정하지 않는다.

다음 결정 순서는 (1) 전환 경로 정확성 및 회귀 검토, (2) 추가 탐색 비용 대비 완료율로 후보 축소, (3) 다른 보드 그룹에서 일반화 검증, (4) CP browser/runtime 수명·취소·오류 처리와 공통 minimals 연결, (5) per-save의 필터별 primary→secondary worker 분배다. primary 자체의 코어/worker 수는 이번 실험으로 변경하지 않는다.
