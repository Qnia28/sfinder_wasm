# Astra→Sol 실행 경로 진단

직전완료증거da27c892…를기준으로제품/원WASM/입력/seed/K/100K불변. 실제입력호출전에합성WASM에서Inspector기능/시간축을검증한다. 실행tier명시field가없으므로FUNCTION_ONLY로분류하며compile생성을frame의실행tier로치환하지않는다.

고정순서: block1비계측RR,RA,AR→계측RA;block2비계측AA,AR,RA→계측AR. 모든call은freshprocess/Worker/one-native-call. 총16개(plain12/profile4). 선행warmup0/공식재벤치마크0/actualprimary,PC,nativethreshold0.

API30/process45/startup45각단계/audit30/ACK10/reap2초. 별도profileexport10초. 최악admission197초=독립startup2×45+process45+audit30+profile10+기록ACK10+reap2+margin10。profileexport는rawfsync후ACK전송시시작하고profile내보내기·저장ACK후검산한다. 이전raw결과를검산/다음call전에저장한다.

동일publicrunner직렬실행,callingthreadlogicalCPU고정. 자원child3GiB/swap0。CPU주파수/SMT/배경compiler통제미보장. queue/host변동에유리한host선별없음。

큰차이진단기준:plainRA4쌍중3쌍이상같은방향,각20%이상및500ms이상,RR/AA대조각max/min≤1.10。대조2쌍은잡음분포추정이아님. 기준충족도제품gatePASS아님。

비계측/계측시간을합치지않는다. profile에서APIhrtime구간만집계,노드parent연결과WASMfunctionindex검사. self/inclusive분리,재귀중복합산금지. sampling비율은실행위치추정이지정확한함수CPU초가아님。

기존campaign04:18:25Z원점불변;compute06:58:25Z/cancel07:13:25Z/overall07:18:25Z。compute17분/job20분과기존64runnerh유지. budget부족은NOT_RUN_BUDGET。actual입력시작후harness교정/자동retry없음。API/process/startuptimeout은보존후독립다음call가능. profiletimeout/quality/OOM/protocol/persistence오류는중단。

계획완료는16호출감사완료또는계측불가/budget부족/오류중단의최종보고·증거봉인이다. Rust내부timer/브라우저실험/독립exactproof/Dev/main/배포/제품warmup/eagercompile/ID,CPU예외/gate완화는이번범위밖이다。
