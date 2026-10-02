# C5 — integrated 비용과 threshold 진행 분리 개발 후보

**상태: 설계·실험 구현·72회 개발 비교 및 감사 완료. C5 합류 조건 미채택.**

- integrated100K/조건부200K(F1), threshold50K prewarm(L1)은 유지한다.
- integrated 시간은 threshold의 정체 시간으로 계산하지 않는다.
- threshold native 공통 준비 완료를 기준으로 별도 시계를 시작한다.
- 그 시계의1초에 한 번, 모델≤4,096변수이고 fully proved threshold가 절반 미만이면
  CP1을 추가한다. 기존 C2의50K/100K 상태 gate는 별개로 유지한다.
- 최신 수신 owned seed/proven prefix를 전달하고 Rust는 계속 실행한다.
- 단계 비율은 완료시간 추정 bound가 아니다. 마지막 threshold는 stable-ID도 증명한다.
- worker/native 준비·integrated·threshold 경과·profile·CP 비용을 구분해 기록한다.
- 실배치와 P코어 제한 진단을 각각 비교한다. P코어 제한은 제품 설정이 아니다.

원본/OFF/ON 정확성·탐색상태 대조와 취소/CP실패/회수 검사 후,
노출3입력에서2회 비교를 동결한다. C3-phase 관측비용 대조를 포함한다.
비교 통과해도 새로운 mirror holdout과 browser 검증 전에는 승격하지 않는다.

[세부 설계](../../tools/validation/secondary-phase-dispatch-20260928/DESIGN_KO.md)
[현재 상태](../../tools/validation/secondary-phase-dispatch-20260928/CURRENT.md)

## 개발 비교 결과

72/72EXACT,387파일해시/72해답/466진행snapshot/8시간관측검산통과.
QB059는20~21/28단계진행에서CP를추가하지않아C4보다22~30%개선했다.
그러나QB235는8~9/29단계에서CP를추가한뒤C4보다20~22%느렸고,
최악단독CP대비3.458배/+6.332초가남았다. 따라서이번조건을채택하지않는다.
C3-phase관측비용대조평균은C3의0.986~1.021배였다. 새WASM/관측기반은개발용으로보존한다.
이번설계는시계기준/진행gate/CPprefix를함께바꿔각요인의기여를독립분해한것은아니다.
다음은초기엔진선택과늦은CP합류를별도로설계하고새mirror group에서검증하는것이다.
[최종 결과](../../tools/validation/secondary-phase-dispatch-20260928/RESULT_KO.md).
