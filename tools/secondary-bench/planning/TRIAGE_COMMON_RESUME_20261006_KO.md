# Astra A/B 공통 하네스 재개 — r5

## 범위

`D:\AI\sfinder-wasm\triage-analysis\Astra\NEXT_EXPERIMENT_PLAN_KO.md`의 M5 확장 순서대로 기존 common 실행 기반에 triage performance profile / 실제 정책 adapter / paired compiler / 독립감사를 연결한다. 기존 information profile, original fixture/weighted rows/K/primary seed, 제품 source/WASM, A/B 규칙과 CP 지연·limit·threads는 바꾸지 않는다.

## 오류 수정 및 재개

- 원본 ALL witness hash는 `INSERTION_SELECTED_QUALITY`. 준비기가 잘못 붙였던 sorted 계약만 수정한다. 원본 DB 2,508 EXACT 행 / 509 원 raw 파일을 준비 단계에서 무solver 재검증하고 proof를 bundle에 봉인한다. 정확성 비교를 삭제하거나 원hash를 변경하지 않는다.
- r4 전용 `startupContinuation` 경로는 실행하지 않는다. r4 bundle/release/code는 추적을 위해 보존하며 superseded 상태다. 실제 경로는 common `activate` + 표준 `continuation={parentLock,parentLockSha256,history,historyIndexSha256}`이다.
- r3 `37460239102`의 artifact 21개 원 ZIP digest를 검증했고 parent lock 및 모든 raw/start/scope/receipt와 최종 JS/Python report를 보존했다. raw 32행: MISMATCH2/TIMEOUT12/NOT_RUN18, UNKNOWN0. 이 결과를 EXACT로 재분류하거나 현재 성능 표본에 pooling하지 않는다.
- 새 호출은 `measurementEpoch=5`; 원 logical ID를 덮어쓰지 않는다. 하네스 교정 후 필요한 canary/calibration과 최초 본측정이다. 원본 증거 복구·감사를 위한 solver replay가 아니다.
- 최초 origin `2026-10-06T11:51:03Z`, end+120h, 16VM, 누적 calls8479, runner-hours1400 유지. 과거 32 계획 슬롯 전부를 차감하여 current cap8447. prior 예약14h는 원 control36×2.5h=90h 안에서 소비한다. 새 control13 jobs를 모두2.5h로 잡아도 총46.5h≤90h; matrix최대523과 합친1397.5h 상한 유지.
- prior CP scoped synthetic4 + 새 VM마다 activation1/canary≤3 = 누적≤8 별도 synthetic. solver-free 독립감사와 구분한다. 필수 confirmation의 전체 선정이 current 잔여 cap을 넘으면 planning을 거부하고 HOLD/INCOMPLETE로 남긴다. 자동 축소·clock/예산 초기화 금지.

## 실제 재사용한 기반

1. `common/action`: Actions artifact 인증 및 pinned runtime bootstrap. triage 전용 native-action 사용 중단.
2. `common/adapters.mjs`: `triage-fixture` 요청; heavy seed/hash는 policy 종료 후.
3. `common/executor.mjs`: 단일 task/chunk loop, fresh scope, durable start, admission, quarantine, checkpoint, transport retry. 기존 `triage/executor.mjs`는 연결부만 남김.
4. `common/manifest.mjs`: 별도 profile 검증, legacy parent 읽기 전용 검증, 동일 source/input/condition/origin/end의 indexed continuation.
5. `common/evidence.mjs`: parent 원bytes/index/상태 보존 및 모든 예정 슬롯 보수 예약. 자료 회복에 solver0.
6. `triage/protocol/analysis/independent-audit`: Astra의 phase/pair/seed/선정/개발 keep-hold-reject 및 별도 Python 계약 검산. 원 정보수집의 4-stage 정책에 억지로 섞지 않는다.

## 확인과 종료

synthetic → canary/독립감사 → calibration/독립감사 → ALL_INITIAL 첫 durable paired task와 실행중인16VM matrix를 확인한 뒤 startup watch 종료. 전체 campaign 결과를 PASS로 주장하거나 완료까지 watch하지 않는다. 후속 결과 검토는 사용자 완료 통지 뒤 수행한다.
