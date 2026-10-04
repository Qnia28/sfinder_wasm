# 광범위 3엔진 정보 수집 — 협의안

2026-10-05 / **DRAFT — 측정 승인·실행 계획이 아님**.
원본 저장소·GitHub main·제품 solver는 변경하지 않았다. 초기 제안 시점에는 원격 실행이 없었으며 후속 준비 단계에서 새 실험 branch의 계약 preflight만 확인한다. 광범위 실측은 아직 시작하지 않는다.

## 최신 사용자 지정 — 이전 제안보다 우선

- independent-split을 제외하고 **bag 계열 / restricted-split 두 family만** 사용한다.
- save 1~2는 **큐에서 남는 미노 수**다. N+1/N+2 중 하나만 쓰라는 후속 지시에 따라 이번 준비판은 **N+1만** 생성한다. 220 개발 그룹에서 bag·restricted 각1개, 총 **440 command**이며 같은 family에서 두 길이를 중복 실행하지 않는다.
- secondary timeout **60초**, 기본 반복 **2회**. campaign 실행 경과가 6시간 미만이면 직전 두 회가 모두 TIMEOUT이 아닌 입력에 2회씩 추가한다. 최대 10회.
- 예산은 **campaign 실행 경과 8시간**으로 관리한다. runner-hour를 예산 상한으로 쓰지 않는다. 총 동시 VM≤16을 유지한다.
- Actions job은 6시간 제한에 접근하지 않게 분할한다. **최대4 task/job, 계산 최대32분 / hard60분**, 각 task scope hard10분/step11분으로 구현했다. task마다 artifact2분 한도 checkpoint, campaign 종료 전에 업로드용5분 여유를 둔다. 다음 2회 블록 전체를 수용 가능한지 검사한다.
- 예상 solver timeout·incomplete·작업 budget 중단은 결과 상태로 기록하며 정상 종료한다. raw/fixture를 즉시 영속화하고 job 내 작은 chunk마다 원격 checkpoint를 업로드한다. 분석의 불일치도 결과 보고서에 표시한다. 플랫폼 hard timeout, VM 유실, 사용자 강제취소 자체를 Actions success로 바꾸는 것은 보장할 수 없다.
- 추가 반복은 성능 변동 선별 재테스트와 구분한 **사용자 지정 정보 수집 반복**이다. 기존 변동≥1.10 selector는 별도 진단 목록으로 보존하며 임의의 추가 호출 예산을 만들지 않는다.

실행 해석: 두 TIMEOUT 제외는 **engine×fixture별**로 적용한다. 공통 시계는 **workflow created_at부터 캡처·VM 대기·setup 포함**으로 보수적으로 적용하며 재시도로 리셋하지 않는다. startup10초/reap5초, full call60초/CP내부60초/캡처전체60초, enumeration·각primary phase60초를 명시한다. CP는 모델/초기화 시간까지 포함한 외부60초 watchdog이 먼저 도달할 수 있다.

`INPUT_PROPOSAL_2FAMILY.json`은 기존 220 개발/55 보류 분할을 유지한다. 개발 그룹의 N은 **4미노2 / 6미노204 / 7미노14**이며 queue 길이는 각각5/7/8이다. 패턴은 `*p5` / `*!` / `*!,*p1`, 제한 split은 `[ILJ]p3,*p2` / `[ILJ]p3,*p4` / `[ILJ]p3,*p5`이다. 2-save 큐는 이번에 생성하지 않는다.

### 실행량 산식 (최종 nontrivial fixture 수 M)

- 기본 호출 `M × 3엔진 × 2회 = 6M`, 10회까지의 정적 상한 `30M`. 실제 추가 호출은 timeout 제외·시간 상한에 의해 줄어든다.
- 220 개발 그룹 × 2 family = **440 command**. command당 1~2 측정 fixture일 때에만 M≤440~880이다. 큐에서 미노를 1~2개 남기는 뜻이면 이 식으로 fixture 수를 확정할 수 없다.
- 모든 호출에 60초를 배정하고 16 VM을 완전히 균등하게 사용하는 경우의 할당시간: M=440은 기본 **2시간45분**, 10회 **13시간45분**; M=880은 기본 **5시간30분**, 10회 **27시간30분**. 이 값은 캡처·startup·검산·회수·VM 준비·업로드·불균형을 제외한다. 8시간 안에 모두 10회는 보장하지 않는다.
- 예를 들어 startup 10초/reap 5초를 유지하면 최악 호출 예약비용은 80초여서 기본 반복만 M=440에 **3시간40분**, M=880에 **7시간20분**이 필요하다(16 VM 균등, 그 밖의 overhead 제외). 880 fixture에서는 캡처까지 같은 8시간에 넣는 보장을 할 수 없다.
- 현재 준비판의 command당 비trivial save 행렬 하나 선택안에서는 **M≤440, 기본≤2,640 call / 전체≤13,200 call**이다. 캡처는≤440 command이며 모든 save의 proven fixture는 별도로 보존한다(최대3,080개). 이 수는 save1~2에서 도출한 상한이 아니라 별도 행렬 표본 규칙에서 도출한 상한이다.
- 4-task chunk에서는 캡처110job·기본반복최대110job, 추가 각단계최대110job이며 16개씩 실행한다. 최초 계산만 최악 캡처 약37.3분+기본3시간44분=**약4시간21분**, 여기에 VM·npm·artifact·단계 planner overhead가 붙는다. 모두10회라면 정적 job상한660개이나 시간/timeout 조건 때문에 그 전에 끝난다. 일부 기본반복도 8h에 미완료가 될 수 있고 이를 감추지 않는다.

**아래 3-family·30초·runner-hour·고정 추가720회·job4시간 등은 최초 제안의 역사 기록이며 현재 실행 지시가 아니다.** 확정 manifest와 원격 실행기는 최신 지정 및 질문 답변으로 다시 동결한다. 기존 `LOCAL_SOURCE_LOCK.json`도 변경 전 준비 snapshot이며 신규 캠페인의 source lock으로 재사용하지 않는다.

## 1. 실제 DB 분포

| DB | ID | 해당 DB mirror 그룹 | 4-line에서 6미노 PC인 ID |
|---|---:|---:|---:|
| cycle-1 | 45 | 41 | 30 |
| cycle-2 | 48 | 26 | 44 |
| cycle-7-2plus2-qb | 356 | 238 | 356 |

- 전체 **449 ID / 411 Fumen 문자열 / 316 보드 / 275 mirror 그룹**. DB 사이 중복이 있어 위 group 수를 합산하면 안 된다.
- 모두 단일 page·operation/garbage 없음·height≤4이고, 지원되는 PC 높이가 존재한다. 실제 해 존재 여부·열거 완료·K는 아직 계산하지 않았다.
- 4-line 기준 독립 mirror 그룹: **4미노 PC 2 / 6미노 PC 259 / 7미노 PC 14**. 7미노 PC는 필요한 미노 수이고 7-bag pattern과 같은 뜻이 아니다.
- 4개 기존 증거 묶음의 보수적 부분 감사로 **84 그룹에 과거 노출 또는 노출 가능성**을 연결했다. **191 그룹은 미확인이지 fresh가 아니다.** Threshold의 나머지 아카이브·다른 실험 자료 감사를 계속해야 한다.
- 노출 감사와 과거 시간 재사용은 다르다. 직접 3엔진 시간·binary/input/lifecycle/state cap/timeout 조건까지 대조한 재사용 행 목록은 아직 동결하지 않았다. 옛 Integrated 100K probe를 direct Integrated exact 완료시간으로 재사용하지 않는다.

원자료: `CATALOG_GEOMETRY.json`, `HISTORY_AUDIT_PARTIAL.json`.

## 2. 권장 범위: 보드 폭을 유지하고 save 행렬 수를 제한

`INPUT_PROPOSAL.json`은 DB 파일명이 아니라 decoded geometry로 만든 초안이다.

1. **275 그룹 중 220 그룹을 개발 모집단, 55 그룹을 미측정 보류**로 제안한다. 보류는 미확인 그룹에서 성능과 무관한 hash로 선택했다. 전체 노출 감사 후 fresh 여부·배분을 재확정한다.
2. 220 개발 그룹마다 대표 보드 한 방향만 사용하되 전체 ID·mirror alias를 보존한다. 원 데이터베이스별 가중치·독립 그룹 집계는 분리한다.
3. 세 pattern family를 제안한다. clear=4, hold=true, per-save 명령, Human quality exact를 명시한다.

| 필요한 미노 / queue 길이 | bag family | restricted-split | independent-split |
|---|---|---|---|
| 4 / 5 | `*p5` | `[IJL]p3,*p2` | `*p3,*p2` |
| 6 / 7 | `*!` | `[IJL]p3,*p4` | `*p3,*p4` |
| 7 / 8 | `*!,*p1` | `[IJL]p3,*p5` | `*p3,*p5` |

이 패턴은 **협의용 생성 규칙**이며 DB가 제공한 bag 계약이라고 주장하지 않는다. `*!,*p1`은 다음 bag에서 한 draw를 덧붙이는 별도 모집단이다. ordinary minimals의 복합 save-expression, hold=false, clear=2/3/5/6은 아직 별도 범위다. 이를 이번 1차 범위에 넣을지 협의가 필요하다.

4. 최대 **660 command**를 캡처해 모든 save의 EMPTY/TRIVIAL/tiny/일반 상태와 원행·K·seed를 기록한다. 최대 4,620 save 행렬이나 실제 수는 미정이다. 같은 matrix/K/seed/stable universe/실행 계약만 중복 제거하며 alias를 보존한다.
5. 신규 직접 측정은 **command당 최대 하나의 비trivial save 행렬, 총 660개 이하**로 제안한다. 후보가 여럿이면 `(group,family)`별 hash로 정한 순환 save 순서의 첫 행렬을 선택한다. 사전에 정의한 규칙으로 저장하며 측정시간을 보고 바꾸지 않는다. tiny 비trivial도 배제하지 않는다. 이 규칙은 모든 save의 runtime 분포를 대표하지 않는다.
6. `n/K/R/E/F/d/u`, trivial·tiny 비율과 family/source/save 분포를 캡처 후 감사한다. 큰 `n/K/R/E` 꼬리나 특정 save가 빠졌으면 **실측 전에** 행렬 배분 수정안을 다시 제시한다. cutoff 주위만 선택하지 않는다.
   enumeration·primary·전체 command timeout으로 미확보된 입력도 분모와 failure ledger에 남긴다. 캡처는 제품 save 표시 순서로 처리하므로 전체 command 제한에 가까운 입력의 뒤쪽 save는 특히 누락될 수 있다. 완료된 save만 모집단이라고 재정의하지 않으며 그 편향을 검토하기 전 최종 matrix 목록을 동결하지 않는다.
7. 과거 직접 3엔진 측정이 동일 계약으로 재사용 가능한 행렬은 신규 호출을 절약한다. 하지만 기존 노출 표본을 신규 broad 표본으로 바꾸어 세지 않는다. 현행 Threshold와 옛 시간 차이가 5% 이내라는 사용자 정보는 재사용 해석에 반영한다.

캡처와 구조 감사까지 먼저 승인하고, 그 결과를 보고 최종 3엔진 행렬 목록을 별도 동결하는 **2단계 합의**를 권장한다.

## 3. 횟수·timeout·예산 제안

모두 **제안값**이다. 횟수·한도를 합의하지 않고 실행하지 않는다.

| 단계 | 제안 횟수 / timeout | 최대 호출·유한 비용 |
|---|---|---|
| fixture 캡처 | command 1회. startup 15초, enumeration 60초, save별 primary 30초, command 전체 180초, reap 5초 | 660 command × 최악 205초 = **37.6 runner-hour** |
| 1차 3엔진 정보 수집 | 행렬별 각 엔진 **2회**. startup 10초, full secondary call 30초, reap 5초, CP 내부 25초 | ≤660×3×2=**3,960 call**. 최악 50초/call = **55 runner-hour** |
| 변동 재테스트 | 동일조건 max/min≥1.10인 **엔진·행렬 조건만 2회 추가**. 최초 두 회를 보존. 새로운 반복도 원래 그룹 통계와 함께 보고 | **추가 720 call / 10 runner-hour 이하**를 별도 제안. 초과 시 중단하고 추가 예산 협의 |

- 신규 broad 계획 합계의 호출 대기·강제회수 포함 이론상 상한은 **102.6 runner-hour**. OS/VM provisioning·npm·artifact·감사 overhead는 별도 여유를 두고 **전체 billable 120 runner-hour** 상한을 제안한다. historical reuse/EMPTY/TRIVIAL/빠른 완료로 실제 사용량은 줄어들 수 있다.
- 동일 행렬의 세 엔진을 같은 VM에서 직렬 실행하고 순서를 반복·행렬별로 분산한다. 최초 2회는 max/min 변동을 확인하는 최소안이며 중앙값 안정성·p95/p99를 증명하지 않는다. **3회 최초안**은 측정 최악 비용이 82.5 runner-hour로 늘어나며 총 예산도 다시 합의해야 한다.
- 16 VM까지 사용 가능하지만 workflow를 동시에 겹쳐 **합산 16을 넘기지 않는다**. 권장: 캡처 완료·감사 후 측정 workflow 시작, 단계별 최대 16 VM. 각 job 4시간, 단계 wall 5시간, campaign wall 16시간을 제안한다. artifact 전체 예산 5GiB를 제안하며 압축 크기·원자료 손실 없는 업로드가 상한 내 가능한지 캡처 전 pilot로 확인해야 한다.
- full call에는 입력 read·init·packing·native/CP 모델·exact 탐색을 포함한다. Rust의 100K state cap 없이 호출한다. 제한 도달은 TIMEOUT/INCOMPLETE이며 definitive loser나 정확한 완료시간으로 쓰지 않는다. 느린 입력에 더 긴 timeout을 줄 후속 진단은 별도 제안·승인한다.
- 3GiB/swap=0 cgroup은 shard 전체 parent+child+CP thread 제한이다. OOM 식별, public Linux runner의 reclaim, artifact·VM 상한과 외부 job/campaign watchdog은 원격 preflight 이후 실측 workflow에서 확인·보강해야 한다.

## 4. 완료된 준비와 남은 것

완료: 독립 저장소·실험 branch, DB 복사·hash 감사, 원행/K/seed 추출 어댑터, 직접 세 엔진 child, 외부 watchdog·worker 회수, raw fsync·source lock, offline witness audit·일정·목적별 retest selector, 합성 입력 계약 검사.

남음: 전체 과거 노출·시간 재사용 감사, ordinary minimals 모집단 계약, 최종 matrix 선별 실행기, 선택 조건만 추가하는 retest 실행기, approved manifest 작성, 실측 Actions/cgroup/OOM·전체 예산 controller·독립 감사를 묶은 원격 동결 및 preflight. 제품 Auto/새 분류 규칙은 구현하지 않았다.

**논의할 결정:** 220 개발/55 보류와 세 pattern family의 4-line per-save 1차 범위, 캡처 180초/최대660 command, 최초2회/30초/변동조건 추가2회의 예산안을 수용할지. save 조건·범위부터 바꾸면 먼저 입력 제안을 갱신한다.
