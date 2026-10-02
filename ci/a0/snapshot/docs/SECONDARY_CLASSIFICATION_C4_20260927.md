# Secondary C4 시간 기반 합류 — 검증 후 미채택

**상태:** 구현/정확성검증완료,성능채택실패,제품미적용.

조건은C3(F1/L1/C2,CP1)에한번의1,000ms시간관측을추가한다.
integrated미완료후threshold가살아있고CP미기동이면모델분석,≤4,096변수일때CP합류.
Rust는계속한다. 최신소유threshold seed/prefix가없으면primaryseed/빈prefix를쓴다.
동기integrated탐색은timer로선점하지않으며실패후가능한시점에관측한다.
기존상태기준CP가먼저기동했으면시간CP중복기동없음. CP실패시Rust유지/반환시회수.

새QB3반전그룹54행렬에서사전구조기준으로2비자명입력+기존3대조군선정,
5조건×2회=50jobs(30초exact).333해시/42완료witness/10관측감사통과.
C3/C4각10/10EXACT이나QB235에서C4는CP단독보다평균2.43배/+3.79초느렸다.
새QB059에서도C3보다13.6%느려져단순시간합류를채택하지않는다.

추가16진단은모든초기CP모델/seed/prefix/38개단계branches/conflicts/목표가같아도
1초대기후CP시작시CP시작후시간이약2.7초→4.6~4.8초로늘어남을재현했다.
Rust경쟁/모델분석만으로설명되지않으며실행환경원인은미확정이다.
새시간cutoff탐색보다이시작시점민감성의wall/CPU/phase대기분리가다음우선순위다.

[전체결과와원자료](../../tools/validation/secondary-walltime-20260927/RESULT_KO.md).

## 2026-09-28 실행환경 보정 후속

CPU계측/컴파일tier/코어집합/고정C3C4보정53시도를추가했다. CP1의대기/즉시
시간비는무제한1.65배,P집합1.16배,E집합1.00배였다. 모든완료모델/해답을검산했고
코어배치영향은확인했으나정확한thread migration/주파수기전은미확정이다.
QB235의C4/우세단독은P집합1.57배로감소했지만QB059는P에서도2.23배로느렸다.
C4미채택은유지한다. 실배치결과를폐기하거나제품CPUaffinity를채택하지않는다.
다음분류는integrated비용과threshold실제진행의구분을검토한다.
[결과와남은작업](../../tools/validation/secondary-runtime-20260928/RESULT_KO.md).
