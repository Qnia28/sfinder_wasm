# Saves 동일 outcome 집합 캐시 — 구현·검증

## 구현

- `src/save-outcome-cache.mjs`는 요청마다 새로 만드는 내부 캐시다. **마지막 bag과 중복 미노 해석이 끝난 완성 outcome 문자열 Set**을 정렬한 JSON 키로 사용한다.
- 캐시 값은 고정된 표현식 목록의 성공 여부 벡터다. 공개 Set evaluator를 바꾸지 않고, 벡터는 freeze해서 cache hit 결과를 변경할 수 없게 한다.
- 최대256 entries, key UTF-16+Boolean slot 추산64KiB, 집합당32outcomes로 제한한다. 상한 초과·miss는 기존 evaluator로 정확히 계산한다. 이 payload 예산은 JS 객체/Map overhead나 RSS 전체의 상한을 뜻하지 않는다.
- `calculateSaves({ outcomeCache:true })`에서만 사용한다. **pilot 감사 후에도 기본false를 유지한다.** ALL 경로는 동일하고 공개 출력 스키마도 동일하다.
- 입력 Set identity나 raw queue 문자열로 캐시하지 않는다. empty Set/empty save, T/TT, 분기별 last-bag, alias/실패큐 중복·순서를 보존한다. regex 예외는 처음 평가할 때 발생하며 실패한 평가는 저장하지 않는다.
- 탐색 조기 종료나 Rust 변경이 아니다. `!` 및 group complement도 완성 집합 전체를 평가한다.

## 검증

`node --test --test-concurrency=1 tests/save-outcome-cache.test.mjs tests/saves-expression.test.mjs tests/saves-outcomes.test.mjs`: **15/15** 통과.

신규6개는 64개 완성집합×14표현식의 원래 Set 의미, 순서독립키/입력변경/벡터보호, 상한 fallback, lazy regex 오류, branch/alias/실패큐/요청격리, 실제WASM 및 기하fallback 결과를 검증한다. 기존9개도 통과했다. 기록은 `tools/validation/saves-outcome-cache-20260926/preflight-astra-001/`.

## 제한된 비교

cache off/on ×2회 ×3입력 =12 jobs, 전체3분/child20초. 작은210큐 단일식, ALT JAWS 독립fullsplit176400큐 단일식, 같은입력8개식만 비교한다. 전체응답을보존하고실패큐순서/중복까지hash비교한다.

feature 전체시간, outcome-search 호출시간, 나머지JS시간, fresh-child전체wall을 구분한다. JS나머지는 패턴전개/집계도 포함하므로 캐시 lookup 자체시간으로 부르지 않는다.

## 완료 결과 및 적용 판정

task010은 12/12 COMPLETE, 약11.2초, 오류/timeout0으로 종료했다. Astra가 동결126파일과 전체응답12개, 실패큐3,304,336개 항목의 순서/소속/집계를 독립 감사했다. 6대응쌍 모두 일치한다.

- 작은 단일식: feature on−off +0.74/−0.03ms.
- 넓은 단일식: +22.25/+88.16ms 회귀, JS나머지도 +75.17/+71.54ms.
- 넓은 8개식: −145.85/−68.64ms 관측, JS나머지 −73.61/−35.68ms. search 구간도 빨라졌으므로 전체 차이를 캐시 효과로 귀속하지 않는다.

**기본false·명시적opt-in 유지.** 단일식 회귀로 전면 적용을 거부하며, 한 보드의 두 표현식 개수만으로 자동 적용 기준을 만들지 않는다. hit rate/평가 전용 시간/캐시 peak 메모리는 미계측이다. 추가 측정은 예약하지 않았다. [상세 독립 감사](../../archive/saves-experiments-20261002/records/tools/validation/saves-outcome-cache-audit-20260926/ASTRA_AUDIT_KO.md).
