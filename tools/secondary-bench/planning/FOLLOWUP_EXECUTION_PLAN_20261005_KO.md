# Astra 분석 후속 — 커버리지 보완과 라우팅 비교 실행안

2026-10-05 · **DRAFT / 계획 작성만 완료. 새 구현·solver 호출·Actions 실행 승인 기록 아님.**

> **사용자 제안 반영 개정:** [MINIMALS_ALL_FIRST_PLAN_20261005_KO.md](MINIMALS_ALL_FIRST_PLAN_20261005_KO.md)가 현재 실행 방향이다. 아래 F0·F1a·F2의 per-save/회수 부분은 필터 자료 보완으로 유지한다. F1b의 ALL 확보는 별도 광범위 캠페인으로 옮기고, F2 ordinary의 hard+20group 선별은 모든 eligible ALL 행렬의 세 엔진 측정으로 대체한다. F3의 d17 선행 구현과 이후 구현 순서는 ALL 분석 → 일반 minimals 우선 → saves/per-save 적용으로 대체한다. 아래 예산표의 F1b/F2 ordinary는 옛 제안이다.

역할: Astra가 해석·방향을 결정하고 Sol이 후속 구현·계측·실험을 담당한다. 서브에이전트는 사용하지 않는다. 실험 저장소/branch에서만 작업하며 원본 `dev-branch`, GitHub `main`, 기존 완료 측정은 변경하지 않는다.

상위 방향: [Astra 분류 결정](ASTRA_ROUTING_DIRECTION_20261005_KO.md). 이번 확인 근거: [전체 DB/BOX 커버리지 감사](FOLLOWUP_COVERAGE_AUDIT_20261005.json).

## 1. 먼저 답변: BOX와 전수 측정

### 1.1 Cycle1의 4×4 BOX는 포함됐지만, 알려진 primary-hard 명령은 측정되지 않았다

점유 보드 `3c0f03c0f`는 왼쪽 4열×4행의 16칸 BOX다. Cycle1의 `cycle1-pcinfo-015`, `cycle1-pcinfo-020`은 이 보드를 공유한다. 대표 `015`로 묶였으며, 세 DB에 걸친 alias는15개다.

이번 조건은 clear4, hold=true, N=6, N+1=7, **per-save**다:

| 패턴 | capture | 3엔진 시간 측정 | capture만 한 nontrivial save |
|---|---|---|---|
| bag `*!` | T/I/L/J/S/Z/O 7개 | S | T/Z/O |
| restricted `[ILJ]p3,*p4` | T/I/L/J/S/Z/O 7개 | T | I/L/J/S/Z/O |

bag I/L/J는 original-singleton trivial이다. **총14개 행렬 capture, 11개 nontrivial 중2개 시간 측정, 9개 nontrivial 미측정**이다. `020`의 별도 물리 호출을 수행한 것은 아니다.

제품 `primaryHard`는 **셋업 이름이나 모양의 상수**가 아니라, 실제 coverage 행렬을 primary kernelization한 뒤 남은 cases/solutions/entries로 판정한다:

```text
(cases≥200 && solutions≥112 && entries≥2200)
  또는
(cases≥650 && solutions≥105 && entries≥6000)
```

BOX의 이번 per-save14개 모두 false다. 예를 들어 restricted/T는 원행 n976/K13/R1152/E55456, 원 singleton F0/d13이지만 primary kernel은 cases0/solutions0/entries0/forced13이다. primary 축소에서 K를 증명한 forced와 원행 singleton F는 다른 값이다. **primary가 쉬워도 exact secondary가 어려울 수 있다.**

전체 capture2,685개의 저장된 kernel stats와 flag도 대조했고 모두 false였다. 이 검사는 원 fixture hash를 검증하고 저장 stats에 판정식을 다시 적용한 것이다. 이번에 kernel을 새로 생성하거나 solve한 것은 아니다.

반면 **일반 minimals의 saves=`ALL`은 여러 save의 해를 한 행렬에서 최적화**한다. per-save의 K/seed/kernel/품질을 합치거나 시간을 더해 대체할 수 없다. 과거 source의 BOX-derived primary kernel hard 사례와 과거 BOX `*!` 일반 exact 제외 기록은 존재하지만, 현재 source·pattern·save 조건의 일반 BOX 행렬은 이 두 캠페인에서 관측되지 않았다.

따라서 정확한 결론은 **“BOX geometry 누락은 아님 / 일반 minimals의 primary-hard BOX 조건 커버리지는 빠짐”**이다. 현재 일반 BOX의 flag를 확인하기 전 true/false로 새로 확정하지 않는다. BOX를 blanket 제외하거나 모양 이름으로 hard를 강제하지 않는다.

### 1.2 세 DB 전수 성능 측정은 아니었다

| 단계 | 범위 |
|---|---:|
| DB 원본 인벤토리 | 449 ID / 411 fumen 문자열 / 316 점유 보드 / 275 mirror group |
| 개발 capture | 220 group ×2패턴 =440명령 |
| 아직 capture하지 않은 보류 | 55 group / 해당 group의75 DB ID |
| capture된 save 행렬 | 2,685개: trivial1,050 + nontrivial1,635 |
| 세 엔진 측정 대상으로 선별 | 309개 nontrivial /205 group |
| capture만 한 nontrivial | 1,326개 |
| 개발 중 선택할 nontrivial이 없는 group | 15개: trivial-only/empty |

440명령의 capture가 모두 완료됐다는 것은 **세 DB 모든 셋업·패턴·save의 시간 측정이 완료됐다는 뜻이 아니다.** 60초/300초 run은 같은309개를 반복했으며 모집단을 늘리지 않았다. extended는 OOM 이후 미실행도 남았다.

DB별 geometry 대표를 통한 커버리지는 다음과 같다. alias 연결은 별도 실행을 의미하지 않으며, source 간 group은 겹쳐 합산하면275가 되지 않는다.

| DB | 원 ID / group | capture 대표가 있는 ID / group | 측정 save 대표가 있는 ID / group |
|---|---:|---:|---:|
| Cycle1 | 45 /41 | 45 /41 | 45 /41 |
| Cycle2 | 48 /26 | 41 /22 | 41 /22 |
| Cycle7 2+2 QB | 356 /238 | 288 /186 | 271 /171 |

즉 Cycle1 geometry는 전부 대표로 포함됐다. 하지만 **Cycle1의 모든 save, 일반 minimals, primary-hard 경로까지 측정한 것은 아니다.** 449 ID 각각의 대표·분할·capture/측정 연결 및 누락55group은 감사JSON에 기록했다.

## 2. 계획 변경: 정적 gate 구현 전에 coverage를 보완한다

순서는 다음으로 수정한다:

```text
자료/export 및 OOM 격리 보완
 → 미capture55group + 일반 minimals 행렬 capture
 → BOX·범위 밖 save·실제 primary-hard 경로의 정보 보강
 → Astra 재해석, d17 후보 유지 여부 확인
 → 현행 Auto vs 정적 후보 실제 paired A/B
 → Threshold 관측/순차 CP 후보
 → 전체 명령·동시 요청·브라우저·fresh 검증
```

이미 측정한309개를 다시 광범위20회씩 돌리는 대신 **없는 조건과 실제 정책 비용**을 채운다. 기존 보류55는 노출 가능52/미확인3이므로 새 개발/회귀 보강으로 쓰며 fresh holdout으로 주장하지 않는다.

## 3. 단계별 Sol 작업과 완료 조건

### F0. 장부·export·격리 보완 (로컬 경량 작업)

1. `wave_decisions`의 누락 `engine`을 원 `WAVE_PLAN.json`에서 복원한다. `(runId,fixtureId,engine,stage)` 유일성 및 원 plan의 모든 결정과 대조하는 테스트를 추가한다. 기존 export를 지우지 않고 revision을 발행한다.
2. fixture/call join에 `commandKind`, `wantedSave`/잔여save, `primaryHard`, primary backend/kernel stats, `tinyEligible`, 완료states와 그 의미를 추가한다. per-save와 ordinary를 이름이 같은save만으로 합치지 않는다.
3. 449 ID→대표group→명령→save→engine→repeat 상태표를 만든다. alias-only, trivial, empty, 미선택, timeout, OOM, NOT_RUN을 구분한다. 전수라는 표현에는 **ID/geometry/명령/save/호출 중 어느 수준인지** 붙인다.
4. 새 호출의 OS 메모리 scope를 엔진×fixture 호출마다 독립적으로 만들고 회수한다. I가 OOM 나도 T/CP 또는 다음 행렬까지 불필요하게 격리되지 않게 한다. 메모리 한도는 기존3GiB를 유지하는 안을 기준으로 고정하고 임의로 완화하지 않는다.
5. native/Node/하위Worker 취소·회수와 OOM 모의 계약 검사를 로컬 및 Actions preflight에서 확인한다. 원 artifact pagination/digest/checkpoint 계약은 유지한다.

완료 조건: 원raw 변경0, 누락engine 결정9,270개 대조, 통합 regression PASS, 새 호출 scope 실패가 이웃 측정을 오염시키지 않는다는 계약 검사.

### F1. 구조·primary coverage 보완 (Actions, 성능 우열 주장은 하지 않음)

**F1a — 미capture55group:** 동일 두family·N+1로110개 per-save명령을 capture한다. 모든 남는미노 필터를 보존한다. 기존440개를 다시capture하지 않는다. 최대770개 새 save fixture를 얻을 수 있지만 실제 empty/trivial에 따라 줄어든다.

**F1b — 일반 minimals:** 전체275group의 대표에 대해 같은 두family, saves=`ALL`로 **550명령**의 일반 행렬을 capture한다. 같은조건의 과거 원행/K/seed 증거가 byte/계약 검증되면 해당 capture는 재사용하고 새 호출 수에서 제외한다. per-save fixture를 이어 붙여 생성하지 않는다.

- BOX의 ordinary `*!`/restricted `ALL` 2명령을 먼저 preflight한다. 여기서 primary-hard flag·kernel stats·실제 선택 backend·K/seed를 확인한다. 불일치면 전체550 capture 전에 계약을 검토한다.
- ordinary/per-save를 동일 보드·패턴으로 연결하되 K/seed/quality의 서로 다른 문제로 보존한다.
- ordinary ALL은 일반 경로의 기본 coverage다. 모든 일반 save-expression 전수는 아니며, 특정필터·복합식은 후속 경로 회귀에 별도 고정한다.
- primary timeout은 PRIMARY_UNPROVEN으로 남기고 secondary 측정을 시작하지 않는다. hard=false나 empty로 바꾸지 않는다. 필요 시 추가primary수집을 새 예산으로 계획한다.
- primaryHard=true가 있으면 별도 목록을 생성하고 제품의 기존 no-I 경로를 회귀 대상으로 고정한다. BOX ALL도 false이면 그 사실을 보고하고, 다른capture/과거동일계약 hard 입력으로 보강한다.

완료 조건: **275group의 두패턴에 대한 per-save capture 상태**와 **일반 ALL capture 상태**가 각각 기록되어야 한다. 구조/K 확보와 timeout을 분리한다. 끝나지 않은 셀을 숨겨 275group 완료라고 선언하지 않는다.

### F2. 새 정보 수집·결측 회수 (제품 정책 변경 전)

첫 per-save 보강 목록:

- F1a의 nontrivial명령마다 성능을 보지 않고 hash로1개save 선별: 최대110개.
- BOX의 미측정nontrivial9개 전부.
- 이전 Astra가 지적한 특징범위 밖15개 전부.
- 위 두 집합의 중복은 제거하므로 신규측정행렬 **최대134개**. 기존309개와 섞어 동일캠페인이라고 부르지 않는다.
- trivial/empty는 엔진강제실행으로 성능표본을 부풀리지 않고 실제 빠른경로 회귀에서 검증한다.

별도 ordinary 보강 목록:

- BOX ALL의 두패턴.
- F1b에서 실제확인한 모든primaryHard/nontrivial행렬.
- non-hard에서도 mirror group hash로20group을 성능과 무관하게 선별하고 두family를 대조군으로 포함한다. 조건중복/trivial/primary미확정은 원장에 남긴다.
- 목록수 `M`은 F1완료 후 확정한다. `M`개를 끝낼 budget을 산정하지 못하면 실행 전에 블록을 나누거나 budget을 협의한다. 결과를 본 뒤 어려운 입력만 제외하지 않는다.

extended 결측 회수안은 다음처럼 분리한다:

- T82 + CP81 = **163개 미실행호출**을 새scope에서 회수한다.
- I는 OOM행렬15개의 미실행45개를 다시 시도하지 않는다. OOM 때문에 같이 격리됐던 이웃7행렬의28개만 회수한다.
- 합계 **최대191개 회수호출**, 원300초·원K/seed·원메모리/엔진조건을 유지한다. source가 격리패치로 바뀌는 차이와 새runner/새campaign/RECOVERY phase를 기록하고 옛236개 NOT_RUN을 덮어쓰지 않는다.
- 45개 I미실행은 원OOM과 함께 남기며 confirmed loser시간으로 쓰지 않는다. 격리수정 외 solver/source 계약변화가 있으면 원조건 회수로 합치지 않는다.

새 행렬의 기본정보수집은 **60초·엔진당2호출**을 제안한다. 변동재검사는 엔진×fixture별 max/min≥1.10인 항목에 별도2호출을 제안하며, 예산내에서 선정 전체를 수용할 수 있는지 검사한다. 두 기본호출 모두timeout인 엔진을300초로 자동연장하지 않는다. 이 값들은 이전campaign 승인에서 승계한 실행권한이 아니라 새 협의용 제안이다.

완료 조건: 엔진별 측정·미완료·OOM분모와 ordinary/per-save별 특징지도, primaryHard경로, BOX9개 및 범위밖15개의 결과. 이 보강 뒤 Astra가 d≥17 후보와 CP전환 방향을 재검토한다.

### F3. 첫 정적 후보의 구현·실제 A/B

coverage 검토를 통과한 경우만 구현한다. 첫 후보의 차이는 여전히 한 가지다:

```text
direct / tiny / trivial → 기존 종료
primaryHard → 기존 no-I 처리 유지
유효한 원행 d≥17 → Integrated100K 생략, Threshold부터
기타 → 기존 Integrated100K + fallback
```

- 기존스캔의 structure요약을 재사용하고 primaryforced를 원F로 사용하지 않는다. 분류/packing/전송/seed비용을 포함한다.
- 비교군과후보의 CP시작·취소·실패계약은 동일하게 유지하여 I생략 효과만 분리한다. 이것은 최종single-active 승인후보가 아닌 ablation이다.
- 기존 n>48·d≤8의50개, 중간51개, 높은d59개 **160개**를 공통진단군으로 유지한다. F2보강군과 ordinary경로를 추가하고 primaryHard는 no-op회귀군으로 분리한다.
- tiny149개·trivial·direct도 별도 보호군이다. ordinary는adaptive tiny처리 여부가 달라 경로표에 따라 분리한다.
- 같은VM·lifecycle에서 **4 paired 호출쌍**을 제안한다. pair내 순서를 균형배치하고 end-to-end secondary100K실제비용·넘기는seed·T증명·CPinit/search·회수까지 측정한다. 부분시간median의 합으로 정책시간을 만들지 않는다.
- A/B전용 retest는 개선상위10% ∪ 악화상위10% ∪ 변동≥1.10 ∪ gate영향이다. 선정항목별 추가4pair를 제안하며 최초와 분리한다.
- 수치gate는 첫호출 전 동결한다. 빠른군 절대ms/상대손실, 전체/꼬리시간, exact완료상태, CPU/메모리, gate영향선정식을 포함한다. 과거Threshold5%편차나oldA0 gate를 자동복사하지 않는다.
- I생략이100K비용을 거의줄이지 못하거나 seed손실로 T가악화되면 **후보보류**다. 현재자료에맞춰17경계를 계속이동하지 않는다.

### F4. Threshold 관측과 순차 CP 후보

F3의 seed/준비비용·보강지도 후 checkpoint계약을 동결한다. 작은u의빠른T와 큰u의CP유리사례를 모두 포함하고 u512만으로CP직행하지 않는다.

- 관측용과비계측용을 분리해 states/result보존 및 관측비용을 확인한다.
- T를 계속하기로 했다면 same-search를 이어갈 수 있는지 점검한다. 현재 bounded반환 후 재호출을 resume이라 부르지 않는다.
- CP로 전환하면 T종료·하위Worker회수 후 시작한다. 행렬당활성secondary하나는 최종후보의필수계약이다.
- CP실패/timeout에서 T재시작 또는 proof/seed재사용 fallback을 사전명시하고 해당비용을 모두포함한다.
- exact최소K·원weightedquality·stable-IDtie증명이 없는bounded/FEASIBLE을 완료로 바꾸지 않는다.

### F5. 전체 명령·동시 요청·브라우저·fresh

- 동결한후보에만275group×두family의 ordinary/per-save 실제명령 검증을 시행한다. 모든save취합과primary/열거/출력/queue/회수를 포함한다. phase별budget을새로산정한다.
- filterWorkers·pool·module reuse 및 compiled/warm/cold를 구분한다. 단독 및 동시2/4요청안을 시작점으로 제안하되 실제Worker상한·메모리에 맞춰 일정동결한다.
- exact옵션명시, implicit/explicit secondary 및 CP지원/미지원, 취소·재시작을 브라우저경로에서 확인한다. 모바일확대나independent-split추가는 이번안에 포함하지 않는다.
- 기존55보류는개발/회귀다. 별도의미노출setup/fumen·출처·alias/mirror정보를 받아freshgroup을 결과열람전에분리한다. 후보하나를동결한뒤검증하며, 없으면fresh일반화PASS는보류한다.

## 4. 예산·스케줄 제안과 실행 전 확인

새단계의clock은새campaign에서정의한다. 완료한60초/300초campaign의clock을재시작하거나기존예산내회수라고주장하지 않는다. 여러workflow합산 **VM≤16**을 유지한다.

| 블록 | 협의용 제안 | solver 시간의 보수적 산식 / 주의 |
|---|---|---|
| F1a | enumeration60초, primary60초/save, 전체2h | 110×(60+7×60)=14.67 runner-hour; 16VM 이상적분배0.92h. startup/upload/긴task skew 별도 |
| F1b | enumeration60초, primary300초/명령, 전체5h | 550×(60+300)=55 runner-hour; 이상적3.44h. capture미완료는기록하고자동확대하지않음 |
| F2 per-save+회수 | 새행렬60초×엔진당2회, 회수300초, 전체4h | ≤134×3×2×60 +191×300=29.32 runner-hour; 이상적1.83h. V추가2회는≤13.40 runner-hour 추가, 준비/회수/정체별도 |
| F2 ordinary | M확정뒤 별도산정 | 기본6M호출 /6M분 search상한, 변동retest최대추가6M호출. primary확정 및 실제M에맞춰추가예산합의 |
| F3 A/B | 최초4pair +선별추가4pair | 행렬수P이면 최초8P정책호출. 후보최대시간·CPfallback까지포함한별도bound와숫자gate동결필요 |

위wall예산은 **전셀완료 보장**이 아니다. 실제 admittedblock이예산을넘지않게 하며 마지막5분은artifact보존용으로남긴다. 추가block은최악시간전체를수용할수있을때만시작한다. stage별미완료목록을다음계약에넘기며budget초과를숨기지않는다.

job은작은taskchunk로분할한다. task최악시간·startup/reap/업로드로chunk수를계산하고hardtimeout60분안에여유를둔다. OOM/timeout은측정상태이며정상raw보존뒤job을끝낸다. 정확성불일치·원자료손상은관련블록을중단한다. GitHub hardkill/VM유실을success로보장하지않는다.

### 모든save 전수 runtime 측정은 별도 대형 캠페인이다

현재 미측정 nontrivial 1,326개를 모두 3엔진·2회씩 측정할 경우, **모든 호출이 시간 상한을 소진하는 최악 조건**의 계산은 다음과 같다. 실제 완료시간의 예측이나 최소 소요시간은 아니다:

- 60초기준 **7,956호출 /132.6 runner-hour /16VM 이상적8.29h**.
- 300초기준 **663 runner-hour /16VM 이상적41.44h**.

여기에새55group·ordinary·변동retest·준비/업로드는아직포함되지않는다. 따라서이번안은 **전체geometry/기본명령의capture상태전수 + 구조층화runtime보강 + 후보의실제명령전체검증**을권장한다. 모든패턴×save×engine의반복runtime전수를했다고표현하지않는다. 그수준의전수를원하면별도campaign분할·호출상한·예산을확정해야한다.

## 5. 현재 상태와 다음 인계

- 완료: 기존파일의오프라인감사, 원fixture2,685개hash와primaryHard저장stats판정대조, DB449 ID커버리지연결, BOX14개장부, 본실행안작성.
- 미실행: export수정, 격리코드수정, 추가capture, 회수, 새분류기, 모든후속벤치마크.
- **첫 Sol 실행 묶음:** F0 구현/preflight → F1a + BOX ordinary2개preflight → F1b 전체capture. 그후 F2의실제M과F3의pair 수/gate/전체예산을동결한다.
- 사용자확인이필요한값: 새capture/보강예산·반복수, 전체save runtime전수여부, F3 숫자성능gate, fresh자료확보. 과거campaign승인을이새실행안의자동승인으로쓰지않는다.
