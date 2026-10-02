# Integrated A0/B10/B6 실행 하네스

사용자 승인: 정확성→pilot→예산내 가능하면 개발 본측정까지 연속 진행, 개발 gate 통과시 후보1개 동결 후 예약 검증. 2026-10-02. 같은 세션 작업, subagent 없음.

제품 baseline c0cb2a0을 별도 clone/`experiment/integrated-bench-20261002`에서만 사용한다. main/default branch/제품 worktree 변경·merge·배포 없음. Muse 전체 복사가 아니라 B6 pivot과 guarded B10 및 필수 experiment ABI만 이식했다. P0/P bridge는 native const-specialization으로 flags off 비용을 최소화하며 결과/states를 검사한다.

입력은 이미 저장된 최소K 증명 행렬이다. PC열거·primary를 재실행하지 않는다. 개발1502/예약219/기존반례12를packhash로봉인한다. 예약decode는pilot/development에서금지한다. 메모리guard64MiB/비교작업guard50M,매호출API10초/process30초/회수2초를조건별독립적용하고묶음누적한도없음.

계획상의workflow_dispatch-only는main에새workflow를등록하지않은branch-only작업과충돌하므로,main변경없이등록·명시기동하는**launch-*.json marker push**만추가했다. workflow는이경로+실험브랜치+명시commitlabel을모두확인한다. 일반source/docpush는계산을자동기동하지않는다. 브랜치registry에등록된뒤가능한dispatch경로는별도명시단계를사용한다. 이트리의첫launch는correctness+pilot뿐이며본문gate/예산확인없이는main측정이실행되지않는다.

측정하네스는freshprocess+freshWorker,legal:false,공통numericpacking/기존wrapper를사용한다. candidate에서는partitionedexport만실험ABI로연결하고다른wrapper는동일하다. rawquality·IDs와effectivecapped(seedfallback)결과를보존한다. nativeprep/search시간은현재ABI에서측정할수없어null이며APIwall·totalwall·CPU·RSS·WASMmemory와dominance작업수는실측한다. 이null을독립DFS시간으로추정하지않는다.

Node+WASM메모리는root가생성한Linuxcgroupv2에서child전체3GiB/memoryswap0으로제한한다. parent는cgroup밖에서동기busywork도kill/reap한다. correctness에서실제무한loop를API/processwatchdog로끊는테스트를먼저실행한다.

원계획/원표본/36,048schedule는로컬`tools/validation/integrated-bench-plan-20261002`에보존한다. immutableinputs/PLAN/SCHEDULE은여기에복사하되candidatecommit/binary는BUILD.json에서새로봉인한다. 모든artifactretention1일,끝난뒤즉시로컬다운로드/독립검산한다.
