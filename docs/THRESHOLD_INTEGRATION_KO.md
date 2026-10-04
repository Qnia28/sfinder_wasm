# Threshold 후보 통합 준비

- 준비 branch: `integration/threshold-candidates-20261004`.
- Dev 기준: `c0cb2a048e7275bfea587d176b1954efff0a8a08`.
- 실험 근거: `908efa38b932837a0c12e5a26b8fd290c6d03d18`.
- Dev 작업 트리/main/배포는 변경하지 않는다. 여기서는 준비·검증만 수행한다.

## 빌드 구성

| 이름 | 구성 |
|---|---|
| D | pinned Dev 원본 Rust에서 제품 WASM 재빌드 |
| C | 준비 코드, feature 없음 |
| A | `threshold-current-propagation` |
| B | A + `threshold-root-forced` |

기존 제품 ABI/JS/worker/라우팅/100K probe/CP60초 정책은 유지한다.
두 feature는 기본 OFF이며 두 후보는 개별 커밋으로 이식한다.
rootForced의32/64 보완안과 다른 실험 최적화는 이식하지 않는다.
최종 기본 feature 선택/Dev merge/배포는 검증 결과 검토 뒤 별도 승인 대상으로 남긴다.

## 계약 분리

제품 ABI의 budget0은 unlimited,JS bounded 요청0은 최소1로 보정되는 기존 계약을 유지한다.
native Rust `Some(0)`은 no-search 계약을 검사한다.
JS 제품 API는 bounded+lockedPrefix를 허용하지 않고,progress는 imported lock 없는 bounded 호출에서만 반환한다.
실험 ABI의 imported-prefix 초기 보존이나 zero-budget 표현을 제품으로 암묵적으로 가져오지 않는다.
완료 K/quality/stable-ID는 같아야 하지만,후보와기준의중도incumbent/states/proved-prefix 길이는 다를 수 있다.

## 검증 순서

1. C/D 비활성 동등성과 ABI export 유지.
2. Native oracle/budget/state undo와제품 WASM exact/bounded/progress/locked/reuse 검사.
3. 실험 mask16/20과알고리즘 동등성,기존cycle1/QB witness 재생.
4. 활성 후보의실제worker/secondary/portfolio/CP/browser 회귀 및호출경로 확인.
5. 사전고정32입력,D/A 및A/B 각5쌍,300초,동시최대10shard.
6. 특이입력 새10쌍,기본과분리보고. 회귀기준은≥10%+≥5ms;완료차이·메모리>20%도경보.
7. 결과 감사와 후보별 통합 권고. 결정과 측정을 이유로 제품 라우팅은 변경하지 않는다.
