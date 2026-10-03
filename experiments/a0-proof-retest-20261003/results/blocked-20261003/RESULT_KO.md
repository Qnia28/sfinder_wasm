# Astra 후속 — 독립 proof 하네스 실패 보존, 재테스트 선별·예산 완료

## 결론

**독립 exact 증명은 아직 완료하지 못했다.** 직접 baseline threshold 호출에 필수 `qualityFor` 인자를 누락해 JS wrapper가 WASM 탐색에 들어가기 전에 거부했다. 이는 이번에 작성한 하네스의 오류이며 solver 오답이나 탐색 timeout이 아니다.

원실패를 보존하고 “실제 입력 단계 시작 후 자동 소스 교정·재실행 금지” 규칙에 따라 중단했다. wrapper attempt1회/native threshold search0회/proof재시도0회다. 성공 rerun으로 실패를 치환하지 않았다.

**읽기 전용 재테스트 선별은 완료했다.** enlarged168개/원1344행을 검산하고, 선별115개+비선별대조6개=121개, input당10쌍 및 환경대조를 포함한2460호출/5runner 계획을 작성했다. proof가미완료이므로새성능native실험은0회다. 조건부실행코드는준비했지만launch파일을비활성으로보존해작동시키지않았다.

기존 reserved p95 실패와 독립 proof 공백은 모두 남는다. A0/Dev/main/default/배포 변경0.

## 1. 독립 exact 시도와 오류의 정확한 범위

- 입력: `board-111--restricted-split--ordinary`, K35/n160/원rows3848/E23158, 원seed/identity/aliases 불변.
- 기준: protectedbaseline `c0cb2a048e7275bfea587d176b1954efff0a8a08`와같은WASM`73224bda…`.
- 방법: 통합partitioned BestSetSearch와다른baseline sequential fixed-K threshold. coverage/gain helper등은공유하므로완전히별도구현이라고주장하지않는다.
- 동결: 한입력1회,2Mstates/API30s/process45s/startup45s/audit30s/ACK10s/reap2s.
- 실행: [37115091562](https://github.com/Qnia28/sfinder_wasm/actions/runs/37115091562),source`85a9e680263c4fc32c3e4d5088ace5cf5f267e8f`,Actionsfailure.
- 새campaign원점:`2026-10-03T10:02:53Z`,compute160/cancel175/전체180분,64runnerh상한. 이전04:18:25Zcampaign은폐쇄상태그대로이며재개하지않았다.

실제호출전source/input/WASM/원A4witness일치/weightedcoverage/seed/기존K증명을확인했다. 원A integrated를재실행하지않았다. 기존watchdogfixture도local/hosted통과했다.

실패:

```
minimumCoverAtCount requires a positive human-quality provider
baseline/src/pc-wasm-min-cover.mjs:178
```

`qualityFor`는numericcoverage라도API인자로필수다. 이번직접호출의options에없었다. 이검사는rowpacking/ABIallocation/nativeboundedExport보다앞에있다. raw에는phase-start1개만있고phase-result나검색결과는없다. **API시작marker는nativeentrymarker가아니므로native호출1로세면안된다.**

최초`PROOF_AUDIT.json`에서attempt를nativecall1로계수한것도정정이필요했다. 원감사는삭제하지않고,`PROOF_FAILURE_REANALYSIS.json`에원감사hash·wrapper소스·검사순서·rawrecord를연결하여**wrapperattempt1/native검색0**으로정정했다. 후보의기존4EXACTwitness유효성은그대로이나독립최적성/동률증거는없다.

이오류를막을directthresholdsyntheticABI검사가사전검사에없었다. 기존hang/저장검사는API인자누락까지검사하지않았다. 이는이번준비의구체적인누락사항이다.

## 2. 완료한 재테스트 선별

원자료의명시적SCHEDULE에서matrixId/variant/repetition/position/shard를대조하여R/A쌍을확인했다. 원시각만으로pair를추정한것이아니다. 따라서selection은`median(T_Apair/T_Rpair)`를사용했다. 원formal집계의`median(A)/median(R)`와다르지만**원값/원p95를수정하지않았다.**

| 분할 | 원입력 | 개선군tail | 악화군tail | 주선별합집합 | 비선별층별대조 | 최종입력 |
|---|---:|---:|---:|---:|---:|---:|
| 개발 | 64 | 4/개선군36 | 3/악화군28 | 29 | 4 | 33 |
| 예약 | 104 | 6/개선군52 | 6/악화군52 | 86 | 2 | 88 |
| 합계 | 168 | 10 | 9 | 115 | 6 | 121 |

선별사유는중복가능:

- R변동max/min≥1.10:89입력
- A변동max/min≥1.10:94입력
- 둘중하나의변동기준충족:113고유입력
- inputslowdownratio>1.10:10입력
- EXACT상태전환:1입력(board111)
- 개선tail10/악화tail9

**10%변동기준은이번원자료에서113/168을선별했다.** 작은반복표본의max/min은극단값에민감하고cold/runtime/환경변동이섞일수있다. 이를113개의알고리즘결함이나113개의통계적회귀라고해석하지않는다. 확인대상을넓게잡는규칙이라는의미다. 대상수가많다고10%를사후상향하거나좋은tail만빼지않았다.

대조는baseline시간사분위×baselineEXACT/CAPPED의비어있지않은층에서hash최저비선별입력을골랐다. 선택seed`sfinder-retest-v1-20261003`,사분위nearest-rank경계와빈층미보충을기록했다. 별도환경대조입력은개발`board-088--restricted-split--ordinary`,예약`board-117--restricted-split--Z`다.

`SELECTION.json`에는168개전체의시간/쌍ratio/원medianratio/변동/포함사유/대조층을남겼다. `SELECTION_AUDIT.json`은1344원행·쌍mapping·양tail·변동·hash대조를별도구현으로검산했다. 성공/나쁜입력원값교체0,독립proof미확인입력삭제0.

## 3. 준비한 일정과 예산 — 아직 실행하지 않음

- input121×R/A10쌍=2420호출.
- 각분할5runner에서RR1쌍/AA1쌍:40호출.
- 합계2460,host당492호출. 각input은host5개×2쌍,host내RA/AR교차. 순서hash사전고정.
- 이전screening처럼freshprocess/freshWorker/oneintegrated100Kcall,affinity추가없음/warmup0/profile0/native threshold0.
- rawwriter/watchdog독립,fsync/ACK후검산. API10s/process30s/startup30s(독립2단계)/audit30s/ACK10s/reap2s. admission167s(최악152s+여유15s).
- job45분×5=최대3.75runnerh,compute42분/보존3분. 기존새campaign의원점10:02:53Z유지,compute12:42:53Z/cancel12:57:53Z/전체13:02:53Z.
- 원자료의큰variantmedian으로추정한native합계약253.73초. **초기화/coverage/cgroup/IPC/저장/감사시간은이추정에포함되지않는다.**
- host당최악총호출상한82164초가45분job보다크다. 전체완료보장은하지않으며각새call을독립적으로admit하고부족하면NOT_RUN_BUDGET. 원자료가빠르다고deadline을줄여보장된것처럼말하지않는다.

준비하네스의schedule/guard와기존watchdog검사3개localPASS,workflowYAMLPASS. **새native초기계획은준비상태이고proof통과조건을충족하지않아실행하지않았다.** `retest-launch-NOT-ACTIVE.json`은workflowtrigger경로와다르다. proof통과원장이없으면runner도거부하도록guard했다.

선택표본의새결과는과거전체p95를대체하지않는다. 구232/675확인campaign/전체route검증/제품승격을자동시작하지않는다.

## 4. 다음 작업

1. **하네스수정은새승인·새source/manifest로연결한다.** directthreshold호출에필수qualityForguard를넣고numericcoverage에서비숫자fallback을사용하지않는지syntheticfixture로검사한다. 기존원seed/2M/30s/45s는늘리지않는다.
2. 처음nativethreshold검색이아직실행되지않았음을명시하되원실패run을PASS로치환하지않는다. 지금자동재호출하지않았다.
3. verifier가EXACT면fullweightedquality와sortedstable-ID를A4witness와비교해공백을닫는다. capped/timeout/UNKNOWN은pending,불일치는중단.
4. proof완료후준비된selection/schedule을다시hash확인하고잔여campaign예산을확인하여10쌍실행. 현campaign이끝났으면새budget을명시한다.

이번사용자의요청은계획대로계속진행하는것이었지만,실행중단조건도계획의일부다. proof완료나재테스트완료를주장할수없는상태로정직하게인계한다.

## 5. 보호·보존

원enlarged/실행진단seal재검증통과. 원source/WASM/pack/seed/weightedrows/stable IDs/aliases/원실패및summary불변. 제품Devclean/c0cb2a0,localmain187fbf9/remotemain03b6377/defaultmain유지. 실제primary/PC/통합재계산0,actualnative threshold search0,retest0.

원Actionsmetadata/log/artifact/LOCK/partialraw/sourcebundle/감사계수정정/selection/준비schedule/결정/봉인을함께보존한다. 새workflow준비와실패를제품branch에merge하지않는다.
