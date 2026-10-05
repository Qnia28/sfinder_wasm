# Astra — 광범위 자료 해석과 분류 방향 결정

2026-10-05 · 역할: **Astra / Plan** · 상태: **후속 설계 방향 결정, 제품 적용·실험 실행 승인 아님**

근거: 60초 run `37222172267`, 300초 run `37226653891`, 원 capture/phase/states, `classifier-raw-20261005`의 개별 기록. 실행·export 기준 commit은 `68af2b0`이다. 이번 단계는 기존 파일의 오프라인 분석과 문서 작성만 수행했다. 구현·추가 solver 호출·Actions 성능 실험은 수행하지 않았다.

수치와 입력별 근거는 [`ASTRA_ROUTING_EVIDENCE_20261005.json`](ASTRA_ROUTING_EVIDENCE_20261005.json)에 보존했다. 원 fumen/pattern/save, 특징, 최초 반복의 상태·중앙값, primary 경로, 입력 hash가 들어 있다. Python으로 집계한 뒤 별도 Node 원기록 대조로 2개 run×309행렬×3엔진=1,854개 조건의 기본 중앙값·완료 상태와 source hash를 확인했다. 새 solver 호출은0회다.

## 1. 결정

**단일 3-class 승자 분류기를 먼저 만들지 않는다. 저비용 구조 분기로 Integrated 사용 여부를 정하고, 어려운 영역에서는 Threshold 진행 관측을 거쳐 CP-SAT로 순차 전환하는 계층형 정책을 연구한다.**

1. **direct / trivial / tiny 경로를 먼저 보호한다.** 그 뒤에도 `d≤8`은 기존 bounded Integrated 경로를 유지할 근거가 강하다. 무제한 Integrated로 바꾸라는 뜻은 아니다.
2. **첫 정적 후보는 `d≥17`에서 Integrated 100K probe를 건너뛰고 Threshold부터 시작하는 분기**로 좁힌다. 17은 이번 개발 자료에서 선택한 실험 후보 경계이지 보편적으로 증명된 cutoff가 아니다.
3. **`9≤d≤16`은 불확실 영역**으로 남겨, 첫 후보에서는 기존 100K Integrated → Threshold를 유지한다. 새 Integrated same-search 관측 ABI부터 구현하지 않는다.
4. **Threshold/CP-SAT는 별도 결정이다.** 높은 d를 무조건 CP로 보내는 정책은 채택하지 않는다. `u`는 추가적인 모호성의 규모, `R/E`는 준비·모델 비용/자원 제약을 나타내는 보조 특징으로 사용한다.
5. 최종 목표는 기존 로드맵대로 **행렬당 활성 secondary 탐색 하나**다. Threshold를 제한적으로 관측하고 계속할지, 종료·회수한 뒤 CP로 갈지 결정한다. 준비·전환 비용 및 증명 상태를 포함해 평가한다.
6. 첫 비교 라운드의 변경은 **고-d Integrated 생략 한 가지**에 집중한다. CP 전환은 관측·전환 비용 자료를 받은 뒤 다음 후보로 동결한다. 동시에 2개를 넘는 정책 후보나 cutoff grid 탐색은 하지 않는다.

## 2. 분석 계약과 분모

- 309개 측정 행렬은 **205개 mirror group**에서 나왔다. 개발 명령 모집단은 220개 그룹·440개 명령이다. 309개의 독립 보드, 수만 회의 독립 입력이라고 세지 않는다.
- 60초 최초2회는 309×3 조건 모두 관측돼 구조별 판단의 주 기준으로 삼았다. 300초 최초4회는 별도 조건의 재현·긴 꼬리 보강 자료다. 같은 행렬을 다시 측정했으므로 fresh 검증은 아니다.
- 표의 완료는 **해당 run의 기본 반복 전부 EXACT**인 조건이다. 일부 exact만 있는 경우와 OOM/미실행은 따로 둔다. timeout은 완료시간으로 대입하지 않는다.
- 시간은 동일 행렬·엔진의 기본 반복 중앙값이다. 엔진 간 median 비율은 정보 수집의 비짝지은 기술통계이며 제품 후보의 paired A/B 추정치가 아니다.
- d 구간은 `1–8 / 9–16 / 17+`로 묶은 거친 기술통계다. 이 자료로 고른 경계의 일반화 성능을 같은 자료로 검증했다고 주장하지 않는다.
- 추가 반복은 방향·분산 검토에 쓸 수 있으나, 조건별 반복수가 달라 최초 모집단과 섞어 기본 분류 label을 만들지 않는다.

## 3. Integrated/Threshold 방향을 지지하는 자료

### 3.1 60초 기본 반복

| d 구간 | 행렬 | Integrated 완료 / timeout | Threshold 완료 / timeout | CP 완료 / timeout | 세 엔진 모두 완료한 경우의 가장 빠른 엔진 |
|---|---:|---:|---:|---:|---|
| ≤8 | 199 | 199 / 0 | 199 / 0 | 199 / 0 | I 195 / T 4 / CP 0 |
| 9–16 | 51 | 49 / 2 | 51 / 0 | 50 / 1 | 48개: I 25 / T 23 / CP 0 |
| ≥17 | 59 | 10 / 49 | 35 / 24 | 45 / 14 | 10개: T 10 |

### 3.2 300초에서의 재현과 누락

- d≤8: 193개는 세 엔진 모두 기본4회 완료. I 190 / T 3. 나머지6개는 **옆 행렬의 OOM 이후 job 격리로 미실행**이며 느린 입력이라는 증거가 아니다.
- d9–16: 49개는 세 엔진 모두 기본4회 완료. I 25 / T 24. 나머지는 I OOM 발생1개 및 이웃 격리1개다.
- d≥17: I 완료13 / timeout32 / OOM14. I가 완료한13개에서도 T가 전부2배 이상 빠르다. T·CP의 기본 반복이 일부만 기록된 OOM 동반 행렬은 완전 비교에서 제외했다.

### 3.3 작은 d 보호는 후보 수 n 하나보다 설명력이 있다

- d≤8의 I 중앙값 최대치는 60초 run에서 **187.14ms**였다. 비교 가능한199개에서 T가 더 빨랐던 경우의 최대 절대 차이는 **11.04ms**, T가2배 이상 빠른 경우는0이었다.
- d≤8의 관측 범위는 n2–178, u2–164, R24–24,754, E92–105,512다. R/E가 크다는 이유만으로 CP를 먼저 시작하면 이 빠른 영역을 해칠 수 있다.
- 현재 제품 per-save adaptive 경로의 n≤48 tiny 대상149개가 모두 d≤8에 포함된다. 이149개의 direct 엔진 차이는 제품에서 실제로 새 secondary 분기를 통과하는 비용과 같지 않다.
- tiny 밖인 **n>48·d≤8은50개**다. 첫 후보의 실질적인 빠른 경로 보호 표본은 이50개와 중간영역의 빠른 입력이다.
- 미측정 nontrivial save에서는 d≤8인데 n332/u327인 입력도 있다. d≤8만으로 임의 크기의 입력을 무제한 탐색하게 해서는 안 된다.

### 3.4 완료 states는 고-d probe 생략 가설을 지지하지만 시간 절약을 증명하지 않는다

60초 기본 반복의 Integrated 원 result에서 최종 searchedStates를 확인했다:

| d 구간 | 완료 states≤100K | 완료 states>100K | timeout으로 완료 states 미관측 |
|---|---:|---:|---:|
| ≤8 | 199 | 0 | 0 |
| 9–16 | 31 | 18 | 2 |
| ≥17 | 0 | 10 | 49 |

d≤8의 완료 states 최대는24,479다. 300초에서 완료한 고-d13개도 전부100K를 넘었다. 기본 반복의 같은 행렬·같은 엔진 완료 states는 두 run을 포함해 일치했다. CP의 `searchedStates=0`은 비교 가능한 CP 탐색량 정보로 사용하지 않았다.

**주의:** 이는 uncapped 완료 탐색의 기록이다. 실제 bounded100K 호출의 소요시간·incumbent·Threshold seed 변화·전송 비용은 이번 측정에 없다. 고-d direct I가60초 이상 걸렸다는 사실을 Auto에서60초 이상 낭비한다고 바꿔 말하면 안 된다. 현재 Auto는 이미100K 이후 T로 전환한다.

### 3.5 중간영역을 지금 단일 엔진으로 고정하지 않는 이유

- `c7-2plus2-qb-row-040/restricted-split/Z`: n228/K15/R750/E13,538/F4/d11/u224. I는60초 timeout,300초에서는OOM; T는60초 기본 중앙값 **76.89ms**. 작은 d의 근접 영역도 안전하다고 단정할 수 없다.
- `c7-2plus2-qb-row-277/restricted-split/I`: n126/K37/R1,434/E5,102/F25/d12/u101. I **30.96ms**, T **116.11ms**. d가8을 넘었다고 전부 T로 보내면 이런 빠른 I를 놓친다.
- `cycle1-pcinfo-015/restricted-split/T`: d13/u976. I57.20s / T10.84s / CP60초 timeout. d에 더해 u와 준비·탐색 구조를 볼 필요가 있다.

첫 라운드에서는 중간영역의 기존 bounded 처리가 기준이다. 여기서 더 줄일 수 있는 probe 비용·오선택 손실이 실제 정책 측정에서 유의미할 때만 I 동적 관측 후보를 추가한다.

## 4. CP의 역할: 완료자만 남기면 보이지 않는 영역

### 4.1 “CP 최속 0개”는 CP를 없앨 근거가 아니다

세 엔진이 모두 끝난 표본에서는 CP 최속이0개였지만, 60초 기본 측정에는 **I와 T가 모두 timeout이고 CP만 완료한 행렬11개**가 있다. 이들은 모두 d≥17이다. 300초 기본4회에서도 같은 형태가7개 있다. 이는 해당 시간 한도 안의 완료 가용성 차이이지, 검열된 엔진의 정확한 최종시간이나 무제한 전역 우열을 증명하는 label은 아니다.

d≥17 중 T와CP가 모두60초 내 완료한34개에서는:

- T가1.10배 이상 빠른 경우26개.
- CP가1.10배 이상 빠른 경우8개(2배 이상5개).
- 별도로 CP만 완료/T timeout11개, T만 완료/CP timeout1개, 둘 다 timeout13개.

따라서 **고-d→CP 직행도, CP 제거도 채택하지 않는다.**

### 4.2 u와 E/R의 역할을 분리한다

d≥17의 u 구간별 60초 자료(설명용 구간, CP 제품 cutoff 아님):

| u | 행렬 | T 완료 | CP 완료 | 둘 다 완료할 때 T/CP가 ≥1.10배 빠른 개수 |
|---|---:|---:|---:|---|
| <128 | 1 | 1 | 1 | 1 / 0 |
| 128–255 | 15 | 15 | 14 | 14 / 0 |
| 256–511 | 15 | 12 | 13 | 8 / 4 |
| ≥512 | 28 | 7 | 17 | 3 / 4 |

작은 u는 T 우선 가설, 큰 u는 조기 CP 검토의 우선 진단군을 지지한다. 하지만 u≥512 자체도 T가 빠른3개와 CP가 완료하지 못한 입력을 포함한다. **u512는 지금 CP 직행 규칙으로 승인하지 않는다.**

R/E는 CP 모델 준비·원행/품질 가중 비용을 제한하는 특징이다. 큰 모델에서 CP가 무조건 유리하지 않다:

- `cycle1-pcinfo-030/bag-plus-next-draw/O`: n347/K160/R26,284/E160,466/F129/d31/u218. T18.15s(300초 기본), CP는4회 모두300초 timeout.
- `c7-2plus2-qb-row-346/restricted-split/I`: n380/K111/R2,332/E11,250/F83/d28/u297. T23.29s vs CP1.75s(60초 기본). I는timeout, 후속에서는OOM.
- `cycle1-pcinfo-019/restricted-split/J`: n183/K48/R1,484/E6,666/F17/d31/u166. I60초timeout/후속OOM인데 T는60초 기본81.33ms. “I가 위험하다→CP가 필요하다”는 논리는 성립하지 않는다.

`d/u`는 잔여 선택 난도 가설, `R/E`는 준비 및 모델 비용, `n/K/F`는 그 출처·검산과 조건 범위를 보존한다. d=K−F, u=n−F이므로 이7개를 독립 특징처럼 취급하지 않는다. fumen/ID/save 이름은 분석 연결키이며 승자 예외 규칙에 넣지 않는다. pattern/family는 대표성·오류 점검의 층이며 첫 정책의 shortcut label로 쓰지 않는다.

### 4.3 다음 관측은 Threshold 쪽을 우선한다

필요한 질문:

1. T가 매우 빠르게 끝날 입력을 최소 비용으로 그대로 통과시킬 수 있는가?
2. 증명 prefix·incumbent quality·누적 states와 elapsed를 소수 checkpoint에서 관측했을 때, CP 전환이 유리한 군을 구분할 수 있는가?
3. 이미 소비한 T 시간, CP init/model, seed 변경, 회수 비용을 합친 **실제 순차 응답시간**이 현행 Auto보다 나은가?
4. CP 실패/미완료 시 이전 T를 잃는 손실과 fallback 비용은 무엇인가?

prefix가 멈췄다는 이유만으로 “진행 없음”을 확정하지 않는다. 같은 threshold 안의 긴 증명일 수 있다. prefix 길이도 matrix별 품질 level 수와 함께 해석한다.

기존 bounded `proofProgress` 및 실험 portfolio는 준비 자료지만 **budget 반환 후 재호출은 same-search resume이 아니다.** 최종 sequential 후보에서 T를 계속하기로 했다면 같은 탐색을 이어가거나, 불가능할 경우 재시작 비용을 정확히 드러내고 평가해야 한다. CP 시작 전 T 종료·하위 worker 회수를 확인한다. CP timeout이면 exact로 바꾸지 않으며 기존 증명 또는 명시적 fallback 계약 없이는 완료를 선언하지 않는다.

## 5. Sol에게 넘길 단계별 작업 — 구현/실험은 이후

### S0. 데이터·하네스 보완 (우선)

1. `wave_decisions` export에 **engine**을 복구하고 `(campaignId,fixtureId,engine,stage)`의 유일성 및 원 plan 대조 검사를 추가한다. 원 raw는 유지하고 새 export revision을 만든다.
2. 분석용 테이블에 `primaryHard`, primary backend/kernel stats, `tinyEligible`, 완료 `searchedStates`를 원 fixture/raw에서 연결한다. CP0 states는 missing/비지원 의미를 명시한다. 없는 이른 checkpoint 값은 생성하지 않는다.
3. P0 minimals 경로표를 완성한다: direct/tiny/trivial, ordinary/per-save, implicit/explicit secondary pool, filterWorkers, 실제 분류 삽입 위치, 구조 요약 재사용 및 duplicate scan/copy 여부. 이번 selected309은 전부primaryHard=false이므로 그 경로는 별도 유지·회귀 대상으로 둔다.
4. OOM 발생 뒤 다른 엔진/이웃 행렬까지 미실행되는 측정 격리 범위를 개선할 실행안을 제시한다. 죽은 scope를 그대로 재사용하거나 Integrated OOM을 성공할 때까지 재시도하지 않는다. 필요한 T/CP 및 이웃 미실행 회수는 **새 계약·예산**으로 제안한다.

### S1. 고-d probe 생략의 실제 비용 확인

첫 **정적 ablation A**의 한 가지 차이:

```text
기존 direct / tiny / trivial 종료 → 그대로
primaryHard → 기존 처리 유지
d가 유효하고 d≥17 → Integrated100K 생략, Threshold부터
그 밖 → 기존 Integrated100K 및 fallback 유지
```

- `structure`의 기존 저비용 요약을 재사용한다. 새 CP profile/hash/전체 graph scan을 모든 빠른 입력에 추가하지 않는다.
- 이 ablation은 효과를 분리하기 위해 **현행 CP 시작/실패 처리 계약을 대조와 같게 유지**한다. 그러므로 행렬당 single-active 최종 제품 후보로 승인하는 것이 아니다.
- 분석 표본: 높은 d59개 + 중간51개 + tiny 밖 낮은 d50개의 **160개**를 경로 비용 진단의 기본 장부로 삼고,149개tiny 및 기존trivial/direct는 빠른 경로 회귀 장부로 둔다. ordinary 경로는tiny 처리 위치가 다르므로 경로표에 따라 분리한다.
- 같은100K probe를 source/seed/worker/lifecycle가 같은 제품 경로에서 측정해야 한다. T에 넘기는 개선 seed가 사라져 손해를 보지 않는지 반드시 확인한다.
- 대조는 현행 Auto, A/B는 실제 정책 호출을 인접 pair로 배치한다. direct I/T 시간을 더해 후보 시간을 만드는 방식은 쓰지 않는다.
- d8/9와16/17 경계, 큰u·큰R/E, 빠른 T 반례를 포함한다. 미측정 save 중 특징 범위를 벗어난15개를 추가 coverage 장부에 포함하되 노출 개발 보강이라고 명시한다.
- A가 고-d에서 줄이는 시간이 작거나 T seed 손실이 이득을 지우면 **정적 gate를 보류**한다. 경계를 계속 움직여 맞추지 않는다.

### S2. T/CP 순차 선택 자료와 후보 B

- 관측·전환 정보 수집을 먼저 계획한다. 고-d59개 전부와 중간영역의 CP 역효과/꼬리 반례를 포함해 CP 유리 사례만 고르지 않는다.
- 기존 직접CP 입력/K/seed를 재사용하고, 과거 자료의 모델/진행 정보도 계약 연결 후 활용한다. 모든 엔진을 다시20회 측정하는 캠페인은 필요하지 않다.
- 서로 다른 역할의 사전 고정된 소수 checkpoint를 제안하고, 관측 자체의 시간·states 보존을 확인한다. 구체적인 state/time 숫자는 Sol의 상세 비용안과 계약 검토 후 동결한다. 지금100K를 T용 budget으로 복사하지 않는다.
- 이후 **후보 B = 검증된 정적 gate + 제한 T 진행 관측 + T 계속 또는 종료·회수 후 CP**로 좁힌다. 전체 활성 탐색은 하나, 제한 종료와 exact 완료를 분리한다.
- T 준비 지연, CP 모델 준비, 전환 시 seed/prefix, CP 실패 시 fallback, 취소·buffer 소유권 및 하위Worker 회수가 측정에 포함돼야 한다.
- B의 의사결정에 u/R/E를 사용할 수 있지만, 큰u만으로 CP 직행을 제품 기본으로 바꾸지 않는다. 중간 d의 I 관측은 A/B에서 가치가 입증된 경우의 후속 질문이다.

### S3. minimals 전체·다중 요청·fresh 검증

- 동일조건 secondary A/B를 통과한 후보만 ordinary/per-save 명령 전체에 연결한다. primary·열거·pool 대기·모든 save 취합·출력·회수를 포함한다.
- 원440명령과 실제 지원 범위의 새 입력에서 빠른/trivial/tiny와 긴 꼬리를 함께 평가한다. 이 명령의 모든save는이번309개 시간표로 대체할 수 없다.
- 단독 및 다중 요청에서 완료시간·queue delay·CPU·process-tree peak memory·전체worker 상한을 측정한다. single-active가 실제 처리량·메모리 이득을 주는지 확인한다.
- 브라우저/WASM의 실제 module reuse·warm lifecycle, CP지원/미지원, 취소 및 재시작을 확인한다. 이번 Node fresh-process-cold 숫자를 그대로 브라우저 cutoff로 옮기지 않는다.
- 마지막에 후보 하나를 동결해 새 mirror group 검증을 수행한다. 반복·timeout·호출수·VM/시간 예산·숫자 성능gate는 Sol 실행안 검토 후 고정하며 이번 해석만으로 캠페인을 발사하지 않는다.

## 6. 평가·종료 원칙

- 목표는 승자 label 정확도보다 **빠른 경로 손실, 긴 지연, timeout/OOM, 총 CPU·메모리와 동시 요청 비용**이다. 개별 반복을 독립 train/test 표본으로 나누지 않는다.
- mirror group 단위 분리·집계를 사용한다. cross-validation을 하더라도 이미 살펴본 개발 자료의 내부 견고성 검사이며 fresh 증거가 아니다.
- completed-only 집계와 전체 상태 분모를 함께 보고한다. timeout/OOM/미실행을 같은 class로 합치거나 cutoff 숫자의 완료시간으로 채우지 않는다. 비교 가능하지 않은 경우 `abstain/unknown`을 허용한다.
- 정책의 추가 관측 비용은 빠른군의 절대ms와 상대비율을 함께 평가한다. gate 수치와 측정 오차 처리법은 후보 결과를 보기 전에 동결한다.
- A/B 재확인은 개선상위10% ∪ 악화상위10% ∪ 같은조건변동≥1.10 ∪ gate영향을 따른다. broad 추가 반복을 그 절차를 마친 것으로 대체하지 않는다.
- 새로운 shape·primaryHard·미지원CP에서 기존 정확성 계약을 잃는 일반화는 허용하지 않는다. single-active가 기존 race의 빠른 완료를 지나치게 잃으면 후보 B를 보류할 수 있다.
- 300초에도 세 엔진 기본 반복 전부timeout인11개는 이번범위의 unresolved stress set으로 남긴다. 새로운 라우터가 풀 것이라고 가정하거나 무제한 timeout을 요구하지 않는다.

## 7. 빠졌거나 부족한 이전 작업

| 우선순위 | 항목 | 현재 사실 / 후속 조치 |
|---|---|---|
| P0 | **wave_decisions.engine export 누락** | 원 plan에는engine이 있고 calls도정상. export CSV/JSONL 둘 다engine을생략했다. 기존 CSV↔JSONL 검사는둘의동일한누락을못잡았다. Sol이원plan과명시key를대조해수정 |
| P0 | 실제 Auto100K 비용·전환 seed 미측정 | directuncapped만있어새gate의실제이득계산불가. S1에서 bounded·seed·pool 포함측정 |
| P0 | OOM에 의한 비교 손실 | I OOM15회,236개기본호출미실행(동일15행렬과이웃7행렬). 기본누락I73/T82/CP81. 새scope에서다른엔진/이웃만회수할계획필요 |
| P1 | 첫run 추가반복 history누락 | 기본2회완전하지만801개의engine×fixture×wave결정차이로추가반복조기제외. 정정집계완료와실제추가반복완료는다름. 기본판단은유효,중단된반복을가짜로채우지않음 |
| P1 | 원 capture 대비 runtime 공백 | 전체2,685행렬 중1,050trivial,1,635nontrivial; 후자중309측정/1,326미측정. 미측정15개(8그룹)는측정군의개별특징범위밖. n최대2,232/E377,120/d67 등큰꼬리추가보강필요 |
| P1 | 실제 제품 경로 커버리지 | selected149개tinyeligible, primaryHard0개. direct child는여러빠른경로를우회했다. 상세경로별비용·삽입지도와ordinary 복합save/명령전체측정미완료 |
| P1 | fresh 검증 자료 | 보류55중52노출가능/3미확인. 현재데이터만으로fresh성능PASS불가. 보류는회귀장부로사용 |
| P1 | 과거 시간·진행자료 계약 매핑 | archive노출감사는있지만원행/K/seed/binary/lifecycle별시간재사용표가미완성. 기존Threshold≤5%차이에대한사용자정보를존중하되조건연결없이현raw와pooling하지않음 |
| P1 | 동적 관측·CPU/메모리 | nativeprep/search분리·같은탐색checkpoint·process-treepeak·동시요청은미관측. CP0states는진행량이아님. childRSS를tree전체로해석하지않음 |
| P2 | 전용 변동 retest·runner 안정성 | 사용자적응추가반복은전용V선별retest와다름. 이번기본자료에는CPU모델6종. 두runmatchedI/T방향반전은252개중5개이고양쪽10%이상확실한역전은0이지만,비교조건과추가표본수를혼합해유의성을과장하지않음 |
| P2 | 대형 독립 oracle | 원weightedwitness·상호일치는확인됐으나대형별도최적화oracle전체대조는아님. 신규정책이기존exactproof/stabletie계약을유지하는검사가필요 |
| P2 | 보존/현재상태 문서 | raw는로컬ignored+Actionsretention30일이며sourceGit에전체게시된것은아님. 이식가능한raw/fixtureseal필요. 옛WORK_STATE의실측미실행표현은역사상태로표시해야함 |

이 공백 때문에 방향 결정을 멈출 필요는 없다. 그러나 **P2의정보수집완료 → P3후보성능확정 → 제품적용**을 한 단계로 뛰어넘어서는 안 된다.

## 8. 추가 데이터 요청 방향

새 정책의 fresh 검증용으로 **기존275개 mirror group과 겹치지 않고 과거 실험/분류 튜닝에 사용하지 않은 setup fumen**이 필요하다. 권장 수집 목표는 **독립50그룹 이상**이며 충분성 보장이 아니라 모집 목표다. pattern은현재합의한bag/restricted-split, N+1, clear4/hold=true를우선유지하고원출처·mirror/alias를함께요청한다.

- 기존 N=6 편중을 줄일 수 있는 N=4/7 및 큰후보/원행규모 입력이 있으면 포함한다.
- K/F/d는fumen만으로확정할수없다. 성능을보기전에한번capture해d8/9·16/17·큰u/E 영역의실제분포를감사한다.
- 새검증자료를Astra가미리튜닝에사용하면그부분은개발자료로돌리고fresh라부르지않는다.
- 추가자료가없어도기존미측정save와보류그룹으로개발·회귀보강은가능하다. 다만그것을fresh일반화증거로대체할수없다.

## 9. 현재 인계 상태

**Astra 결정 완료:** 정적고-d I생략을첫질문으로하고,중간d는기존bounded처리,빠른/trivial/tiny보호,T/CP는고-u·모델비용·진행관측을구분한순차정책으로이행한다.

**다음 담당 Sol:** S0 보완과 S1/S2의상세구현·계측·비교계약·예산안을작성해돌려준다. 이문서는새하네스코드작성이나원격캠페인이실행됐다는기록이아니다.
