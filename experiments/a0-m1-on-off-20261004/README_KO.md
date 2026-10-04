# 통합 후 ON/OFF 비교 준비 — 아직 실행하지 않음

이번승인범위는선택가능A0+M1구현과Actions비교준비까지다. **launch.json이없고실제campaign호출은0**이다. push준비만으로Actions가실행되지않는다. 실행은별도승인후이디렉터리에launch.json을추가한push로만가능하다.

## 비교 대상과 범위

- OFF=`exactProbe:reference`,ON=`exactProbe:a0-m1`. 양쪽동일제품source/runtime/옵션,후보정책만다르다. R기본값유지.
- 이전동결122입력(개발34/예약88)을그대로쓴다. 새유리한tail재선별/168·232·675확장없음. 선택이유·원gzip bytes/weightedrows/stableIDs/Kproof/seed/alias/hash를보존했다.
- capturedmatrix만probe하는이전벤치와다르다. 원fumen/pattern/filter로**제품 save-minimals API**를실행해PC열거·primary·실제100K probe·CAPPED 후 실제threshold·fumen출력까지포함한다. primary는실제로다시풀며K를원독립proof와확인한다. 새primary seed를숨기지않고raw에저장/쌍간대조한다. 원seed와과거측정값을대체하지않는다.
- **Node24.13.0 기본flags 런타임 비교**다. backend Auto의실제해결값과ORTools지원여부를lock/raw에기록한다. Node에서JSPI가없으면기존fallback 경로를재고,CP가실행됐다고주장하지않는다. browser의CP late-race응답시간/GUI전송지연/warmWorker성능을확증하는벤치는아니다. browser통합계약은별도합성회귀로검증했다. 기본값판정때이범위를명확히구분한다.

## 고정 일정

122입력×100인접쌍×2요청=24,400 full requests. 개발/예약고정환경대조2개×10runner×2정책×2동일정책요청=80환경requests. **총24,480,10runner당2,448**이다. 각runner입력당10쌍(정역각5),전체100쌍이며100독립host는아니다. 이전M1재테스트의100쌍/10runner선호를유지한다.

매요청은새child/Worker realm이다. 주요지표 `coldRequestMs`는freshchild생성부터제품출력까지이며raw ACK/사후검산/teardown은빼서기술적으로분리한다. `requestApiMs`는moduleimport/solverload/PC열거부터출력까지다. 종료후별도재계산한originalmatrix hash의 `postTimingAuditMs`도cold시간에서제외한다. 양쪽동일probe IPC계측은있으므로계측없는사용자응답시간과동일하다고주장하지않는다. probe API/load시간도따로기록한다. user빈도가중/브라우저end-to-end수치가아니다.

## 실행 gate와 예산

Actions는원Rustsource로R/batch를다시빌드해c0cb2a0의Linuxbuild와byte동등성을확인하고,후보는고정overlay/M1feature로별도빌드해원hash와대조한다. LinuxR=73224bda…,M1=c3c9a884…필수gate. nativeRustdebug/release·제품회귀·byte/input/schedule·통계·rawdurability/watchdog/cgroup gate가모두통과해야10jobs가시작된다. host별재컴파일/유리한host교체없음. source/gitblob·runtime·inputlock은각runner가다시검사한다.

새**full-request 캠페인**은wall3h/64runner-hours,compute160/cancel175/overall180분이다. 10jobs×165분+preflight20분의상한27.833runner-hours≤64. 100K검색예산과probe10초독립deadline,CP60초/120초정책은그대로다. 기존probe-only10초를request전체deadline으로오용하지않도록새full-requestAPI210초/process240초를둔다. startup30초·audit30초·durableACK10초·reap2초는각독립이다. child3GiB/swap0및전체descendant kill을강제한다.

인접쌍입장예산664초는최악startup30+callstartup30+process240+audit30+reap2의2배다. API210은process240안의겹치는guard이며ACK도processdeadline내에포함된다. origin은최초Actionscreated_at에서고정,paired입장guard/runnerguard로중단한다. 실제실행시외부watch.py도즉시시작해175분cancel을독립보장해야한다.

**전체요청소요는미측정**이므로이전47분probe벤치로완료시간을보장하지않는다. timeout/OOM/정확성/protocol실패시해당job정지,다른고정job은fail-fast:false로증거를보존한다. partial만성공판정/자동budget증액/자동재실행없음. 입력별10%악화는진단기준이지default채택자동veto가아니며새5%gate도없다.

raw를별도writer가fsync한후ACK하고검산후다음요청을진행한다. probe subphase도독립10초guard와원시기록을남긴다. 완료후`audit.py <download>`가원weightedrows/K/IDs/실제Linuxruntimebytes/source·raw·파일inventory·모든인접쌍을검사한다. `analyze.py`는pairedratio/delta,runner중앙값·8/10방향·환경경보·seed변화를보존하며환경host삭제를하지않는다.

## 별도 실행 승인 후

1. 이구현commit을고정하고launch.json에`{"status":"AUTHORIZED_ONE_PRODUCT_ON_OFF_CAMPAIGN"}`을추가해명시적실행승인을기록한다. 현재는이파일을만들지않는다.
2. branch `integration/a0-m1-selectable-20261004`에launch만추가한push→최초runID/created_at기록→외부watcher시작. 재테스트tail을다시선별하지않는다.
3. 모든artifact/실패/partial을새결과폴더로다운로드,독립audit→한번판정. 기존봉인증거와원timing은변경하지않는다. default승격/mainmerge/배포는별도결정이다.
