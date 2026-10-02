# Saves 표현식 후속 설계 — 2026-09-26

후속 상태: 아래는 최초 정적 검토 기록이다. 이후 사용자가 Astra의 직접 테스트를 허용하여 S21-6 A/B를 구현하고 9개 회귀를 통과했다. 최신 구현 범위와 검증은 [구현 기록](SAVES_EXPRESSION_IMPLEMENTATION_20260926.md)을 참조한다. C/D 및 S21-7은 계속 보류한다.

## Objective

`Todo.md`의 S21-6(표현식 평가/캐시), S21-7(단조 조건 조기 종료)에 대한 제품 코드 사전 설계다. 사용자의 하네스 설정 대기 중 수행한 **정적 코드 검토와 문서화**이며, 구현·테스트·벤치·위임은 수행하지 않았다. 아래 사례는 소스의 집합 연산으로 유도한 설명이며 실행 결과가 아니다.

공통 minimals 엔진 정책 검증이 현재 주 작업이다. 이 문서는 그 순서를 변경하거나 saves 구현 착수를 승인하지 않는다. Sol의 테스트/벤치 스크립트 설계, 동결된 신규 보드 행렬 추출 및 Sol 협업 제안서와 별도 범위다.

## Completed

### 1. 검토 기준과 현재 경로

실제 작업본 `release3.0-20260906`의 다음 파일을 읽었다. 해시는 이번 읽기 검토 시점의 SHA-256이며 실행 검증이나 새 snapshot 동결을 뜻하지 않는다.

| 파일 | SHA-256 |
|---|---|
| `src/saves.mjs` | `10d35a42c81dbd57e5ecbb6e69cf5a31a13ba86d6396d6cb82fd80aff4c06ac7` |
| `src/saves-feature.mjs` | `9d61f307c47f1dbec94dcdd0ac6bf8ba0fbe1c7609f29a4b633e994b5932eb16` |
| `tests/saves-outcomes.test.mjs` | `84bf50c3c974a5ea839cc234f22a1ce57808bf3e9e72cd1e187bc6b43f20c791` |

기존 문서: [초기 계획](SAVES_OPTIMIZATION_PLAN_20260921.md), [outcome-only 구현](SAVES_OUTCOMES_IMPLEMENTATION_20260921.md).

현재 `calculateSaves`의 단계:

1. 입력과 마지막 bag을 검증하고 표현식 AST를 요청당 한 번 구성한다.
2. `saveOutcomesPattern`으로 사용 개수 조합별 coverage를 받는다. 전용 API가 없거나 null이면 기존 `visitCaseSolutions`로 fallback한다.
3. `savedCodePrepared`로 **분기별 마지막 bag을 적용한** 정확한 save 코드를 계산하고 case별 Set에 저장한다.
4. ALL이면 save별 빈도를 집계한다. 표현식이면 각 case의 코드를 문자열 Set으로 변환하고 evaluator를 호출한다.

확인한 반복 비용은 `saveCodeToString` 호출, case별 문자열 Set 생성, atom/group별 결과 Set 생성, regex atom 평가마다 `new RegExp` 생성이다. 어느 비용이 현재 병목인지는 새 측정 없이 판단하지 않는다. 여러 표현식의 공통 열거와 outcome-only 탐색은 이미 구현된 공유다.

### 2. 변경 시 보존할 집합 의미

U를 한 case의 **완전한 save 문자열 집합**, M을 하위 표현식의 결과 집합이라 둔다.

| 구성 | 현재 결과 |
|---|---|
| 일반 atom | U 중 요구 미노 중복 개수를 포함하는 outcome 부분집합 |
| regex atom | U 중 해당 정규식에 매칭하는 부분집합 |
| `^E` | U에서 M을 뺀 차집합 |
| `!E` | M이 비어 있으면 U, 아니면 빈 집합 |
| `A && B` | 양쪽 결과가 모두 비어 있지 않을 때 **두 결과의 합집합**, 그 외 빈 집합 |
| `A || B` | 두 결과의 합집합 |
| 최종 성공 | 결과 집합의 크기가 0보다 큼 |

term의 `^`가 먼저 적용되고 `!`가 그 뒤 적용된다. 반복 prefix는 parser의 Boolean toggle을 따르며 혼합 connector는 **왼쪽부터 결합**한다. connector 없는 후속 term은 현재 결과를 교체한다. parser 정리나 엄격한 문법 도입은 이번 최적화와 섞지 않는다.

- U=`{I,J}`에서 `I&&J`는 성공하지만 `IJ`는 실패한다. `&&`를 교집합/비트 AND로 대체할 수 없다.
- U=`{I,J}`에서 `^I`는 `{J}`, `!I`는 빈 집합이다.
- U=`{I,J}`에서 `I||J&&T`는 `(I||J)&&T`로 계산하여 실패한다. scalar minimals의 AND 우선순위와 다르다.
- U가 빈 집합이면 `!I`도 빈 집합이다. 단순 Boolean NOT으로 PC 없는 큐를 성공 처리하면 안 된다.
- U=`{빈 문자열}`은 U가 빈 집합인 경우와 다르다. code 0이나 문자열 `''`를 누락/false sentinel로 사용하지 않는다.
- T와 TT는 다른 outcome이다. save 코드는 opaque number|string이며 큰 중복 개수는 canonical string fallback이다. 7-bit 미노 존재 마스크로 줄일 수 없다.

공개 `compileSaveOutcomeExpression`은 Boolean이 아니라 **Set을 반환**하며 legacy alias도 같은 함수다. 내부 성공 전용 최적화를 도입하더라도 공개 반환값이나 호출 간 mutable Set 독립성을 바꾸지 않는다.

### 3. S21-6: 작은 변경부터 분리하는 설계

#### A. 요청 내 code → 문자열 캐시

`calculateSaves` 호출의 지역 Map을 사용한다. packed/fallback 공통 집계 뒤 ALL과 표현식 양쪽에서 동일한 변환 함수를 사용할 수 있다. 키는 opaque code 자체, 값은 `saveCodeToString(code)`의 반환값이다. 빈 문자열은 유효한 값이므로 truthiness로 cache miss를 판정하지 않는다.

캐시는 요청 종료 시 해제한다. 전역 캐시, case identity 변경, raw queue 중복 제거는 포함하지 않는다. 이 변경만으로 전체 outcome Set 메모리가 줄었다고 주장하지 않는다.

#### B. regex 객체 재사용과 예외 시점

현재 queue-level evaluator는 AST 파싱 때가 아니라 **atom 평가 때** 정규식을 생성한다. 즉 조기 `new RegExp`는 잘못된 regex의 오류 시점을 열거 전으로 옮긴다. case가 0개여서 evaluator를 호출하지 않는 경로의 동작도 바뀔 수 있다.

호환성을 우선하는 첫 후보는 evaluator closure 안의 AST node별 **최초 평가 시 lazy 생성 후 재사용**이다. 현재 regex 문법에는 flags 전달이 없으므로 g/y의 `lastIndex` 상태는 도입하지 않는다. flags 문법을 추가하는 것은 별도 변경이다.

`compileSaveOutcomeAst`는 scalar minimals의 `compileExactSaveExpression`도 사용한다. 공통 parser에 eager regex 생성을 넣어 scalar의 예외/캐시 동작까지 우발적으로 바꾸지 않는다. 단순 사전 컴파일을 채택하려면 오류 시점 변경의 공개 계약을 먼저 결정해야 한다.

#### C. 같은 완성 outcome 집합의 평가 결과 재사용

요청 내 canonical outcome 문자열에 정수 ID를 부여하고, case별 고유 ID를 정렬한 배열을 충돌 없는 형태(예: JSON 배열 문자열)로 직렬화하여 키로 삼는 후보를 검토한다. ID는 요청 내 고정이며 표시 순서나 stable solution ID를 뜻하지 않는다.

캐시 값은 **요청의 고정 표현식 목록에 대한 내부 Boolean 결과 벡터**로 제한한다. 공유 mutable Set을 공개 evaluator 결과로 반환하지 않는다. 캐시 적중 여부와 무관하게 원래 cases를 순회하여 success와 failedQueues를 갱신한다. alias, 표현식 순서, 실패 큐 순서/중복 및 분모 total을 유지한다.

raw queue 문자열만 캐시 키로 사용하지 않는다. 마지막 bag을 적용한 완성 outcome 집합이 같을 때만 공유한다. 서로 다른 bag 분기에서 같은 큐 문자열이 나올 수 있다.

키 정렬/직렬화 비용과 hit 비율을 아직 모르므로 A/B와 분리하여 채택 여부를 판단한다. 캐시 크기 제한에 도달하면 신규 저장을 생략하고 동일 evaluator로 계산하는 정확 fallback이 가능하다. 제한값은 이번 문서에서 임의 확정하지 않는다.

#### D. outcome ID sparse/bitset 표현

후속 후보로만 둔다. U를 해당 case의 outcome ID 집합, M을 중간 결과로 유지해야 한다. 차집합은 **현재 case의 U**에 대해서 수행하며 요청 전체 outcome universe를 사용하지 않는다.

OR는 합집합이다. AND는 양쪽 nonempty 확인 뒤 합집합이다. absence는 child가 empty일 때 U를 복사한다. 단순 Boolean AST나 7종 미노 비트셋으로 일괄 치환하지 않는다. atom별 요청 공통 match 목록을 만들더라도 case U와의 제한을 적용해야 한다.

### 4. S21-7: 조기 종료에 필요한 증명 경계

열거 도중 발견 집합 U가 커질 때 성공이 유지되는가와, 완성 U에서 계산을 빠르게 하는가는 별개다.

- **보수적인 단조 부분집합:** absenceTest가 없고, complement는 match/regex atom에만 붙으며, group complement는 없는 AST. atom 결과는 U에 대한 고정 predicate 필터이며 양의 AND/OR 합성의 결과 집합도 U 증가에 대해 포함 관계를 유지한다. connector 없는 term 교체 역시 마지막 해당 term의 단조성을 따른다. 따라서 성공 후 false로 돌아가지 않는다.
- `^I` 같은 atom complement는 outcome별 고정 predicate이므로 위 범위에 포함할 수 있다. regex 내부 부정 패턴도 한 문자열에 대한 고정 predicate라는 점은 같다.
- `!I`는 U=`{J}`에서 성공하다 U=`{I,J}`에서 실패한다. 미탐색 outcome이 있는 상태에서 부재를 확정할 수 없다.
- **group complement는 별도 증명 없이는 제외:** `^(I&&J)`는 U=`{I}`에서 `{I}`로 성공하지만 U=`{I,J}`에서 빈 집합으로 실패한다. 단순히 “!가 없는 표현식”을 단조라고 분류하면 잘못이다.
- 위 판정은 충분조건이지 필요조건이 아니다. 더 복잡한 식의 Boolean 동치 단순화로 대상 범위를 넓히는 작업은 후속으로 둔다.

표현식 성공이 확정되어도 solver 탐색을 즉시 줄일 수 있는 것은 아니다. 현재 `saveOutcomesPattern`은 모든 root coverage를 동기적으로 계산한 **완성 packed 버퍼**를 반환하고, fallback visitor에도 여기서 확인한 case별 완료/skip 계약이 없다. JS 집계에서 outcome 추가를 생략해도 이미 수행한 Rust 탐색 시간이 줄지는 않는다.

탐색 수준 조기 종료를 도입하려면 별도의 완료 상태와 API가 필요하다:

1. case별 pending/satisfied/exhausted 상태 및 이미 확정된 표현식별 성공을 구분한다.
2. 여러 표현식이 있으면 한 표현식의 성공만으로 case를 완료하지 않는다. 남은 식도 성공 증명되거나 전체 outcome 탐색이 끝나야 한다. 중도 실패 확정은 별도 증명 없이는 하지 않는다.
3. ALL은 전체 save별 빈도가 필요하므로 위 성공 조기 종료 대상이 아니다.
4. raw queue 탐색을 공유하는 여러 branch/case 중 하나가 성공해도 다른 case를 삭제하지 않는다. 모든 consumer의 요구와 branch별 bag 의미를 반영해야 한다.
5. expression budget 소진에 따른 exact fallback, 구 WASM/null compatibility fallback, 완성 줄과 Hold 의미를 그대로 유지한다. 성능 예산 소진을 outcome 부재나 완료로 취급하지 않는다.

## Active Work

이 문서 작성으로 이번 독립 정적 검토는 완료했다. 제품 코드·공개 API·WASM·runner·입력·동결 manifest는 수정하지 않았다. 테스트/벤치 스크립트를 작성하거나 실행하지 않았다.

## Next Steps

실행 가능한 다음 작업은 사용자의 하네스 설정 및 현재 minimals 작업 순서가 정리된 뒤 결정한다.

1. Astra: S21-6 A/B의 제품 변경 범위와 regex 예외 시점 보존 여부를 확정한다. 현재는 구현 보류.
2. Sol: 구현 착수에 맞춰 별도 승인된 범위에서 필요한 테스트/벤치 스크립트와 조건을 설계한다. 이 문서는 runner, 반복 수, 성능 임계값을 지정하지 않는다.
3. 필요한 정확성 근거는 위 Set 의미, 공개 evaluator 반환 계약, queue-level/scalar 구분, 코드/문자열 혼합 키, empty outcome, 분기별 bag, alias/출력 순서 및 packed/fallback 동등성이다. 기존 tests 파일을 읽었다는 사실을 신규 검증 통과로 취급하지 않는다.
4. 완성 집합 캐시(C)와 sparse/bitset(D)의 채택은 반복 비용/메모리 근거가 생긴 뒤 판단한다. 조기 종료(S21-7)는 API와 증명 범위를 별도 설계·검증한 뒤 진행한다.

## Decisions

- 이번 산출물은 새 설계 문서 하나다. S21-6/7의 구현 완료 체크는 하지 않는다.
- 우선 후보는 요청 내 변환 캐시와 호환성을 보존하는 lazy regex 재사용이다. 성능 개선은 아직 주장하지 않는다.
- Set 반환 evaluator 전체를 Boolean이나 bitwise AND로 바꾸는 접근은 의미가 달라 제외한다.
- 단조성은 AST의 실제 Set 의미에 대해 판단한다. group complement 및 absence는 보수적으로 조기 종료 후보에서 제외한다.
- Rust 탐색 조기 종료와 JS 평가 비용 감소를 별개 단계로 다룬다. 기존 동결 minimals 추출·정책 검증 및 Sol 위임 범위를 변경하지 않는다.
