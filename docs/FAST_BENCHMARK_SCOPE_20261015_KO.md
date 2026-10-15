# Fast 첫 비교 벤치마크 범위 v2

2026-10-15 · **비교 범위 확정 / 실행 전**

목적: 현재 Fast의 제한 탐색이 직접 2x2보다 언제 이득인지, 예산 축소와 preview/grace 중 무엇이 시간·품질을 바꾸는지 넓게 수집한다. 첫 결과는 조건부 정책 설계를 위한 개발 데이터이며 제품 승격/독립 holdout 검증이 아니다.

- 선행 조사: [현재 경로·가설](FAST_BUDGET_REVIEW_20261015_KO.md)
- 기계 판독 범위: [SCOPE_20261015_v2.json](../tools/fast-bench/SCOPE_20261015_v2.json). v1 JSON은 원본 보존.
- 개정 근거: [Gemini·DeepSeek 검토](FAST_EXTERNAL_REVIEW_20261015_KO.md). GRACE 실제 패턴, 추가 인과 대조, 품질/통계 계약을 보완했다.
- 오프라인 생성기: `tools/fast-bench/freeze-scope.py` (solver 호출 없음)
- 기준 제품: 로컬 DEV `3a938a337706748890accd179f97d4ecf2d0d108`.
- 기존 실험의 승인·clock·실행 manifest를 승계하지 않는다. 이번 JSON은 실행 trigger가 아니다.

## 1. 확정 규모

| 층 | 대상 | 비교군 × 반복 | 최대 실행 단위 |
|---|---|---|---:|
| 행렬/특징 확보 | 일반 ALL548 + per-save548 + 경계16 + GRACE 실제 회귀1명령 | 각 1회 | 1,113 |
| 공통 K/seed 행렬 비교 | ALL548 + GRACE1 + per-save최대384 = 최대933행렬 | 9군 ×3회 | 25,191 |
| 추가 인과 대조 | 주 행렬 중 구조별 최대96개 | 추가3군 ×3회 | 864 |
| 공개 API 전체 비용 | 일반128 + per-save128 + 경계16 + GRACE1 =273명령 | 5군 ×3회 | 4,095 |
| 계측 영향 screen | 행렬32개 | 3정책 ×ON/OFF ×2회 | 384 |
| 계약·실환경 preflight | 작은 입력/합성·대표 경로 | 총 한도 | 64 |
| **합계** | | | **31,711** |

이는 **스케줄 실행 단위** 상한이다. 한 capture/per-save 요청 안의 여러 primary, 한 Fast 안의 preview/integrated/grace/refine은 하위 호출로 별도 계수한다. 이를 solver 31,711회라고 표시하지 않는다.
기존 capture를 현재 계약과 hash까지 확인해 재사용하거나 empty/unproven이 있으면 실제 행렬 호출 수는 줄어든다. 비어 있는 슬롯을 다른 모집단이나 추가 반복으로 자동 전환하지 않는다.

## 2. 입력 범위와 선택 규칙

### 2.1 주 모집단

보존된 `tools/secondary-bench/prepared-20261005/A_TEMPLATE.json`의 550명령을 입력 정의로 사용한다. 원 자료는 275 mirror group, clear4, Hold ON, N+1, bag 계열/restricted-split이다.

이번에는 BOX 제외를 유지하기 위해 `mirrorGroup=3c0f03c0f`의 두 명령을 제외한다. 결과는 **274그룹·548명령**이다. 별칭 전체를 JSON에 남긴다. 과거 451 nontrivial 같은 건수를 현재 실행의 확정 분모로 사용하지 않는다.

- 일반: 공개 minimals, `wantedSave:'ALL'`.
- per-save: 같은 548개의 보드·패턴을 per-save 명령으로 평가. 실제 잔여 미노 필터 의미를 사용하며 일반 saves=T와 동일시하지 않는다.
- 주 모집단에서는 source Fumen, pattern, clear, Hold, primary auto를 고정한다.
- primaryHard, tiny, trivial, empty를 모집단에서 삭제하지 않고 각각 기록한다. **primary K 미증명은 secondary 입력으로 넘기지 않는다.**
- 독립 full-split, 모바일, BOX 8P, 다른 높이/Hold OFF, Boolean, Worker 수 변경, CP secondary 정책은 이번 첫 캠페인 범위 밖이다.

### 2.2 per-save 384행렬: 넓은 특징 확보 + 제한된 실제 비교

548명령의 모든 save에 대해 capture 상태와 구조 특징을 남긴다(최대3,836 save slots). 그중 원 품질 문제가 nontrivial이고 K가 증명된 **primaryHard=false** 행렬에서 최대384개를 선택한다. hard는 모집단 기록과 ALL 비교/e2e에 남기되 이 probe 표본의 몫을 차지하지 않는다.

선택은 **새 Fast 시간/품질을 보기 전**, 구조만 사용한다.

1. 원 singleton을 직접 세어 F, d=K−F, u=S−F를 구한다. primary kernel forced로 대체하지 않는다.
2. 층: d=`0..8 / 9..16 / 17..24 / 25+`, u=`0..127 / 128..511 / 512+`, family=`bag계열 / restricted`, previewEligible=`false / true`: 총48칸. previewEligible은 제품의 세 크기 가드로 계산한다.
3. 각 칸 최대8개를 첫 할당으로 삼는다. 칸 순서는 위 열거 순서, 후보 순서는 `SHA256(selectionSeed + ':' + fixtureIdentity)` 오름차순. fixtureIdentity는 원명령 ID+save 이름이며 별칭 중복은 제거한다.
4. 전체 선택에서 mirror group당 최대4개. 첫 할당 후 빈 몫은 동일 칸 순서로 한 개씩 round-robin 재분배하여 최대384개까지 채운다. 해당 한도 때문에 부족하면 부족분을 그대로 남긴다.
5. 가능한 경우 과거 미측정 save도 자연스럽게 포함되지만 이를 fresh group이라고 부르지 않는다. 선택 확률이 균등하지 않으므로 per-save384 평균을 전체 save 모집단 평균으로 외삽하지 않는다.

ALL은 준비된 모든 eligible 행렬을 비교하므로 저-d만의 표본이 아니다. 모든 save를 9군 반복하는 대신 이 층화로 구조 폭과 비용을 맞춘다.

### 2.3 공개 API 273명령

- 고정 seed로 선택한 **64 mirror group×두 family=128명령**을 일반/per-save 양쪽에서 실행한다. GRACE 그룹은 역사 회귀군으로 고정 포함한다. 대상 ID는 JSON에 이미 기록했다.
- 추가16명령: 같은 패널 앞8그룹에 대해 (a) bag 패턴의 사전식 첫 concrete queue로 per-save 단일 큐, (b) 원 bag 패턴의 일반 wantedSave=T. 다른 입력으로 결과를 보고 교체하지 않는다.
- 첫 concrete queue는 입력 확장만으로 계산하며 성공 여부를 보고 고르지 않는다. empty일 수 있고, 단일 큐 우회/작은 경로의 실제 발생 여부를 기록한다.
- tiny/direct의 경로 차이를 보존한다. 공개 auto와 2x2의 차이는 probe만의 인과효과로 보고하지 않는다.

**GRACE 명시 회귀1개 추가:** `regression/grace-p7/minimals-ALL`, 원 GRACE Fumen, `pattern:'*p7'`, clear4, Hold ON, wantedSave=ALL. 현재 카탈로그 GRACE는 `*p5`라 역사 K45 회귀를 대신하지 못한다. 이 추가 명령은 N+3이며 일반 minimals에만 적용한다. 잔여 1미노 전용 per-save에 복제하지 않는다. K45/기본 preview exact/B40 grace exact는 구 테스트의 기대값으로 현재 API 계약 검사에서 확인하고, 불일치 시 기록한다.

E2E JSON에 `endToEndModes`를 명시한다. base128을 두 모드로 확장하고 edge16과 regression1을 더해 273개의 고유 ID가 되어야 한다. 구 API 테스트는 현재 공개 API로 재표현한다.

### 2.5 추가96개 패널·정적 동치 생략

- 추가군 표본은 본행렬 중 non-hard에서 previewEligible true48/false48. 각 부분집합에서 ALL/per-save를 번갈아 hash순으로 선택하고 group당 최대4개를 적용한다. GRACE 회귀는 true 패널의 첫 슬롯에 고정한다. 한쪽 부족분은 반대쪽의 남은 후보로 채우되 group cap을 유지한다. 결과 시간/품질을 보고 고르지 않는다.
- feature 표에 각 층 모집단/선택 수, pin/선정 이유를 남긴다. group cap·pinning이 있으므로 `N_h/n_h`를 포함확률 역수라고 주장하지 않는다.
- primaryHard의 BASE100 외 군, preview 부적격의 NO_PREVIEW(기준 BASE100)/I_ONLY(기준 NO_GRACE)는 정적 동치 생략 가능. 각 클래스 첫8행렬(hash순)은 음성대조로 전군 유지한다. schedule 동결 시 결정한다.
- 생략은 `SKIPPED_STATIC_EQUIVALENCE` 및 참조 arm으로 기록한다. 실제 측정값/반복 수로 복제하지 않고 시간은 null이다. 위 비용표는 생략 없는 상한이다.
- preview exact 여부 등 **측정 후 결과**로 군을 생략하지 않는다. 작은 후보 수나 원 singleton trivial이라는 이유만으로 Fast 본체를 생략하지 않는다. matrix는 tiny/direct 우회 없는 fixed-K 비교이고 e2e는 실제 우회를 따른다.

### 2.4 개발/평가의 경계

전체는 이미 노출된 카탈로그의 **개발 자료**다. 결과를 여러 에이전트가 읽고 조건을 제안할 수 있다. mirror-group 단위 분할 검증은 내부 안정성 점검이며 독립 fresh 검증은 아니다. 최종 정책을 정한 뒤 별도의 미사용 보드 검증을 설계한다.

## 3. 비교군 9개

모든 행렬 비교는 **동일 원 품질 행렬·중복 가중치·stable ID·K·primary seed**에서 시작한다. 각 군은 독립 프로세스에서 실행하며 앞 군의 seed/캐시를 받지 않는다.

| ID | integrated | preview | grace | 질문 |
|---|---:|---:|---:|---|
| BASE100 | 100K | 최대2.5K | 최대5K | 현재 제품 기준 |
| B1 | 1K | 최대50 | 최대100 | 매우 작은 기존 API 예산 |
| B10 | 10K | 최대500 | 최대1K | 중간 축소 |
| B40 | 40K | 최대2K | 최대4K | 완만한 축소·GRACE 경로 |
| DIRECT | 없음 | 없음 | 없음 | 원 seed에서 바로2x2 |
| NO_PREVIEW | 100K | 없음 | 최대5K | preview 순효과 |
| NO_GRACE | 100K | 최대2.5K | 없음 | grace 순효과 |
| I_ONLY | 100K | 없음 | 없음 | 두 보조 probe를 제거한 효과/상호작용 |
| I10_FIXED_AUX | 10K | 최대2.5K | 최대5K | 주 예산만 축소한 효과 vs B10 |

추가96개 패널에만 아래3군을 더한다(각3회). 같은 패널의 기존9군 결과와 대응 비교한다.

| ID | integrated | preview | grace | 질문 |
|---|---:|---:|---:|---|
| I1_FIXED_AUX | 1K | 최대2.5K | 최대5K | B1의 주 예산과 부가 예산 축소 분리 |
| I10_NO_GRACE | 10K | 최대2.5K | 없음 | preview 미완료 층에서 10K seed→2x2 직접 효과 |
| P_ONLY_2x2 | 없음 | 최대2.5K | 없음 | preview 완료만 채택, 미완료면 원 primary seed→2x2 |

I10_NO_GRACE가 preview에서 exact로 끝난 경우를 순수 integrated seed 효과로 해석하지 않는다. P_ONLY의 ineligible은 DIRECT와 같아지는 음성대조다.

- preview 크기 가드는 모든 preview 사용군에서 동일하게 유지한다. 숫자 한도가 있어도 ineligible이면 실행하지 않는다.
- primaryHard→직접2x2 가드는 모든 군에서 유지한다. hard 행렬에서 여러 군이 동일 경로가 되는 것은 예상된 negative control이다.
- 각 단계 exact 완료 시 즉시 반환하며, 미완료 preview 폐기·나머지 seed 전달·2x2 최대16pass는 현재 계약을 따른다.
- DIRECT를 `fastStateBudget:0`으로 구현하지 않는다(현재 0은100K로 해석됨).
- NO_PREVIEW/NO_GRACE/I_ONLY/I10_FIXED_AUX는 **실험 adapter 전용**이다. 공개 API 옵션을 늘리지 않는다.
- e2e는 앞5군(BASE100/B1/B10/B40/DIRECT)만 실행한다. 공개 `secondary:'auto'` 또는 `'2x2'`를 사용하고 기존 tiny/direct 선택도 그대로 둔다.
- 130K 상향, hard probe 재허용, CP 합류 변경, 조건부 cutoff 구현은 이번에 섞지 않는다. 첫 결과를 보고 별도 후보로 판단한다.

## 4. 실행·시간·자원 계약

### 환경

- 별도 실험 브랜치의 Linux GitHub Actions. 로컬 population benchmark 없음.
- 측정 VM 최대16, VM당 활성 측정 scope 1개. 각 scope는 process tree 전체3GiB, swap0.
- `filterWorkers:0`, `secondaryWorkers:0`로 save 배분을 고정한다. primary auto는 유지하며 Rust/HiGHS1-thread, ORTools primary2-worker를 기록한다. Fast의 CP secondary 호출은 없다.
- 실제 Node 버전·flags·CPU/VM 정보·WASM/source hash를 실행 전에 동결한다. 새 Fast adapter는 기존 exact-only assert를 무력화하는 대신 별도 계약으로 연결한다.

### 반복·순서·타이머

- 본측정은 **3회 고정**, 자동 추가 반복/성공할 때까지 재시도 없음.
- 한 입력의 한 반복 block에서 모든 군을 같은 VM에서 직렬 실행한다. 입력 hash로 시작 순서를 정하고 반복별 cyclic rotation을 적용한다. 전체 패널에서 시작 위치를 균형 배분하며 실제 순서를 보존한다. 3회만으로 완전 Latin-square 균형이라고 주장하지 않는다.
- 매 군 fresh process/solver. 별도로 `startupMs`, matrix/API 진입→반환, 검산/IPC/회수 포함 wall을 기록한다. matrix에선 열거/primary를 타이밍에 더하지 않고 capture 비용으로 따로 기록한다. e2e는 열거+primary+모든 save secondary+결과 생성을 포함한다.
- matrix call60초, e2e call180초, capture 전체300초(그 안의 enumeration 최대60초). capture의 save별 primary로 전체 clock을 초기화하지 않는다.
- startup30초, reap5초×최대2단계. 부모 외부 watchdog으로 동기 WASM도 종료한다.
- OOM은 해당 input×arm의 나머지 반복을 NOT_RUN_AFTER_OOM으로 남긴다. 정상 TIMEOUT/품질 악화는 유효한 부정적 관측이다. 실행 조건/해 유효성/회수 오류는 해당 수집을 중단하고 구분한다.

### 총 상한

- 스케줄 최대31,711단위.
- 최악 호출 예약 약 **1,095.828 runner-hours** + 준비/전송/제어100h = **1,195.828h**.
- 추가 대조에 기존 여유30h를 재배정했다. watchdog/호출 제한은 줄이지 않았다. 준비·전송100h가 실제 schedule에서 부족하면 시작 전 범위를 재검토하며 최악 예약을 평균 startup 시간으로 낮추지 않는다.
- 총 **1,200 runner-hours**, 단일 origin부터 **96시간**. 이는 예상 소요시간이 아니라 최악 자원 상한이다.
- 상한에 필요한 회수·기록 여유까지 포함해 다음 task를 admission한다. 큐 대기·실행 장애로 전체 계획을 마치지 못하면 INCOMPLETE로 보고하며 scope나 clock을 조용히 늘리지 않는다.
- capture에서 실제 품질 solve를 우회했는지, 하위 primary/probe 수와 elapsed를 원장에 별도 기록한다. 기존 벤치를 자동 재실행하지 않는다.

## 5. 계측과 결과 계약

### 호출별 보존

- input/board/mirror-group/family/save ID, source revision, fixture hash, 실제 옵션, runner/block/order, seed ID/hash.
- K·S·N·E·원F/d/u·primaryHard·kernel 통계·primary backend·행 표현(Map/numeric), tiny/direct/trivial/empty 여부.
- 단계별 실행/생략 이유, 예산/실제 states, 시작/종료 시간, 각 단계 반환 seed의 품질 벡터와 stable IDs, exact 완료 여부.
- 원 seed 및 각 단계 incumbent가 보존되므로 별도 분석자가 seed 개선을 재계산할 수 있어야 한다. 미완료 preview는 참고용으로만 기록하고 후속 seed에 섞지 않는다.
- 최종 K/coverage 검산, 가중 품질 벡터, 선택 key/ID, 품질 proof 상태, 2x2 pass 수, 결과 Fumen/표시 순서(e2e).
- process-tree CPU/peak memory는 scope 측정값으로 기록한다. WASM 내부 세부 전처리/탐색 시간은 ABI로 분리 불가능하면 **UNOBSERVED**로 둔다. wrapper 시간에서 임의 추정하지 않는다.
- 상태는 `RETURNED_EXACT / RETURNED_APPROX / TIMEOUT / OOM / ERROR / NOT_RUN`으로 구분한다. 예산 소진 후 정상 Fast 결과를 반환한 것은 TIMEOUT이 아니다.

### 계측 영향

matrix32개(ALL16/per-save16)에서 BASE100/I10_FIXED_AUX/**DIRECT**의 trace ON/OFF를 각2회 비교한다(384단위). 각 출처16개는 d≤8/preview 적격8개와 나머지8개를 hash순 선택하고, 부족한 몫은 같은 출처의 남은 행렬로 채운다. ALL 적격에 GRACE 회귀를 고정 포함한다. 행렬 소스가 부족하면 부족분을 기록한다.

- main matrix는 단계 관측 ON, e2e는 상세 trace OFF. 결과 직렬화·검산 비용도 별도 기록한다.
- trace가 결과/탐색 states를 바꾸면 유효성 문제다. 단순 시간 차이는 불확실성으로 보고하며 시간에서 차감하지 않는다.
- 빠른 입력의 screen 기준은 `max(5ms,5%)` 초과 여부이며 2회 screen을 확정된 overhead나 성능 gate로 부르지 않는다.
- 관측 wrapper의 준비 비용을 정책 이득으로 오인하지 않도록 e2e 비계측 결과를 함께 본다. Rust 바이너리 변경을 요구하는 깊은 계측은 첫 캠페인에 넣지 않는다.

추가 계측 계약:
- `previewEligible`, refine 입력 seed/출력 seed를 명시한다. 진단을 위해 추가한 품질 재계산·검산·직렬화는 타이머 밖으로 옮기되, 제품이 본래 수행하는 품질 계산/결과 생성은 타이머 안에 남긴다. 스냅샷 복사도 비용이 있으므로 zero-overhead라고 부르지 않는다.
- JS pack/copy, `wasmCallMs`(Rust 준비+탐색 포함), refine prepare/pass를 구분 가능한 JS 경계에서만 기록한다. `wasmSearchMs`라는 순수 탐색 이름을 사용하지 않는다. 추가 F/d/u 스캔은 capture/별도 진단 비용이고 현재 제품 비용에 가산하지 않는다.
- 같은 e2e 실행 안의 열거/primary/save별 secondary/결과 생성과 잔차를 연결한다. 외부 독립 matrix 시간합을 e2e 시간의 등식으로 만들지 않는다. 연결된 입력의 행렬/K/seed/표현/실제 우회 일치 여부를 기록하고 비계측 wall이 주 지표인 점을 유지한다.
- 고정 seed matrix 반복의 결과/states 변동은 조사 대상이다. e2e primary auto(ORTools2-worker 포함)까지 100% 결정적이라고 가정하지 않는다.

## 6. 분석·판정

주 비교는 각 후보 대 BASE100 **및 DIRECT**. ALL/per-save/e2e/edge/회귀, 초기/계측 screen을 분리한다.

1. 계획→capture→eligible→실행→반환 분모와 모든 결측/검열을 먼저 보고한다.
2. 전체 시간 합·입력별 paired 차이·중앙값/p90/p95·큰 회귀 사례. 완료 쌍과 완료율 전이를 함께 보고한다. timeout 제한값을 완료시간으로 대입하지 않는다.
3. 품질 벡터는 가중 maximin 사전식 비교로 better/equal/worse, 최초 차이 위치/값을 기록한다. stable-ID tie 차이를 품질 하락과 구분한다. K/coverage 손실은 허용하지 않는다.
4. exact 증명 완료율과 결과 품질은 별개다. approximate가 알려진 exact witness와 같아도 그 실행을 proven exact로 올리지 않는다. 기존 optimum 비교는 원 행렬·목표가 일치할 때만 참고한다. 새 전수 exact/CP oracle 측정은 없다.
5. probe 비용·seed 변화·refine 비용·최종 결과를 연결한다. 작은 seed 손실이 최종 품질 손실인지, preview 조기 완료 손실인지 구분한다.
6. d/u/E, primaryHard, family, tiny/direct, 표현별 분석. aggregate 승자 하나로 요약하지 않는다.
7. 최종 cutoff는 첫 벤치에 미리 넣지 않는다. 단순 고정 축소 대비 조건부 분기의 추가 가치와 품질 손실 사례를 분석한 뒤 선택한다. 보편적 허용 품질 손실률을 지금 임의로 정하지 않는다.

품질의 정확한 정의는 `q_i(S)=max_{s∈S∩row_i} quality(i,s)`를 행 가중치만큼 펼쳐 오름차순 정렬한 벡터의 사전식 최대화다. **선택 후보가 행을 덮는 개수의 최대화가 아니다.** 원 CSR에는 edge별 quality도 반드시 보존한다. 별도의 stable-ID 최종 동률 목표를 구분한다.

현재 군 중 어느 exact 완료 결과든 동등한 원 행렬/목표에서만 reference로 연결한다. approximate의 일치에는 `UNPROVEN_OPTIMAL_MATCH`를 붙일 수 있지만 proof 상태는 바꾸지 않는다. reference 부재는 UNKNOWN이며 새 전수 exact anchor를 요구하지 않는다.

TIMEOUT은 유한 상한의 우측 검열, OOM은 자원 실패, NOT_RUN_AFTER_OOM은 미실행이다. 미실행을 추가 OOM 관측으로 세거나 검열값을 +∞ 완료시간으로 바꾸지 않는다. 완료쌍 분석의 선택 편향과 전체 완료 전이를 함께 보고한다. mirror-group bootstrap은 개발 자료의 기술적 안정성만 나타내며 대표성/독립 검증을 보장하지 않는다.

이 캠페인의 종료 산출물은 **후보 정책 선택을 위한 근거**다. 시간·품질 trade-off와 환경 불확실성을 확인한 뒤 제품 채택은 별도 판단한다.

## 7. 다른 에이전트에게 넘길 분석 패키지

하나의 패키지에 다음을 포함한다.

- `README_KO.md`: 질문, 현재 코드 흐름, 군 차이, 용어/상태/한계, 재집계 명령.
- scope/실행 schedule/source-runtime lock/선택 manifest와 원장.
- `calls.jsonl`, `pairs.csv`, `stages.jsonl`, `fixtures.csv`, SQLite 조회본: 모든 호출·반복과 누락 슬롯을 보존.
- 선택한 행렬의 원 weighted CSR·stable keys·K·원 seed, 단계별 incumbent/최종 품질의 손실 없는 표현, e2e 입력/결과. 대형 벡터는 RLE 등 가역 압축 가능.
- 모집단 전체 capture의 특징·상태 목록. 미선택 save를 실패/성공으로 처리하지 않음.
- 정확성/수집 감사, 집계 스크립트, 환경 및 trace 영향, 주요 회귀 목록. 평균 요약만 넘기지 않음.
- 요청 분석: (1) 고정 예산의 Pareto 관계 (2) 구조별 probe 유지/생략 가설 (3) preview/grace 독립 효과 (4) 반례·누락·계측 한계 (5) 최소 조건부 후보.

이번에는 분석을 위임하지 않았다. 첫 결과가 나온 뒤 동일 패키지를 공유할 수 있도록 설계했다.

## 8. 다음 작업

범위·입력 command ID·비교군·반복 수·자원 상한은 이 문서와 JSON으로 확정했다.
실행 전 준비는 Fast adapter/계측 구현, 경량 계약 검사, Linux source/runtime lock 및 capture 후 구조 기반384개 선택 manifest 생성이다. 최종 fixture 수는 capture 결과에 따라 줄 수 있으며 그 이유를 기록한다.
**이번 범위 확정은 benchmark 실행이나 push가 아니다.**
