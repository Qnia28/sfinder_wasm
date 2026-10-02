# 최적화 1차 구현 결과 — 2026-09-21

대상: `D:/AI/sfinder-wasm/release3.0-20260906`. Gemini 리뷰 검토 계획의 첫 묶음(패턴 메타데이터, movement 중복 검사, geometry 캐시)을 구현했다. primary 정책·exact 알고리즘·Worker 수·complete-row 처리는 유지했다. 커밋/배포는 하지 않았다.

## 구현

1. `src/pattern.mjs`: 공개 `expandPatternCases`는 케이스별 독립 mutable Set을 유지한다. 내부용 `expandPatternCasesInternal`은 branch당 lastBag/observedBag 메타데이터를 공유하고 일반적인 add/delete/clear 및 메타데이터 대입을 차단한다. `expandPattern`(문자열 배열 반환), saves, per-save, batch cover/congruent 내부에 적용했다. 이는 내부 읽기 전용 계약이며 악의적 `Set.prototype.add.call()`까지 차단하는 보안 경계가 아니다.
2. 결과에 cases를 직접 노출하는 fifth/path/일반 minimals는 기존 전개 경로를 유지했다. 해당 3개 소스는 snapshot과 동일하다. 공개 mutation 호환성을 희생하지 않았다.
3. `movement.rs`: 선형 dedup 배열을 256-bit seen으로 변경했다. 현재 CELLS 및 inside 좌표 범위에서 canonical orientation/y/x가 cells와 next board를 유일하게 결정한다. 첫 orientation 및 후보 순서를 유지하고 중복 후보는 normalize 전에 건너뛴다. 기존 함수를 cfg(test) 기준 구현으로 보존하여 500개 보드 × 7미노 × 2물리 규칙, 총 7,000회 전체 Placement 벡터를 비교했다.
4. `batch-geometry.mjs`: 정상 2..6 높이/7미노에 최대 35개 lazy cache. 반환 배열은 slice하여 caller의 수정이 cache를 오염시키지 않는다. exported CELLS 변경도 signature로 감지해 무효화한다. 지원 범위 밖 입력은 기존 계산 경로를 유지한다.
5. WASM을 기존 Rust 1.90.0으로 재빌드했다. batch WASM은 snapshot과 바이트 단위로 같고 pc WASM만 변경됐다.

## 측정

Node 24.13.0. 동일 실행 내 교대 5회 중앙값. heap은 GC 후 retained JS heap 차이이며 peak memory나 GC pause 측정이 아니다.

| 측정 | 기존 | 변경 후 |
|---|---:|---:|
| *p3,*p4 내부 전개 (176,400 cases) | 284.1ms | 49.6ms |
| 위 전개의 retained heap | 167.5MiB | 22.2MiB |
| geometry 3,500회 호출 + 결과 동일성 검사 | 202.1ms | 22.0ms |

geometry 수치는 순수 함수 시간만이 아닌 동일성 비교 비용도 포함한다. 표는 부분 단계의 개선이며 solver 전체 가속 배율로 해석하지 않는다.

전체 결과를 비교한 대표 입력은 complete-row saves T,*p3, ALT SHOES per-save *!, ALT SHOES per-save [IJL]p3,*p4이다. 모든 비교에서 출력 전체가 일치했다. 전체 *p3,*p4 solver 완료 성능을 측정했다고 주장하지 않는다.

### 전체 시간에서 확인한 한계

동일 Node 프로세스에 두 버전을 함께 로드한 9회 확인에서 ALT SHOES 분할 패턴은 기존 3,355ms / 변경 후 3,566ms로 약 6% 증가했다. 기존 WASM + 새 JavaScript로 분리해도 유사한 증가가 나와 movement 단독 원인이라고 결론내릴 수 없었다. 이 측정 결과도 삭제하지 않고 보존했다.

새 Node 프로세스에서 요청 1개씩, 버전 순서를 교대로 바꾼 최종 5회 비교:

| ALT SHOES [IJL]p3,*p4 | 기존 | 변경 후 |
|---|---:|---:|
| 새 프로세스 요청 중앙값 | 1262.3ms | 1242.4ms |

실제 Chrome의 새 public Worker 5회 교대 비교:

| 입력 | 기존 중앙값 | 변경 후 중앙값 |
|---|---:|---:|
| complete-row saves | 71.3ms | 72.4ms |
| ALT SHOES per-save *! | 146.5ms | 136.6ms |
| ALT SHOES split | 4141.3ms | 4226.4ms |

새 프로세스에서 위 6% 증가가 재현되지는 않았지만, 전체 solver 속도 개선도 확정할 수 없다. Chrome 분할 패턴은 실행 간 변동이 커 평균적인 가속을 주장하지 않는다. 이번 적용의 확실한 이익은 내부 pattern 전개 메모리 감소 및 geometry 재계산 제거이며, 전체 latency는 후속 최적화에서도 감시한다.

## 검증

- Rust workspace 77개 통과: 3 + 70 + 4. 새 dedup equivalence 테스트 포함.
- 프로젝트 JavaScript 106개 + 기존 validation 269개 = 375개 통과. snapshot 비교 테스트 활성화, 실패/skip 없음.
- 기존 Chrome Fumen 회귀 28개 통과. 추가 Chrome 3입력 × 2버전 × 5회 = 30회 결과 일치 및 page error 없음.
- 새 Node 프로세스 비교 10회 결과 SHA-256 일치.
- complete-row 190/210 회귀와 per-save exact Worker 결과 보존.
- 공개 bag mutation 독립성, 내부 공유/변경 차단, union/case 순서, pattern 제한, geometry 반환값 변경과 CELLS 변경 무효화 확인.
- Rust fmt 및 release WASM 빌드 성공. 기존 BOX/3×4 BOX 8P 제외 방침 유지.

## 후속 범위

다음 묶음은 primary kernel 평탄화·popcount, 키 유형별 해셔 비교, DFS 동적 scratch 재사용이다. 이들은 아직 구현하지 않았다. board 가지치기/fast 2↔2/캐시 정리/JS fallback 역시 측정 우선순위에 따라 진행할 후속 항목이다.

## 원자료

`D:/AI/sfinder-wasm/tools/validation/optimization-wave1-20260920`에 baseline snapshot, manifest, changes.diff, changes.json, benchmark.json(5회), confirm.json(9회), js-only-confirm.json, wasm-isolation.json, fresh-results.json, browser-results.json 및 모든 검사 로그를 보존했다. 단일 프로세스/격리 프로세스/Chrome 수치는 서로 다른 실험이므로 합쳐 평균내지 않는다.
