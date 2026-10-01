# Saves 다중 root 완료·중단 확인 계약

## 구현 범위

task013의 독립 구현은 `tools/validation/saves-multiroot-contract-20260927/implementation/save-multiroot-session.mjs`다. task012의case당root하나모형을확장하여한case가여러root의outcome을합칠수있게했다. 제품소스에서이모듈을import하지않으며,현재Rust/WASM에없는중단capability를활성화하지않는다.

## 소유권과 부분 coverage

- 생성시모든candidate root와case의보수적인소유관계를고정한다. 실제해답이없는root도완료집계에포함한다. 한case를여러root가소유하고한root를여러case가공유한다.
- `observe(rootId,caseIds,rawOutcome)`는지정된coverage case에만outcome을추가한다. root의모든잠재consumer에성공outcome을broadcast하지않는다.
- case별mapper가마지막bag을적용한다. raw queue가같은branch들도고유case ID와출력순서를유지한다.
- 한coverage event는모든mapper/표현식판정이성공한뒤원자적으로반영한다. 잘못된case ID·중복ID·비정규save·mapper예외는root error다. callback의재진입상태변경도거부한다.

## 완료와 중단 상태

root상태는`open → stop-requested → stopped/exhausted`이며,중단거부시`open`으로돌아간다. `budget/cancelled/error`는불완전종료다.

`requestStop`은이세션에서발급한identity token을반환한다. 동일필드의복사객체나다른세션의token은ack가아니다. `acknowledgeStop`으로`stopped/exhausted/rejected`중하나를확인한다. 확인전in-flight coverage는허용한다. 그동안exhaustion이나오류가먼저도착하면token을폐기하고늦은ack를거부한다.

중단조건은root의**모든consumer가모든요청식에대해단조성공을확정**한경우다. ALL·완성outcome요구·증명되지않은식·regex는조기중단을허용하지않는다. regex의수학적단조성여부와오류시점보존은별개다.

producer capability인`exactStop`과`futureErrorsPrevalidated`는둘다기본false다. 후자는생략할작업에서관측해야할오류가나오지않음을producer가확인했다는계약이다. 현재solver의입력검사만으로모든후속오류가해결됐다고간주하지않는다. 이계약을실제producer에서정의/증명하기전에는native중단을연결하지않는다.

## 요청 전체의 오류·결과 확정 장벽

한case의모든root가exhausted여도다른case의탐색이진행중이면완전한응답을반환하지않는다. `finalize`는요청전체root가성공적으로settle된뒤case순서대로전체표현식을평가하고결과를한번에commit한다.

따라서먼저끝난case의invalid regex가나중root의열거오류보다먼저발생하지않는다. budget/cancel/error는기존true증명이남아도요청완료가아니다. fallback은새세션에서완성탐색한다.

`resultComplete`는요청commit이후에만true다. `completeOutcomes`는그중해당case의**모든**root가exhausted일때만노출한다. 하나라도stopped인경우성공결과만완성되며outcome목록은null로유지한다. 완성집합캐시/ALL에부분결과를넣을수없다.

## 현재 native 경로 검토와 후속 연결 지점

현재 `pattern.rs::save_outcomes_pattern_packed`는입력검증→candidate multiset roots→공유DAG→전체OrderLanguage구축→root별QueueTrie coverage→완성records순서다. WASM export는모든record를하나의버퍼로반환한다. 또한coverage가빈root는출력에서생략한다.

따라서기존packed결과의root목록만으로원래탐색의전체소유그래프를복원할수없다. 이번테스트의완성trace재생은관측된productive roots와empty sentinel을사용한모델검증이다.

실제연결의최소단위는begin/next-root/skip-ack/close형태의**별도producer cursor**가될수있다. 필요한조건은다음과같다.

1. 검색시작전완전한candidate-root목록과case소유권을정하고,coverage0인root도exhausted통지를내보낸다.
2. root를skip해도다른root가사용하는공유DAG/OrderLanguage/scratch자원을폐기하지않는다. close는producer소유자에서한번수행한다.
3. 중단은coverage계산경계에서ack하고오류/취소/예산의구분을export한다. 호환API는항상full exhaustion모드로쓸수있어야한다.
4. JS↔WASM왕복과root×case그래프복제비용을계측한다. 단순한case별Map/Set프로토타입을176,400큐제품표현으로복사하지않는다.
5. 현재DAG와전체language는coverage루프전에이미구축된다. 첫cursor버전의절감상한은주로남은root coverage/packed출력이며DAG전체탐색절감으로보고하지않는다. 단계계측으로이구간이충분한병목인지먼저판단한다.

## 검증 완료 및 후속

동결task013의12계약테스트가모두통과했다.3패턴×Hold양쪽의6개기존WASMtrace를scalar geometryoracle과대조했고,전체집합/실패큐순서/branch중복/긴multiplicity의72회재생검증을완료했다. local10+external119파일을독립감사했다.

실제trace에서중단된root는0개였다. 합성계약에서중단/ack는검증됐지만실제작업절감은확인되지않았다. 다음은즉시native연결이아니라coverage비중과생략가능작업량을확인하는단계다. [상세감사](../../tools/validation/saves-multiroot-contract-audit-20260927/ASTRA_AUDIT_KO.md).
