# saves 첫 wave 실행 기록

## 현재 상태

실험 branch: `experiment/saves-ci-20261002`. 기준 `187fbf9`.
local dev/main과 remote main은 변경하지 않는다. 제품 승격/배포 없음.
로컬 구현 및 공통 정확성 gate 통과. 사용자가 계정의 유료 초과 사용 차단을 확인하여 비용 gate 충족. 첫 wave 실험 branch push 준비 중.

## 독립 구현과 대조

- A5: `681b096` — escaped 문자·regex 내부 #는 alias delimiter에서 제외. eager 구조검사/lazy regex 계약 유지.
- A4: `023950c` — 기존 세 global map FIFO512, predicate memo256, 문자열 key4096 상한. 키 초과는 정확 계산 후 미보존. 새 AST sharing 없음.
- A6: `111c9d2` — opt-in 단계계측. stats off는 계측 시계/통계 scan0. source overlay로 A4와 분리.
- B4: `fc377e7` — 공유 DAG/언어 coverage 끝단에서 Rust가 residual bitset 생성. JS last-bag 의미·ordered duplicates 그대로. Muse 파일/바이너리 복사 없음.
- REF는 원제품/원WASM. P/R/M은 같은 JS(A5만 포함, A4/A6 제외), 원WASM/원Rust 재빌드/direct Rust를 각각 사용. A4 대조에는 동일 explicit snapshot 지원만 추가한다.
- 새 테스트/runner/workflow는 별도 실행 commit에 고정하며 최종 gate runner signature에 포함한다.

## 사전 검사

- DB 원본 hash·401행 alias inventory·299 raw geometry·32 holdout/64 deep/16 large ID 검증 통과.
- holdout 그룹 교차 노출0. benchmark runner는 holdout input을 실행하지 않음.
- Luna1,595셀/7,975 paired observations 및 Muse164 input coverage를 cell ledger로 기록. 기존 성능 캠페인은 재실행하지 않음.
- 새827셀 중67개는 이전 literal input tuple과 겹침. 이는 새 B4 구현/빌드·wrapper 비용 또는 A6 가설 검증이며 과거 candidate가 동일하다고 주장하지 않음.
- anchor가 소유한 비교2개를 broad/large에서 제거. timed counts: anchor72/A616/broad2108/deep1024/large124=3344.
- A4 resource16 sessions 별도. max-parallel4, 첫 wave job timeout 합280분 상한.
- 로컬 shared gate: REF27/M30/A5 4/A4 3/A6 2 =66 tests 모두 통과(스킵0). fixture 네 조건 signature 일치.
- three A6 stats-on diagnostics는 정확성 gate만, 성능 표본으로 사용하지 않음.
- pinned action SHA, actionlint1.7.12 workflow 검사 통과.

## 실패·한계 보존

- Windows native `cargo test`: `link.exe` 부재로 실행 불가. pc-core native correctness는 Ubuntu CI build job에서 실행하며 실패하면 benchmark 차단.
- 최초 local gate runner는 execFileSync timeout 소수 인자로 시작 실패. 정수 변환 수정. solver 실행 전 오류였음. `.campaign/local-failures/gate-01-timeout-argument/`에 실패자료를 보존, 성공 gate와 혼합하지 않음.
- 로컬 성공 gate 및 build raw 자료는 `.campaign/artifacts/` 보존. local solver correctness 관측의 시간은 새 Linux benchmark 관측으로 합산하지 않음.
- CPU/image는 job마다 기록. 같은 VM pair만 비교. RSS peak는 process lifetime high-water이며 초기화/warmup 포함.
- 2관측은 provisional screen이고 holdout 검증이나 통계적 확증이 아님.

## 무료 사용·자료 보존

- public repo `ubuntu-24.04` standard runner만. cache/larger/유료 fallback/결제 설정 변경 없음.
- build artifact 실제 raw 크기 약1.08MiB. 각 upload<=4MiB, 총20 uploads<=80MiB(추가 안전 상한96MiB). ZIP overhead 대비 여유 확보.
- 기존 repo artifact 약0.55MiB. 계정 전체 공유 artifact/Packages storage는 현재 OAuth scope로 조회 불가.
- retention1일. 종료 직후 로컬 download/hash 검증. 타 작업 artifact/cache 삭제 안 함.
- timeout/실패/부분 실행/미시작은 flush JSONL과 summary에 보존. hard VM 종료 시 업로드 유실 가능성을 명시하며 자동 재시도 없음.
- 무료 잔여 또는 유료 초과 차단 확인 전에 원격 push/Actions 시작 안 함.
- 사용자 최종 확인: **유료 초과 사용 차단됨**. 이 확인을 config에 기록하고 무료 standard runner 첫 wave만 활성화한다. 저장 한도 때문에 artifact가 거부되면 실패/미보존으로 기록하고 유료 fallback을 하지 않는다.
- child supervision 자체 검사3개 통과: invalid variant 오류 보존·deadline 초과 강제 회수·환경 metadata.
- 기준 소스 공개 전 token/private-key 패턴 검사171파일에서 실비밀 발견0. HiGHS 함수명 내부 `ghs_` 부분일치 오탐은 원격 main에도 동일하며 경계 있는 패턴으로 제외한다.

## 후속

첫 wave 결과를 먼저 판정. B6/B3/B1 및 fresh holdout/concurrent/browser wave는 자동 실행하지 않는다.

## CI 실행1 — infrastructure gate 실패

- run36975926163, commit `8d08dab`. build44초/aggregate16초.
- 원WASM 재빌드와 M WASM 빌드는 성공. native pc-core73 tests 중72 pass/1 fail.
- 실패는 `initial_completed_middle_row_uses_normalized_legal_board_in_all_searches`에서 `../../wasm/legal_boards_4.lgb`를 읽지 못한 것. 임시 Rust root에 따른 fixture 배치를 runner가 누락했다.
- gate/anchor/measurement는 차단. timed0/resource0/holdout0. solver 정확성 또는 성능 실패로 해석하지 않음.
- `prepare.mjs`에 baseline tracked legal pack을 정확한 fixture 경로로 복사·hash 확인 추가. candidate source/Rust/WASM 입력·cells·선정·판정 기준 변경 없음. test skip/expected 값 수정 없음.
- 원시 job logs/run metadata/build/aggregate artifact 모두 `.campaign/github-run-36975926163/`로 download. BUILD_SEAL의 R/M SHA256을 실제 bytes와 확인해 archive seal을 별도 저장한다.
- action runtime Node20 deprecation warning은 checkout/setup/upload action 런타임의 Node24 강제 전환 알림. 실제 측정 Node는 setup-node의 고정24.13.0. 실패 원인은 이 경고가 아님.
- 원격 main `03b6377`, local dev/main `187fbf9` 그대로. 인프라 수정 후 새 commit/run 시작은 사용자 확인 전 보류한다. 실패 run을 삭제하거나 동일 run을 임의 재시도하지 않는다.
- 사용자 확인 완료: **수정 후 새 실행 진행**. 수정된 runner의 새 commit으로 시작하며 source candidate refs·동결 cells·holdout 상태는 유지한다.
