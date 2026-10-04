# Threshold 후보 통합 준비

**2026-10-04 완료:** [제품 경로 검증·후보별 권고](../bench/threshold-integration/RESULT_KO.md).
준비 브랜치에서 이식·검증·측정·재확인·독립감사를 마쳤다. Dev/main/기본ON/배포는 변경하지 않았다.

- 준비 branch: `integration/threshold-candidates-20261004`.
- Dev 기준: `c0cb2a048e7275bfea587d176b1954efff0a8a08`.
- 실험 근거: `908efa38b932837a0c12e5a26b8fd290c6d03d18`.
- Dev 작업 트리/main/배포는 변경하지 않는다. 여기서는 준비·검증만 수행한다.

## 빌드 구성

| 이름 | 구성 |
|---|---|
| D | pinned Dev 원본 Rust에서 제품 WASM 재빌드 |
| S | Dev에추적된기존WASM원본,재빌드와분리한동등성대조 |
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

### 범위·사전 고정

`bench/threshold-integration/run.json`에 cycle1 16개와QB 16개를측정전에고정했다.
기본32입력×2비교×5쌍×2side=640요청이며,완료여부에따라조기종료미실행은따로기록한다.
재확인은material회귀/완료차이/메모리>20%와함께긴입력(OFF≥60초)의≥100ms+≥2/3느림,
큰개선(OFF≥1초,ratio≥1.5)을대상으로하고range-noise만으로반복을늘리지않는다.
재확인10쌍은기본5쌍과합산하지않고cycle1/QB를분리한다.

이저장소는엔진라이브러리이며소비앱UI가없다. 브라우저검사는실제Chromium에서
기존제품모듈/API/Worker/진행prefix/취소/회수/재실행을검사하는harness다.
소비앱UI전체의입력/표시검증이나Dev/main/배포완료라고주장하지않는다.

Lint에서는기존lib의needless_borrow/manual_range_contains와기존pc-core테스트의
unusual_byte_groupings/filter_map_bool_then만분리허용한다. 새후보코드의경고는허용하지않는다.

### Dev 소스와 저장된 WASM의 차이

원래Dev에추적된WASM(S)은640232e3…이며현재DevRust에는이미존재하는
partitioned/progress/proven-prefix export4개가없다. D는현재DevRust를같은toolchain으로재빌드한기준이다.
S를수정하거나DevWASM을교체하지않고별도보존해기존exact/bounded/locked API의
결과·states를D와직접검사한다. S에없는progress계약을통과했다고주장하지않는다.
제품후보A/B는D의exportset과완전히같고S의모든export를포함한다.
주성능D/A는이러한재빌드차이를최적화효과로섞지않는source-to-source비교다.
별도고정6개짧은입력에서S/D·D/C 각5쌍(120호출)을직접측정하고주32개비교와분리한다.
