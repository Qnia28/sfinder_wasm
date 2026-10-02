# Integrated A0/B10/B6 실행 하네스

**최신 상태: 개발 본측정36,048회 / 기존반례288회 / 독립threshold129회 완료.** 상세는 `MAIN_RESULT_KO.md`. 정상 witness/quality 감사와129개추가exact교차검증PASS. 주대상675개exact는H0=282/P0=P=PC=291/PD=418/PDC=419. bridge/tail/easy-overhead/timeout·bounded품질gate때문에선정후보없음,예약0회,제품승격없음. 본측정시작부터threshold종료까지22.47분/job경과합계약3.76runner-hours로추가승인예산내완료했다. 아래중단/실행중표현은단계별이력이다.

사용자 승인: 정확성→pilot→예산내 가능하면 개발 본측정까지 연속 진행, 개발 gate 통과시 후보1개 동결 후 예약 검증. 2026-10-02. 같은 세션 작업, subagent 없음.

제품 baseline c0cb2a0을 별도 clone/`experiment/integrated-bench-20261002`에서만 사용한다. main/default branch/제품 worktree 변경·merge·배포 없음. Muse 전체 복사가 아니라 B6 pivot과 guarded B10 및 필수 experiment ABI만 이식했다. P0/P bridge는 native const-specialization으로 flags off 비용을 최소화하며 결과/states를 검사한다.

입력은 이미 저장된 최소K 증명 행렬이다. PC열거·primary를 재실행하지 않는다. 개발1502/예약219/기존반례12를packhash로봉인한다. 예약decode는pilot/development에서금지한다. 메모리guard64MiB/비교작업guard50M,매호출API10초/process30초/회수2초를조건별독립적용하고묶음누적한도없음.

계획상의workflow_dispatch-only는main에새workflow를등록하지않은branch-only작업과충돌하므로,main변경없이등록·명시기동하는**launch-*.json marker push**만추가했다. workflow는이경로+실험브랜치+명시commitlabel을모두확인한다. 일반source/docpush는계산을자동기동하지않는다. 브랜치registry에등록된뒤가능한dispatch경로는별도명시단계를사용한다. 이트리의첫launch는correctness+pilot뿐이며본문gate/예산확인없이는main측정이실행되지않는다.

측정하네스는freshprocess+freshWorker,legal:false,공통numericpacking/기존wrapper를사용한다. candidate에서는partitionedexport만실험ABI로연결하고다른wrapper는동일하다. rawquality·IDs와effectivecapped(seedfallback)결과를보존한다. nativeprep/search시간은현재ABI에서측정할수없어null이며APIwall·totalwall·CPU·RSS·WASMmemory와dominance작업수는실측한다. 이null을독립DFS시간으로추정하지않는다.

Node+WASM메모리는root가생성한Linuxcgroupv2에서child전체3GiB/memoryswap0으로제한한다. parent는cgroup밖에서동기busywork도kill/reap한다. correctness에서실제무한loop를API/processwatchdog로끊는테스트를먼저실행한다.

원계획/원표본/36,048schedule는로컬`tools/validation/integrated-bench-plan-20261002`에보존한다. immutableinputs/PLAN/SCHEDULE은여기에복사하되candidatecommit/binary는BUILD.json에서새로봉인한다. 모든artifactretention1일,끝난뒤즉시로컬다운로드/독립검산한다.

Attempt1/run37004387878은checkout기본depth1때문에baselineGitobject가없어gitarchive에서실패했다. 컴파일·synthetic·pilot·본측정호출은0회였다. 전체Actions로그/RUN을로컬보존하고fetch-depth0만CI준비설정으로추가한다. 입력·candidateRust·flags·gate·예산은변경하지않는다.

Attempt2/run37004697494는native debug29/release29검사와두WASMbuild가성공했다. Linuxcgroupchildlauncher의execargv에nodeexecutable이빠진하네스오류가watchdogtest에서발견되어synthetic/pilot/main호출은0회였다. 두binary/hosttest/전체Actions로그를보존하고launcher만수정한다. candidateRust·입력·예산·gate는동일하다.

## 현재 실행 결과 / 본측정 전 중단

### 추가 승인 반영 (본측정 재개)

사용자 추가 승인: “최대 3시간까지 허용함. 그대로 64로 진행하라”. 개발64runner-hours,32chunks/최대16VM으로기존36,048run의배치만바꾼다. 기존SCHEDULE/PLAN은그대로보존하고EXECUTION_SCHEDULE에originalShard와새chunk를별도봉인한다. pilot의기존gatefalse도소급수정하지않으며승인된새배치의예측72.77분으로진입판정한다. 원입력/flags/seed/quality/조건/4반복/100K/매호출상한은동일하고검증된두binary를재사용한다.

전체경과시간3시간은Actionsrun생성부터계산한다. 새호출은160분deadline32초전까지만시작하며job별110분보존상한도유지한다. artifact/집계여유20분을남긴다. 로컬watcher는175분에아직실행중이면Actions전체를cancel하여180분이전에회수·보존을시도한다. queuedjob도같은absolute기준을적용한다. cleanup/queue문제로자동취소된부분결과를성공으로바꾸지않는다. 기존구반례288호출은개발job완료뒤남은전체시간안에서만수행한다. 예약및threshold검증은개발gate/남은시간을확인하기전기동하지않는다.

변경허용하네스는run.mjs의운영배치/전체deadline부분뿐이다. native후보/engine-worker/sample/supervisor/common은pilot당시hash와동일하게검사한다. 새예산승인·실행배치·운영하네스hash도launch-development.json에서봉인한다.

Attempt3/run37005113356/commit36dbc5a: native debug29/release29PASS, Linuxhardcgroup/watchdog검사PASS, synthetic288fixture/6,912callsPASS(nonoptimalseed218fixture). 개발32개pilot192호출전부기록·회수했다. EXACT52/CAPPED86/TIMEOUT_API54,ERROR/OOM/cleanup실패0. timeout은primaryHard9행렬×6조건이며앞조건timeout이뒤조건을생략시키지않았다. 정상반환결과exact/bridge불일치0. timeoutincumbent는null이다.

pilot집계의PASS는하네스/결과장부정합성상태이며본측정진입gate성공을뜻하지않는다. 보수적route최대시간예측은shard최대163.28분/전체38.79runner-hours로,사전등록한80분진입기준및개발32runner-hours상한을넘었다. `mayProceedToMain:false`. 예산을임의로늘리거나100K/호출시간/대상/gate를변경하지않고**본측정기동전에중단**했다. 본측정·구반례측정·예약측정은0회다.

동일24calls/행렬을32chunk/최대16VM에재배치하는로컬초안의최대예측은72.77분이다. 그러나32job×120분은개발운영상한64runner-hours(기존32→64)로증액되므로사용자추가승인이필요하다. 전체원계획상한도66.7→98.7runner-hours다. 이제안은실행하지않았다. 기존호출상한API10초/process30초/회수2초와100K를그대로유지한다.

본측정workflow/분석/빌드재사용검사코드는준비했지만launch-development.json은만들지않았다. explicitlaunch승인및저장된pilot/독립audit/예산gate없이기동되지않는다. source/docpush만으로pilot을재실행하지않는다.

보존:`D:/AI/sfinder-wasm/tools/validation/integrated-bench-20261002/`. 세attempt전체로그/RUN,성공build·correctness·8pilot·summaryartifact,독립Python검사,중단판정/32chunk예산제안/sourcebundle를보존한다. 독립검사는32개inputpackhash/모든192runID,정상138개의witness/quality/states/bridge및54timeout의SIGKILL회수를확인했다. 독립최소K/qualityexactsolver를실행한것은아니다. 성능우세후보를pilot으로선정하지않았다.
