# M1 100쌍 재테스트 완료 — 선택 가능한 A0+M1 통합 구현 단계 진행 권고

**완료: [Actions37138752420](https://github.com/Qnia28/sfinder_wasm/actions/runs/37138752420)의73,320호출모두독립검산통과. M1의관측이득은지지되며중대한정확성/운영문제는없다. 다음은선택가능한A0+M1의통합구현단계가적절하다. 기본값승격이나엄격성능PASS는선언하지않는다. 추가재테스트/실제통합은수행하지않았다.**

source `c6554bce7356fe226693074610e8c7a2177335cb`, branch `validation/a0-m1-retest-20261004`. 대상/순서3tests·분석5tests·Worker/watchdog4tests통과. 원Linuxartifact의768runtimefiles및동일worker/source를검산했다. 캠페인은origin16:57:31Z→최종job17:44:54Z,wall47.383분·7.298889runner-hours로종료. watcher없음. [STATUS.json](STATUS.json)/[DECISION.json](DECISION.json)이최종인계다.

## 1. 정확성·운영 판정: 통과

- 계획73,320calls=실행·검산73,320,122입력×3비교각100완전쌍.누락/timeout/OOM/error0.
- EXACT55,060/CAPPED18,260. CAPPED는정상100Kprobe이며후속실제threshold는호출하지않았다.
- M1의states/전체weightedquality/stableIDs/EXACT-CAPPED는A0와정확히일치. K/seed/기존최소Kproof보존. 실제primary/PC/threshold0.
- 원시기록219,960개,source271blobs,결과73,360files,weightedquality/seed146,640회재계산검증. 독립통계검사로36,600쌍/366비교series의인접쌍·정역순·runner구성·모든ratio/delta를확인했다.
- control/R/A0원본byte동일73224bda…,M1=c3c9a884…로전벤치와같은WASM/runtime를사용. 재컴파일/layout교체없음. 이번시간차의기전전체를배타적으로증명한것은아니다.

## 2. M1 이득과 손실: 관측 기술통계

아래는122개각입력의100인접pairratio와runner별10쌍median을사용했다. **환경경보포함관측통계**이며엄격재현PASS/제품모집단PASS와다르다.

| 비교 | pairedmedian<1 입력 | pairedmedian>1 입력 | ≥8/10runner 빠른방향 | 10/10runner 빠른방향 | 입력별pairedmedianratio의중앙값 |
|---|---:|---:|---:|---:|---:|
| A0/R | 51 | 71 | 25 | 15 | 1.002679 |
| M1/R | **91** | 31 | **55** | **42** | **0.975990** |
| M1/A0 | **94** | 28 | **54** | **36** | **0.981099** |

선택122개입력의arm별시간median을합한별도기술지표는M1/R `0.929678`(약7.03%비용감소),M1/A0 `0.961427`(약3.86%감소),A0/R `0.968381`다. 이합산지표는pairedratio중앙값이아니고,사용빈도가중이아니며,전체제품응답시간이나기존sumgate재판정도아니다. 두지표를동일한개선율로섞지않았다.

### 대표 관측

| 입력 | M1/R | Δms(R대비) | R대비빠른runner | M1/A0 | 해석 |
|---|---:|---:|---:|---:|---|
| board106 bag ordinary | 0.327821 | −225.30 | 10/10 | 별도CSV | 큰A0이득유지 |
| board011 restricted O | 0.720495 | −97.09 | 10/10 | 0.712306 | M1추가효과관측 |
| board111 restricted ordinary | 0.757226 | −40.85 | 10/10 | 0.968713 | exact차이·이득유지 |
| board115 bag ordinary | 0.930992 | −1.47 | 9/10 | 0.988054 | 과거큰악화는이번크기재현안됨 |
| board106 restricted J | 1.006382 | +0.05 | 4/10 | 0.983103 | 작은차이/혼합방향 |
| board119 restricted L | 1.018319 | +0.10 | 3/10 | 1.010983 | 작은악화관측 |
| board028 restricted ordinary | **1.009142** | **+64.60** | 3/10 | **1.008031** | 큰hotspot은해결되지않음 |

손실을숨기지않는다. M1/R의가장큰입력pairedmedianratio는board107restrictedT `1.048108`/약+0.380ms. M1/A0의최대ratio는board106restrictedS `1.088391`/약+1.106ms,board115restrictedL도 `1.085411`/약+1.526ms다. 최대절대악화는board028의R대비+64.60ms/A0대비+56.74ms이며두비교7/10runner에서느린방향이다.

이번전체입력pairedmedianratio중>1.10은없고8/10runner+전체>1.10magnitude관측경보도0개다. **이를통합조건충족/악화없는알고리즘보장으로사용하지않는다.** 원과거악화·p95실패도소급무효화하지않는다.

## 3. 중요 제한: 환경60쌍 중22쌍경보

동일variant환경max/min>1.10이22/60쌍에서발생했다. 두phase모두에서각비교arm의관련runner경보가있어,사전에고정한보수적분류는**세비교모두122입력 ENVIRONMENT_SENSITIVE**다. 엄격 `DIRECTION_REPLICATED`/환경경보없는개선분류는0이다. 위55개·54개는이를통과한개수가아니라환경경보를제외하지않은runner방향관측수다.

경보host를삭제/교체하지않고100쌍을모두유지했다. 경보가곧100쌍모두무효라는뜻도아니며,100반복이22경보를없애거나엄격성능PASS를만들었다는뜻도아니다. CPU별기전단정/유의성/100독립host주장없음. 정확성통과와성능의환경불확실성은별도다.

## 4. 최종 판정과 다음 범위

**선택가능·롤백가능한A0+M1을제품에연결하는통합구현단계로진행권고. R은남기고M2는제외한다. 기본값승격은아직권고/승인하지않는다.**

근거는계약/운영정상,원별도work-count에서의목표검사량감소,이번100쌍의폭넓고일부큰관측이득이다. 환경경보때문에엄격확증은미충족이므로옵션후보연결과default승격을구분한다. 개별10%악화나과거p95가구현단계의영구거부권은아니다. 새5%평균gate를도입하지않았다.

다음구현의권고구조는일반Exact의기존100Kprobe호출부에R/reference와A0+M1/candidate정책을분리해**요청당하나만실행**,EXACT면검증후반환/CAPPED면동일incumbent로기존threshold이어받기다. Fast/trivial/primaryHard/명시적엔진/decomposition/CP60s/전달probe재사용/취소계약은그대로둔다. 실제제품전체route/fallback지연은이번벤치가측정하지않았으므로기본값평가에서별도확인한다.

이번요청은결과판정까지로종료했다. 추가재테스트/구현/Dev적용/mainmerge/배포는하지않았다. 결과가환경민감하다는이유로재테스트를무한반복하지않는다. [기계요약](COMPARISON_SUMMARY.json),[입력별CSV](COMPARISON_BY_INPUT.csv),[별도통계검산](PAIRED_STATS_AUDIT.json),[byte/source출처검산](PROVENANCE_AUDIT.json)을참조한다.

## 실행 전 계획 (이력 보존)

이번4군결과의R/A0/M1세비교에서개발/예약분할별양쪽10%tail, 내부max/min≥1.10, 구gate경보/결과상태전환등을합쳤다. 대상은122개전부다. 원모집단168개로확대한것이아니다. 비선별C는없으며환경대조는분할별고정한다.

각비교별인접100쌍,10runner×10쌍(정역각5). 세직접비교를따로측정해총73,200calls+환경120=**73,320calls**. 각runner7,332calls. 이전계획보다runner당5배×runner수2배. v1.1재테스트규칙의반복·runner수만사용자승인으로상향, 원자료/규칙수정없음. 기술적방향일치는4/5대신8/10으로대응하며통합gate나유의성으로전용하지않는다.

원Linuxartifact의R/A0/M1binary/runtime전체byte재사용,hashgate필수. freshWorker·100K·원K/seed/weightedrows/IDs유지,실제primary/PC/threshold0. M2실제호출/계측진단없음. maxparallel10≤12,child3GiB/swap0,API10s/process30s등원deadline유지. wall3h/64runner-hours내고정상한10.333runner-hours. 기존sessionwall환산예상runner26~43분;초과시partial보존/자동증액없음.

재테스트한번후결과를판정하고종료한다. 개선/악화재현·절대시간·환경민감·운영을분리하며**개별10%악화는통합거부기준이아니다**. 통합진행가능권고와제품default승격은별도다. 새5%평균gate/재재테스트/Dev/main/배포를자동실행하지않는다.

원 sealed4군실험은 [이전결과](../a0-four-arm-execution-20261004/RESULT_KO.md), 재현규정은 [v1.1](../TESTING_RULES_KO.md). 실제실행상태/최종판정은후속STATUS/AUDIT/DECISION으로기록한다.
