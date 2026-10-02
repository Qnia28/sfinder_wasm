# Exact secondary 직접 엔진 비교

**2026-09-25 결과 추가:** 아래는 측정 전 고정한 계약이다. Gemini/LUNA가 각각 300회 실행을 완료했고 완료 해답은 모두 일치했다. 완료 여부 4건의 차이와 독립 감사, 다음 재현 계획은 [교차 감사](SECONDARY_CUTOFF_AUDIT_20260925.md)에 기록했다. 제품 기본 정책은 유지한다.

## 이번 결정에 필요한 증거

전체 정책에서 중복 제거는 ELEPHANT J/O의 threshold 전환을 피했지만 공통 timeout 8입력을 해결하지 못했다. 현재 100,000 상태 전환 기준 자체가 유리한지, 어려운 입력에는 threshold보다 CP-SAT을 먼저 선택할 근거가 있는지 분리해 확인한다. 제품 코드·기본값·primary 설정·worker 분배는 이번 묶음에서 변경하지 않는다.

## 고정한 입력과 방법

실행 위치: `D:/AI/sfinder-wasm/tools/validation/secondary-engine-choice-20260925`.

앞선 `secondary-partition-policy-20260923` 기준선의 5초 timeout 8입력을 전부 포함한다. 추가 비교용 7개는 per-save ELEPHANT J의 J/O, cycle3-000 full split I/T, per-save ALT SHOES S, per-save pcinfo-018 L, ordinary QB row-002 `*!` T다. 이미 관찰한 개발·회귀 집합이며 미관측 검증셋은 아니다. kind와 필터를 유지하고 독립 `*p3,*p4`와 제한 `[IJL]p3,*p4`를 합쳐 보고하지 않는다. 4×4 BOX 제외는 유지한다.

15입력 × 4조건 × 5회 = 300회다. 조건은 기존 integrated 단독, threshold 단독, CP-SAT max_lp 1-worker, 같은 모델의 2-worker다. 같은 원본 행렬·증명된 K·초기 seed에서 시작한다. integrated는 historical 구현이며 partitioned를 섞지 않는다. integrated/threshold의 상태 예산은 무제한이고 외부 시간 제한을 둔다. 분해·기존 probe·엔진 전환은 실행하지 않는다. ABCD/DCBA 교차, 작업마다 새 Node 프로세스, 직렬 실행이다.

## 시간·정확성 계약

- 먼저 각 런타임을 초기화한다. Rust solver 생성과 CP-SAT의 기존 cached runtime loader 호출 시간을 initMs로 기록한다. CP-SAT에 임의 예제 solve를 실행해 탐색을 예열하지 않는다.
- engineMs는 Rust numeric 준비+탐색 또는 CP 모델 준비+품질/동률 증명 전체다. 목표 20초이며 CP에도 같은 전체 제한을 전달한다. sync Rust 중단과 CP 종료 정리를 위해 공통 외부 강제 종료는 engine-start 후 25초다.
- 20초 이내 proof 완료만 EXACT다. 20~25초 완료는 EXACT_LATE, CP가 반환한 미완료는 INCOMPLETE, 외부 종료는 TIMEOUT이다. EXACT_LATE를 20초 내 완료에 포함하지 않는다.
- initAndEngineMs는 초기화+엔진, processWallMs는 프로세스 시작·검산·종료까지 포함한다. 이들 모두 후보 열거와 primary를 제외하므로 명령 전체 시간이 아니다.
- stdout에 engine-start/end 및 CP 품질/tie 단계 이벤트를 기록해 강제 종료 시 마지막 관측 단계를 보존한다. 기록되지 않은 incumbent나 정확한 정지 위치를 추정하지 않는다.
- CP는 기존 정수 objective 재구성 모델을 복사했다. 각 품질 묶음과 stable-ID 묶음의 OPTIMAL/정수 objective/bound 조건을 지키고 FEASIBLE을 exact로 취급하지 않는다. numWorkers 외 설정은 동일하다.
- 반환된 모든 incumbent는 K/원본 전체 행 커버/품질 벡터를 독립 재계산한다. 완료된 결과는 모든 엔진 및 기존 참조와 stable keys·품질 hash를 대조한다. 완성 결과가 없는 입력은 비교의 한계를 그대로 기록한다.

## 실행 및 후속 판정

기존 CP 완전탐색·65후보 tie 테스트를 이 snapshot에 연결해 먼저 실행한다. 통과하면 벤치마크를 진행한다. `node run.mjs`를 한 번만 실행하며 실행 중 소스·runner·입력 수정이나 재시도는 하지 않는다. 실행 전후 manifest hash를 검사한다. 코드 문법 검사와 묶음 준비만 완료했고 새 테스트/벤치마크는 아직 실행하지 않았다.

판정은 입력별 완료율·완료 시간·integrated 상태 수·CP 품질/tie 단계 비용을 기준으로 한다. 서로 다른 완료 집합의 평균을 비교하지 않는다. 특히 ELEPHANT J/O의 기존 integrated가 100,000을 얼마나 넘겨 끝나는지, timeout 그룹에서 CP가 실제 증명을 마치는지, 쉬운 입력의 CP 준비 비용을 확인한다. 이 자료로 다음 전환 정책 후보를 정한 후 새로운 보드 그룹에서 검증한다. 이번 비교만으로 setup ID별 규칙이나 고정 CP 우선 정책을 만들지 않는다.
