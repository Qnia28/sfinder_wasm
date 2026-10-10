# P15 기본값 승격 판단 — r14 동결 실행 계약

사용자 승인: 넓은 검증으로 승격 판단을 마무리한다. 개별 반례를 자동 탈락 조건으로 두지 않고 평균 이득 대 손해를 평가한다. Actions 감사는 줄이고 성능차 상·하위10% 및 loop차>10%를 추가 측정한다. C20-10s는보류.

## 질문·모집단

-기존 ALL548개 전수(비자명451+자명97), per-save213개. 총761입력.
-per-save: 변경d15/16 전79개, 경계d14/17 전79개, 기존32개 회귀패널, family×trivial/low/mid/high×tiny/large 각층 SHA256순2개 대조군의합집합.17개존재층, seed=`p15-promotion-r14-v1`. 선택에시간·승패를사용하지않는다.
-변경군은ALL18+per-save79=97. per-save79중62개는기존secondary측정이없다. 과거수집자료이므로완전히새보드의fresh validation이라고하지않는다.
-ALL은전수평균주근거,per-save는별도승격적용범위근거. per-save표본213의평균을전체3348개평균이라고하지않는다. 변경per-save79는전수다. 반복/추가선정 때문에 표본수가많은입력에가중치가늘지않도록한다.

## 조건·스케줄

-H9_OPEN=A_H9, P15_OPEN=P15. 제품/WASM/compact OR source는r13과동일. CP60초합류·내부deadline=null,정확Human·원fixture/seed/품질/stable-ID보존.
-외부watchdog600초,3GiB/swap0,secondary각1thread. 같은cold post-primary settled 시간. policy trace ON,고빈도메모리/native진단OFF.
-P15_INITIAL:761×2arm×2loop=3044호출. 같은runner인접pair, loop2는순서반전·별도runner。loop별fixture순서는동일동결hash순서.
-P15_CONFIRMATION:선정합집합에만2loop추가(2arm각2회). 초기단계완료후새runner에서동일역순설계.선정은딱한번,추가측정결과로재선정하지않는다.
-추가선정: ALL/per-save각각공통exact입력의중앙paired絶対delta 및relative ratio를정렬해양끝ceil(10%)씩,baseline 또는candidate loop시간의max/min>1.10,paired ratio의max/min>1.10,상태변동,변경97개전체의합집합.동점fixture ID순.당초절대시간차tail을유지하고상대tail을더해빠른입력큰비율손해도포착한다.
-누락·UNKNOWN·미회수·잘못된witness/proof는비교불가.정상timeout/OOM은검열보존. CP runtime ERROR후T생존은제품의허용된fallback outcome으로보존하며성능·자원분석에포함한다. INVALID proof는차단한다. r12원인조사를다시열지않는다.

## 감사 축소

새canary/calibration/각runner CP preflight/중간전용감사job/JS중복감사를추가하지않는다. 로컬합성계약검사와저장fixture검증은solver0. Linux activation의scoped CP synthetic1회,측정후최종Python독립증거감사1회,공통byte/전송검증만유지한다. 추가측정선정job은계획·누락·pair/witness 검사만수행하고solver를재실행하지않는다. 정확성검사는정책질문에필수이며잘못된품질과속도를비교하는일을막는다.

## 예산·기한

-계승:population13272+CP16=13288예약,2718.8333333333335runner-hours.
-확인최악전761선정까지예약:population6088+CP1;합계최대19377≤20000.
-phase당최대128matrix(12pair/task parts,350min),두phase256matrix+control8h.누적최대4220.166666666667h≤5000.
-최대16VM,원clock2026-10-06T11:51:03Z~2026-10-11T11:51:03Z유지. queue/최악timeout으로기한이부족하면미실행을숨기거나기한을묵시연장하지않는다. 대부분기존입력은빠르게완료하지만완주보장은아니다.
-선정제한/예산초과시표본을사후축소하지않는다. 원장에선정·계획·start·결과·예약을보존한다. 예산상한은승인된현재요청범위이며이전실패슬롯도계승한다.

## 승격 판단 계약

이전r13의개별손해screen과5%개선screen을자동승격관문으로재사용하지않는다. 정확성은필수,반례존재자체는거부사유가아니다。

1. ALL초기전수의공통exact동일집합에서입력등가중평균ms差/합계、ratio기하평균、절약합과손해합、집중도/큰반례를본다. 변경97과미변경664를분리한다。
2. per-save변경79전수에서도평균순이득및완료율·tail을따로확인한다. family/save/d/기존측정노출별로반례를설명한다。
3. 확인단계는선정된tail/변동/변경군에서초기방향의재현성을평가한다. 초기와확인을무작정합쳐선정편향된'전체평균'을만들지않는다。일반화불확실성은mirror/command군집단위로다룬다。
4. 완료gain/loss,timeout/OOM/ERROR/NOT_RUN,CPU/peak를함께평가한다. 검열값을600초성공시간으로대체하지않는다. 큰완료손실은완료시간평균과별도로의사결정에설명한다。
5. 저자가평균이득이손해를충분히상쇄하고확인자료가이를지지하는지판단해기본P15채택/기존A_H9유지를명시한다. 개별반례만으로보류하지않고,임계치통과도자동승격으로하지않는다。

최종인계는원5파일증거패키지、초기/확인분리DB/표、저자분석、portable검증도구를단일ZIP으로봉인하고원장에연결한다。
