# Saves 추가 최적화 조사·계획 — 2026-09-21

후속 상태: outcome-only 탐색과 압축 전송을 구현하여 기본 saves 경로에 적용했다. 이 문서의 실측·호출 경로는 구현 전 조사 기록이며, 변경 후 결과는 [구현 검증 보고서](SAVES_OUTCOMES_IMPLEMENTATION_20260921.md)를 참조한다.

## 결론

saves는 최소 해답 조합이나 품질 최적성을 요구하지 않는다. 필요한 결과는 각 입력 큐에서 가능한 정확한 save multiset의 집합과 그 집합에 대한 표현식 평가다. 현재는 모든 기하 해답과 큐별 정확한 orderCount까지 계산한 뒤 이 정보를 대부분 버린다.

따라서 우선순위는 **saves 전용 save 결과 존재성 탐색 → 압축 전송·집계 → 표현식 평가 개선**이다. minimals secondary의 CP-SAT 도입이나 7개 필터 반복 실행은 이 문제의 직접 해결책이 아니다.

이번 작업은 코드 조사, 기존 코드 계측 및 후속 계획 수립이다. 운영 로직은 변경하지 않았다. 원자료와 스크립트는 `D:/AI/sfinder-wasm/tools/validation/saves-plan-20260921/`에 있다.

## 현재 호출 경로와 불필요한 계산

`src/saves-feature.mjs`의 `calculateSaves`는 다음 순서다.

1. 패턴 전개 및 마지막 bag 메타데이터 준비.
2. `visitCaseSolutions` → `enumerateCases` → 넓은 패턴에서는 `enumeratePcPattern` 호출.
3. Rust `enumerate_pc_pattern_packed`에서 multiset DAG 구성, 기하 경로 복원, 기하 해답별 가능한 order 수집, order별 큐 coverage, 큐별 orderCount 계산.
4. JS에서 각 기하 해답의 미노 사용 개수를 구해 큐별 `Set<saveCode>`에 추가.
5. `ALL`은 save별 등장 큐 수를 집계하고, 지정 표현식은 큐별 전체 save 집합에 평가.

saves의 visit callback은 `hit.orderCount`를 사용하지 않는다. 하지만 현재 Rust와 JS 전송은 이를 계산·읽기·검증한다. JS는 기하 배치 자체도 출력하지 않고 미노 사용 개수만 사용한다.

현재 이미 적용된 공유는 유지해야 한다. 여러 wantedSave 표현식은 한 번의 공통 열거로 처리되고, 패턴 분기 bag 메타데이터 공유도 이미 적용돼 있다. 이를 새 개선으로 주장하지 않는다.

## 실측

i5-1240P, Node v24.13.0, clear=4, Hold=true, wantedSave=ALL. 매번 새 프로세스/solver, solver 초기화 제외. 작은 네 조건은 각 3회 중앙값이며 출력 hash가 반복 간 일치했다. 계측 로그 및 진단 overhead가 포함되므로 소수 ms 차이는 의미를 부여하지 않는다.

| 셋업 / 패턴 | saves 전체 | enumeratePcPattern | 기하 해답 수 | 해답–큐 연결 수 | 최종 save–큐 쌍 |
|---|---:|---:|---:|---:|---:|
| ALT SHOES / `*!` | 97.1ms | 74.4ms | 37 | 24,348 | 10,696 |
| ALT SHOES / `[IJL]p3,*p4` | 195.9ms | 167.0ms | 564 | 119,448 | 14,090 |
| ALT JAWS / `[IJL]p3,*p4` | 201.1ms | 167.9ms | 871 | 124,774 | 15,300 |
| complete-row 회귀 / `T,*p3` | 12.7ms | 5.5ms | 18 | 356 | 326 |

`enumeratePcPattern` 시간은 Rust 열거와 JS 해답/coverage 객체 변환을 합친 값이며 순수 Rust 시간으로 해석하면 안 된다.

ALT SHOES의 split에서는 564개 기하 해답이 **54개 미노 사용 개수 조합**으로 줄어든다. ALT JAWS는 871개에서 **61개 조합**이다. save는 이 사용 개수 조합과 큐/마지막 bag 정보만으로 결정되므로, 서로 다른 배치를 끝까지 구분할 필요가 없다. 다만 같은 사용 조합이라도 실제 배치 및 순서의 가능성이 다르므로 큐 호환성 확인 없이 병합해서는 안 된다.

전체 독립 `*p3,*p4`는 별도 1회씩 진단했다.

| 셋업 | saves | PC 존재성 canPcPatternMany |
|---|---:|---:|
| ALT SHOES | 15초 제한 미완료, 열거 중 | 0.582초 |
| ALT JAWS | 15초 제한 미완료, 열거 중 | 0.766초 |

각 176,400큐이며 존재성 성공은 각각 149,754와 158,994다. saves가 중단되어 같은 입력의 전체 save 결과를 대조한 것은 아니다. **존재성은 큐마다 Boolean 하나만 반환하므로 saves의 대체품도, 새 saves의 예상 속도도 아니다.** 다만 기하 해답·품질 없이 가능한 순서 집합을 압축 처리하는 기존 경로가 실제로 훨씬 저렴하다는 근거다.

complete-row 입력은 `v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH`, saves `T,*p3`, ALL에서 기존 수정대로 190/210을 유지했다.

## 제안 1 — 사용 미노 조합별 존재성 결과를 직접 계산

가장 큰 구조적 개선 후보다.

현재 필요한 수학적 결과는 다음과 같다.

- U: 사용한 미노 종류별 개수 조합.
- C(U): U로 PC를 완성할 수 있는 배치 순서가 하나 이상 존재하는 입력 큐의 집합.
- 각 큐 c의 save 결과 = `마지막 bag의 미추출 미노 + 큐의 미노 개수 − U`, 단 c가 C(U)에 포함될 때만 추가.

같은 U의 여러 기하 배치는 그 가능한 순서들의 **합집합**으로 충분하다. 순서 개수나 각 배치의 geometry key가 필요하지 않다.

구현 후보:

1. 기존 `pattern_multiset_roots` 및 `build_multiset_dag`로 기하 상태를 공유한다.
2. 기하 경로를 개별 해답으로 복원하는 `collect_flat_dag_paths` 대신, 기존 `OrderLanguage`와 같은 성공 순서 압축 표현을 이용한다.
3. 현재 PC 존재성은 여러 root의 순서를 하나로 합치지만, saves에서는 **사용 개수 조합 U별 root 식별을 유지**한다. 공통 suffix 노드·DAG는 공유한다.
4. QueueTrie와 Hold 상태를 따라 U별 큐 coverage를 구한다.
5. U별 큐 비트셋 또는 큐별 sparse outcome 코드만 WASM에서 반환한다. JS는 마지막 bag 의미와 기존 출력 계약에 맞춰 합산한다.

이 방식은 기하 해답 객체, 해답별 key, 각 큐의 orderCount, 기하 해답별 큰 coverage 행렬을 생략할 수 있다. 기존 PC 존재성 코드를 그대로 호출하면 사용 개수 정보가 소실되므로 수정 없이 재사용할 수는 없다.

모든 U를 따로 다시 탐색하는 방식은 피한다. 한 번 만든 DAG/순서 표현을 공유해야 한다. U별 결과를 밀집 비트셋으로 전부 저장하면 넓은 패턴에서 메모리가 커지므로 sparse/dense 선택 또는 U별 스트리밍도 비교한다. 표현 압축 예산 소진 시 정확한 기존 열거로 fallback하며 부분 결과를 확정하지 않는다.

## 제안 2 — 실제 남는 미노가 하나인 경우의 특수 경로

큐 길이가 필요한 배치 수+1이면 가능한 실제 잔여 미노는 7종뿐이다. 큐를 포함한 구조적 DAG에서 각 상태가 도달할 수 있는 잔여 미노 비트마스크를 OR로 계산하는 경로를 검토한다.

`single_queue.rs`에는 과거 Top-K 코드에서 쓰던 `reachable_save_mask` 아이디어가 남아 있다. 이것은 재사용 가능성을 살펴볼 자료이며, 오래된 함수를 호출하는 것만으로 구현이 끝나는 것은 아니다. 정확한 구조적 DAG와 초기 완성 줄 정규화·Hold·physics 계약을 검증해야 한다.

한 큐당 가능한 잔여 미노를 u8로 표현하면 176,400큐 결과가 약 172KiB다. 이후 마지막 bag의 미추출 미노를 합쳐 일반 saves 문자열로 변환한다. **saves 최종 출력 자체가 항상 한 미노라는 뜻은 아니다.** `[IJL]p3,*p4`의 마지막 bag 정보 때문에 여러 미노 또는 중복 미노 save 문자열이 생길 수 있다.

더 긴 큐나 일반 multiset 결과는 제안 1의 일반 경로를 사용한다. 단일 큐 scalar와 넓은 패턴 공유 경로를 실제로 비교해서 선택한다. 같은 입력 큐에서 특정 미노를 임의로 제거하고 기존 PC Boolean만 호출하는 것은 Hold 순서를 바꿀 수 있으므로 동등한 대체가 아니다.

## 제안 3 — compact 전송은 작은 중간 개선으로 분리

Rust의 새 존재성 경로가 준비되기 전에, 현재 object 기반 `enumeratePcPattern` 대신 owned compact buffers를 소비하는 실험은 가능하다.

- 기하 마스크의 popcount로 usage만 읽고 geometry key/해답 객체는 만들지 않는다.
- 큐별 객체 `{caseIndex,orderCount}`를 대량 생성하지 않고 CSR caseIds를 순회한다.
- saves는 quality를 사용하지 않으므로 장기적으로 quality buffer도 생략하는 WASM export를 둔다.

단, 현재 `enumeratePcPatternCompact`도 내부적으로 같은 Rust 전체 열거·orderCount 계산을 수행한다. **이 변경만으로 전체 split의 15초 병목이 해소된다고 기대하면 안 된다.** 준비·전송·GC 비용을 줄이는 보조 단계다. 이번에는 compact 대체의 성능을 측정하지 않았다.

## 제안 4 — 큐별 save 집합과 표현식 평가 최적화

현재 `compileSaveOutcomeExpression`은 AST를 한 번 파싱하지만, 평가 때 atom/group마다 Set을 만들며 regex atom은 `new RegExp`를 반복한다. `calculateSaves`는 모든 큐에 Set을 미리 만들고 save code를 문자열로 반복 변환한다.

개선 후보:

- RegExp는 컴파일 단계에 생성하여 재사용하고 saveCode→문자열 변환은 요청 내 memoization.
- 실제 잔여 1미노 특수 경로에서는 큐별 Set 대신 u8 가능성 마스크.
- 일반 경로에서는 요청에서 나타난 정확한 save code에 짧은 ID를 부여하고 outcome 집합을 비트셋 또는 작은 sparse 배열로 표현.
- atom/regex가 매칭하는 outcome ID 집합을 사전 계산하고, 기존 집합 연산을 비트 연산으로 치환.
- 같은 outcome 집합이 여러 큐에서 반복되면 표현식 결과를 요청 내 캐시한다. 출력 failedQueues 순서·중복은 원래 큐 순서에서 재생성한다.
- 전체 일반 save를 7비트 존재 집합으로 축약하지 않는다. `T`와 `TT`는 서로 다른 결과이고, 기존 multiplicity 코드의 큰 개수 string fallback도 보존한다.

여러 wantedSave를 한 번에 평가하는 공유 열거는 이미 구현돼 있다. 새로 필요한 것은 그 이후의 반복 집합·문자열 연산 감소다.

## 제안 5 — 조건부 조기 종료와 중복 큐 공유

- `ALL`은 모든 가능한 save 결과가 필요하므로 첫 PC 발견만으로 큐 처리를 끝내면 안 된다.
- 양의 atom/regex 및 `&&`, `||`로 구성된 표현식처럼, 결과 추가에 대해 성공이 유지됨을 증명할 수 있는 경우에만 성공 후 조기 종료를 검토한다.
- `!T`처럼 T가 어느 해답에도 없다는 조건은 미탐색 결과가 없음을 확인해야 한다. 미완료 상태에서 성공 처리하면 안 된다.
- 동일한 물리 큐는 탐색을 공유할 수 있지만, 같은 큐 문자열이라도 패턴 분기의 마지막 bag 메타데이터가 다르면 최종 saves는 달라질 수 있다. raw queue coverage와 branch별 save 해석을 분리하여 remap한다.
- 병렬화는 사용 조합·큐 그룹 간 독립 부분과 메모리를 확인한 뒤 적용한다. 문자열 큐를 단순 분할하면 DAG/순서 상태 공유를 잃을 수 있다.

## 반드시 보존할 saves 의미

saves는 minimals의 scalar 필터와 다르게 한 큐에서 가능한 **전체 결과 집합**을 평가한다. 예를 들어 결과가 `{I,J}`이면 `I&&J`는 성공할 수 있으나 `IJ`는 실패한다. `^I`와 `!I`도 다르다. 현재 queue-level 혼합 연산자는 왼쪽부터 결합하며 scalar minimals의 연산자 우선순위와도 다르다.

따라서 “wanted 미노 하나만 찾으면 된다”는 일반화나 minimals의 scalar predicate 재사용은 잘못된 최적화가 된다. 표현식·alias·regex 안의 쉼표·중복 미노·empty outcome을 기존 테스트와 대조해야 한다.

## 권장 실행 순서와 검증

1. 정확한 outcome-only API를 검증용으로 구현한다. req+1 단일 잔여 경로와 multiset-root별 순서 존재성 경로를 비교한다.
2. cycle1 `*!`와 제한 split, complete-row 회귀 및 중복 save·집합 표현식 fixture에서 기존 전체 결과와 대조한다. Hold on/off, 2~6줄, branch metadata 차이도 포함한다.
3. 전체 독립 `*p3,*p4`에서 노드 수·order 표현 크기·큐/outcome pair 수·peak 메모리·단계 시간 및 미완료율을 측정한다. baseline이 미완료인 입력은 제한 부분집합/별도 참조 솔버로 검증 근거를 확보한다.
4. 전송·집계와 표현식 최적화를 적용하고, 여전히 필요한 부분만 병렬화한다.

운영 적용 전에는 기존 결과 의미를 보존하고, 결과가 동일함을 확인한 입력에서만 성능 개선을 주장한다. BOX와 모바일/에뮬레이션 제외 조건은 유지한다.
