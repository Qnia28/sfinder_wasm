# Saves 조기 성공의 후속 계약 — 정적 검토

task011의 mask 기본 적용 이후 S21-7 검토다. 현재 구현에는 탐색 조기 종료를 추가하지 않았다.

2026-09-27 후속: 독립JS 프로토타입 task012의계약테스트13/13과동결18파일을감사했다. 기존parser 기반분석과stream 완료규약의검증단계이며제품연결은미완료다. [감사·통합전잔여계약](../../archive/saves-experiments-20261002/records/tools/validation/saves-early-stop-contract-audit-20260927/ASTRA_AUDIT_KO.md). 특히case당여러multiset root의완료집계,producer stop ack,중단으로생략되는오류의규약이남아있다.

task013 후속: [다중root·중단요청/확인·요청전체오류장벽](SAVES_MULTIROOT_PROTOCOL_20260927.md)을독립구현했다.12/12계약테스트와실제WASMtrace6조건/72회재생대조및129파일감사완료. 모델수준완료집계/ack는검증했으나실제trace의stopped roots는0이므로,제품연결전coverage비용과생략가능작업량확인이우선이다.

## 안전하게 인정할 수 있는 부분집합

U를 현재까지 발견한 정확한 save 문자열 집합, V를 최종 집합이라 하면 U⊆V다. 표현식 결과집합 E에 대해 E(U)⊆E(V)를 증명할 수 있으면, E(U)가 비어 있지 않을 때 성공은 뒤집히지 않는다.

- 일반 atom/regex: `U∩P` 형태의 고정 술어이므로 집합 포함에 대해 단조다.
- atom에 직접 붙는 `^`: `U∩(¬P)`이므로 역시 단조다. 이를 모든 complement와 함께 무조건 금지할 필요는 없다.
- `||`: 단조인 두 결과의 합집합이므로 단조다.
- 기존 `&&`: 양쪽 결과가 비어 있지 않을 때 합집합이다. U에서 양쪽이 비어 있지 않으면 V에서도 양쪽 결과가 유지되고, U에서 빈 결과였다면 포함관계는 자명하다. 따라서 두 하위식이 집합 포함 단조이면 안전하다.
- prefix가 없는 그룹과 왼쪽 결합 sequence는 위 성질을 귀납적으로 합성할 수 있다.
- `!` 부재 테스트는 일반적으로 안전하지 않다. U={J}에서 `!I`는성공하지만V={I,J}에서는실패한다.
- 그룹 complement는 일반적으로 안전하지 않다. U={I}에서 `^(I&&J)`는성공하지만V={I,J}에서는실패한다.

최초 classifier는 AST를 기준으로 atom/regex,직접atom-complement,안전한그룹/연결자만인정하고 net absenceTest 또는 group complement가있는식을거부할수있다. parser가취소한이중prefix는문자열검색이아닌AST의최종flag를기준으로판정한다. 이는충분조건이며모든안전한표현식을찾는완전한판별기가아니다.

## 단조성만으로 부족한 실행 계약

1. ALL은완전한outcome빈도가필요하므로조기성공대상에서제외한다.
2. 표현식출력이성공여부/실패큐만요구하더라도,여러표현식중하나만성공했다고해당큐를닫지않는다. 모든요청식에대해성공확정또는열거완료가필요하다.
3. 안전하지않은식의실패/성공판정은전체outcome을기다린다. 안전한식도아직성공하지않았다면미탐색상태를실패로취급하지않는다.
4. 실패큐는원래case순서와중복을보존한다. raw queue가같아도마지막bag이다른branch의완료상태는별도다.
5. regex오류시점을보존해야한다. 현재규약은열거오류가먼저발생하고,표현식평가에서빈universe/OR로도invalid regex를숨기지않는다. 탐색전선컴파일로이순서를바꾸지않는다.
6. 취소/예산소진/일부root누락은완료증명이아니다. 미완료응답을일반성공률응답으로반환하지않는다.

## 현재 API의 실제 제약

`saveOutcomesPattern`은모든root의coverage를동기적으로계산한뒤packed배열을반환한다. JS에서이미성공한식을건너뛰어도현재Rust탐색비용은줄어들지않는다. 새classifier나mask-table를추가하는것만으로탐색최적화라고보고해서는안된다.

탐색을줄이려면root/QueueTrie coverage처리중case별closed상태를받아들일새계약이필요하다. 공통DAG나OrderLanguage의suffix는다른미완료case가사용할수있으므로폐기하지않는다. 먼저root별coverage/전송비용의실제비중을확인해야한다.

따라서다음구현후보는(1)정확한일반outcome사전의확장,(2)packed전송/coverage구간의단계계측을우선검토한다. 조기종료를위한새RustAPI는별도설계/검증작업이다. 이번19시작업에서추가측정은예약하지않았다.
