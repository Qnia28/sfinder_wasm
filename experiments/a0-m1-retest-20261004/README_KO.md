# M1 후속 재테스트 한 번 → 결과 판정 (제품 통합 제외)

사용자 승인: 이번 결과로 대상 고정→M1재테스트1회→판정. 실행 전 추가 승인으로10쌍을**100쌍**, runner5개를**10개**로 늘림(maxparallel허용12,실사용10). 기존 공통규칙 v1.1의선별/보존/측정계약유지, 이캠페인의반복/runner수만명시적으로상향한다. 원 규칙이나 과거봉인값은수정하지않는다.

## 대상: 이번 결과의 합집합, 122개

원자료는Actions37134463920의동결비계측4군벤치. R/A0/M1만선별에사용하고M2는제외한다. 비교A0/R,M1/R,M1/A0 각각개발34/예약88분할별 개선군·악화군10%tail(ceil/경계동률포함), variant전체또는runner내max/min≥1.10, 입력ratio>1.10구경보, 상태전환, priorgate/proof/hotspot5개sentinel을합친다. 환경민감이라는이유로제외하지않는다.

결과: **122개전부선별**. 새168/232/675모집단확인이아니다. S밖정상입력이없어비선별hash-stratified대조C는0개. 원규칙대로분할R시간중앙값에가장가까운입력을동일variant환경대조로고른다.

## 100쌍과73,320calls

각입력×세직접비교×100쌍×2calls=73,200calls. 두분할×10runner×R/R,A0/A0,M1/M1각2calls=120환경calls. 합계**73,320**, runner당7,332.

- 각비교는같은runner의인접2calls, runner당10쌍(정/역순각5), 전체100쌍.
- 세군을한번씩만재는3callblock이면세비교를모두인접시킬수없다. 그래서세직접쌍을따로측정한다. arm당전체200calls/input,각비교는100쌍이다.이중반복을숨겨100호출이라고부르지않는다.
- 이전10쌍×5runner계획대비단일runner2→10쌍=5배,runner5→10=2배. 총비교calls10배. 100개의독립host라고주장하지않는다.
- 기존10쌍분류의4/5runner방향일치율을명시적으로**8/10runner**로대응한다. 각runner10개pairratio의median과전체100개median을분리한다. 이는기술적재현분류이지유의성/승격gate가아니다.

## 바이너리/호출계약

전Actionsbuildartifact의전체runtime/WASMbytes를재사용한다. 후보를재컴파일해code-layout을바꾸지않는다. control/R/A0=73224bda…,M1=c3c9a884…를hash필수gate로확인. 이전diagnostic/M2runtime도artifact의구성으로검증하나실제벤치에서호출하지않는다. 원계측fixture16calls만별도syntheticpreflight로실행한다.

원K/seed/weightedrows/stableIDs/proof/100Kstates/COLDfreshWorker/API측정경계유지. startup30s/API10s/process30s/audit30s/durableACK10s/reap2s, child3GiB/swap0. rawfsync-before-ACK→검산→다음call. 실제primary/PC/threshold0, CAPPED에대한threshold는spy계약검사만한다. M1/M2결합없음. Fast/명시적엔진/decomposition/CP60s/제품default변경없음.

## 예산/중단

신규승인된한캠페인, 최초workflowcreated_at로origin고정. compute160/cancel175/overall180분. preflight20분+10retestjobs각60분=runner-hours상한10.333≤64, maxparallel10≤12. runnercompute55분guard, 인접쌍최악입장예산2×94s. 이전실측sessionwall을100쌍규모로환산하면runner당26~43분예상이나보장은아니다. 총예산/개별timeout시partial보존, 자동budget증액/유리한host교체/성공값치환없음.

정확성/OOM/protocol/timeout은해당job정지한다. 다른고정job은fail-fast:false로증거보존을진행한다. 재테스트한번후새tail을다시선별해재재실행하지않는다. 모든호출미완료시성공표본만으로완전판정하지않는다.

## 판정과이번범위끝

1. 정확성/운영계약위반: 통합진행권고하지않고구체적blocker보존.
2. 완료/계약정상: M1/A0추가이득과M1/R교체이득을별도보고. 각개선/악화재현·절대ms·runner방향·환경민감·완료상태를공개한다.
3. 개별R대비>10%악화는손실확인기준이지통합자동거부조건이아니다. 환경민감또는host혼합은삭제/교체하지않고그한계를유지한다.
4. 재현되는이득이있고중대한운영문제가없으면**다음통합구현단계로진행가능한후보**로권고한다. 기본값승격/제품전체응답속도PASS는아직주장하지않는다. 불명확하면선택가능후보로의통합검토까지만권고하고자동추가재테스트는하지않는다.

원p95실패는과거결과로보존하지만이캠페인의통합검토를영구거부하는조건으로쓰지않는다. 새5%평균gate를자동도입하지않는다. 이번승인은결과판정까지며**Dev통합/기본값승격/mainmerge/배포는실행하지않는다**.
