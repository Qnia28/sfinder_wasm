# RC2 출시 전: secondary CP 영향군 선별 제안

작성 GPT-6 Astra. 사용자 방향: linMax RC2 검증 후3.1, Boolean triage는3.1이후.
실행manifest/dispatch/예산예약이 아닌 후보 선정이다.

## 범위와 근거

RC1=2c406b98(Boolean), RC2는RC1의quality OR만linMax로변경한제품이어야한다.
primary CP 또는Rust/P15 변경이없다는소스diff 확인을전제한다.
R15 DEV7ef62d18 대RC1의1098명령/13176호출/각arm6회저장결과를재분류했다.
근거: files/triage-database/triage-experiments/rc-dev-product-r15/ANALYSIS.sqlite
SHA256 2a561e24ebc3b9049c01ef99b9f99015c35e765f91f8367fd3900054d62d27bb.
원감사artifact11701514629, digest8c796cf838a4ffb1c8ea36909aeb91d8bac124ed02e8559bb3ff15a25a118780.
R15 원FAIL/개별artifact미수집/전체로컬재감사PENDING을보존한다. 선정은solver0.

## 기준과 후보

DEV 또는RC1의6회중한번이라도조건에해당하면원명령전체를포함한다.

| 조건 | 중복포함 명령수 | 의미 |
|---|---:|---|
| qualityBackend=ortools-quality-cpsat |32(ALL8/per-save24)|secondary CP사용의확실한양성증거|
| timeout/OOM 등非EXACT |83(ALL63/per-save20)|CP사용여부미확인,linMax메모리후퇴누락방지|
| EXACT 전체명령시간≥60초 |52(ALL27/per-save25)|Rust승자라도CP병행가능성을배제하지않음|

위합집합124명령=ALL85/per-save39.
전체명령50–60초완료가있고합집합밖인경계6명령을추가한**130명령=ALL90/per-save40**을제안한다.
50초는추가선별여유의제안값이지CP시작시각또는검증된성능threshold가아니다.
R15 outcomes는승자backend를보존하지만CP시작flag를보존하지않는다.
따라서시간≥60초를CP사용확정으로분류하지않으며, primary시간/per-save합산으로인한과포함도허용한다.
실제원trace에서CP미사용이증명되면동결전에줄일수있다.

경계6개:
- c7-2plus2-qb-row-076/restricted-split
- c7-2plus2-qb-row-140/all/restricted-split
- c7-2plus2-qb-row-157/all/restricted-split
- cycle1-pcinfo-030/all/bag-plus-next-draw
- pcinfokorea-c2-029/all/bag
- pcinfokorea-c2-029/all/restricted-split

알려진4회귀QB068/QB293/QB321/QB318은130명령에포함됨을assert했다.
전체목록및선정근거callId는files/triage-database/triage-experiments/rc2-validation-plan/SELECTION.json과CANDIDATES.csv에저장했다.
선정코드tools/secondary-bench/postprocess/plan_rc2_selection.py.

## 권장비교

출시판단을위한동시대조는DEV/RC2,각2회×3바퀴로제안한다.
130×2arm×6=1560호출. RC1의이전결과는역사적참고이며같은VM동시대조로표현하지않는다.
RC1까지새로측정하려면2340호출이며추가780호출의판단상필요성을먼저정한다.
RC2만측정하면780호출이나VM차이와제품차이를분리하기어려워기본권장은아니다.
각명령의family/pattern/N+1/hold=true/clear4/thread그대로,per-save전체명령유지,
무계측fresh process, 외부600초, 최대12VM을유지한다. 실행시간/추가예약/기한은별도동결해야한다.

선별집합밖잔여968명령을이번모델변경때문에자동전수재측정할필요는없다.
단‘전체population검증완료’라고표현하지않고기존R15결과와신규영향군결과를revision별로구분한다.
실제배포물smoke/정확성/취소/실패복구검사는별도유지한다.

결정: 기존일반적‘대표군선정’보다이번변경경계에맞는130명령보수집합을추천한다.
후보수는확정실행승인이나문제해결판정이아니다.
