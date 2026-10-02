# Saves / minimals / per-save-minimals 구조 재검토 — 2026-09-21

후속 실행 계획: [통합 최적화 계획](OPTIMIZATION_ROADMAP_20260921.md). 분해 손해 사례와 동일 엔진·동일 누적 예산 비교를 포함한다. 아래 시제품은 가능성을 검토한 자료이며 분해의 무조건 적용 근거가 아니다.

## 판단

saves의 outcome-only 전환은 목적에 맞는 개선이다. minimals와 per-save의 공통 해답 산출 및 필터별 최적화 분리도 타당하다. 다만 **세 secondary 엔진의 선택 임계값을 먼저 확정하는 계획은 수정하는 편이 좋다.** 원본 품질 행렬의 독립 성분 분해와 자명한 exact 해 판정을 먼저 넣으면 풀어야 할 문제 자체가 크게 달라진다. 그 뒤 남은 문제에 대해 엔진 선택·전환을 측정해야 한다.

이번 작업에서는 운영 소스/WASM을 수정하지 않았다. 구조 분석 및 분해 시제품은 tools/validation에만 작성했다. 아래는 구현 제안이며, 완료된 제품 변경으로 간주하지 않는다.

## 1. 가장 큰 개선: 독립 성분 분해

원본 행렬의 후보와 큐 행으로 이분 그래프를 만든다. 같은 큐에 등장하는 후보들을 연결했을 때 서로 연결되지 않은 성분들은 독립적으로 풀 수 있다. primary 전용 dominance로 축약된 행렬이 아니라 **모든 원본 품질 행**을 기준으로 분해해야 한다.

### 정확성

1. 후보가 여러 성분에 걸쳐 큐를 덮지 않으므로 전역 최소 개수는 각 성분의 최소 개수 합이다.
2. 이미 증명된 전역 K와 feasible K-seed가 있다면, seed가 각 성분에서 고른 개수도 해당 성분의 최소 K다. 어느 성분에서 더 줄일 수 있다면 전역 K도 줄어 모순이다.
3. 정렬된 품질 벡터의 사전식 최대화는 낮은 품질부터 histogram 빈도를 사전식 최소화하는 것과 같다. 성분별 histogram은 더해지므로 각 성분의 최적해를 합친 결과가 전역 품질 최적이다.
4. 품질 동률에서는 원래 전역 stable-ID 순서를 각 성분 내부에서 유지한다. 성분별 최소 사전식 선택 집합의 합집합이 전역 동률 기준도 만족한다.

이는 최소 개수 K가 확정된 조건에 대한 분해다. 임의의 더 큰 고정 K, 여러 성분을 연결하는 추가 제약, 근사 primary 결과에 그대로 적용해서는 안 된다.

per-save는 같은 큐에서 남기는 미노가 정해지면 사용 미노 개수도 정해진다. 따라서 서로 다른 사용 미노 개수 조합이 자연스럽게 분리되는 경우가 많다. 일반 minimals의 save 표현식은 한 큐에서 여러 결과를 허용하므로 성분들이 더 많이 연결된다. 명령 이름이나 큐 패턴으로 분해를 가정하지 않고 실제 행렬에서 확인하는 것이 안전하다.

### 구조 조사

기존 per-save 행렬 54개 중 42개가 여러 성분으로 나뉘었다. 일반 minimals의 새 pilot 행렬 16개 중에서는 6개가 나뉘었다.

| per-save 행렬 | 전체 후보 | 성분 수 | 가장 큰 성분 후보 |
|---|---:|---:|---:|
| ALT JAWS / 제한 split / I | 591 | 53 | 68 |
| ALT JAWS / 제한 split / L | 370 | 40 | 43 |
| ALT JAWS / 제한 split / S | 501 | 16 | 68 |
| Elephant + J / 제한 split / I | 356 | 38 | 36 |

### 진단 시제품

기존에 증명된 K와 seed를 사용하여 각 성분의 K를 얻고, 원본 singleton 행으로 모든 선택이 강제되는 경우를 즉시 처리했다. 나머지는 기존 integrated 10만 상태, 미완료 시 threshold 20만 상태로 풀었다. 운영용 임계값을 제안하는 숫자가 아니라 기존 엔진을 그대로 사용하는 진단 설정이다.

ALT JAWS의 아래 시간은 새 Node 프로세스 각 3회 중앙값이다. 분해, 행렬 준비, secondary, 결과 병합을 포함하며 공통 해답 열거, primary 및 solver 초기화는 제외한다.

| 필터 | 분해 시제품 | 이전 CP-SAT 2-worker 기록 |
|---|---:|---:|
| I | 32.3ms | 9.358초 |
| L | 29.3ms | 7.598초 |
| S | 30.1ms | 10.924초 |

이전 기록은 이전 실험의 단계별 CP-SAT 모델이며, 모든 최신 모델·같은 실행 시점과의 재벤치마크가 아니다. 위 표로 일반 가속 배율을 주장하지 않는다. 다만 이 행렬들에서 분해를 엔진 전환보다 우선 검토할 근거는 충분하다. 선택 ID와 전체 품질 벡터는 보관된 exact 결과와 일치했다.

분해 가능 또는 원본 singleton 강제 해 판정이 가능한 59개 행렬을 시도했다. per-save 49개는 모두 완료했고 일반 minimals 10개 중 9개가 완료했다. 기존 전역 exact 참조가 있는 17행렬에서 총 71개 완료 기록과 일치했다. 참조가 없는 나머지 행렬까지 전역 oracle 검증을 마쳤다고 주장하지 않는다. 별도로 작은 독립 행렬 100개를 완전탐색과 대조하여 K·품질·동률 선택이 일치했다.

일반 minimals에서는 QB T가 단일 integrated 약 52ms 대비 시제품 약 129ms, ALT SHOES T가 단일 threshold 약 167ms 대비 약 413ms였고, ALT JAWS T는 10초 제한에 걸렸다. 분해 후에도 대부분 후보가 큰 성분 하나에 남는 경우 효과가 작고 추가 준비 비용이 생긴다. 따라서 **분해 검사와 무조건 모든 성분을 새 solver 호출로 푸는 정책은 구분**해야 한다.

## 2. Minimals exact secondary 개선

### integrated의 실제 탐색을 먼저 개선할 여지가 있다

`rust/pc-core/src/min_cover.rs`의 `BestSetSearch::run`은 coverage와 필요한 후보 수의 하한으로 가지를 자른다. `consider`에서 완성된 선택 집합의 품질을 비교하며, 현재 DFS에는 품질 상한을 incumbent와 비교해 가지를 자르는 로직이 없다. histogram은 이미 구현되어 있지만 주로 품질 평가 비용을 줄이는 역할이다.

또한 중복 완성 집합은 `completed: HashSet<Vec<u32>>`에서 제거하지만, 그 집합에 도달하기 전 중복 탐색까지 제거하지는 않는다.

제안:

- 현재 선택과 남은 후보로 얻을 수 있는 낙관적인 큐별 품질 상한을 계산하고, 그 histogram조차 incumbent보다 나쁘면 중단한다. 동률 가능성이 있으면 stable-ID 기준까지 고려하거나 가지를 유지한다.
- 같은 pivot 큐의 형제 분기에서 앞서 다룬 후보를 제외하는 방식으로 선택 조합의 중복 탐색을 줄인다. 단순히 전체 선택 ID를 오름차순으로 제한하는 것은 pivot 선택과 충돌해 해를 누락할 수 있으므로 사용하지 않는다.
- 아주 작은 성분에서는 상한 계산 비용이 더 클 수 있으므로 완전탐색 검증과 크기별 실측 후 적용한다.

### tiny 경로에도 예산이 필요하다

`min-cover-adaptive.mjs`와 `per-save-minimals-core.mjs`에는 후보가 48개 이하면 제한 없는 legacy exact를 호출하는 경로가 있다. 이는 새 secondary 선택 정책과 worker 분배를 우회한다. 후보 수만으로 쉽다고 보장할 수 없으므로 작은 작업 판정도 남은 선택 수, 성분 크기, 큐 제약을 보고 제한된 탐색으로 확인해야 한다.

가장 먼저 할 수 있는 안전한 처리는 원본 singleton 행의 후보 집합 F를 계산하는 것이다. F가 모든 행을 덮고 `|F|=K`라면 선택이 유일하다. `K=전체 후보 수`도 자명하다. primary kernel의 `forced`는 후보 dominance 이후 생긴 강제 선택을 포함할 수 있으므로 원본 문제에서 반드시 선택해야 하는 후보라고 그대로 재사용하면 안 된다.

### 엔진 전환은 진행 상태를 보존해야 한다

현재 `minimumCoverAtCount`는 호출마다 행렬을 WASM으로 복사하고 Rust에서 정규화/보조 자료를 다시 만든다. threshold는 품질 단계별 탐색을 수행하지만 bounded 결과로는 증명한 단계와 targets를 반환하지 않는다. JS wrapper는 bounded와 lockedPrefix의 동시 사용도 금지한다.

짧은 탐색을 반복하는 정책을 먼저 추가하면 전처리와 증명을 반복할 수 있다. 다음 계약이 선행되어야 한다.

- 요청/worker 내 준비된 원본 행렬 핸들 재사용.
- 반환 상태에 best feasible 해, 증명된 품질 단계/targets, 최종 동률 증명 여부 구분.
- 같은 엔진을 계속할 때 가능한 탐색 상태 재사용, 다른 엔진에는 incumbent 및 검증된 prefix 전달.
- prefix는 같은 행렬·가중치·K·품질 단계에 대한 증명일 때만 사용. seed의 품질을 증명된 최적 target으로 고정하지 않는다.
- 전환 예산에 전처리·복사·모델 생성 및 요청 내 누적 probe 시간을 포함한다.

threshold와 CP-SAT은 별개의 최적화 목표가 아니라 동일한 단계별 품질 목표를 푸는 다른 구현이기도 하다. 검증된 prefix를 공유하면 전체 목표를 매번 처음부터 증명할 필요가 줄어든다. CP-SAT의 학습 절이나 탐색 트리가 solve 호출 사이에 자동 보존된다고 가정하지 않는다.

초기 선택은 primary kernel의 난도(`primaryHard`)보다 **분해 후 남은 secondary 문제**의 후보 수, K, 자유 선택 수, 품질 단계, 가중 행 클래스 및 상한의 느슨함에 근거해야 한다. CP-SAT은 큰 연결 문제가 남았을 때의 대안으로 유지하되 항상 마지막 순서라고 확정하지 않는다.

### 이미 있는 최적화와 구분

Rust의 품질 histogram 행 그룹화, threshold별 가중 그룹화, threshold dominance는 이미 존재한다. 이를 새 기능처럼 중복 구현하지 않는다. 공통 전처리에서 가중 품질 행을 만들어 재사용하는 것은 별도 개선 후보이며, 원래 큐 중복 가중치와 최종 출력 복원 정보를 유지해야 한다.

## 3. Per-save worker 분배

공통 해답을 한 번 산출하고 필터 작업에서 primary→secondary를 수행하는 계획은 유지할 가치가 있다. 다만 분해 후 수십 ms가 된 필터를 전부 worker로 보내면 생성·전송 비용이 더 커질 수 있다.

권장 구조:

1. 공통 기하 해답과 품질 산출.
2. 필터별 원본 행렬 및 독립 성분 확인.
3. 자명한 결과/충분히 작은 작업은 로컬에서 제한된 예산으로 완료.
4. 무거운 필터 또는 성분 묶음은 공통 pool에 전달해 primary→secondary 실행. 미세한 성분마다 worker를 만들지 않는다.
5. 무거운 작업부터 배정하되, 매우 긴 하나의 필터가 남으면 성분 단위 재분배를 고려한다.

현재 pool은 요청마다 만들어 종료하며 `keys` 문자열과 CSR 사본을 보낸다. 재사용 가능한 pool, job 전용 transferable 배열, 숫자 ID 중심 전송으로 비용을 줄일 여지가 있다. 기존 요청 소유 배열을 무작정 detach하지 않는다. 결과용 Fumen과 geometry 복원은 부모에 남길 수 있다. 이 단계에서 SharedArrayBuffer를 필수로 도입할 필요는 없다.

filter worker와 내부 ORTools/CP-SAT worker를 같은 총 CPU 예산에 포함해야 한다. 무조건 7필터×2 내부 worker로 늘리는 것은 피한다. primary Rust/HiGHS 1, ORTools 2 설정은 유지하면서 동시 실행 슬롯을 조정한다.

전체 독립 split에서 minimals는 여전히 secondary 이전의 기하/품질 열거에 오래 걸린다. saves의 outcome-only 결과로 minimals의 해답별 품질 행렬을 대체할 수는 없다. 이 병목은 root별 기하/순서 처리와 메모리를 별도로 계측하고 개선해야 하며, worker 분배만으로 해결된다고 기대해서는 안 된다.

## 4. Saves

현재 outcome-only는 필요한 정보만 구하므로 유지한다. 일반 minimals/per-save와 save 집합의 의미가 다르므로 계산 결과 자체를 무리하게 통합하지 않는다. 공통으로 재사용할 것은 board/queue 준비, 기하 DAG 등 계약이 같은 부분이다.

추가 우선순위는 아래와 같다.

- **JS 집계와 표현식 비용 계측**: 큐마다 Set과 미노 count 배열을 만들고, 지정 표현식에서는 문자열 Set을 또 만든다. 같은 save-code 집합과 같은 bag 해석의 결과를 요청 내에서 재사용하고 RegExp를 AST 구성 시 한 번 컴파일할 수 있다. 캐시는 요청 범위나 크기 제한을 둔다.
- **한 미노 잔여 전송 특화**: queueLength=req+1인 경우 큐당 가능한 잔여 미노를 u8로 전달하는 방법을 비교한다. 이는 최종 save 전체를 7-bit 집합으로 축소한다는 뜻이 아니다. 마지막 bag의 미인출 미노와 중복 미노를 기존 후처리에서 합쳐야 한다.
- **fallback 비용 완화**: `build_separate`는 전체 구성 실패 시 이미 구성한 다른 root도 압축 결과를 사용하지 못한다. 예산 압박이 실측된다면 성공한 root를 보존하고 실패한 root만 exact fallback하는 방식을 검토한다.
- **요청형 반환**: ALL 집계, 특정 표현식 판정, 상세 큐 결과 등 출력에 필요한 자료만 생성하는 경로를 비교한다. `!T` 등 부재 조건은 전체 탐색 없이 성공으로 확정할 수 없다.

새 saves가 약 0.76초에 처리한 두 전체 split 결과만으로 내부 Rust 탐색과 JS 처리 중 어느 부분이 다음 병목인지 단정할 수 없다. 따라서 추가 스레드나 특수 DAG 재작성보다 현재 구현의 구간별 계측을 먼저 권한다.

## 수정 제안 순서

1. 원본 행렬 기반 독립 성분 분해 및 원본 강제 후보/자명한 exact 해 처리.
2. tiny 경로 예산과 공통 prepared matrix/증명 상태 계약 정리.
3. integrated 중복 탐색·품질 상한 개선을 별도 비교. 개선 효과가 없으면 기존 구현 유지.
4. 위 변경 후의 잔여 문제를 대상으로 integrated / threshold / CP-SAT 선택·전환 임계값 보정.
5. 그 비용 분포에 맞춘 per-save primary→secondary worker 분배.
6. 별도 작업으로 saves의 현재 병목 계측과 JS/전송 최적화.

4×4 BOX `*!`, 기존 BOX 8P/모바일 제외 조건은 계속 유지한다. 이미 확보한 행렬 실험은 버리지 않되, 분해 전 필터 전체를 기준으로 정한 시간·후보 수 임계값을 분해 후 성분에 그대로 적용하지 않는다.

## 근거 파일과 실험 자료

- `src/saves-feature.mjs`, `src/saves.mjs`, `rust/pc-core/src/pattern.rs`.
- `src/min-cover-adaptive.mjs`, `src/min-cover-exact-secondary.mjs`, `rust/pc-core/src/min_cover.rs`.
- `src/per-save-minimals-core.mjs`, `src/exact-secondary-pool.mjs`, `src/pc-wasm-min-cover.mjs`.
- `D:/AI/sfinder-wasm/tools/validation/solver-review-20260921/`: `structure.json`, `components.mjs`, `results.json`, `repeat-results.json`, `brute.mjs`, `brute-results.json` 및 입력별 로그.

실험은 저장된 원본 행렬과 기존 production WASM을 사용했다. 소스 변경 없이도 분해의 효과를 확인했으며, 제품 통합과 전체 명령 검증은 후속 작업이다.
