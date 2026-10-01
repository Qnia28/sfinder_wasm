# Minimals 필터 작업 실행 구조 — 합의된 설계 (2026-09-21)

## 작업 순서 및 측정 카탈로그

후속 검토를 반영한 현재 순서는 [통합 최적화 계획](OPTIMIZATION_ROADMAP_20260921.md)을 따른다. 자명한 exact 처리와 선택적 순차 분해, 공통 행렬·예산·증명 상태, integrated 개선을 비교한 뒤 integrated / threshold / CP-SAT의 초기 선택과 전환 기준을 검증한다. minimals/per-save 모두 동일 정책을 사용하며 분해를 자동 강제하지 않는다. 이 정책이 검증된 뒤 per-save의 필터별 primary→secondary worker 분배에 적용한다. worker 도입과 엔진 선택 정책을 동시에 바꾸지 않아 각각의 효과를 확인한다.

사용자 지정 카탈로그:

- `D:/AI/tetrispc/setups/cycle-1-setups.json`: 45개.
- `D:/AI/tetrispc/setups/cycle-3-extra-t-setups.json`: 55개.
- `D:/AI/tetrispc/setups/QB/cycle-7-2plus2-qb-setups.json`: 356개.

총 456개 항목의 Fumen과 placements 점유 보드가 일치함을 확인했다. 색상을 제외한 동일 보드는 338종, 좌우 반전까지 묶으면 297그룹이다. 같은 보드·큐·필터는 중복 집계하지 않고, 동일/반전 보드를 학습용과 검증용에 나누어 넣지 않는다.

**4×4 BOX의 `*!` exact는 우선 제외한다.** 사용자 보고상 integrated와 threshold 모두 1시간 이내에 완료되지 않았다. 이는 사용자 제공 이력이며 이번 작업에서 재실행한 측정치가 아니다. 이름 대신 점유 셀의 4×4 완전 사각형 여부로 검출한다. cycle1의 `cycle1-pcinfo-015`, `cycle1-pcinfo-020` 외에도 QB 카탈로그에 같은 모양의 항목 11개가 있다. 기존 3×4 BOX 8P 및 모바일 제외 방침도 유지한다.

먼저 `*!`, `[IJL]p3,*p4`와 독립 `*p3,*p4`로 측정 절차를 검증한다. 서로 다른 cycle의 실전 큐 조건을 같다고 간주하지 않는다. 필드별 필요한 미노 수를 기록하고 큐가 짧아 해답이 없는 입력은 solver 우열 자료로 사용하지 않는다. 추가적인 cycle별 실제 큐 패턴은 별도 측정 조건으로 기록한다.

열거·primary·secondary 시간을 분리한다. secondary 비교는 원본 품질 행렬, 증명된 K, 동일 seed를 저장한 뒤 수행한다. 사전 열거가 시간 제한을 넘긴 경우 secondary 실패로 집계하지 않는다. 일반 minimals의 마지막 bag save 필터를 직접 사용하며, 이전 per-save 잔여 한 미노 행렬만으로 정책을 정하지 않는다.

초기 pilot은 엔진당 단일 실행으로 절차와 난도를 확인한다. 이후 난도별 표본 확대, 순서 교대 반복, 1/2-worker CP-SAT 비교, 별도 보드 그룹 검증을 거쳐 임계값을 확정한다. 전환 정책은 전체 시간·느린 요청·전환 낭비를 함께 평가하고, 최선해 전달을 포함한 실제 혼합 실행으로 검증한다.

카탈로그 원본 해시, 제외 판정, 초기 측정 재현 자료: `D:/AI/sfinder-wasm/tools/validation/minimals-policy-20260921/`.

## 작업 단위

공통 후보 열거·큐별 품질 계산 후 필터별 행렬을 만든다. worker 작업 단위는 `필터 행렬 → primary로 K 증명 → secondary로 품질 및 stable-ID 증명` 전체다. 일반 minimals는 작업 하나, per-save는 미노별 작업 여러 개를 같은 실행 계층에 제출한다.

현재 운영 코드는 아직 secondary만 분배한다. 이 문서는 사용자가 승인한 후속 구조를 기록하며, 구현 완료를 의미하지 않는다. 이번 CP-SAT 비교는 이 구조에서 사용할 secondary 엔진 선택을 검증하는 독립 프로토타입이다.

## 유지할 계약

- 기하 해답 열거를 필터마다 반복하지 않는다.
- save 필터가 coverage를 바꾸므로 K는 필터마다 독립적으로 증명한다.
- primary의 알고리즘 내부 설정은 Rust/HiGHS 1스레드, ORTools 2-worker를 유지한다.
- 필터 worker 수와 솔버 내부 계산 스레드 수를 함께 관리한다. secondary CP-SAT의 내부 worker 수는 primary 설정과 독립적인 비교 대상이다.
- primary 전용 dominance/kernel로 줄인 후보 집합을 secondary의 원래 품질 행렬 대신 사용하지 않는다.
- 일반 minimals의 마지막 bag 기반 save 표현식과 per-save의 실제 잔여 1미노 분류 의미를 보존한다.
- 큐 중복의 가중치, 정렬된 품질 벡터, stable-ID 동률 결과, 반환 표시 순서를 보존한다.
- worker 배정과 integrated/threshold/CP-SAT 선택은 별도 판단이다. 짧은 integrated 미완료를 threshold 우위의 증거로 취급하지 않는다.
- 아주 작은 작업은 로컬 경로를 허용한다. 무거운 작업은 integrated를 포함한 전체 탐색을 worker에서 시작한다.
- 여러 필터가 남아 있으면 필터 간 병렬화를 우선한다. 한 난제만 남으면 남는 계산 예산으로 서로 다른 exact 방식의 경쟁 실행을 검토할 수 있다.

## 구현 전 비교 기준

동일한 원래 품질 행렬, 동일 K, 동일 primary seed에서 integrated 단독·threshold 단독·기존 혼합·CP-SAT을 비교한다. 실제 완료 시간, 모델 준비 비용, 품질 증명과 stable-ID 증명 비용, 미완료 비율 및 peak 메모리를 구분한다. 탐색 노드 수는 서로 다른 알고리즘 사이의 동일 작업량으로 취급하지 않는다.

CP-SAT 실험 결과 및 재현 스크립트 위치는 `docs/CPSAT_SECONDARY_EXPERIMENT_20260921.md`에 기록한다. 선택 기준은 단일 셋업 ID로 하드코딩하지 않고, 추가 검증 후 행렬 특성 및 실행 진척에 근거해 정한다.
