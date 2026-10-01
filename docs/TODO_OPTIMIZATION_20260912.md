# 2026-09-12 TODO 구현 계약

이번 변경은 배포 전 로컬 작업본에 적용했다. 원격 commit/push나 배포는 수행하지 않았다.
요청에 따라 모바일(에뮬레이션 포함)과 3×4 BOX 8P는 검증에서 제외한다.
측정·검증 원본은 `D:/AI/sfinder-wasm/tools/validation/todo-20260912/RESULT_KO.md`를 참조한다.

## 1. 요청 수명과 전송 — B2/B7/B11

동일 WASM exports를 사용하는 wrapper들이 세션 깊이와 staging 상태를 공유한다.
큐 값 스냅샷과 WASM generation이 모두 유효할 때만 큐 handle을 재사용한다.
다른 wrapper의 reset·세션 종료·예외 이후에는 다시 staging한다. JS 입력 배열의 변경도 검출한다.
중복 큐는 한 번만 packing하고 원래 위치로 remap한다. semicolon 중복의 가중치와 실패 목록 순서는 유지한다.
성공한 unique 큐 수의 4배가 전체 unique 큐 수보다 작으면 u32 인덱스, 그 외에는 dense u8 bitmap을 읽는다.
Congruent operation·order와 Cover 결과는 owned 버퍼로 복사한다. WASM memory growth나 다음 호출에 의해 이전 결과가 바뀌지 않는다.
구형 WASM의 bulk/handle export가 없으면 기존 getter/staging 경로를 사용한다.

## 2. 정확 tiling과 순서 엔진 — B1/B3/B4/B5/B8

5개 이상의 미노에서 placement ID·cell 역색인·active bitset·후보 수·undo log로 incremental MRV를 사용한다.
4개 이하는 작은 입력의 비용을 줄이기 위해 기존 scalar MRV를 사용한다. 후보 방문 순서를 보존한다.
root multiset은 (piece, 필요한 수)별 비트셋으로 교차한다.
남은 빈 공간의 4방향 연결 성분 면적이 4의 배수가 아니면 배제한다. 가로 행 경계를 넘는 연결은 허용하지 않는다.
negative memo는 (남은 fill, 사용한 미노 수)별 기하학적 불가능성만 보관하며 최대 65,536개다.
큐/physics 때문에 실패했거나 이미 출력한 해를 기하학적 실패로 기록하지 않는다. 성공한 색칠을 fill만으로 합치지 않는다.

순서 엔진은 작은 입력의 cached Boolean trie, 상태별 frontier, canonical successful-suffix language를 비교했다.
기본값은 7 operations 이하 cached Boolean, 8개 이상 suffix language다. scalar queue 판정과 frontier DFS는 비교 가능한 진단 경로로 남긴다.
suffix 상태는 board·남은 operation ID·원래 행 복원을 위한 cleared 정보·Queue/Hold frontier를 포함한다.
TETRIO/Jstris exact-lock을 그대로 호출하며 일반 Congruent의 terminal 판정에만 적용한다. Cover trace/mode 판정을 대신하지 않는다.
표현 예산 200,000 상태 및 관련 frontier 제한 소진은 unknown이다. 부분 언어를 반환하지 않고 기존 정확 Boolean 엔진으로 재실행한다.
이 기준은 이번 desktop corpus의 경험적 선택이며 모든 입력의 최적 엔진이라는 주장이 아니다.

## 3. 한도와 출력 선택 — B6/B9/B10

`calculateCongruent`와 `calculateCongruentCover`의 `maxSolutions` 기본값은 20,000이다.
유효 범위는 1..4,294,967,294이며, Rust와 JS 모두 **큐 필터를 통과한 고유 해**를 센다.
정확히 한도만큼인 결과는 성공한다. 다음 수락 해가 발견되면 `CongruentLimitError`를 발생시킨다.
직접 호출의 오류에는 `limit`, `unit: 'accepted-solutions'`, `exhausted: true`가 있다.
Worker는 기존 오류 계약대로 name/message를 전달한다. 잘린 결과를 완전한 결과처럼 반환하지 않는다.
별도의 저수준 `enumerateTilings` 한도는 기하학적 tiling 단위다.

| API | outputMode | 계약 |
|---|---|---|
| congruent-cover | `variants` (기본) | 기존 Fumen·solutions·orders/variants·실패 목록 유지 |
| congruent-cover | `coverage` | Fumen·solutions·target orders/variants 생략, 정확 coverage와 failedQueues 유지 |
| congruent-cover | `count` | 큐 목록 없이 정확 가중 합계와 target별 coverage, Fumen/solutions/failedQueues 생략 |
| cover-percent | `queues` (기본) | 기존 결과와 Fumen 유지 |
| cover-percent | `count` | Cover/Chance의 가중 prefix 계산, 행별 exact 합계 추가, Fumen 유지 |

count 출력은 안전한 정수 범위에서는 숫자, 초과하면 십진 문자열을 사용한다. `*Exact` 필드는 항상 십진 문자열이다.
target/mirror는 합집합으로 계산하고 semicolon 중복은 가중치로 유지한다. count 정렬은 BigInt로 비교한다.
Congruent의 TETRIO 적합성 확인 후 Cover의 Jstris 판정을 별도로 적용한다.
Congruent count의 소비 가능한 unique prefix는 최대 1,000,000개이며 초과하면 명시적인 패턴 한도 오류다.
`maxBatchPrefixes`는 1..1,000,000, 기본 65,536이다. 큰 suffix 공간을 다룬다고 모든 큰 prefix 공간을 무제한 지원하는 것은 아니다.

## 4. Chance와 최선해 — L3a/L3b/L4

Chance 기본 queues 출력은 PC가 소비할 수 있는 prefix를 풀고 실패한 prefix에서만 전체 실패 큐를 복원한다.
공통 패턴 제약·순서·중복과 MAX_PATTERN_CASES=1,000,000 제한을 유지한다.
생략할 suffix가 없는 경우에는 기존 concrete expansion을 사용해 closure 생성 비용을 줄인다.
한 요청의 count/queues 배치에서 normalized board와 정렬된 multiset roots가 같은 immutable DAG를 재사용한다.
보관 한도는 32 MiB/64개 그룹이고 최외곽 세션 종료 및 예외 시 해제한다. 이는 보관 한도이며 탐색 전체의 peak heap 제한은 아니다.
서로 다른 배치의 실제 queue trie는 재생성한다. 큐 구조 전체를 영구 저장하거나 요청 결과를 캐시하지 않는다.

solve-one과 단일 큐 per-save-best는 색칠별 suffix language를 공유해 distinct playable-order count를 정확히 계산한다.
최대 order count, 동점의 안정적인 key 선택을 유지한다. 첫 해에서 종료하거나 후보 16개로 자르지 않는다.
기본 압축은 필요한 미노가 6개 이상이고 DAG의 경로 수가 100,000 이상일 때 사용한다.
200,000 상태/언어 노드와 500,000 geometry-map 항목 예산에 도달하면 동일 DAG에서 기존 전체 order 집합 방식으로 fallback한다.
안전한 품질 상한으로 후보를 배제하는 새 규칙은 추가하지 않았다. 이번 L4 구현은 정확한 표현 공유이며, 모든 geometry 탐색의 생략을 뜻하지 않는다.

## 5. oracle 검토와 강제 fallback

B12 검토 결과, PC legal/tail을 일반 batch 목표의 대체 oracle로 사용할 수 없다.
예를 들어 빈 4줄 보드에서 큐 O는 PC 완성을 못 하지만 같은 보드의 정확 O target은 Jstris/TETRIO Cover 모두 성공한다.
PC 불가능성을 그대로 batch 실패로 사용하면 이 정답을 잃는다. `tests/todo-budget.test.mjs`에 반례를 고정했다.
증명 가능한 공통 최적화인 기하학적 연결 성분 검사만 적용하고 physics exact-lock은 유지한다.
별도의 PC geometry 상태 예산을 0/2로 강제 소진해 PATH fallback이 기본 경로와 같음을 검증했다.

## 6. 계측과 실행 범위 — M1/M2

정상 배포 WASM의 batch 진단 카운터는 feature 미설정으로 컴파일에서 제거된다.
진단 전용 batch WASM, JS 복제본, Rust PC 복제본은 tools/validation 아래에 둔다.
PC 복제본의 host phase hook은 DAG 생성과 geometry/order 복원을 분리한다. 정상 PC WASM에는 host hook이 없다.
JS 함수 self/inclusive time, WASM ABI 호출, 파일 읽기/instantiate, 초기화, 행렬 준비, solver, Fumen encode/decode/Field 비용을 기록한다.
진단 카운터는 tiling node, multiset/component/negative reject, exact-lock/spin calls/hits, DAG nodes/edges, frontier/fallback, staging, bulk words, language nodes, prefix reject다.
진단 결과에는 WASM committed memory high-water와 프로세스 메모리 표본을 포함한다.
PC 기존 stats는 cold/warm 누적 카운터이며 batch 카운터는 각 요청 전 reset한다.
Node RSS는 프로세스 전체 표본, Chrome JS heap은 페이지 표본으로 Worker heap이나 전체 peak RSS를 뜻하지 않는다.
프로파일링은 계측 오버헤드가 있고 wall time 중첩 구간도 있으므로 제품 속도 비교에 사용하지 않는다.
제품 비교는 계측 없는 별도 fresh Worker 요청이며 첫 로드·계산·전송을 포함한다. 반복 요청 결과 캐시는 사용하지 않는다.
