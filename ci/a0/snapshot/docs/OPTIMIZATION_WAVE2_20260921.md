# 최적화 2차: primary kernel / exact DFS — 2026-09-21

대상 `D:/AI/sfinder-wasm/release3.0-20260906`. 1차 구현 및 complete-row 수정 위에 반영했다. 이번 제품 변경은 Rust min_cover.rs/min_cover_primary.rs와 재빌드된 pc_wasm.wasm이다. 신규 회귀 테스트 optimization-wave2.test.mjs를 추가했다. JavaScript 제품 코드, 자체 해셔, batch WASM은 기준 snapshot과 동일하다. 커밋/배포는 하지 않았다.

## 구현 내용과 결정

### 1. primary kernel의 평탄화와 지배 비교 필터

case mask / candidate coverage를 Vec<Vec<u64>>에서 각각 하나의 Vec<u64>로 바꾸고 커널 반복 사이에도 재사용한다. active row 개수 × words 산술은 checked_mul로 확인한다. candidate별 커버 수는 중복 제거된 행렬을 채우면서 정확히 집계한다. 따라서 전체 bitset을 다시 popcount하지 않고 같은 정보를 얻는다.

count[a] > count[b]이면 a⊆b 검사를 생략한다. subset이 참일 때 count가 같으면 두 bitset도 같으므로 기존 동일 coverage의 stable ID 우선 규칙을 유지한다. forced IDs, solution remap, 최종 kernel의 행/열 순서를 변경하지 않는다. secondary는 여전히 원본 quality 행렬을 사용한다.

### 2. DFS covered 버퍼 재사용

CardinalitySearch / BestSetSearch / SequentialThresholdSearch 각각에 요청 소유 Vec<Vec<u64>> buffer pool을 둔다. 재귀는 읽기 전용 covered slice를 받고, 자식은 pool의 Vec에 parent bitset을 복사·OR한 뒤 호출한다. 재귀에서 돌아오면 Vec을 pool로 반환한다. 부모의 covered는 수정하지 않으므로 undo 복원 누락을 만들지 않는다.

최대 깊이를 16으로 고정하지 않는다. 실제 최대 활성 깊이만큼 버퍼가 늘고 sibling에서는 capacity를 재사용한다. 비트 복사 자체는 남는다. memo의 소유 키, branch 벡터, quality 상태 등 다른 할당도 남으므로 'DFS 전체 힙 할당 0'이라고 주장하지 않는다. threshold 단계마다 별도 search pool을 생성하는 기존 생명주기는 유지했다.

### 3. 해셔는 기존 std 구현 유지

u32/u64/품질 pair 벡터의 길이 4·16·64에서 native와 WASM 비교를 수행했다. FastHasher는 긴 키에서 대부분 더 느렸다. 짧은 u32 벡터 일부에서는 개선됐지만 이들 map/set은 가변 길이 키를 받으므로 전면 교체하지 않았다. 해셔 이름 통일보다 실제 비용을 우선했다.

## 정확성

- 100개 결정적 random 작은 행렬: brute-force 최적 K, 품질 벡터와 stable selected IDs 일치.
- 중복 행의 가중치 보존. primary kernel 결과 전체 및 cardinality/legacy/integrated/threshold 결과를 이전 WASM과 비교했다.
- state budget 1/3/100000의 결과와 searchedStates까지 동일. 예산 중단 뒤 같은 solver에서 exact 재실행 확인.
- K=17/63/64/65 및 64-bit word 경계 확인. K=65 integrated는 66 states를 탐색하여 실제 깊은 재귀 경로도 실행했다. threshold는 seed로 조기 증명되는 경우가 있어 이 숫자를 모든 엔진의 깊이 검증으로 확대하지 않는다.
- 기존 complete-row 190/210, per-save 병렬 Worker와 stable 출력 유지.

## 할당 측정

단일 스레드 native allocator wrapper로 alloc/realloc 호출과 요청 바이트를 센 5회 비교. synthetic 512×256 kernel과 60행/24후보 quality 행렬이다. 같은 입력에서 모든 결과와 searchedStates가 동일했다. 아래는 호출 수이며 peak 메모리가 아니다.

| 단계 | 이전 할당 수 | 이후 할당 수 | 감소 |
|---|---:|---:|---:|
| kernel | 1,313 | 546 | 58.4% |
| cardinality | 569 | 394 | 30.8% |
| integrated | 1,707 | 583 | 65.8% |
| threshold | 11,228 | 10,140 | 9.7% |

할당 요청 바이트도 alloc-native.csv에 기록했다. Cardinality memo 키와 threshold 상태의 다른 할당은 그대로 남아 있어 단계마다 개선 폭이 다르다.

## WASM 함수별 측정

Node 24.13.0, 각 함수 100회 호출 묶음을 버전 순서 교대로 7회 실행한 중앙값. 각 묶음 전에 결과 동일성을 검사했다. JS 행렬 포장/호출 비용 포함이며 native 할당 계측을 이 시간에 섞지 않았다.

| 함수 100회 | 이전 ms | 이후 ms |
|---|---:|---:|
| kernel | 88.85 | 90.12 |
| cardinality | 6.32 | 5.78 |
| integrated | 21.59 | 20.31 |
| threshold | 517.16 | 517.01 |

cardinality/integrated는 이 입력에서 빨라졌고 threshold는 거의 같다. kernel은 할당을 줄였지만 이 입력에서는 시간이 약간 늘어났다. primary 평탄화를 모든 행렬에 대한 속도 향상으로 표현하지 않는다.

## 해셔 WASM 비교

각 3,000 keys의 map 삽입+조회 30회 묶음, 7회 중앙값(ms). 벡터의 소유 복사 등 동일한 비용도 포함한다. 임의 키 microbenchmark이므로 solver 전체 성능 배율이 아니다.

| 키 | 길이 | std | FastHasher |
|---|---:|---:|---:|
| Vec<u32> | 4 | 7.24 | 6.20 |
| Vec<u32> | 16 | 10.59 | 20.35 |
| Vec<u32> | 64 | 24.91 | 78.45 |
| Vec<u64> | 4 | 8.79 | 12.24 |
| Vec<u64> | 16 | 16.29 | 41.64 |
| Vec<u64> | 64 | 142.50 | 354.23 |
| Vec<(u32,u32)> | 4 | 9.61 | 10.15 |
| Vec<(u32,u32)> | 16 | 20.43 | 37.68 |
| Vec<(u32,u32)> | 64 | 128.20 | 330.41 |

## 실제 요청

Node는 새 프로세스에서 ALT SHOES [IJL]p3,*p4 per-save 요청을 각 5회 순서 교대로 실행했다. 결과 해시는 모두 같다.

Node 요청 중앙값: **1265.7 → 1262.8ms**. 전체 요청 성능은 거의 같다.

Chrome은 새 public Worker의 생성·초기화·요청·결과 전달을 포함하며 각 버전 5회 측정했다.

| 입력 | 이전 ms | 이후 ms |
|---|---:|---:|
| complete-row saves | 77.4 | 87.6 |
| ALT SHOES per-save *! | 160.5 | 141.0 |
| ALT SHOES split | 1191.7 | 1197.8 |

complete-row saves처럼 이번 set-cover 변경을 사용하지 않는 짧은 요청도 시간이 늘어나는 등 cold Worker 측정에는 변동이 있다. 모든 요청이 빨라졌다고 결론내리지 않는다. 정확성 확인은 모든 30회 비교에서 통과했다. 전체 *p3,*p4 176,400큐의 끝까지 실행 시간을 검증했다는 의미가 아니다.

## 전체 회귀 및 남은 범위

- Rust workspace 77개 통과, 실패 없음.
- JavaScript 프로젝트 108개 + 기존 validation 269개 = 377개 통과. BASELINE_ROOT를 이번 변경 직전 snapshot으로 지정했고 skip 없음. 강화한 깊이 assertion은 별도 targeted 재실행으로 통과.
- Chrome 기존 Fumen 회귀 28개 통과, 추가 30회 비교 결과 일치 및 page error 없음.
- cargo fmt check와 release WASM 빌드 성공.
- 이전 BOX 및 3×4 BOX 8P 제외 방침 유지.

이번 요청의 두 번째 묶음은 완료했다. 해셔 교체는 측정 결과에 따라 적용하지 않는 것으로 결론냈다. 이후 후보는 board 가지치기 비트 연산, fast 2↔2 정제, 실제 cache 압박 계측이다. JS fallback 재작성과 dead helper 정리는 여전히 낮은 우선순위다.

## 재현 자료

D:/AI/sfinder-wasm/tools/validation/optimization-wave2-20260921:

- baseline/, baseline-manifest.json: 기존 소스/WASM snapshot
- changes.diff, changes.json: 제품 diff와 해시
- targeted.log, js-tests.log, validation-tests.log, rust-tests.log: 회귀 결과
- alloc-bench.rs, alloc-native.csv: 할당 비교
- wasm-benchmark.mjs, wasm-benchmark.json: 함수별 WASM 비교
- hash-bench.rs, hash-native.csv, hash-wasm.rs, hash-wasm.json: 해셔 비교
- fresh*.mjs, fresh-results.json: 새 Node 프로세스 결과
- browser/, browser-results.json, browser-regression.log: 실제 브라우저 검증

스냅샷의 tests 디렉터리는 포함하지 않았으며 제품 테스트는 현재 프로젝트에서 실행했다. 기존 사용자 변경을 되돌리거나 Git 커밋을 생성하지 않았다.
