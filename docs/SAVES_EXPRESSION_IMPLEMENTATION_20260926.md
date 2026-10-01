# Saves 표현식 지역 캐시 구현 — 2026-09-26

## 범위와 상태

[사전 설계](SAVES_EXPRESSION_DESIGN_20260926.md)의 S21-6 A/B를 로컬 제품 코드에 반영했다. 사용자가 Astra의 직접 테스트를 허용한 뒤 수행했으며, 위임·벤치마크·빌드는 하지 않았다. 성능 개선 폭이나 보편적인 가속은 주장하지 않는다.

S21-6 전체는 아직 미완료다. 완성 outcome 집합별 평가 캐시, sparse/bitset 표현, S21-7 탐색 조기 종료는 구현하지 않았다. minimals 정책 및 동결된 신규 보드 추출 묶음도 이번 변경 대상이 아니다.

## 제품 변경

### `src/saves-feature.mjs`

`calculateSaves` 요청 내 지역 Map으로 opaque save code → 문자열 변환 결과를 재사용한다. ALL 집계와 표현식 평가 경로 모두 사용한다.

- number|string 키를 그대로 사용하여 큰 중복 미노의 문자열 fallback을 보존한다.
- 빈 문자열도 cache hit로 취급한다. code 0을 누락시키지 않는다.
- 캐시는 요청 밖으로 보관하지 않는다.
- 원래 case 순회와 case별 outcome Set을 유지한다. raw queue가 같은 다른 bag 분기를 합치지 않는다.
- 공개 출력 객체·failedQueues·success 집계는 요청마다 새로 만든다.

### `src/saves.mjs`

queue-level AST regex node에 최초 평가 시 RegExp를 저장하고 재사용한다. AST는 컴파일한 evaluator에 속하며 호출자에게 노출하지 않는다.

- AST 파싱 단계에서 regex를 생성하지 않는다. 잘못된 regex는 기존처럼 최초 평가에서 오류를 낸다.
- OR의 앞부분이 성공하더라도 뒤의 잘못된 regex 평가를 생략하지 않는다.
- 결과 Set은 매 평가 때 새로 생성한다. 입력 또는 이전 반환 Set의 변경이 이후 결과를 오염시키지 않는다.
- 현재 문법은 regex flags를 받지 않으므로 g/y의 mutable lastIndex 동작을 추가하지 않는다.
- scalar minimals의 평가 함수와 parser를 수정하지 않는다.

## 직접 검증

실행 명령(실제 작업본에서 실행):

```powershell
node --test --test-concurrency=1 tests/saves-expression.test.mjs tests/saves-outcomes.test.mjs
```

최종 결과: **9개 통과 / 실패 0 / skip 0**. 파일별 실행을 직렬로 제한했다. 테스트 출력의 실행 시간은 성능 측정 자료로 사용하지 않는다.

신규 `tests/saves-expression.test.mjs` 6개:

1. 여러 outcome universe에 걸친 regex evaluator 재사용, AND의 조건부 합집합, complement/group, 왼쪽 결합, 중복 미노와 빈 문자열.
2. 입력 Set 변경을 관측하고 반환 Set 변경의 영향을 격리.
3. 잘못된 regex의 lazy 오류 및 solver 오류와의 발생 순서 보존.
4. queue-level/scalar의 서로 다른 우선순위·부재 의미, group complement의 비단조 사례.
5. ALL 집계의 빈 save·큰 개수 문자열 fallback·같은 raw queue의 bag 분기 차이.
6. alias와 중복 실패 큐 순서, 요청별 반환 배열 독립성.

5/6은 JS 집계만 분리하는 packed solver fixture다. 가상의 coverage/사용 개수 입력을 사용하므로 실제 보드의 PC 가능성 검증 근거로 해석하지 않는다. 첫 실행의 이 두 fixture는 서로 다른 길이의 패턴 분기를 사용해 입력 검증에서 실패했다. 기존 equal-length 계약에 맞춰 fixture만 수정한 뒤 위 9개를 재실행하여 통과했다.

기존 `tests/saves-outcomes.test.mjs` 3개도 제품 WASM으로 통과했다:

- 반복/역순/길이가 다른 큐의 scalar geometry 대조, 강제 표현 예산 fallback 및 반환 버퍼 소유권.
- 2~6줄 완성 행과 Hold 양쪽의 coverage 대조.
- packed 경로와 기존 기하 열거의 saves 반환값 대조: 부재·complement·conjunction·regex·중복 미노·중복 branch·다른 bag·긴 큐 및 null compatibility fallback. 최초 재현의 190/210 성공도 유지.

## 후속 경계

이 변경은 반복 객체 생성/변환을 줄이는 코드 변경이며, 해당 비용이 실제 전체 실행에서 차지하는 비중은 아직 측정하지 않았다. Map lookup과 캐시 메모리 비용도 존재한다.

향후 성능 확인이 필요하면 Sol이 별도 승인된 테스트/벤치 설계 범위에서 조건을 확정한다. 이번 회귀 명령이나 과거 완료 벤치를 자동 재실행하도록 요청하지 않는다. AST 전반 Boolean화, bitwise AND, group complement 조기 종료는 기존 의미와 맞지 않으므로 적용하지 않는다.
