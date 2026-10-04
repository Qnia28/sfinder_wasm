# artifact 운송 하네스 교정 — 원조건·시계 보존

- 최초run37222172267:success/51분,1376artifact. defaultdownload action이1000개(일부필터에서는900개)만조회했다.
- 원결과1368archive를전부pagination다운로드·digest검증후보고재생성:기본반복누락0,exact witness문제0,EXACT5118/TIMEOUT180/CAPTURED440.
- 누락된history때문에최초run의추가반복일정일부가조기제외됐다. 실제2/4/6/8/10반복조건수는90/140/545/116/36이며전체927engine×fixture조건이다. 이편차를시간예산/엔진패배로해석하지않는다.
- 첫5분launch37225619701은모든measure가skip됐다. fixturelock은부분다운로드를거부했고cross-run REST request폭증으로secondaryrate-limit까지발생해계획/report job이실패했다. solver결과는0이므로완료측정재실행/교체가없다.
- 교정:현재run의목록은REST페이지전체조회;다운로드는runtimebackend의idFilter로SDK직접다운로드. 과거309fixture는단일first-plan bundle로재사용. checksum·fixturelock검증을유지한다.
- 이교정은분류/solver/표본설계변경이아닌실행하네스수정이다. jobscope/timeout/repeats/조건을바꾸지않는다.
- 복구origin은2026-10-04T18:44:56Z이며총6h·추가admission5h는이시계에서계속된다.
- final combinedreport는원60초raw전체와실제300초복구raw를하나의문서에보고하며조건별통계를분리한다. 이미저장한firstpartialreport는역사기록으로남긴다.
