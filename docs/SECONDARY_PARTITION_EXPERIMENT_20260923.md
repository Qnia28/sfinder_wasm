# Integrated 중복 분기 제거 실험

## 구현과 증명 범위

`min_cover.rs`에 `exact_quality_cover_at_count_integrated_partitioned_bounded`를 추가했다. 기존 공개 entry point와 제품 WASM은 이전 탐색을 유지한다. 새 경로는 `BestSetSearch`에 sibling 제외 플래그와 복원 trail을 둔다.

미커버 행에서 후보 순서가 b0, b1, …이면 b0 분기는 b0를 포함한 확장을 담당하고, b1 분기는 b0를 제외하고 b1을 포함한 확장을 담당한다. 모든 유효 확장은 그 행에서 선택한 가장 앞선 후보의 분기 하나에 속한다. 이후 행에서 작은 ID를 선택할 수 있으므로 전역 ID 증가 조건을 적용하지 않는다. 상태는 재귀 깊이별 checkpoint로 복원하며 예산 종료 때도 조상의 제외 플래그를 유지하고 자기 프레임의 추가분만 제거한다.

기존 pivot 선택·gain 정렬·lower bound·품질 비교·histogram 전환·완료 집합 중복 검사·stable-ID 동률 결정은 유지했다. 제외 후보를 lower bound에서 계속 세는 것은 느슨한 안전한 하한이며 별도 휴리스틱 변경은 하지 않았다. 완료 집합 HashSet도 아직 제거하지 않았다. bounded 결과는 유효 incumbent일 뿐이며 Exact만 최적 품질과 동률 결정을 증명한다.

## 준비한 정확성 검증

- 160개 작은 행렬을 모든 부분집합으로 독립 열거하여 최소 K, 원본 중복 행을 포함한 품질 벡터, stable ID를 구한다.
- 각 행렬에 histogram 전환 1/비활성 및 상태 예산 0/1/2/5/32/무제한을 비교한다. 미완료는 원본 행 커버, seed 이상 품질, 상태 한도를 검증한다.
- 삼각형 coverage에서 중복 분기 감소를 확인하고, 큰 ID 다음 작은 ID가 필요한 최적해를 보존하는 회귀를 추가했다.
- debug 빌드의 root 복귀 검사로 예산 종료 후 제외 trail/플래그 복원을 확인한다.

첫 실험의 소스 타입 검사·빌드 후 LUNA가 아래 단위 테스트와 1,140회 측정을 완료했다. 후속 정책 전체 비교는 별도 절에 기록한다.

## 고정된 실행 묶음

위치: `D:/AI/sfinder-wasm/tools/validation/secondary-partition-20260923`.

`node run.mjs`를 한 번 실행한다. 준비된 native 단위 테스트가 통과하면 저장된 ordinary 16 + per-save 54 + 기존 후속 회귀 6, 총 76입력 × 3모드 × 5회 = 1,140회를 새 프로세스에서 직렬 실행한다. 모드는 기존 소스 baseline / 수정 소스의 기존 경로 control / partitioned다. 상태 예산은 모두 integrated 100,000, 외부 제한은 5초다. threshold·분해·worker 분배는 실행하지 않는다. 반복 순서는 ABC/CBA 교차다.

측정 엔진은 두 소스 버전을 함께 빌드한 별도 WASM이며 제품 바이너리를 교체하지 않는다. `coreMs`는 입력의 Rust 행 복원부터 integrated 전처리·탐색·결과 packing까지다. JS 입력 packing·결과 복사는 `requestMs`에 추가로 포함한다. WASM 초기화·primary·큐 열거·독립 검산은 제외하므로 실제 명령 시간과 혼동하지 않는다.

EXACT/BUDGET/TIMEOUT을 분리해 집계한다. baseline/control은 완료 여부·incumbent·품질·상태 수가 같아야 한다. partitioned와 다른 경로가 모두 exact이면 K/품질/stable keys가 같아야 한다. 73입력에는 이전 exact 결과도 있어 새로운 exact 결과를 대조한다. 참조가 없는 3입력은 독립 작은 행렬 검증과 모드 간 비교 범위만 주장한다. partial과 exact 시간을 섞은 전체 평균으로 가속 배수를 만들지 않는다.

전체 소스·테스트 바이너리·WASM·runner·입력을 `manifest.json`으로 고정했다. 빌드/동결 스크립트는 재현용이며 실행 담당자는 다시 빌드하거나 동결하지 않는다. 오류가 나면 자동 재시도 없이 결과를 보존하고 멈춘다.

## 다음 판정

1. 정확성과 기존 control의 회귀 여부부터 확인한다.
2. 같은 입력의 exact 완료율, 상태 수, 준비 포함 시간으로 partitioning 효과를 판단한다.
3. 유리한 경우에만 제품 WASM 실험 옵션과 실제 minimals/per-save 입력의 후속 검증을 준비한다. 기본 적용은 별도 판정한다.
4. 탐색 재개는 별도 작업이다. 현재 bounded 함수는 행 정규화·coverage 준비와 재귀 상태를 모두 반환 시 버린다. 준비 상태 재사용만으로는 탐색 재시작을 피할 수 없으며 continuation에는 소유된 준비 행렬과 명시적 DFS 프레임/분기 위치/품질 undo/제외 상태의 수명 관리가 필요하다.

## 첫 실험 결과 — 기본 적용 보류

`secondary-partition-20260923/run-01`에서 native 단위 테스트 25개 통과, 1,140개 작업 완료, TIMEOUT/ERROR 0이었다. 모드별 380회 중 baseline/control은 EXACT 155, BUDGET 225였고 partitioned는 EXACT 165, BUDGET 215였다. 기존 경로 baseline/control의 결과·상태·탐색 수는 모두 일치했다. Exact 결과와 기존 기준 결과의 K/품질/stable keys도 일치했다.

| 입력 | control | partitioned | 판정 |
|---|---:|---:|---|
| per-save ELEPHANT J 제한 split J/O | 각각 BUDGET 5/5 | 각각 EXACT 5/5 | 10만 상태 내 증명 완료 증가 |
| per-save ELEPHANT J 제한 split S | 17.4ms / 7,387 states | 14.0ms / 4,107 states | 같은 exact 작업 개선 |
| per-save pcinfo-018 제한 split T | 63.5ms / 88,559 states | 54.0ms / 73,637 states | 같은 exact 작업 개선 |
| minimals cycle3-000 full split I | 226.7ms / BUDGET | 248.0ms / BUDGET | 같은 예산 실행 시간 악화 |

시간은 독립 WASM coreMs 평균이며 제품 전체 시간은 아니다. 쉬운 일부 사례에도 수백 μs~1ms 미만의 악화가 있었고, 기존 소스 baseline과 옵션을 끈 control의 시간도 달랐다. 이를 전부 옵션 검사 비용 탓으로 단정하지 않는다. 코드 배치·빌드 차이와 측정 편차도 가능하다.

ALT JAWS 제한 split T의 bounded incumbent는 두 경로가 달랐다. Astra가 원본 행렬에서 재계산한 첫 품질 차이는 정렬 벡터의 0-based rank 112이며 control=1, partitioned=2였다. 이 경우 partitioned incumbent가 더 좋다. 유효한 미완료 해의 차이는 오류가 아니지만 다음 threshold의 비용을 바꿀 수 있으므로 최종 exact 정책 전체로 비교해야 한다.

## 후속 구현 — 컴파일 분리와 실제 WASM 정책 비교 준비

`BestSetSearch<const PARTITION: bool>`로 두 DFS를 컴파일 시 분리했다. 기존 경로에서 매 상태의 실험 옵션 판정과 제외 배열 접근이 제거되도록 했으며, 기존 경로는 빈 제외 배열을 갖는다. 실제 시간 회귀가 사라졌는지는 아직 측정하지 않았다.

실험용 `solver_min_cover_at_count_integrated_partitioned_bounded` WASM export와 `minimumCoverAtCount(..., { integrated: true, partitioned: true })` 내부 옵션을 추가했다. 기본값은 false다. dominance/비-integrated 조합과 해당 export가 없는 구 WASM을 명시적으로 거부한다. 공통 exact 정책과 worker payload는 변경하지 않았다. 검증 adapter가 integrated 호출에만 옵션을 넣는다.

새 실행 묶음은 `D:/AI/sfinder-wasm/tools/validation/secondary-partition-policy-20260923`이다. 실제 pc-wasm을 snapshot에서 빌드했으며 제품 `wasm/pc_wasm.wasm`은 SHA256 `640232e30c586e87d6c5f5ad5ab52856c9ab173df984e4915f383e9fd399eee2` 그대로다. 후보 WASM hash는 `2c6844eb6c1424307f8d66b8d233c45a5c13efc6cc6ec9f8c7ce068962982d5c`다.

`node run.mjs` 한 번으로 native 단위 테스트, WASM ABI·완전탐색·예산 후 재호출·threshold seed 전달 검사, candidate 프로젝트 회귀를 먼저 수행한다. 통과하면 동일 76입력 × 3조건 × 5회 = 1,140회를 직렬로 비교한다. baseline은 기존 제품 snapshot, control은 새 WASM의 기존 경로, partitioned는 새 WASM의 중복 제거 경로다. 기존 정책 그대로 trivial → integrated 100,000 → 필요시 threshold exact를 사용한다. decomposition off이며 이 corpus는 primaryHard=false다. 각 작업 제한 5초, ABC/CBA 교차다.

`productionMs`는 numeric 준비 + exact secondary 정책 전체 시간이다. 단계별 integrated/threshold 시간·상태·seed·결과를 함께 보존하고, 미완료 incumbent까지 원본 행렬에서 독립 검산한다. WASM 초기화·primary·열거·독립 검산은 제외한다. 완료 집합이 다른 조건의 전체 평균을 가속 배수로 해석하지 않는다. 새 보드 일반화, 자동 분해 정책 결합, CP-SAT 비교는 이번 범위에 포함하지 않는다.

357개 소스·입력·runner·바이너리의 hash를 고정했고 live Rust/JS 변경과 candidate 소스 일치를 확인했다. 이후 사용자가 위임문을 전달해 LUNA가 아래 검증을 완료했다.

## 2026-09-25 전체 정책 검증 결과와 결정

`secondary-partition-policy-20260923/run-01`에서 native 25개, WASM 정책 3개, 프로젝트 125개 테스트가 통과했고 프로젝트 1개는 조건부 skip이었다. 1,140회 비교에서 각 모드는 같은 68입력의 340회 exact 완료와 같은 8입력의 40회 timeout을 기록했다. 오류 0, 완료 결과 K/품질/stable keys 불일치 0이며 baseline/control의 완료된 단계별 결과·탐색 상태도 같았다. 고정 파일 hash는 유지됐다.

| 입력 | control productionMs 평균 | partitioned 평균 | 관찰 |
|---|---:|---:|---|
| per-save ELEPHANT J 제한 split J | 407.11 | 112.40 | threshold 약 285.79ms 생략 |
| per-save ELEPHANT J 제한 split O | 173.87 | 81.51 | threshold 약 97.33ms 생략 |
| per-save pcinfo-018 제한 split L | 169.5 | 179.9 | 약 6.2% 악화 |
| minimals cycle3-000 full split I | 604.2 | 614.0 | 소폭 악화, 기존 제품 baseline은 584.9ms |

ALT JAWS T ordinary/per-save는 모두 5/5 timeout이라 변경 incumbent가 최종 threshold 완료 시간에 미치는 효과는 아직 알 수 없다. 기존 runner는 최종 반환 전 단계 기록을 쓰지 않으므로 이 자료만으로 timeout 위치도 단정하지 않는다.

중복 제거는 실험 경로로 유지하고 제품 기본 활성화는 보류한다. 정확성 근거와 일부 큰 시간 이득은 있지만, 전체 완료 집합은 늘지 않았고 손해 사례와 미관측 그룹 검증이 남았다. 제품 WASM도 기존 상태로 유지한다.

다음 우선순위는 엔진 선택과 전환 예산 검증이다. ELEPHANT J/O의 큰 이득은 100,000 상태 경계를 넘느냐에 좌우되므로 기존 integrated를 조금 더 실행하는 대안과도 비교해야 한다. [직접 엔진 비교 계획](SECONDARY_ENGINE_CHOICE_20260925.md)에 기존 integrated 단독, threshold 단독, CP-SAT 1/2-worker 비교를 고정했다.
