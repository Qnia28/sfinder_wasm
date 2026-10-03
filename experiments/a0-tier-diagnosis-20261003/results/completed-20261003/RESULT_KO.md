# 엔진 단계 진단 완료 — 코드 생성 정책의 큰 비용 영향 확인, 제품 변경은 하지 않음

## 결론과 대응

**원래 계획한 native integrated24호출을 중복 없이 완료했다. 비계측18회와 별도 추적6회이며, 두 하네스 실패는 원장 그대로 보존했다.**

같은9V74호스트/같은입력/seed/WASM/100K예산에서컴파일정책에직접개입한결과:

- **Liftoff 전용은 약10.1초, 기본·사전 최적화는 약6.0초.** compiler정책과생성코드가이입력의실행비용에크게영향을준다는근거를확보했다.
- 별도trace/profile에서도차이는대부분coreexport안에있었다. JS packing/readback이초단위차이의주된설명은아니다.
- 같은정책에서R/A비용은가까웠다. 고정적이고큰A0전용검색관리비용이라는설명은이cohort에서지지되지않는다. 작은차이를배제한것은아니다.
- **사전최적화는API시간을약1%줄였지만초기화가약240ms로늘어init+API합은약2.6~2.9%증가했다.** 제품eagercompile/warmup을추가할근거가없다.

대응결정은 **A0제품후보그대로유지/통합계속보류/탐색코드수정없음/제품warmup·eagercompile·ID/CPU예외없음/기존gate완화없음** 이다.

이것은현재환경에서compiler정책의인과적영향을보인것이지,과거9V45의Cold3.82→5.73초나기존reservedp95실패를같은기전으로완전히설명한것이아니다. 그구체적인기전은아직미해결이다.

## 1. 계획과 실패 보존

원계획은DEFAULT/LIFTOFF_ONLY/OPTIMIZED_FIRST×R/A를3회씩비계측하고별도trace각1회를추가하는단일입력24호출이다. 호출마다freshprocess/Worker,각Worker의자기반복0,호출OSthread는동일logicalCPU0에고정했다. CPU주파수/SMT/배경compilerthread는통제하지않았다.

- DEFAULT: 기본Node24.13.0의compiler정책.
- LIFTOFF_ONLY: `--liftoff-only`.
- OPTIMIZED_FIRST: `--no-liftoff --no-wasm-lazy-compilation`.
- trace호출만 `--trace-wasm-compilation-times --trace-wasm-lazy-compilation` 및core/alloc facade를사용했다. trace시간을비계측시간으로대체하지않았다.

세실행:

1. [37101047698](https://github.com/Qnia28/sfinder_wasm/actions/runs/37101047698),source`952f5aa…`: EPYC7763에서4개nativecall성공. optimized첫Worker는비동기eagercompile대기중referencedport가없어exit13으로종료했다. 부모startupwatchdog가45초뒤종료했다. **실패attempt에는phase-start/nativeintegratedcall이없다.** 성능45초timeout으로해석하지않는다.
2. [37101472741](https://github.com/Qnia28/sfinder_wasm/actions/runs/37101472741),source`0ed6502…`: port초기참조수정후compile-onlyfixture통과. 기존가짜positive감사경로의150ms제한으로preflight실패. **실제nativecall0.** negativehang제한과positivefixturebudget을분리했다.
3. [37101642194](https://github.com/Qnia28/sfinder_wasm/actions/runs/37101642194),source`1de0f52…`: EPYC9V74에서미실행20개nativecall만첫실행하여완료. 성공한첫4개는재실행하지않았다.

제품/기존one-callWorker/native경계/flags/seed/100K는불변이다. 진단wrapper초기port참조,예상밖Workerexit즉시전달,가짜positivefixture3초/negativehang짧은제한분리및testfile직렬화만수정했다. 진단본체의API30초/process45초/startup45초/audit30초/writerACK10초/reap2초는모든mode에서불변이다. 원제품10초/30초정책과이전원장은변경하지않았다.

첫실패와preflight실패는각각FIRST_RUN_SEAL/PREFLIGHT_RUN_SEAL에봉인했다. 이후성공으로실패를PASS치환하지않았으며누락일정을originalRunId로연결했다.

## 2. 같은 호스트에서의 정책 비교

최초7763결과와새9V74결과를섞지않았다. 아래는continuation9V74의rep2/3만비교한것이다. 이는continuation실행전에고정한matchedcohort다. optimizedrep1의6.461초결과도전체원장/분석에그대로남겼다.

| 정책 | R API median | A API median | A/R | R 초기화 | A 초기화 |
|---|---:|---:|---:|---:|---:|
| DEFAULT | 6.013초 | 6.008초 | 0.9992 | 5.1ms | 4.9ms |
| LIFTOFF_ONLY | 10.066초 | 10.180초 | 1.0113 | 6.8ms | 5.1ms |
| OPTIMIZED_FIRST | 5.933초 | 5.948초 | 1.0026 | 241.2ms | 240.4ms |

- Liftoff/default비용은R1.674배/A1.694배.
- Liftoff/optimized-first비용은R1.697배/A1.711배.
- optimized-first/default API는R0.9866/A0.9900배.
- **init+API합** 은defaultR6.018초/A6.013초,optimized-firstR6.174초/A6.189초. 각각+155.7ms/+175.2ms다.

init+API는로딩과solver생성및boundedwrapper구간의합일뿐,decode/coverage/Worker생성/IPC를포함한전체제품route시간이아니다. 정책변경으로계산위치가이동한것을사용자전체지연개선으로주장하지않는다. 2회반복의1%차이에효과유의성이나제품gate통과를부여하지않는다.

최초7763cohort의1회씩측정은DEFAULT R8.586초/A7.099초,LiftoffR11.893초/A11.881초다. DEFAULT에서는A가더빨랐고forcedbaseline에서는비슷했다. 이것도보존하지만1회씩/다른host이므로새cohort비율에합치거나과거기전의증명으로쓰지않는다.

## 3. 추적에서 실제 확인한 것

process와Worker의실제execArgv를검사했고,별도V8로그에서다음compiler생성을확인했다.

| 정책 | R에서파싱한compiler event | A에서파싱한compiler event |
|---|---|---|
| DEFAULT | Liftoff57/TurboFan16 | Liftoff58/TurboFan16 |
| LIFTOFF_ONLY | Liftoff57/TurboFan0 | Liftoff58/TurboFan0 |
| OPTIMIZED_FIRST | Liftoff0/TurboFan449 | Liftoff0/TurboFan442 |

기존WASM정적exportindex는R114/A116이며,두export모두default/liftoff에서는Liftoff,optimized-first에서는TurboFan생성로그가있다. DEFAULT의두variant는공통hotfunction들및각variant에다른function들의TurboFan생성도기록됐다. exportwrapper자체는34byte이므로이를순수DFS함수로잘못명명하지않는다.

**로그제한:** 병렬compilerstdout이일부줄에서서로섞였다. optimized-first의`Compiled function`literal수는R450/A445이고정상파싱은449/442다. 위count는파싱수이지WASM전체455함수의완전한목록이아니다. 원로그와섞인줄예시는TRACE_LOG_COMPLETENESS에보존했다. 누락fragment를복원해정확한functionevent를만들거나native실행을재시도하지않았다.

compiler코드생성완료를관측한것이지모든실행frame의tier를직접추적한것은아니다. DEFAULT는혼합상태다. 초기화/APImarker와nativecompiler출력은서로다른buffering경로가있으므로경계근처순서를확정적으로해석하지않는다. 정수ms컴파일시간합은병렬작업을포함해critical-path시간으로쓰지않는다.

### 추가 호출 없이 확인한 호출 경로

고정WASM을별도임시도구wabt1.0.39로정적disassembly하고기존trace와대조했다. nativecall추가0,제품의package/source/WASM변경0이다. 도구packageintegrity/lock/entry/WAT원문hash를CALLGRAPH에기록했다.

- R: export114 → 공통112 → 공통113 → 자기재귀363.
- A: export116 → 공통112 → 공통113 → 자기재귀380.
- export114/116은끝의옵션상수만다르게공통112를호출한다.
- DEFAULT의R로그에는공통112/113과재귀363의TurboFan생성이, A로그에는공통112/113과재귀380의TurboFan생성이있다.

따라서 **“exportwrapper가Liftoff로생성됐으니검색전체도Liftoff다”는해석은틀리다.** DEFAULT에서도공통/재귀경로에최적화코드가생성됐다. 이관측은eageroptimized-first가default에비해API시간을크게줄이지못한결과와부합한다. 다만debugname없이363/380을Rust특정symbol로확정하지않으며,정적callsite수를runtime호출횟수나함수별CPU시간으로해석하지않는다.

## 4. 비용은 어느 경계에 있었나

별도trace/profile의coreexportwall:

| 정책 | R core | A core | API에서core외차이 |
|---|---:|---:|---:|
| DEFAULT | 5.989초 | 6.005초 | 약3~4ms |
| LIFTOFF_ONLY | 10.068초 | 10.125초 | 약6~7ms |
| OPTIMIZED_FIRST | 6.106초 | 6.138초 | 약3ms |

초단위tier정책차이는주로coreexport안에있다. core는Rust전처리+탐색+런타임작업이며순수DFS만이아니다. trace자체가교란하므로위시간을비계측값으로치환하지않는다.

관측은 **컴파일에몇초를소비했다** 보다 **생성된코드/최적화정책에따라실제core실행비용이크게달랐다** 는설명에부합한다. Liftoff전용은로그상컴파일작업이적은데도실행이약4초더길었다. 단,정수compiletime합만으로정확한runtime비중을산출하지않는다.

## 5. 현재 추정과 대응 위치

확신높음:

- 실행환경의compiler/최적화정책은이입력의CPU비용에큰영향을준다.
- 현재9V74cohort에서는같은정책의A/R비용이비슷하며초단위차이는주로nativecore안에있다.
- eageroptimized-first는초기화비용까지포함한이두구간합에서이득이없다.

아직미확정:

- 과거9V45에서R3.82초/A5.73초가된정확한코드tier/CPU/공유상태기전.
- 기존짧은F14지연의주원인비중. 이큰입력의결과를작은입력전체로일반화할수없다.
- 작은sibling/trail추가비용의유무와실제브라우저Worker수명에서의영향.

추가solvercall없는함수index/호출경로대응분석까지완료했다. **Rusttrailblind수정이나제품warmup/eagercompile추가로진입하지않는다.** 이후브라우저수명이나함수별CPU/내부Rusttimer등새측정계약이필요한단계는별도범위를정해야하며,이번진단결과로공식재벤치마크나제품적용에자동진입하지않는다.

미검증exact`board-111--restricted-split--ordinary`는별도통합차단조건그대로다. 이전reservedp95실패도유효하다.

## 6. 검산·보존·예산

- native24/24,CAPPED24,각100K. 원weightedquality/seed/coverage/stableIDs/primaryproofidentity/engine변경간결정성검산통과. states/quality회귀0.
- 최초4개와continuation20개각각독립감사. 합계rawjournal72record/quality+seed48회검산. 성공nativecall재실행0. trace6회는별도구분.
- 원source/WASM73224bda…/입력/harness/workflow/actionhash/schedule/flags/환경은LOCK으로고정. 별도writer append/fsync/ACK후검산. cgroup3GiB/swap0.
- 최초04:18:25Z캠페인시계불변. 최종06:03:40Z까지105.25분,전체3h이내. 이번tier실행3job의관측runner합계0.08389h. 이전원인진단+순서진단까지모두합계0.47806h,64h이하.
- watcher의INITIAL_RUN은예산원점run37096100399이다. 각job자체경과는별도SELF_RUN metadata로계산하며원점경과와혼동하지않는다.
- 표준publicrunner/직렬실행만사용했다. paidservice/host선별없음. 실제primary/PC/native threshold/공식232확인0.
- 보호Devclean/HEADc0cb2a0/localmain187fbf9/remotemain03b6377/defaultmain불변. 제품/Dev/main/배포변경0. 이전seal과실패결론도불변.

원로그/계측/컴파일fragment/실패/검산/sourcebundle/판정을모두보존하고봉인한다. 관측한엔진영향을전체제품개선이나과거gatePASS로전용하지않는다.
