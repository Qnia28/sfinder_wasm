# Per-save 실측 병목과 후속 최적화 계획 — 2026-09-21

현재 병목은 보통 primary가 아니라 **exact secondary의 10만 상태 사전 탐색과 최적성 증명**이다. 그러나 전체 `*p3,*p4`에서는 그 앞의 **후보 열거**도 별도의 큰 병목이다. 필터 작업만 병렬화하는 방향은 실측상 유효하다. 단, worker 수 증가만으로 어려운 exact 문제까지 해결되지는 않는다.

## 측정 조건

- 대상: `D:/AI/sfinder-wasm/release3.0-20260906`, Wave 1·2 최적화와 complete-row 수정이 반영된 현재 소스/WASM.
- CPU: Intel Core i5-1240P, 12코어/16논리 프로세서.
- Node v24.13.0, Chrome 154, 데스크톱. 모바일/에뮬레이션 및 BOX 제외.
- Hold=true, clear=4, exactHumanQuality=true, Primary=Auto. primary 정책 및 ORTools 2-worker 설정은 변경하지 않았다.
- Node 단계 측정은 새로운 프로세스·solver마다 실시한 3회 중앙값. solver 초기화 약 29–35ms와 Fumen 출력 인코딩은 제외하고, 실제 feature와 동일하게 includeCoverage=false로 계산했다.
- Chrome은 실제 `SolverWorkerClient`의 `per-save-minimals` 요청을 매번 새 client로 호출했다. Worker 초기화, 계산, Fumen 출력, 응답 수신까지 포함하며 화면 렌더링은 제외한다. 페이지 및 정적 자산은 재사용했다. 각 조건 3회, 순서를 교대했다.
- 운영 코드를 수정하지 않고 외부 검증 폴더의 소스 복사본에 계측했다. 사전 탐색 예산 변경도 이 복사본에서만 실행했다. 새 문서 외 운영 파일 변경 없음.
- 원자료: `D:/AI/sfinder-wasm/tools/validation/per-save-profile-20260921/`. `results.json`, `experiments.json`, `hard-results.json`, `browser-results.json`, `summary.json`, `source-hashes.json` 및 실행 스크립트 포함.

## 1. 실제 오래 걸리는 단계

아래는 현재 기본값 secondaryWorkers=auto이다. auto는 2개의 worker에 threshold fallback만 넘기고, integrated 사전 탐색은 메인 solver에서 순차 실행한다.

| 셋업 | 패턴 | 전체 계산 | 후보 열거 | primary 합계 | 순차 사전 탐색 합계 | worker threshold 작업시간 합계 |
|---|---|---:|---:|---:|---:|---:|
| ALT SHOES | `*!` | 100ms | 53ms | 아래 설명 | 해당 없음 | 해당 없음 |
| ALT SHOES | `[IJL]p3,*p4` | 1,199ms | 128ms | 6.5ms | 510ms | 702ms |
| HILLS + HEART | `[IJL]p3,*p4` | 1,698ms | 121ms | 6.5ms | 467ms | 1,498ms |
| Elephant + J | `[IJL]p3,*p4` | 1,680ms | 116ms | 5.3ms | 447ms | 1,871ms |
| CLIFF + O | `[IJL]p3,*p4` | 1,414ms | 83ms | 5.3ms | 471ms | 1,262ms |
| 91.03% / pcinfo-019 | `[IJL]p3,*p4` | 1,101ms | 73ms | 4.7ms | 398ms | 827ms |
| 91.03% / pcinfo-019 | `*!` | 346ms | 37ms | 3.1ms + tiny 통합 처리 | 145ms | 33ms |

**동시 실행되는 worker 작업시간의 합은 전체 경과시간에 더하면 안 된다.** primary 수치는 kernelize를 포함한다. 단계별 중앙값을 각각 구했으므로 표의 수치를 단순 합산해 전체 중앙값을 재구성할 수도 없다.

ALT SHOES `*!`는 작은 후보 집합용 primary+quality 통합 경로가 합계 약 11ms에 끝난다. 분할 패턴 5개에서는 primary가 모두 전처리 kernel에서 해결되어 HiGHS/ORTools 탐색까지 가지 않았다. 따라서 이 표는 모든 가능한 입력의 primary 비용이 작다는 증명이 아니라, 실제 측정한 느린 사례에서 primary 멀티스레딩의 우선순위가 낮다는 근거다.

그 밖의 후보 분배·정렬은 분할 패턴에서 약 31–43ms, 패턴 전개는 약 5ms였다. 최근 JS 객체 할당·Rust 버퍼 개선 이후에도 남은 큰 비용은 exact 탐색이다.

### 세이브별로 무거운 항목

`[IJL]p3,*p4`, 기본 auto, 각 3회 중앙값. 아래 숫자는 해당 필터의 worker threshold 실행 시간이며 대기 시간은 제외한다.

| 셋업 | 무거운 세이브 | threshold 실행 시간 |
|---|---|---:|
| ALT SHOES | Z, L | 213ms, 181ms |
| HILLS + HEART | O, S, I | 504ms, 348ms, 231ms |
| Elephant + J | I, Z, L | 815ms, 366ms, 304ms |
| CLIFF + O | I, T, Z | 384ms, 313ms, 284ms |

primary의 최소 해답 수 K가 큰 필터가 언제나 가장 느린 것은 아니다. 예를 들어 HILLS + HEART에서는 I의 K=61보다 O의 K=29가 더 오래 걸렸다. 품질 분포와 exact 증명 구조가 중요하다.

### ALT JAWS: 병렬화만으로 해결되지 않는 사례

`[IJL]p3,*p4`는 5,040큐이고 후보 열거는 약 128ms에 끝났다. 이후:

- 기본 auto: T threshold만 8.55초, 347,237상태. 요청을 30초에서 외부 중단했을 때 I와 L 작업은 미완료였다.
- 필터 전체를 4-worker로 분배: 역시 요청 30초 제한을 초과했다. L threshold는 891,619상태를 탐색했고, I와 S 작업이 미완료였다.
- 4-worker + integrated 예산 1,000 실험: 역시 요청 30초 제한을 초과했다.

이 세 실행은 각 1회 진단이다. 완료 시간을 추정하거나 예산 변경의 성능 우열을 단정할 수 없다. 다만 exact threshold 자체가 수십 초 수준의 병목이고, worker 증가나 사전 탐색 축소만으로 해결되지 않는다는 점은 확인됐다. 외부 테스트 중단이며 제품에 timeout/근사 결과를 도입한 것이 아니다.

## 2. 기본 auto의 순차 구간

`src/min-cover-exact-secondary.mjs:2`는 integrated 사전 탐색을 100,000상태로 고정한다. `src/exact-secondary-pool.mjs:94`의 auto는 onlyHeavy=true이므로 이 탐색이 끝나지 않은 필터의 threshold 부분만 worker로 넘긴다.

ALT SHOES에서는 7개 중 S만 사전 탐색으로 완료하고, 나머지 6개는 각각 100,000상태를 소비한 뒤 fallback했다. 사전 탐색 합계는 약 510ms다.

Node 계측에서 첫 worker 실제 dispatch는 요청 시작 약 801ms 후였고, 마지막 메인 사전 탐색은 약 727ms에 끝났다. HILLS + HEART는 각각 약 739ms와 666ms였다. 풀은 submit 시 비동기로 module을 준비하고 worker를 생성한다. 메인 스레드의 연속 동기 탐색 동안 비동기 시작/ready 처리가 진전되지 않아, 이 실행들에서는 7개 필터 사전 탐색 뒤에야 worker 작업이 시작됐다. 이 구체적 시간축은 Node 계측 결과이며 Chrome의 세부 시간축을 별도로 계측한 것은 아니다.

## 3. 이미 가능한 설정 변경의 효과

숫자 workers=2 또는 4는 integrated+threshold 전체 secondary를 worker에 넘긴다. 따라서 auto와 숫자 2의 차이는 worker 수가 아니라 **분배하는 작업 범위**다.

### Chrome의 실제 per-save 요청

| 셋업 / `[IJL]p3,*p4` | 현재 auto | 전체 secondary 2-worker | 전체 secondary 4-worker | auto 대비 4-worker 단축 |
|---|---:|---:|---:|---:|
| ALT SHOES | 1.172초 | 0.988초 | 0.802초 | 31.6% |
| HILLS + HEART | 1.718초 | 1.550초 | 1.081초 | 37.1% |

18회 호출 모두 셋업별 전체 응답이 동일했고 브라우저 오류가 없었다. 출력 Fumen도 포함한 비교다.

Node 계산 단계 중앙값도 같은 방향이었다.

| 셋업 | 직렬 0 | 현재 auto | 전체 2 | 전체 4 |
|---|---:|---:|---:|---:|
| ALT SHOES | 1.362초 | 1.199초 | 1.031초 | 0.842초 |
| HILLS + HEART | 2.053초 | 1.698초 | 1.663초 | 1.126초 |

39회 기본 계측에서 같은 셋업·패턴의 모든 worker 설정과 반복 결과 hash가 일치했다. 4-worker에서는 각 작업의 실행 시간이 늘어나는 경우도 있었으나 동시 실행으로 전체 대기 시간이 줄었다. 메모리 및 CPU 경쟁을 고려해 무조건 7-worker로 늘릴 근거는 없다.

## 4. 사전 탐색 예산 축소 실험

계측 복사본에서 integrated 예산만 100,000→1,000으로 변경했다. threshold exact 증명은 무제한으로 유지했고, 최소 개수·품질·stable-ID 선택 규칙을 바꾸지 않았다.

| 셋업 | 현재 auto, 예산 100,000 | auto, 예산 1,000 | 전체 4-worker, 예산 1,000 |
|---|---:|---:|---:|
| ALT SHOES | 1.199초 | 0.788초 | 0.653초 |
| HILLS + HEART | 1.708초 | 1.279초 | 0.955초 |

새 프로세스 3회 중앙값이다. 기본 auto 열은 같은 실험 묶음의 미계측 운영 소스 실행이다. 1,000 예산 두 열은 계측 복사본이고, Chromium 측정값이 아닌 Node 계산 시간이다.

위 2개 외 Elephant + J, CLIFF + O, pcinfo-019까지 총 5개 셋업에서 완료된 26개 결과를 비교했다. backend 진단 필드만 제외한 전체 결과가 일치했다. 큐별 성공률, 최소 해답 수, 선택 key/해답 순서, 품질 벡터를 포함한다.

이것은 예산을 무조건 1,000으로 고정할 근거가 아니다. integrated가 조금 더 탐색하면 쉽게 끝나는 입력이나, 충분히 좋은 seed를 만든 뒤 threshold에 넘기는 것이 유리한 입력도 있을 수 있다. 또한 ALT JAWS 난제는 이 변경으로 해결되지 않았다. **실측 기반의 조기 전환 정책**으로 검증할 가치가 크다는 결론이다.

## 5. 전체 `*p3,*p4`는 후보 열거 문제도 따로 해결해야 한다

사용자가 지정한 두 구간 독립 패턴이며, 구간 사이 미노 중복을 허용한다.

| 패턴 | 큐 개수 | req=6, Hold에서 탐색하는 사용 미노 multiset root 수 |
|---|---:|---:|
| `*!` | 5,040 | 7 |
| `[IJL]p3,*p4` | 5,040 | 80 |
| `*p3,*p4` | 176,400 | 357 |

root 수는 현재 `pattern_multiset_roots`와 같은 규칙으로 계산했다. 보드 도달 가능성을 적용하기 전의 개수다. 두 번째 행은 전체 독립 패턴을 대신하는 벤치마크가 아니라 제한된 별도 패턴이다.

현재 빌드에서 전체 `*p3,*p4`를 ALT SHOES 및 ALT JAWS에 각각 실행했다. 두 실행 모두 30초 제한 시점까지 `enumeratePcPatternCompact`에서 반환하지 않았고, secondary는 시작하지 않았다. 패턴 전개 자체는 각각 약 36ms와 42ms였다. 따라서 문자열 전개/Set 할당을 더 줄이는 것으로 30초 이상의 대기를 해결할 수 없다.

`rust/pc-core/src/pattern.rs:415` 이하에는 이미 multiset DAG 공유와 QueueTrie가 있다. 후보 열거를 큐별 독립 탐색으로 바꾸거나 단순히 7개 save별로 같은 열거를 반복하는 것은 중복 작업을 늘릴 수 있다. 이번 계측은 외부 열거 함수 단위이므로, 내부 DAG 구성/경로 복원/order coverage 계산/큐별 quality 누적 중 어느 단계가 가장 느린지는 아직 확정하지 않았다.

## 6. 권장 구현 순서

1. **보통 크기의 분할 입력: secondary 전체 작업 분배를 우선 개선한다.** 작은 tiny-exact 경로는 유지하고, 충분히 무거운 필터가 여러 개면 integrated+threshold 전체를 2–4개 worker로 보낸다. 데스크톱에서는 4개가 유효했다. primary는 현재 정책을 유지한다. 작업량 추정에 따른 무거운 작업 우선 실행도 검토하되 표시 순서·stable-ID 결과는 유지한다.
2. **10만 상태 사전 탐색의 조기 전환 기준을 검증한다.** 1천/1만/10만 예산과 threshold 직접 진입을 비교하고, matrix 크기·K·탐색 진척·seed 개선 정도 등을 평가한다. 정확한 최종 증명은 유지하면서 실패할 사전 탐색에 쓰는 시간을 줄이는 것이 목적이다. 완료 사례뿐 아니라 ALT JAWS 등의 난제에서 회귀가 없는지 확인한다.
3. **worker 준비 지연과 반복 초기화를 줄인다.** 작업이 무겁다고 판정되면 synchronous probe 전에 worker를 준비하고, 필요하면 이벤트 루프에 실행 기회를 준다. 요청 간 풀 재사용은 취소·오류 복구·WASM 메모리 정리까지 설계한다. 이번 결과에서 초기화만 줄이는 것보다 작업 분배 범위와 probe 비용 개선의 기대 효과가 크다.
4. **ALT JAWS급 exact 난제: threshold와 최종 stable-ID 동률 증명을 나누어 계측한다.** 현재도 하한/품질 상한/정적·동적 dominance/lexicographic 가지치기가 있다. 이것들을 새로 도입한다고 표현하면 안 된다. 어느 가지치기가 비싸고 약한지, 동일 상태가 반복되는지 확인한 뒤 상한 강화·분기 순서·안전한 memoization을 개선한다. memo key에는 단순 covered뿐 아니라 남은 후보, 남은 선택 수, 이전 품질 목표 및 동률 의미를 반영해야 한다. 하나의 필터가 여전히 대부분의 시간을 차지하면 그 exact 탐색의 상위 분기를 나누는 병렬화를 별도 검토한다. 모든 분기 증명과 결정적 병합이 필요하다.
5. **전체 `*p3,*p4`: 열거 내부 4단계 계측을 별도 우선 과제로 둔다.** DAG 구성, 경로 복원, order→queue coverage, quality 누적의 시간·노드·order·edge 수를 기록한다. 결과에 따라 queue 호환성을 더 일찍 적용하거나 order 집합을 압축하는 방향을 검토한다. 여러 기하 경로로 같은 order가 생겨도 quality를 중복 계산하면 안 된다. multiset root 단위 병렬화는 가능성은 있으나 공유 상태 중복과 peak 메모리를 먼저 비교해야 한다.

최근 버퍼·해시 최적화는 보조 수단이다. 현재 자료에서 더 큰 효과를 확인한 방향은 **불필요하게 긴 사전 탐색 감소, secondary 전체 작업 분배**, 그리고 **수십 초 난제의 exact 증명 및 전체 독립 패턴의 열거 구조 개선**이다. 이번 작업은 분석·격리 실험이며 운영 기본값은 변경하지 않았다.
