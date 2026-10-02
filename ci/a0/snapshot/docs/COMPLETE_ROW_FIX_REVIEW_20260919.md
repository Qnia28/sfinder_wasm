# Complete-row 수정 검토 및 통합 — 2026-09-19

## 결론

제공된 수정은 문제 원인에 맞고, 검토·재현·회귀 검사에서 추가적인 제품 로직 결함을 발견하지 못했다. `D:/AI/sfinder-wasm/release3.0-20260906`에 통합했다. 제공된 폴더는 수정하지 않았다. 기존 per-save secondary 병렬화 등 JavaScript 코드는 모두 통합 전과 해시가 같다.

## diff와 원인

| 파일 | 변경과 판단 |
|---|---|
| `rust/pc-core/src/lib.rs` | `initial_search_board()` 추가. 초기 보드를 정리한 뒤 legal table 검사를 수행한다. 적절하다. |
| `rust/pc-core/src/pattern.rs` | 패턴 존재 판정, path geometry, solution 열거의 3개 진입점을 공통 처리로 변경한다. 기존 초기 줄 위치 마스크는 원본에서 계산하므로 출력 좌표를 보존한다. |
| `rust/pc-core/src/single_queue.rs` | scalar/probe/batch DFS와 structural DAG의 초기 상태를 모두 정리한다. legality 검사만 고치고 DFS에는 원본을 넘기는 불완전한 수정을 피했다. |
| `rust/pc-core/src/tests.rs` | Stage 7 legal table이 실제로 활성화된 상태, 여러 완성 줄 위치와 2개 완성 줄 등을 검사한다. |
| `tests/initial-complete-rows.test.mjs` | 제공된 public API 회귀 검사 2개를 통합하고 추가 2개를 보완했다. |
| `wasm/*.wasm` | 제공본은 다른 Rust 버전으로 만들어졌다. 로컬 Rust 1.90.0으로 오프라인 재빌드하여 소스와 산출물을 맞췄다. batch WASM은 기존 로컬과 완전히 동일했고 PC WASM만 실질적으로 변경되었다. |

문제 Fumen의 원본 보드는 `0xf0f83fffc7`(28칸, Stage 7)이다. legal table에는 정리된 형태 `0xf0f83f1fff`가 들어 있지만 원본 형태는 없다. 기존 코드는 원본으로 legal 검사를 해 검색 전에 탈락했다. Stage 4는 테이블이 비어 있어 일부 완성 줄 셋업은 이전에도 정상처럼 보였다.

여기서 정리는 단순히 10칸을 삭제하여 목표 높이를 줄이는 방식이 아니다. 기존 solver 표현에 따라 완성 줄을 바닥의 채워진 줄로 모으고 나머지 줄의 순서를 보존한다. 따라서 차지한 칸 수·필요 미노 수가 유지된다. 출력용 원본 필드와 cleared-row 마스크는 그대로 남겨, 실제 솔루션을 원래 Fumen 좌표로 복원한다. 배치 cover/congruent의 별도 물리 처리에는 변경이 없다.

## 원래 문제 재현

입력: `v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH`, saves 패턴 `T,*p3`, Hold=true, wantedSave=ALL.

| 버전 | legal table | 성공 |
|---|---|---:|
| 기존 로컬 | 사용 | 0 / 210 |
| 기존 로컬 | 미사용 | 190 / 210 |
| 제공 수정본 | 사용 / 미사용 | 각각 190 / 210 |
| 통합본 | 사용 | 190 / 210 = 90.47619% |

실제 Chrome의 public Web Worker에서도 기존 0/210 → 통합 190/210을 확인했다. 기존 local의 legal-disabled 결과도 일치하므로, 수정본 내부 비교에만 의존하지 않았다. 다만 별도 Java SFinder와 실제 PC_Setup_Trainer 호스트 배포 검증은 수행하지 않았다.

## 추가 보완

제품 로직을 더 바꿀 근거는 발견하지 못했다. 제공 테스트의 범위를 다음과 같이 넓혔다.

- 높이 2~6, 완성 줄을 위/중간/아래에 배치하는 조합, 여러 완성 줄, full field.
- Hold on/off, 성공·실패 큐와 중복 큐. 정리된 보드의 scalar 기준과 pattern 경로 결과 비교.
- 원본 좌표에서 모든 solution mask가 기존 블록 및 서로와 겹치지 않고 목표 필드를 정확히 채우는지 확인.
- minimals와 per-save exact의 serial/auto/2 Worker 결과 전체가 legal-disabled 기준과 일치하는지 확인.

## 검증

- Rust workspace: 76개 통과 (3 + 69 + 4), 실패 없음. Windows GNU 대상과 로컬 rust-lld/self-contained 라이브러리로 실행했다. 최초 MSVC linker 미설정과 GNU linker 설정 문제를 해결한 뒤 완료했다.
- 프로젝트 JavaScript: 104개 통과, 실패/skip 없음. BASELINE_ROOT는 통합 직전 snapshot으로 지정했다.
- 기존 validation: 269개 통과, 실패 없음. 기존 BOX 8P 제외 방침 유지.
- 기존 Chrome 회귀: 28개 통과. 별도 원래 문제의 before/after Worker 검사 2개 통과.
- cargo fmt check, release WASM 빌드 성공.
- 모든 기존 src JavaScript 파일의 SHA-256이 통합 전과 동일함을 확인했다.

PC WASM SHA-256: `f66c4599746395626d42069dd5d89dee96e71812a6062890a8d0e34c988c9057`.
Batch WASM SHA-256: `c4513567b1dd7192103e73763479913b6639a2b7b8370f0a68e3e83c37dfe476` (기존과 동일).

## 원자료

`D:/AI/sfinder-wasm/tools/validation/complete-row-review-20260919`에 최초 diff (`review.diff`), snapshot (`baseline/`), 입력 재현 (`reproduction.json`), 브라우저 재현 (`browser-reproduction.json`), 통합 전/제공본/통합 후 해시 (`integration-hashes.json`), 빌드 및 테스트 로그를 보존했다. 변경 사항은 로컬 작업 트리에 반영했으며 커밋·배포는 수행하지 않았다.
