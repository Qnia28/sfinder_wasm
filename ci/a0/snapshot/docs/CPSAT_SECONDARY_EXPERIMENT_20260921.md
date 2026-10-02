# Exact secondary CP-SAT 비교 실험 — 2026-09-21

**CP-SAT을 모든 exact secondary에 적용하는 것은 적절하지 않다. 그러나 ALT JAWS의 어려운 필터에서는 뚜렷한 이점이 확인됐다.** integrated와 threshold도 입력에 따라 우열이 바뀌므로, worker 배정과 탐색 방식 선택을 분리하여 함께 설계해야 한다.

운영 소스 및 WASM, 기본값은 변경하지 않았다. 로컬 검증 폴더에 실제 실행 가능한 CP-SAT exact 모델, 행렬 추출기, 비교 도구와 브라우저 검증을 구현했다. per-save를 필터별 primary→secondary 전체 작업으로 분배하는 합의는 [실행 구조 설계](MINIMALS_FILTER_EXECUTION_PLAN_20260921.md)에 기록했다. 해당 구조의 운영 구현 완료를 의미하지 않는다.

## 범위와 측정 조건

- 작업본: `D:/AI/sfinder-wasm/release3.0-20260906`, complete-row 및 Wave 1·2 반영 빌드.
- 실험 파일: `D:/AI/sfinder-wasm/tools/validation/cpsat-secondary-20260921/`.
- Intel i5-1240P, Node v24.13.0, Chrome 154 데스크톱. BOX 및 모바일/에뮬레이션 제외.
- cycle1의 6개 셋업에서 54개 유효 필터 행렬을 추출했다. 일반 사례와 난제를 포함한 10개 필터를 시간 비교 대상으로 선정했다.
- 패턴은 `*!`와 `[IJL]p3,*p4`. 후자는 첫 구간을 제한한 독립 분할 패턴이다. 전체 `*p3,*p4` 176,400큐를 대신하는 결과가 아니다. 전체 독립 패턴의 후보 열거 병목은 이번 실험에서 해결하지 않았다.
- 동일한 원래 품질 행렬, primary가 증명한 K, primary가 반환한 초기 해답으로 각 엔진을 새 프로세스에서 실행했다. 기하 열거와 primary는 비교 시간에서 제외했다.
- Rust integrated 단독은 10만 상태 제한을 제거하고 외부 15초 실행 제한으로 비교했다. threshold 단독, 기존 10만-state integrated→threshold 혼합도 같은 행렬로 비교했다.
- CP-SAT은 프로젝트에 이미 포함된 WASM 바인딩을 사용했다. 기본 비교 설정은 `numWorkers=2`, `subsolvers=['max_lp']`, randomSeed=1, addZeroHalfCuts=false, useSatInprocessing=false, relativeGapLimit=absoluteGapLimit=0이다. primary 운영 설정은 변경하지 않았다.
- Rust는 1스레드, 기본 CP-SAT 비교는 내부 2-worker이다. 같은 CPU 수의 비교라고 주장하지 않는다. 별도 1-worker CP-SAT 실험도 수행했다.
- Node 시간은 Rust의 numeric matrix 준비+탐색, CP-SAT의 모델 구성+solve들을 포함한다. JSON 읽기·모듈 import는 제외한다. Rust WASM 초기화는 별도 필드, CP-SAT runtime의 첫 solve 초기화는 solve 시간에 포함한다. 전체 per-save 요청 경과시간이 아니다.
- 먼저 15초 예산으로 비교하고, ALT JAWS I/L/S의 Rust threshold는 별도 45초 제한으로 연장 검증했다. CP-SAT 제한은 내부 제한이므로 약간 초과할 수 있다. FEASIBLE은 최적성 미증명으로 처리했다.

## 1. 비교 결과

단위: 초. `미완료(15)`와 `미완료(45)`는 해당 초의 제한에서 종료한 것이며 실제 완료 시간은 알 수 없다.

| 셋업 / 패턴 / save | Rust integrated | Rust threshold | 기존 혼합 | CP-SAT 2-worker |
|---|---:|---:|---:|---:|
| ALT SHOES / `*!` / J | 0.007 | 0.008 | 0.007 | 0.322 |
| pcinfo-019 / `*!` / T | 0.729 | 0.047 | 0.185 | 0.842 |
| ALT SHOES / split / S | **0.039** | 0.067 | 0.038 | 4.247 |
| ALT SHOES / split / Z | 2.153 | **0.230** | 0.321 | 10.498 |
| HILLS + HEART / split / O | 미완료(15) | **0.512** | 0.586 | 5.369 |
| Elephant + J / split / I | 미완료(15) | **0.750** | 0.886 | 5.489 |
| ALT JAWS / split / T | 미완료(15) | **7.899** | 7.979 | 9.001 |
| ALT JAWS / split / I | 미완료(15) | 미완료(45) | 미완료(15) | **9.358** |
| ALT JAWS / split / L | 미완료(15) | 18.415 | 미완료(15) | **7.598** |
| ALT JAWS / split / S | 미완료(15) | 미완료(45) | 미완료(15) | **10.924** |

split는 모두 `[IJL]p3,*p4`다.

반복 수:
- pcinfo-019 T, ALT SHOES S의 각 방법: 3회 중앙값.
- HILLS + HEART O의 threshold·혼합·CP-SAT: 3회 중앙값. integrated 중단은 1회.
- ALT JAWS I/L/S의 CP-SAT: 각각 3회 중앙값. Rust의 각 중단 및 연장 검증은 1회.
- 나머지는 1회 진단이다. 단일 실행에서 작은 차이를 성능 개선으로 해석하지 않는다.

해석:
- 같은 분할 패턴에서도 S에는 integrated, Z에는 threshold가 유리하다. “넓은 큐이면 threshold가 항상 우월하다”는 정책은 근거가 없다.
- CP-SAT은 쉬운 문제에서 모델 준비·반복 solve 비용과 일반 목적 탐색 비용이 크게 불리했다.
- 반면 ALT JAWS I/L/S에서는 CP-SAT이 전체 exact 증명을 완료했다. L은 Rust의 연장 실행에서도 완전히 동일한 결과가 확인됐다.
- I와 S는 Rust가 45초에도 미완료이므로 Rust 완성 결과와의 비교는 불가능하다. 이 두 필터의 CP-SAT 결과는 전체 단계 OPTIMAL, bound 일치, 원래 행렬 재검증 및 서로 다른 CP 구성 간 동일 결과로 검증했다.

## 2. CP-SAT exact 모델

후보 선택 Boolean x_j를 두고 다음 조건을 설정했다.

1. 선택 개수 합계 = primary가 증명한 K.
2. 필터 적용 후 모든 활성 큐에 대해 하나 이상의 후보를 선택한다.
3. 각 품질 임계값 t에 대해, 해당 큐를 quality≥t로 커버하는 선택 후보가 하나라도 있는지를 Boolean y로 정확히 표현한다. `addMaxEquality(y, qualifying x)`를 사용한다. 조건을 한 방향으로만 완화하지 않는다.
4. 낮은 임계값부터 충족 큐 수를 최대화하고, 증명된 최적값을 equality로 고정한다.
5. 최종 품질 목표를 모두 고정한 후 작은 stable-ID 후보부터 선택 Boolean을 사전식 최대화한다. 고정 K에서는 정렬된 선택 ID 벡터의 사전식 최소화와 같다.

단순 품질 합계 최대화나 ID 합계 최소화를 사용하지 않았다. stable-ID는 30개 Boolean씩 이진 가중치로 묶고 각 블록의 최적값을 고정한다. 각 블록 합은 2^30−1 이하로 정확히 표현된다.

중복 행은 후보→품질 매핑 전체가 같은 경우만 묶고 원래 큐 중복 횟수를 가중치로 유지한다. 각 임계값의 동일 OR 집합도 재사용한다. 아직 쓰지 않는 미래 임계값의 변수는 미리 만들지 않고 해당 단계 진입 시 생성한다.

primary가 줄인 kernel 후보로 secondary를 제한하지 않는다. 처음 추출한 원래 품질 행렬을 사용한다. 각 solve는 OPTIMAL이며 정수 objective와 bestObjectiveBound가 일치해야 다음 단계로 진행한다. 시간 제한 시 FEASIBLE을 최종 exact 결과로 채택하지 않는다.

## 3. 모델 및 설정 개선 실험

### CP-SAT 탐색 설정

기본 CP-SAT 설정(numWorkers=2, subsolvers 미지정)은 ALT SHOES S, ALT JAWS T/I에서 각각 약 15초에 FEASIBLE로 종료되어 최적성을 증명하지 못했다. 같은 사례는 `max_lp` 설정에서 완료됐다. 따라서 외부 솔버 이름만 선택하는 것으로 충분하지 않고 모델·설정을 함께 비교해야 한다.

`max_lp` 1-worker 추가 실행은 ALT SHOES S 3.682초, ALT JAWS T 7.980초, I 8.429초에 완료됐다. 각각 1회이므로 일반적 우위는 단정하지 않는다. 다만 I의 개선을 단순히 Rust보다 두 배 많은 worker를 쓴 결과로만 설명할 수는 없다. 필터 풀 안에서 CP-SAT 내부 worker 수를 따로 최적화할 가치가 있다.

### 품질 목표 3단계 묶기

임계값별 충족 큐 수는 0..N 정수다. B=N+1로 두고 연속된 세 목표 C1,C2,C3를 `C1*B^2 + C2*B + C3`로 최대화하면 해당 세 단계의 사전식 최적화와 정확히 같다. 그 최적값을 고정하고 다음 묶음으로 진행한다.

전체 가중 합 상한이 2^45를 넘지 않도록 묶음 크기를 줄인다. 품질 목표 전체를 거대한 단일 가중치로 바꾸지 않으며, 정밀도 손실이나 임의 근사를 도입하지 않았다.

| 필터 | 단계별 CP-SAT | 3단계 묶음 CP-SAT |
|---|---:|---:|
| ALT SHOES S | 약 4.25초 | 2.414초 |
| ALT JAWS T | 9.001초 | 4.248초 |
| ALT JAWS I | 약 9.36초 | 5.211초 |

묶음 구성은 각 1회 Node 실행이다. 세 결과 모두 다른 완료 엔진의 선택 ID·전체 품질 벡터와 동일했다. 묶음 모델에도 별도의 완전탐색 대조 테스트를 적용했다.

## 4. 정확성 및 Chrome 검증

- 단계별 모델: 작은 무작위 행렬 24개를 모든 후보 부분집합 완전탐색 결과와 비교했다. 초기 seed는 품질 최적해로 고정하지 않고 별도의 최소 개수 feasible 해답을 선택했다.
- 묶음 모델: 같은 24개를 독립 실행해 비교했다.
- 두 모델 모두 65후보·K=33, 품질 동률에서 여러 stable-ID 블록을 통과하는 추가 사례를 검증했다. 기대 선택은 각 후보 쌍의 작은 ID다. 각 모델 25개, 합계 50개 테스트 통과.
- 실제 행렬 비교 80회 중 63회가 증명 완료, 17회가 시간 제한 미완료였다. 완료된 결과는 동일 필터의 다른 완료 실행들과 선택 ID 및 큐 중복을 포함한 전체 품질 벡터가 일치했다.
- CP-SAT은 품질 단계와 stable-ID 단계 모두 OPTIMAL 및 objective/bound 일치를 요구했다. 원래 행렬에서 커버 여부·K·품질 벡터를 다시 계산했다.
- Chrome 154, COOP/COEP 및 JSPI 활성화 환경에서 실제 browser용 CP-SAT 바인딩과 새 worker로 4회 검증했다. 네 실행 모두 Node 결과와 선택 ID·품질 벡터가 일치했고 브라우저 오류는 없었다.

| Chrome worker / 1회씩 | worker 초기화·전송·종료 포함 경과시간 | 모델 구성+solve |
|---|---:|---:|
| ALT SHOES S / 단계별 | 4.402초 | 4.114초 |
| pcinfo-019 T / 단계별 | 1.107초 | 0.707초 |
| ALT JAWS I / 단계별 | 9.205초 | 8.846초 |
| ALT JAWS I / 3단계 묶음 | **5.133초** | 4.729초 |

브라우저 표도 추출된 필터 행렬의 secondary 실행이며, 전체 per-save 계산이나 UI 렌더링 시간은 아니다.

## 5. 후속 적용 판단

1. **per-save는 합의대로 필터별 primary→secondary 전체를 공통 minimals 작업 풀에 제출하는 구조로 변경한다.** 후보 열거는 공유하고 save 의미·결과 정렬은 보존한다. 이번에는 설계를 문서화했으며 운영 실행 경로는 변경하지 않았다.
2. **CP-SAT 전면 교체는 하지 않는다.** integrated·threshold가 수십~수백 ms에 해결하는 필터에서 CP-SAT은 수 초가 걸렸다.
3. **CP-SAT을 어려운 secondary용 선택지로 개발할 근거는 확보했다.** max_lp 및 품질 목표 묶음 모델을 후보로 삼고, 후보 수·행 수·K만으로 성급하게 고정 분기하지 않는다. 품질 단계 수, 행/OR 동치 클래스 수, 기존 탐색 진척과 함께 더 넓은 데이터에서 검증한다.
4. **worker 배정과 엔진 전환을 결합하되 같은 판단으로 취급하지 않는다.** 여러 무거운 필터는 처음부터 worker에서 처리한다. 짧은 integrated가 끝나지 않았다는 이유만으로 threshold 우위를 가정하지 않는다.
5. **총 계산 예산을 관리한다.** primary의 기존 ORTools 2-worker 정책은 유지하고, secondary CP-SAT은 별도 1/2-worker 비교 결과를 적용한다. 필터 여러 개 × 솔버 내부 worker의 중첩을 고려한다.
6. 전체 `*p3,*p4`의 후보 열거 지연은 이 변경으로 해결되지 않는다. secondary 모델 구성 메모리, 176,400큐 규모의 행렬 증가, 실제 풀에서 여러 필터를 동시에 실행할 때의 메모리·지연·취소 처리도 아직 검증하지 않았다.

## 재현 파일

- `extract.mjs`, `snapshot/`: 운영 후보 열거 및 primary를 사용해 secondary 진입 직전 원래 행렬·K·seed를 추출.
- `matrices/`, `matrix-index.json`: 54개 필터 원본과 SHA-256.
- `cp-model.mjs`, `cp-model-batched.mjs`: 단계별/묶음 exact CP-SAT 모델.
- `cp-one.mjs`, `cp-batched-one.mjs`, `rust-one.mjs`: 단일 행렬 실행기.
- `bench.mjs`, `extra.mjs`: 새 프로세스의 순차 비교 및 시간 제한.
- `benchmark.json`, `extra-results.json`, `summary.json`: 80회 비교와 집계.
- `model-tests*.mjs`, `model-tests*.json`: 완전탐색 및 동률 검증.
- `browser/`, `browser-results.json`: browser용 WASM 및 worker 검증.
- `production-source-hashes.json`: 운영 소스·WASM 해시. 직전 profiling 시점과 동일함을 확인했다.

CP-SAT 프로토타입은 검증용이며 운영 API·기본값에 연결하지 않았다. 커밋·푸시·배포는 수행하지 않았다.
