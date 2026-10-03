# 실행 범위 정정 — 원인 파악과 대응 결정만

사용자: “실행하라. 지금 중요한 건 원인파악과 대응 결정임. 성능 벤치마크를 다시 돌리는 것이 아님.”

승인 범위를 S0/S2/S3 진단으로 한정한다. 기존32개에 cold/compiled/warm 조건을 바꾸는 주진단2048회, baseline/baseline 통제128회, 세부계측384회만 수행한다. warmup640회도 전체2560회에 포함하고 기록한다. 이것은 알고리즘 성능 승격 campaign이 아니며 p95통과/5%효과를 다시 입증하지 않는다.

S1신규exact검증/S4공식232개확인/S5제품회귀와통합검증/S6Dev적용은 이번 실행에서 **모두 제외**한다. 실제입력native threshold/primary/PC는0이다. 새64개의pack/decode접근도 없다. 이미남은독립proof는미해결로유지한다.

제품JS/Rust/WASM불변, baseline-source확인binary73224bda…를사용한다. 데이터별R/A는같은runner에서직렬실행한다. block0/1은독립job집합이지독립물리CPU보장이아니다.

메모리구현현실: NodeWorker는thread이고compiledModule은process밖으로일반IPC전송할수없다. compiled/warm manager+worker를3GiB/swap0의한sessionprocesscgroup에넣는다. freshworker마다cgroup을분리했다고주장하지않는다. COMPILED/WARMpeak는누적값이며이번에는제품resourcegate자체가없다. COLD는freshprocesscgroup이다.

실행job상한: preflight15m + host0/1각16×20m + audit10m = 665job-minutes=11.0833runner-hours,순차최대65분(queue별도). maxparallel16/전체3h/64h/160분신규중단/175취소는유지한다. 상한소진시미실행보존,자동retry없음. 자료가부족하면원인미확정으로보고하고새벤치마크로전환하지않는다.

raw저장은독립writerprocess,watchdog는별도supervisor. API10초/process30초(phase-start~rawACK)/startup30초/audit30초/reap2초를서로구분한다. phase-result는검산전writerfsync후ACK한다.

세부계측은solver.e용facade로coreexport와alloc/dealloc만hook한다. 수천번의qualitygetter에timer를넣어readback비용을인위적으로키우지않는다. pre/post는JS+ABI구간,corewall은Rust전처리+탐색+runtime으로명명한다. internalRusttimer없는제품binary에서순수DFS비용만분리했다고주장하지않는다.

종료산출물은원인별관측/반증/확신도와 “제품그대로유지/최소수정가설제안/측정환경개선필요/추가진단필요”의대응결정이다. 진단으로통합승인을발행하지않는다. 과거run/gate/seal불변,Dev/main/배포불변이다.
