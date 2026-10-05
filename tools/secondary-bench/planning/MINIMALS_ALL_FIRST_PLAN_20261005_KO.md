# Minimals ALL 우선 — 광범위 측정과 구현 순서 개정

2026-10-05 · Astra / Plan · **방향 개정 / 새 실행 manifest·예산은 미동결**

> **현재 실행 계약:** [FOLLOWUP_PREPARATION_KO.md](FOLLOWUP_PREPARATION_KO.md). 사용자 지정 F8VM/A12VM 동시 실행, 합산20VM이며 두 별도workflow를 준비했다. job 예산·disk guard·activate 실패진단·실패checkpoint만final재전송을 보완했다. 기본/retest 반복은 아래 제안을 유지하고 wall 경계는 전송예산포함 F36h/A108h로 봉인했다. CP primary2-worker/secondary1-worker 기본값 유지. 사용자가 보완후실행을승인했다. 아래16VM 및 미동결 표현은 이전 계획 상태다.

사용자 제안에 따라 일반 minimals `saves=ALL`을 주 연구·구현 대상으로 삼는다. 기존 per-save 캠페인은 잔여 미노 필터가 적용된 행렬의 정보로 보완·활용한다. Sol은 하네스·실험·구현을 담당하고 Astra는 결과 해석과 후보 방향을 결정한다. 서브에이전트는 사용하지 않는다.

이 문서는 [이전 후속안](FOLLOWUP_EXECUTION_PLAN_20261005_KO.md)의 **일반 ALL capture 후 hard+20group만 선별 측정하는 방식과 d≥17 후보 우선 구현 순서**를 대체한다. 기존 raw·커버리지 감사는 그대로 유효하다.

## 1. 판단과 수정 이유

- 기존 측정은 모두 per-save였다. 2,685개 capture 행렬의 primaryHard는 모두 false였으므로, ALL의 결합 행렬과 primary-hard 경로에 대한 분류 근거가 없다.
- per-save에도 secondary timeout/OOM이 있었다. 따라서 “어려운 입력이 전혀 없었다”가 아니라 **어려움의 범위와 행렬 모집단이 한쪽으로 치우쳤다**고 해석한다.
- 한 필터는 ALL에서 허용하는 해/edge를 제한한다. 그러나 필터링 후 K·forced·축소 kernel·증명 탐색이 바뀌므로, 작은 행렬의 solve 시간이 반드시 더 짧다는 단조 관계는 보장되지 않는다. 실제 ALL 자료를 확보해야 한다는 결론은 더욱 중요하다.
- 기존 d≤8/9–16/≥17의 관찰은 **잔여 미노 필터 자료의 개발 가설**로 유지한다. ALL 측정 전에는 ALL의 경계나 엔진 우열로 확대하지 않는다. 기존 primaryHard no-I 동작도 현행 기준이지 새 최적 정책의 증거는 아니다.

## 2. 두 자료군과 공통 준비

### 공통 준비 C0

이전안 F0를 그대로 수행한다: wave_decisions.engine 복구, 원 plan 대조, commandKind/filter 의미·primaryHard/kernel/backend·states 연결, 독립 OOM scope·회수, source/fixture/hash/checkpoint 보존, 전체449 ID의 대표/alias 연결.

두 새 캠페인은 ID·manifest·원결과·clock·예산을 분리한다. 완료한 캠페인을 재개하거나 기존 NOT_RUN을 덮어쓰지 않는다. 실행은 별도 실험 branch의 GitHub Actions, 여러 workflow 합산 VM≤16이다. 가벼운 검사·오프라인 분석은 로컬에서 수행한다.

### 자료군 F — 기존 필터 행렬 보완

**일반 ALL 확보·측정은 이 작업에서 빼고**, 이전안의 per-save 보완을 유지한다:

1. 미capture55group ×2family =110명령의 per-save capture. 최대770개 save fixture. 기존440명령은 재capture하지 않는다.
2. 새 nontrivial명령당 사전 hash로1save 선택(최대110개), BOX 미측정nontrivial9개, 기존 특징범위 밖15개를 합쳐 중복 제거. 새 측정행렬 최대134개.
3. T82/CP81의 미실행과 OOM 이웃 I28호출을 새 scope에서 회수: 최대191호출. OOM행렬 자체의 I미실행45개는 재시도하지 않고 원236개 NOT_RUN도 보존한다.
4. 새 정보수집60초·엔진당2회, 변동항목 별도2회 / 결측회수300초는 이전안의 **협의용 제안**을 유지한다. 같은 조건의 max/min≥1.10을 정보수집 retest 기준으로 쓴다.
5. 기존 per-save160개 진단군·tiny149개 등은 추후 필터 경로 회귀 장부로 보존한다. 이를 새 ALL 실험의 학습/평가 분모로 대체하지 않는다.

### 필터 의미를 확인한 뒤 재사용

개념적으로 같은 fixed-K exact solver가 필터링된 coverage를 처리한다. 다만 현재 구현의 입력 의미는 다음과 같다:

| 경로 | 필터 판정 |
|---|---|
| per-save | `unusedPiecePrepared`: 큐에서 사용하지 않은 미노가 정확히 하나인지 계산 |
| 일반 minimals | `savedMultiplicityCodePrepared`: 큐의 잔여 미노 + 마지막 bag의 미추첨 미노, multiplicity를 보존해 saves 식 판정 |
| 일반 `ALL` | saves 식이 모든 해를 허용 |

따라서 모든 패턴에서 per-save/T = 일반 `saves=T`라고 이름만 바꿀 수 없다. 완전한 단일 bag에서는 일치할 수 있지만 부분 bag·restricted·bag-plus-next-draw는 last-bag 의미를 확인해야 한다.

Sol은 동일 조건에서 case ID·stable solution key·원 weighted rows/quality를 canonical 대응해 동등성을 확인한다. 서로 다른 행 순서도 원 의미로 비교하며 byte hash가 같다고 추측하지 않는다. 필요한 실제 열거는 Actions에서 수행한다. 동등성이 확인되면 `FILTER_EQUIVALENT`와 판정 근거를, 그렇지 않으면 `QUEUE_REMAINDER_FILTER`와 차이를 남긴다. **원자료에 ordinary 호출시간 또는 일반 saves=T 측정이라는 label을 소급 부여하지 않는다.**

## 3. 자료군 A — minimals saves=ALL의 새 광범위 측정

### A0. 모집단·조건 동결

- 세 DB 전체 **275개 mirror group의 대표 ×2family =550명령**을 모집단으로 한다. 449 ID는 alias 대응표에 남기며 별도 독립 표본으로 세지 않는다.
- clear4 / hold=true / N+1 / bag 계열 및 restricted-split. independent-split은 제외한다. BOX도 포함한다.
- 명령은 `kind: 'minimals'`, 하네스 필드는 `wantedSave: 'ALL'`, 제품 의미는 `saves=ALL`이다. Human quality exact를 명시한다.
- 모든550명령에서 원행/K/seed capture와 상태를 확보하고, **primary를 증명한 모든 nontrivial ALL 행렬을 세 엔진 측정 대상으로 삼는다.** 한 setup의 save를 다시 선별하지 않는다. ALL 행렬은 명령당하나다.
- primaryHard와 무관하게 direct 세 엔진 모두 대상으로 둔다. 현행 Auto가 Integrated를 생략한다고 direct I 측정을 사전 제외하지 않는다. OOM 발생 이후 반복 중단은 독립된 상태/자원 계약으로 기록한다.
- 보류55group은 이미 fresh로 확인되지 않았으므로 이550명령은 전체 개발 모집단이다. 기존자료와 같은 geometry여도 새 ALL 측정을 fresh holdout으로 부르지 않는다.

### A1. BOX preflight와 전체 capture

1. BOX ALL의 bag/restricted 두명령에서 일반 제품 collector와 하네스의 case·solution·quality 의미를 대조한다. 예상한 primary-hard 여부가 다르면 kernel stats와 원명령을 비교한다. true를 강제하거나 false라고 BOX를 빼지 않는다.
2. 전체550명령을 capture한다. 원행/가중치/stable ID, primary kernel stats/flag/backend, 최소K의 증명과 seed, n/K/R/E/F/d/u, 각 phase 시간·메모리·실패상태를 보존한다. F는 원 singleton 기준이며 primary forced와 다르다.
3. primary가 미완료이면 `PRIMARY_UNPROVEN`을 남긴다. 그 명령을 empty/trivial로 바꾸거나 secondary에 넘기지 않는다. primary 미완료가 집중되면 별도 bounded 회수안을 마련하고 분석의 누락 분모로 유지한다.
4. trivial/empty도 모집단 상태로 보고하며 trivial 종료는 이후 실제 명령 회귀에서 측정한다. 강제 세 엔진 호출 수를 늘리기 위해 trivial을 nontrivial로 바꾸지 않는다.
5. 동일 계약·동일 fixture 증거가 확인되는 과거 capture는 재사용할 수 있지만 과거 timing을 새 호출로 세지 않는다. per-save fixture/최적해를 합쳐 ALL의 K·seed·시간을 만들지 않는다.

### A2. 모든 eligible ALL 행렬의 세 엔진 정보 수집

**권장 초안: call 제한300초, 각 엔진 최초2회, 변동항목 별도2회.** primaryHard를 포함한 큰 행렬이 주 목적이므로 60초 광범위 측정 후 같은 모집단을 다시300초로 반복하기보다 처음부터300초의 단일 조건으로 모은다. 이 숫자는 실행 전 협의·manifest 동결 대상이며 옛300초 캠페인4→20회 규칙을 승계하지 않는다.

- 엔진: Integrated / Threshold / CP-SAT. direct Rust stateBudget=null. 엔진별 종료시각/메모리한도·CP 내부limit를 정합적으로 고정한다.
- fixture별 K/seed/원행은 고정하고 세 엔진의 초기 입력은 동일하게 한다. direct 비교에서 다른 엔진의 개선 seed를 넘기지 않는다.
- 엔진순서를 균형배치하고 기본 두 반복의 runner/job/block 정보를 보존한다. 재검사에는 별도 phase를 붙인다. 정보수집을 paired 정책 A/B라고 부르지 않는다.
- OOM은 해당 엔진×fixture를 중단·격리하고 다른 엔진/이웃은 깨끗한 scope에서 진행한다. 예정된 후속 반복은 NOT_RUN_AFTER_OOM으로 남긴다. 동일한 timeout·OOM을 성공할 때까지 재시도하지 않는다.
- 검열 상태와 완료시간을 분리한다. CP FEASIBLE·bounded·proof pending은 exact가 아니다. weighted quality와 stable-ID 증명을 대조한다.
- 자료군 F와 A는 동일 scale로 합산해 winner를 정하지 않는다. 같은 setup/pattern의 paired 구조 변화는 볼 수 있지만, 서로 다른 문제의 runtime 비율을 후보 정책 개선율로 해석하지 않는다.

### A3. Astra 재해석

ALL 전체분모, primaryHard/non-hard, trivial/empty/primary미확정, family, 구조구간별로 완료범위·시간·준비비용·메모리를 분석한다. 완료자만 남겨 CP 역할이나 OOM 손실을 숨기지 않는다.

결정 질문:

1. ALL에서도 작은 d의 Integrated 보호·높은 d의 생략 가설이 유지되는가? d17을 먼저 고정하지 않는다.
2. primaryHard에서 현행 no-I가 타당한가? primary-hard와 secondary 난도를 혼동하지 않는다.
3. Threshold/CP 우열을 구분할 저비용 정적 특징과 동적 관측의 가치가 있는가?
4. 필터를 적용했을 때 ALL의 규칙이 유지되는가, 불확실 영역이 달라지는가?

실제 제품 Auto100K probe 비용·seed효과는 direct 자료만으로 계산할 수 없으므로 후보 A/B의 별도 질문으로 남긴다. 수치경계·관측API·최종순차전환 정책은 이 해석 후 선정한다.

## 4. 구현·검증의 주 경로

```text
공통 하네스 보완
 → ALL 광범위 capture + 세 엔진 측정 (주 자료)
   + 기존 per-save/잔여필터 보완 (보조 자료)
 → Astra 후보 결정
 → 일반 minimals의 공통 coverage/secondary solver·라우팅 구현
 → 일반 minimals ALL 실제 정책 A/B + 명령 전체 검증
 → 일반 saves 필터의 계약·성능 회귀
 → per-save에 같은 공통 정책 적용 + 전용 wrapper/pool 비용 검증
 → 동시 요청·브라우저·fresh 검증
```

- 공통 solver가 이미 두 기능에서 공유된다면 두벌을 새로 만들지 않는다. 구현 시 공통부 변경은 우선 명시적 실험옵션으로 비교하고 per-save의 기본동작에 미검증 규칙을 즉시 활성화하지 않는다.
- generic matrix 특징으로 분류한다. ALL/per-save 이름이나 setup ID로 엔진을 하드코딩하지 않는다. 경로별 tiny/trivial/pool·필터 계약은 보존한다.
- ALL에서 먼저 정책을 검증하되, 승격 전에 필터 자료로 빠른 경로 악화를 검사한다. per-save wrapper는 공유열거·여러save 취합·병렬성·큐 대기를 포함하므로 ordinary 단일호출 성능으로 대체하지 않는다.
- A/B 횟수·숫자gate는 후보/모집단이 정해진 다음 최초실행 전에 동결한다. 재검사 규칙은 개선상위10% ∪ 악화상위10% ∪ 변동≥1.10 ∪ gate영향이다.
- exact 계약, 취소·회수, 행렬당활성secondary하나의 최종목표, 실제CPU/메모리·동시요청비용의 평가 원칙을 유지한다.

## 5. 비용 산식과 실행 인계

ALL eligible nontrivial 수를 `M≤550`, 변동재검사 대상 엔진×fixture 수를 `V≤3M`이라 하면:

| 항목 | 제안 조건 | 최악 search/phase 시간 산식 |
|---|---|---|
| ALL capture | enumeration60초 + primary300초/명령 | 최대55 runner-hour; 16VM 이상적분배3.44h |
| ALL 기본 | 300초 ×3엔진 ×2회 | 6M호출; M/2 runner-hour. M550이면275 runner-hour /16VM 이상적17.19h |
| ALL 변동재검사 | 선정엔진×fixture마다 추가2회, 300초 | 2V호출; V/6 runner-hour. V1650이면추가275 runner-hour |
| 자료군 F | 이전 F1a·F2 per-save/회수안 유지 | capture최대14.67 + 기본/회수29.32 runner-hour, 변동재검사·준비는별도 |

위값은 모든호출이상한을소진하는 **최악 budget 계산**이며 실제예상시간/최소시간이 아니다. startup/reap·upload·queue·job skew는별도다. **ALL300초 기본만으로도 최악17.19h이므로 옛6h/8h wall budget으로 전셀완료를 보장할 수 없다.** 기본과변동재검사를 별도run/block으로 분할하고 global계약·원장을공유한다.

Sol의 다음 산출물:

1. 자료군F와 ALL각각의실행manifest초안, 기본/재검사호출상한, wall/runner-hour예산, chunk/job시간, 합산16VM스케줄.
2. 원본보존·격리·일반collector대조·필터의미연결의경량계약결과.
3. ALL모집단550명령장부, BOX필수포함, primary미완료처리, retest/중단규칙.

새 시간제한·반복수·전체budget을확정한뒤원격실행한다. 이번방향수정에서는새solver호출·제품수정·원격실행을하지않았다. 기존미노출추가데이터요청은fresh검증단계용으로유지하며 ALL개발캠페인의착수를막는조건으로삼지않는다.
