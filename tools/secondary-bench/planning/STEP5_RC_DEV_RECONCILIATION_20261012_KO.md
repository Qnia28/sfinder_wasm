# step5 검토 대조 및 DEV→RC 해결 후보

작성: Astra, 2026-10-12. 신규 solver 호출0. 제품 변경/추가 dispatch 없음.

## 1. 질문과 증거

검토 대상 `D:/AI/sfinder-wasm/triage-analysis/step5-preview-free/261011/`
의 RC_REVIEW_KO.md, SUMMARY.json, code/rc9_p15_isolation.py,
code/rc13_concurrency.py. 원문은 보존한다.

실제 비교는 DEV `7ef62d18e1d155b6479e00d651c851ff3baa7112` → RC
`2c406b98cadc186bfaf4490f4b8568535a60ea01`이다. 현재 checkout 경로 대신
두 commit의 `git diff ... -- src`로 확인했다. 제품 src 변경7파일,
WASM 변경 없음. r15 전수13,176호출과 r16 anchor16호출을 별도 해석한다.
r16 근거는 triage-experiments/rc-regression-r16의 calls/segments/seeds/traces.jsonl.
패키지 PACKAGE.json hash:
`6328cfb45f30fffd08e7b08e3d7d1be099b7f0ca9e1c24f136879daf5902d64d`.
원r16 감사 PASS, 공통 패키지는 R16 plan/감사 계약 미지원 오류를 보존한다.

## 2. step5에서 채택할 부분과 수정할 부분

채택: r15 산술 재현, 통합 RC만으로 개별 변경의 인과효과를 추정할 수 없다는
지적, 완료손실/CPU/메모리/시간을 함께 보는 접근, 슬롯 계측 필요성.
계측 요구는 r16 anchor로 일부 충족됐다. 비승격 판단도 일치한다.

### 중요한 오류: DEV를 A_H9로 바꿔 비교했다

RC_REVIEW 118~147행 및 rc9_p15_isolation.py 1~4행은 A_H9→P15의
`d15..16` 차이를 r15 DEV→RC에 적용한다. 실제 DEV
min-cover-exact-secondary.mjs는 `if (!primaryHard)`에서100k probe를 한다.
A_H9 모듈 자체가 DEV에 없다. 따라서 다음을 구분해야 한다.

| 정책 | non-hard | hard |
|---|---|---|
| 실제 DEV baseline | d와 무관하게 probe | probe 없음 |
| A_H9 | d≤16 probe | d≤9 probe |
| RC P15 | d≤14 probe | d≤9 probe |

trivial/별도route는 이 probe 분기 전에 처리된다. unknown 구조는 baseline fallback.
네 named 회귀는 non-hard이며 DEV와 RC의 실행probe가 실제로 달랐다.
**A_H9→P15의 마지막 경계축소는 해당 네 입력에서 차이가 없지만,
DEV→P15 전체 gate 도입의 영향은 배제할 수 없다.**
73입력의 +196.5초도 그 부분집합의 통합RC 이득이지 P15 단독효과가 아니다.
rc9의 그룹화는 primaryHard를 정책식에 반영하지 않으며 else를
`all d>=17`로 이름 붙이지만 low/high 혼합명령도 들어간다(89~92행).
이 분류로 인과를 분리했다는 주장은 성립하지 않는다.

### CP 경합 가설의 범위

CPU 증가 자체는 사실이다. 그러나 명령 wall≥60초는 CP시작의 직접 증거가 아니다.
60초는 명령 전체가 아니라 각 secondary 작업의 elapsed를 반영해 합류한다.
긴 enumeration/primary 또는 여러 짧은 per-save secondary 합도60초를 넘을 수 있다.
qualityBackend는 반환승자이며 CP시작/실패/패배 비율이 아니다.
따라서 승자분포가 유사하다고 routing/경합이 같다고 결론내릴 수 없다.
1.4714 대1.0129는 약1.453배이며 보고서의 '300배'가 아니다.
초과분끼리 비교해도 약36.54배다.

Actions maxParallel은 여러 VM의 동시 job수다. 한 VM의 thread/core 경합과
동일하지 않으며 rc13의 전체 호출 중첩17개를 한 머신 포화로 해석하면 안 된다.
maxParallel4/18 조정만으로 제품 내 CP/Rust 경합 원인을 분리할 수 없다.
필요하면 동일VM core quota/affinity와 엔진별CPU를 통제해야 한다.

### 메모리·회귀 우선순위

원 r15 pairs에서 population=ALL, exact=true를 직접 조회했다.
DEV 최대2,902,487,040 bytes는 cycle1-pcinfo-031/all/bag-plus-next-draw,
call bbd5da8819b7a48491ea2ec9e47a12fe5f71a5efc2f1f5aea6b9c565dfd64123.
RC 최대1,532,137,472 bytes는 cycle1-pcinfo-041/all/bag-plus-next-draw,
call80d450808b5663cf061cae7359738523f349c8599047254b0d73ac9efbf0f0ec.
둘 다 EXACT/EXACT pair다. 'OOM 부분집합의 최대값'이라는 반박은 틀렸다.
서로 다른 입력의 집합최대값이며 median 개선을 뜻하지 않는다는 한계는 타당하다.

QB219/QB136의 상대회귀도 보존할 가치가 있다. 그러나 약57ms/32ms 회귀가
11~17초 또는 완료손실보다 운영상 더 나쁘다는 결론은 ratio만으로 내릴 수 없다.
네 입력은 사용자가 지정한 절대손해/완료손실 조사우선순위다.

## 3. 코드상 차이와 가능한 인과 경로

### P: probe의 직접비용보다 seed 품질효과

`min-cover-exact-secondary.mjs`가 gate를 바꾸며,
`min-cover-three-engine.mjs:90~98`은 probe.keys가 유효하면 동일payload의
seed로 **threshold와 CP 모두**에 보낸다.
`cpsat-secondary-model.mjs:17,78~85`는 그 seed를 selected로 받아 최초 x hint로
제공하고, 다음 최적화 단계는 직전 해를 hint로 사용한다.
따라서0.1초 probe를 아껴도 두 exact 엔진의 탐색경로가 모두 달라질 수 있다.
seed는 최적성증명을 대체하지 않으며 hint가 좋은 만큼 항상 빠른 것은 아니다.

r16 QB068/I: DEV seed의 sorted weighted qualityVector 길이3006,
첫 차이 index2130(0-based)에서 DEV5 vs RC4. 두 반복 동일, DEV가 lex 우수.
QB293/S: 길이1974, 첫 차이index242에서 DEV2 vs RC1. 두 반복 동일.
QB068 RC는 I, QB293 RC는 S에서 미완료; 뒤 queued save를 별도회귀로 세지 않는다.
반례로 QB293 I/L은 seed가 달라도 RC가 더 빠르다. seed효과 크기는 입력 의존적이다.

### M: 논리적으로 동치지만 탐색에 다른 CP모델

DEV `logicalOr(ids)`는 `addMaxEquality(y, xs)`.
RC `cpsat-secondary-model.mjs:37~49`는
`addBoolOr(xs).onlyEnforceIf(y)` 및
`addBoolAnd(not xs).onlyEnforceIf(not y)`다.
Boolean 영역에서 둘 다 y↔OR(xs)를 뜻하므로 이 diff만으로 정확성 버그라 할 수 없다.
RC는 linMax의 각 입력별 expression proto를 두 literal목록으로 줄인다.
반면 constraint 종류/순서/전처리/LP relaxation/분기 경로는 달라질 수 있다.
두 버전 모두 `subsolvers:['max_lp']`,1worker,seed1을 사용하므로 특히 모델표현의
영향을 조사할 가치가 있다. 'RC의 LP bound가 반드시 약하다'는 것은 아직 가설이다.

배치quality→objective고정→30개씩stable-ID 증명의 큰 흐름은 동일하다.
동일feasible set이어도 각 stage solve가 빨라진다는 보장은 없고,
초기stage의 다른해가 다음stage hint를 바꿀 수도 있다.

r16 ALL QB321/QB318은 pair별 seed keys와 quality가 완전히 같다.
두 입력 모두CP승자, CP구간지연이 전체회귀 대부분과 대응한다.
DEV CP는49~92초에 끝나120초deadline 이전이다.
따라서 'DEV CP를120초에 끊어서 Rust가 빨라짐'으로 이 ALL회귀는 설명되지 않는다.
M이 최우선 후보이며 C(maxTime 파라미터 유무)와 미세runtime차이는 대조로 남긴다.

### C 및 worker/failure 변경

DEV CP limit120000→RC null이 orchestration, outer timer, worker,
CP stage별 remaining/maxTimeInSeconds 전달에 일관되게 반영됐다.
단순 타이머삭제 외에도 CP solver의 time-limit parameter 유무가 달라진다.
CP가 장시간 살아남으면 CPU를 더 쓸 수 있지만, seed/model로 탐색이 느려져
오래 산 것인지 지속정책이 원인인지 분리해야 한다.

`secondary-engine-runner.mjs`는 Rust실패시 CP 즉시시작/유지와 양엔진 실패처리를
강화했다. 성공경로는 여전히 Rust즉시시작, CP60초합류, exact승자 후 둘 다회수다.
r16 trace900개에서 engine-error0, 정상완료46/미완료4이므로 실패복구가
네 회귀의 주원인이라는 직접증거는 없다. 대기중 내부진행까지 관측한 것은 아니다.
worker/vendor의 memoryTrace는 hook 설치시에만 호출되는 진단이다.
변경된worker가 threshold 알고리즘이나WASM을 교체한 것은 아니다.
per-save pool 구현은 두commit간 동일; primary제출과 secondary는 겹칠 수 있으므로
명령 전체를 단순히 '7개 함수의 완전직렬합'이라고 쓰는 것도 과도하다.

## 4. 해결 후보와 우선순위

### 1순위: DEV식 probe + 기존 CP OR표현을 각각 복구한 진단 후보

RC 공통기반에서 다음 네 조합을 비교한다. CP무기한/RC실패복구는 고정한다.

| 후보 | probe | CP OR표현 | 답할 질문 |
|---|---|---|---|
| 현RC | P15 | compact | 대조 |
| SeedRepair | baseline(!primaryHard) | compact | I/S완료가 probe만으로 회복되는가 |
| ModelRepair | P15 | DEV linMax | 동일seed ALL회귀가 모델만으로 회복되는가 |
| CombinedRepair | baseline | DEV linMax | 두 변경의 상호작용/동시회복 여부 |

이미 설계한64호출 factorial의 C=null 절반이 이 네조합이다.
C120 절반은 역사적 원인대조다. 별도976호출 실험보다 먼저 네 회귀에서
이 비교를 끝내는 것이 현재 질문에 직접적이다. A_H9 vs P15만으로는 I/S probe를
복구하지 못하므로 step5 제안arm은 이 문제를 해결하지 못한다.

baseline probe 복구는 d>14 전체이득을 잃을 수 있고, linMax 복구는 큰 입력의
메모리/OOM 개선을 잃을 수 있다. 따라서 이들은 검증용 최소원인개입이지 전면승격안이 아니다.

### 2순위: 원인이 확인된 뒤 최소 제품수정

P효과가 확인되면: 광범위 gate폐기보다 seed보존형 probe정책을 설계한다.
현재d만으로 seed가치가 예측되지 않는다. 더 작은 state-budget, 지연 seed갱신,
구조기반gate는 별도 후보이며 현재증거로 특정임계값/family예외를 선택하지 않는다.
동적seed갱신은 CP가시작할 때만 적용하는지/진행중Rust재시작인지 구분해야 한다.
진행중Rust를 버리는 방식은 기존진행보존 요구와 충돌하므로 우선안이 아니다.

M효과가 확인되면: 메모리를 아끼면서 LP표현을 회복하는 후보로
`y >= x_i`(각i), `y <= sum(x_i)`의 Boolean OR등가선형식을 검토할 수 있다.
이는 가능한 설계일 뿐 기존linMax와 동등한 속도/메모리는 미입증이다.
혹은 모델규모 기반 hybrid linMax/compact를 검토하되 네입력에 맞춘
family gate로 일반화하지 않는다. OOM개선대표가 반드시 검증대상에 들어가야 한다.

C효과만 확인되더라도 production CP deadline은 복원하지 않는다.
엔진별CPU와corequota를 계측하여 경합을 확인한 뒤 scheduling/모델/seed를 개선한다.
CP조기시작/CPU affinity도 현시점 채택안이 아니다.

### 확인 및 완료 기준

추가진단은 각secondary에 trace taskId/piece를 직접 연결하고 CP stage별
quality/tie 소요시간, branch/conflict/bound 등 실제 지원통계를 수집한다.
기존memory hook으로 phase경계는 확보 가능하나 계측오버헤드는 별도로 표시한다.
현후처리의 K→piece 연결은 이번입력에서유일함을assert했을 뿐 일반키가 아니다.
VM CPU모델/논리core/cgroup cpu.max, engines별CPU를 기록하면 경합가설을 평가할 수 있다.

인과를 좁힌 뒤 최소수정 후보를 무계측으로 네회귀+이득대표+OOM개선대표에 검증한다.
원래fixture/pattern/N+1/clear4/hold/thread/600초를 유지하며 최종판단은
기본2회×3바퀴 arm별6회, exact Human/stable-ID/실패복구를 확인한다.
영향군에서 이득과 손해를 함께 집계한 다음 제품승격을 재판단한다.

## 결론

step5의 산술검토·변수분리 필요성은 유용하다. 그러나 비교기준 혼동으로
probe를 배제했고, 지속CP경합을 최우선으로 둔 논거는 r16에서 약해졌다.
현재 가장 설명력있는 복합가설은 **per-save의 seed손실 + ALL의 CP모델표현 비용**이다.
원인이 확정된 것은 아니다. CP무기한과 실패복구를 유지한 채 probe/model을
각각 복구하는 것이 해결법 탐색의 우선경로다. RC 비승격을 유지한다.
