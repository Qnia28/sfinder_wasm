# Saves outcome-only 구현·검증 — 2026-09-21

`calculateSaves`의 기본 WASM 경로를 save 결과 존재성 탐색으로 교체했다. 기하 해답 복원과 큐별 orderCount 계산을 생략하고, 사용한 미노 개수 조합별로 성공 가능한 큐를 계산한다. 표현식 평가와 공개 반환 형식은 유지한다.

## 구현

- `rust/pc-core/src/pattern.rs`: 공통 multiset DAG의 생산적인 root와 사용 미노 개수 조합을 함께 보존한다. `save_outcomes_pattern_packed`는 각 root의 성공 순서를 QueueTrie에 투영한다. 각 root마다 모든 성공 큐를 수집하며 첫 PC에서 종료하지 않는다.
- `order_language.rs`: `build_separate`가 root별 성공 순서 언어 ID를 반환한다. suffix 구성과 intern/memo는 공유하지만 서로 다른 사용 미노 조합의 root를 합치지 않는다.
- 언어 구성 또는 큐 투영의 표현 예산이 부족하면 해당 DAG의 정확한 순서 열거로 복귀한다. 예산 소진을 실패/빈 결과로 해석하지 않는다. fallback은 느려질 수 있으며 전체 탐색의 시간 상한은 아니다.
- `pc-wasm`: `[사용 개수의 4-bit 카운터 × 7, 큐 개수, 큐 ID...]` 레코드를 연속 u32 버퍼로 반환한다. geometry와 quality는 전송하지 않는다.
- `pc-wasm-enumeration.mjs`: WASM 메모리의 결과를 JS 소유 배열로 복사한다. 이후 WASM 호출/메모리 성장에 영향을 받지 않는다.
- `saves-feature.mjs`: 레코드를 기존 `savedCodePrepared`에 연결한다. 미노 순서는 Rust의 IJLOSTZ에서 표시 순서 TILJSZO로 변환한다. 같은 raw queue라도 분기별 마지막 bag 메타데이터를 각각 적용한다. 구 WASM 또는 전용 API 없는 solver는 기존 열거 경로로 처리한다.

정확성의 근거는 고정된 큐와 마지막 bag에서 save가 **사용한 각 미노의 개수**로 결정된다는 점이다. 동일 개수 조합 내 여러 기하 해답과 여러 성공 순서는 save 결과를 추가하지 않는다. 반면 다른 개수 조합은 보존해야 하므로 Boolean PC 판정처럼 root를 모두 합칠 수 없다.

완성된 줄은 기존 `initial_search_board`로 정규화한다. 0-placement PC는 기존 기하 열거의 빈 결과 규약을 유지한다. Hold, 긴 큐, 마지막 bag의 미인출 미노 및 중복 save 미노의 해석은 변경하지 않는다.

## Node 측정

Node 24.13.0, clear=4, Hold=true, wantedSave=ALL. 변경 직전 소스/WASM snapshot과 현재 버전을 새 프로세스에서 번갈아 실행했다. 각 3회 중앙값, solver 초기화 제외, 패턴 전개·탐색·집계 포함. 이전 조사 문서의 계측값이 아니라 이번에 다시 측정한 값이다.

| 셋업 / 패턴 | 변경 전 | 변경 후 |
|---|---:|---:|
| ALT SHOES / `*!` | 77.26ms | 66.71ms |
| ALT SHOES / `[IJL]p3,*p4` | 172.25ms | 121.91ms |
| ALT JAWS / `[IJL]p3,*p4` | 169.18ms | 125.78ms |
| complete-row / `T,*p3` | 8.23ms | 7.68ms |
| ALT SHOES / `*p3,*p4` | 15초 제한 미완료 | 756.54ms |
| ALT JAWS / `*p3,*p4` | 15초 제한 미완료 | 766.92ms |

전체 독립 split은 각 176,400큐이며, 변경 전은 각 1회만 시도하고 15초에 종료했다. 따라서 변경 전 완료 시간이나 정확한 가속 배율은 알 수 없다. 변경 후 전체 split은 각 3회 동일한 결과 해시를 얻었다. 짧은 요청의 수 ms 차이는 일반적인 성능 보장으로 해석하지 않는다.

## 정확성 검증

- ALT SHOES/ALT JAWS의 전체 `*p3,*p4`를 앞 구간의 미노 집합에 따라 35개 독립 묶음으로 분할했다. 각 묶음은 5,040큐이며 중복 없이 전체를 덮는다.
- 변경 전 기하 열거를 기준으로 **큐별 가능한 사용 미노 개수 집합**을 생성하고, 새 경로의 각 묶음 결과 및 전체 176,400큐 단일 호출 결과와 전수 대조했다. `ALL` 결과, save별 집계, 실패 큐 순서도 일치한다.
- 전체 PC 성공 큐는 ALT SHOES 149,754/176,400, ALT JAWS 158,994/176,400이다.
- 최초 complete-row 사례 `v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH`, `T,*p3`는 190/210을 유지한다.
- 신규 테스트는 스칼라 기하 열거와의 비교, Hold on/off, 길이가 다른 큐, 중복·역순 큐, 2~6줄 완성 행, 언어 예산 0의 강제 fallback, 반환 배열 수명, 서로 다른 bag 분기의 동일 큐, 7개 초과 중복 미노를 검증한다.
- `!T`, `^T`, `I&&L`, `IJ`, `TT`, `/TT/`, 다중 표현식, ALL, alias 등은 신규/기존 saves 테스트로 확인했다.
- Rust workspace 77개, JS 프로젝트 111개 및 기존 validation 269개(총 380개) 통과. 추가 bag 분기 케이스를 넣은 신규 파일도 다시 통과했다. 기존 BOX 제외 방침 유지.
- 실제 Chrome의 새 public Worker로 30회 검증했다. 작은 4조건은 변경 전/후 각 3회 전체 응답이 일치했고, 전체 split 2조건은 각 3회 Node의 검증된 전체 응답과 일치했다. page error 없음. 이 실행은 일부 다른 검증과 동시에 진행했으므로 브라우저 시간을 독립 성능 벤치마크로 사용하지 않는다.
- release WASM 빌드, `cargo fmt --check`, `git diff --check` 통과.

## 남은 범위

이번 변경은 일반 multiset 경로의 saves 최적화다. 미노 하나가 남는 경우의 u8 전용 출력, 표현식 캐시/RegExp 사전 컴파일, 단조 표현식 조기 종료 및 추가 병렬화는 아직 적용하지 않았다. minimals/per-save primary·secondary worker 구조는 별도 TODO다.

`ALL`이나 부재 표현식에서 미탐색 outcome을 무시하는 최적화는 하지 않았다. 일반 경로의 정확성과 넓은 큐 성능을 먼저 확인했으며, 이후 특화는 이 구현과 비교하여 판단한다.

## 재현 자료

`D:/AI/sfinder-wasm/tools/validation/saves-outcomes-20260921/`

- `baseline/`: 변경 직전 source/WASM snapshot.
- `one.mjs`, `run.mjs`, `results.json`, `run-*.json`: 번갈아 실행한 Node 측정과 전체 결과.
- `full-oracle.mjs`, `full-oracle.json`: 기존 기하 열거와 전체 독립 split의 전수 대조.
- `rust-tests.log`, `js-tests.log`, `validation-tests.log`: 회귀 결과.
- `browser/`, `browser-results.json`: 실제 Worker 응답 검증.
- `changes.diff`, `changes.json`: 이번 작업만의 source diff와 해시.

제품 회귀 테스트: `tests/saves-outcomes.test.mjs`. `wasm/pc_wasm.wasm`을 재빌드하여 반영했고 batch WASM은 변경하지 않았다.
