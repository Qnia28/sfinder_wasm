# Integrated A0 / B10 / B6 — 본측정 및 독립 검증 완료

## 결론

**개발 본측정36,048회·기존반례288회·독립threshold129회가완료됐다. 후보승격·예약검증은하지않는다.**

추가승인한개발64runner-hours/전체3시간이내에서수행했다. 본측정기동부터독립threshold종료까지 **22.47분**,두실행의job경과시간합계 **약3.76runner-hours**였다. 이는GitHub청구시간이아니라job시각의합계다. 제품/main/defaultbranch/과금설정변경없음.

- **A0:** 새주대상에서는이전5%공통exact시간gate를통과했다. 그러나쉬운군절대overhead와공통timeoutgate를통과하지못해승격보류.
- **B10:** exact완료증가가크고추가exact도독립검증됐다. 하지만공통capped준비비용·p95지연·쉬운군overhead를통과하지못해 **유망한연구후보일뿐**.
- **B6:** 단독완료수순증가0,시간개선이5%미만이고bounded품질회귀가있다. 이번정의로채택하지않는다. 결합은B10보다exact1개순증가에그친다.
- **Bridge:** P0/P의witness·states는동일하지만p95지연비1.0725가상한1.05를넘는다. 이식비용을무시하지않는다.

## 1. 완료 범위와 원자료

| 단계 | 대상 / 실제 호출 | 결과 |
|---|---:|---|
| Native | debug29/release29 | PASS |
| Synthetic | 288fixtures / 6,912 | PASS; nonoptimal seed218fixtures |
| Pilot | 개발32행렬 / 192 | 전부보존; 주성능표에합산하지않음 |
| 개발본측정 | **1,502행렬 × 6조건 × 4회 = 36,048** | 누락0 |
| 기존반례 | 고정12 × 6 × 4 = **288** | 누락0 |
| S4 independent exact | 필요한개발행렬 **129개,각1회** | **129/129 VERIFIED_EXACT** |
| 예약 | 219행렬 | **0회**,선정후보없어실행하지않음 |

각ledger로정의한총호출은43,569회(synthetic/pilot/본측정/구반례/threshold합계)다. Native unit test 내부의solver호출수는이장부수에포함하지않는다.

개발status: EXACT27,500 / CAPPED8,356 / TIMEOUT_API192. 정상반환35,856회전수witness감사PASS. 기존반례: EXACT124 / CAPPED164 / timeout0. ERROR/OOM/cleanup실패/반복비결정성/bridge결과불일치/서로다른exact해 **0**.

TIMEOUT192는primaryHard8행렬 × 6조건 × 4회다. 주대상675개에는timeout0. 어려운입력을빼거나성공한반복만골라median을만들지않았다. TIMEOUT의witness/quality는null이며SIGKILL·회수시간을확인했다. 앞조건timeout이뒤조건을생략하거나예산을소진하지않았다.

## 2. 주 판정 — integrated 대상675개

행렬별4회APIwall의median을합산했다. APIwall은numericpacking/기존JSwrapper/ABIallocation·copy/nativeprep/검색/readback을포함한다. 아래ratio는비교기준의합계대비이며end-to-end사용자응답시간이아니다.

| 조건 | 정의 | exact / 675 | 기준 | 전체probe시간ratio | p95 slowdown ratio |
|---|---|---:|---|---:|---:|
| H0 | baseline,partition off | **282** | — | — | — |
| P0 | baseline,A0 on | **291** | H0 | **0.9899** | **1.0828** |
| P | candidate bridge,A0 only | **291** | P0 | **0.9955** | **1.0725** |
| PD | P + guarded B10 | **418** | P | **1.0325** | **1.3175** |
| PC | P + B6 | **291** | P | **0.9946** | **1.0729** |
| PDC | P + guarded B10 + B6 | **419** | P | **1.0218** | **1.3057** |

### A0

- H0→P0: **추가 exact 9 / lost exact 0**.
- 공통exact282개시간ratio **0.9351**,약 **6.49%감소**로이전최소5%gate를충족했다.
- 전체probe시간약1.01%감소,p95≤1.10,states증가0,raw품질회귀0도주대상수치gate를충족했다.
- 그러나tiny806+trivial3의positiveoverheadp95 **2.3305ms > 1ms**. primaryHardtimeout도사전등록한공통최종gate에서보류사유다. 주대상성공을전체승격성공으로바꾸지않는다.

### B10 및 결합 — 완료 증가와 capped 비용을 분리

| 비교 | 공통exact | 새exact | 역전 | 공통capped | 공통exact시간ratio | 공통capped시간ratio |
|---|---:|---:|---:|---:|---:|---:|
| P→PD | 291 | **127** | 0 | 257 | **0.7572** | **1.1396** |
| P→PDC | 291 | **128** | 0 | 256 | **0.7476** | **1.1281** |
| P→PC | 290 | 1 | 1 | 383 | 0.9865 | 0.9953 |
| PD→PDC | 417 | 2 | 1 | 255 | 0.9974 | 0.9886 |

B10은완료형gate의최소14개증가/전체wall≤1.05라는점추정부분을충족하지만,공통capped시간증가약13.96%와p95+31.75%로공통회귀제한을넘는다. 결합도p95+30.57%로탈락한다. 이미exact인입력만분석하면보이지않는마스크준비비용이포함된결론이다.

### B6 및 bounded 품질

- B6단독은exact1개증가/1개감소로순증가0. 전체probe시간개선약0.54%로5%시간형gate미달이다.
- P대비raw품질회귀: **PC65개**,PD6개,PDC14개. 모두capped의feasible결과이며원seed보다나쁘지않다는정확성검사는통과했다. 하지만다른mode의incumbent보다나쁜것은bounded계약회귀다.
- PC를제품incumbent로사용하기위한품질회귀0조건도실패했다.
- D의effective capped결과는원seedfallback으로계산하며PD/PDC모두P대비품질회귀146개다. rawDincumbent향상을제품이득으로내세우지않는다. fallback호출비용을측정하지않았고routing/Auto정책을바꾸지않았다.

## 3. Bridge / 쉬운군 / 불확실성

P0→P의completed/states/selectedIDs/fullweightedquality는정상반환결과전수동일하다. 총APImedianratio0.9955는≤1.02지만,p95 **1.0725 > 1.05**이므로bridgegate는실패다. 동일한의미라고이식오버헤드가없다고주장하지않는다.

tiny806+trivial3 positiveoverheadp95(기준대비증가분만):

| 비교 | ms | 상한 |
|---|---:|---:|
| H0→P0 | 2.3305 | 1 |
| P0→P | 2.5540 | 1 |
| P→PD | 2.4089 | 1 |
| P→PC | 1.9772 | 1 |
| P→PDC | 2.5179 | 1 |

tiny/trivial모두모든조건에서exact이며정확성문제는없다. tiny는candidate수가작다는분류이며원weighted행은많을수있다. 측정API는packing등을포함하므로이값을native검색시간으로분해하거나“오직B6고정비”로인과귀속하지않는다. 측정noise가능성을이유로gate를낮추거나선택재실행하지않았다.

주대상675개는91개mirror group에속한다. 10,000회groupclusterbootstrap을동일하게적용했으며반복4회를독립표본으로세지않았다.

| 비교 | group동등가중geomean시간ratio | 95%CI | group동등가중exact완료율차이95%CI |
|---|---:|---|---|
| H0→P0 | 0.9864 | [0.9795,0.9934] | [+0.0049,+0.0207] |
| P→PD | 0.8246 | [0.7629,0.8854] | [+0.1081,+0.2084] |
| P→PC | 0.9934 | [0.9870,0.9999] | [-0.0037,+0.0037] |
| P→PDC | 0.8156 | [0.7541,0.8768] | [+0.1073,+0.2104] |

6개 개선 검정의 Holm 보정 후 PD/PDC의 시간·완료 p≈0.000600, PC 시간 p≈0.0438/완료 p≈0.6468. group 평균의 개선은 큰 입력의 전체 wall/꼬리지연 gate를 대체하지 않는다. 즉 통계적으로 개선된 지표가 있어도 사전 회귀제한 실패를 상쇄하지 않는다.

## 4. B10 guard 및 자원

주대상675개/각D조건의실제guard분류는동일했다:

| guard | 행렬 | PD 전체APIratio vs P | PDC 전체APIratio vs P |
|---|---:|---:|---:|
| COMPLETE | **642** | 1.0113 | 1.0020 |
| WORK_BYPASS | **21** | **1.2217** | **1.1944** |
| MEMORY_BYPASS | **12** | 0.9993 | 0.9963 |

- WORK_BYPASS는50,000,000primitive상한에서partialmask를폐기했고모든21개가capped였다. 이미사용한준비비용을wall에남겼다.
- denseallocation실측최대약60.80MiB로64MiB이내. MEMORY_BYPASS는allocation0/primitive0이며입력은제외하지않았다.
- 주대상정상반환peakRSS최대: P약216.7MiB,PD약262.6MiB,PDC약271.8MiB. WASM선형메모리최대는P40.38MiB/PD·PDC66.94MiB. 이는dense마스크크기그자체가아니며그것보다클수있다.
- primaryHard정상반환10개도자원·wall·guard를별도보존했다. hardkill8개는terminalRSS/guardtelemetry가없으므로추정하지않았다. child전체는실제Linuxcgroup3GiB/swap0으로제한됐다.
- nativeprep/dominance/DFSphase독립시간은ABI에없어null이다. 추정·보간하지않았다.

## 5. 독립 감사 / exact 교차검증 / 기존 반례

Python은solver없이다음을독립재계산했다:

- 개발 **1,502개** 및 기존 **12개** pack hash·identity·원 seed/선택 coverage/weighted quality.
- 36,048/288 run ID와 동결 원 schedule 및 승인된 32 chunk 배치 정합성.
- 정상 35,856/288 결과의 K/seed quality 하한/반복 결정성/exact·bridge 동일성.
- 개발 2,560개/기존 28개의 서로 다른 quality witness를 원행에서 재계산.
- 개발 seal 96개 파일/기존 seal 6개 파일, 137개 comparator Git 소스(blob) 검증.
- hard-kill 192회의 null witness/SIGKILL/시간·회수 기록.

S4는H0/P0exact가없는candidateexact행렬129개에만기동했다. 저장된최소K·원seed·원quality행을그대로사용하고,baselinethreshold fixed-K secondary를각1회, **2Mstates/API30초/process45초**로검증했다. 전부EXACT이며fullselectedIDs/weightedquality가후보결과와동일했다. INCONCLUSIVE/MISMATCH0. PC열거/primary최소K를재실행한것은아니다.

고정기존반례12개는새모집단점수에섞지않았다. exact수H0=3/P0=P=PC=4/PD=PDC=8,timeout·exact불일치0. 원파일hash는oldmanifest와대조했고원counterexample를쉬운입력으로대체하지않았다.

## 6. 보존 및 다음 작업 경계

- 본측정: https://github.com/Qnia28/sfinder_wasm/actions/runs/37016499665
- 독립 threshold: https://github.com/Qnia28/sfinder_wasm/actions/runs/37018994637
- remote 결론은 둘 다 success이며, 별도의 **개선 후보 승격 gate는 실패/보류**라는 상태를 구분한다.
- mainartifact **37개/9,434,614압축bytes**,crosscheck **16개/182,153압축bytes**를전부다운로드했다. 기존pilot11개와두초기준비실패로그도그대로보존한다. 총512MiBartifact예산이내다.
- 최소비교baselineWASM: `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`
- 최소candidateWASM: `2090c448119fdd9723b3bbd0227e5ffb9cc5016490ea854fc72b5f0be595a0cf`
- measuredcandidateRust/sourcecommit `36dbc5afb3d91dbcff4fa1254d1ea626cc523ffa`,main운영commit `51e9250f752c1c367e098ad1dd937e89985a3aca`.
- remote 실험브랜치만 사용; 제품 HEAD `c0cb2a048e7275bfea587d176b1954efff0a8a08` 유지. 로컬 main `187fbf954ad0749e697b4e7f1252683b318d696e`, remote main `03b637730c5b541f4f2934be613498fbe65327fd`, default main/public 유지.

주 산출물: `COMPLETION.json`, `DEVELOPMENT_INDEPENDENT_AUDIT.json`, `LEGACY_INDEPENDENT_AUDIT.json`, `CROSSCHECK_INDEPENDENT_AUDIT.json`, `DESCRIPTIVE_DEVELOPMENT.json`, `GUARD_STRATA.json`, `KEY_NUMBERS.json`, 각 run 원자료/Actions 로그/source bundle.

**후보최대1개선정규칙에따른통과후보는없다. 예약219개는decode·실행하지않았다.** mainmerge/제품적용/Auto·routing·CP·동시요청벤치는하지않았다. A0쉬운군계측,bridge꼬리지연,B10WORK_BYPASS준비비용등을다시다루려면후속설계·새사전등록을별도로정해야하며이번결과에맞춰guards/gates를사후조정하지않았다.
