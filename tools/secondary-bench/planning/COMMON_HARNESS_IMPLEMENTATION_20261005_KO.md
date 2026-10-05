# 공통 하네스 구현 상태

2026-10-05 · 확정 계약: [COMMON_HARNESS_DESIGN_20261005_KO.md](COMMON_HARNESS_DESIGN_20261005_KO.md)

**공통 실행 기반 v1 구현 및 소형 실제 Actions 관문 완료.** 최종소스 smoke [37302094137](https://github.com/Qnia28/sfinder_wasm/actions/runs/37302094137), 로컬100/100 PASS, 원격 EXACT8(초기6+추가2), 누락/receipt누락/witness오류0, 로컬archive 재검산PASS. 제품 triage/e2e 어댑터(M5)와 실자료 성능 판정은 완료 범위가 아니다.

## 구현 범위

- `tools/secondary-bench/common/`: manifest/profile/lock/ID/budget, 정책·어댑터, planner/executor, immutable evidence·receipt/index·복구·감사·archive·legacy reader.
- `.github/workflows/secondary-bench-common-*.yml`: 공통 reusable campaign/stage, manifest/그룹 launcher, 소형 합성 smoke.
- `tests/secondary-bench-common.test.mjs`: F/A 원계획 대조, raw·실행/전송 구분, 장애 주입, budget·VM·미지원 조합 거부, 실제 세 엔진 tiny fixture, 실제 Bash clock 검사.
- [사용 절차·지원 조합·복구 운영](../common/README_KO.md).

기존 F/A 하네스/manifest/start marker, 원자료, 제품 solver 및 main은 변경하지 않는다. 문서 작성 시 사용자에게 실험 branch에만 게시하고 원격 합성 검증까지 수행하는 승인을 받았다. 기존 실자료 캠페인은 재실행하지 않는다.

## 관문

| 단계 | 상태 |
|---|---|
| M0 기준 동결 | 기존 F/A·제품·main 보존 확인,220개 canonical committed source 검증 |
| M1 명세·정책·예산 | 구현·계약 검사 통과, F/A 원조건·선별·순서·반복·packing 대조 |
| M2 evidence·legacy·감사 | 구현, 합성 장애·positive continuation·실제SDK/receipt·archive 검증 |
| M3 실제 Actions 전체 경로 | 최종 revision의 실제1VM smoke 성공; initial/additional 실호출 및 빈정상단계 검증 |
| M4 F/A 인계 | 읽기 전용 recipe·사용 절차·지원조합 문서·동등성/차이 원장 제공; 실자료 재실행 없음 |
| M5 triage/e2e 어댑터 | 미구현. schema에서 실행 거부; 별도 cutoff/제품 변경 없음 |

공통 실행 기반의 완료 표시는 실제 M3 관문 통과와 원자료 재검산을 근거로 한다. 모든550개실자료의완료·모든장애상황의원격검증·성능PASS를 뜻하지 않는다. ACK 유실/재전송/부분 실행/continuation의 일부 검사는 합성 local transport로 수행했고 실제Linux OOM·SDKupload/download·정상추가단계는원격으로검증했다.

## 명시적 차이

- 진단 최악 예약: 기존150초 고정 → 공통식160초. 실제 호출·phase 제한은 유지.
- campaign end 전 최종 transport/audit/reserve를 명시적으로 예약하는 보수적 admission.
- 기존 ID는 원 포인터로 보존하며 새 실행의 ID는 canonical v1 계약을 사용.
- 과거 continuation은 자동 이관하지 않고, 부모 lock·완전 history·원시각 검증을 요구.

## 실행 증거

- 최초 게시 전 로컬98/98, digest 회귀 추가 후99/99, continuation 완료·보존 분리 회귀 포함 최종 **100/100 PASS(기존77+공통23)**. 실제 세 엔진의 소형 합성 fixture 실행과 실제 Bash clock 검사 포함.
- 신규4개workflow actionlint 통과(shellcheck/pyflakes 비활성). runtime Bash는 별도 실제 실행 검사로 보완했다.
- 원격 run/artifact/archive 및 최종 관문은 원격 검증 뒤 아래에 기록한다. 미기입은 원격 PASS를 뜻하지 않는다.

### 첫 원격 smoke의 경계 오류

- 준비 preflight `37299660129` 성공.
- 합성 smoke `37299789888`: 공통21개계약·실제Linux OOM계약 성공 후 activate에서 config digest 표기를 거부했다. 측정 stage는 전부 skip, dataset 호출0.
- 원인: `actions/upload-artifact`의 bare SHA256 출력과 backend의 `sha256:` 표기를 동일하게 처리하지 못함.
- 공통 `artifactDigest` 경계 정규화와 두 표기/잘못된 digest 회귀 검사를 추가했다. 실패run 및 진단artifact `11341330936`은 보존한다. 이 실패를 측정PASS로 취급하지 않는다.

### 첫 전체 경로 통과와 추가 복구 감사

- `37300246150` (commit `9ccd8fab33cca80d25095269b7a4532876e5a2ed`): 실제1VM공통경로로 EXACT6, missingCalls0/missingReceipts0/witnessErrors0, validity PASS, performance NOT_APPLICABLE.
- 원격 artifact를로컬로내려받아 snapshot/hash/원행 witness를재검산하고 archive index를검증했다. `benchmark-results/common-harness-20261005/smoke-37300246150/`에보존.
- history index SHA256 `4f6f109373c41faaabcd30947a64103f8d1c05ecd9642f22c405f9674202f211`.
- 추가 positive continuation 검사를통해 기존 NOT_RUN 증거는보존하되 후속실행으로해소된호출은현재미실행으로세지않도록분리했다. OOM 엔진의보류도continuation에서유지한다. 최신소스의최종smoke는별도로기록한다.

### 최종 실행 기반 검증

- 준비 revision `0460391d3df0a6165a307e69f5b5d8f4d903ea07`, preflight `37301887872` 성공 후 marker-only commit으로 실행.
- 최종 smoke commit `92e9bb3ed190d5656323b495a64a77eefce84f50`, run [37302094137](https://github.com/Qnia28/sfinder_wasm/actions/runs/37302094137) 성공.
- sourceLock `ecb5f0b6779d5db6e17982b35672e20c0394cfedff39f4bef092013ea81e1ce7`, manifestHash `8195a5bf04a5943f71faaa56987f946a06ea61dbcfeb46f9ecb4fed237fbc3da`.
- 실제 peak VM1(계획·보고포함), EXACT8(초기6/추가2), 세 엔진, owned process-tree scope. preflight/acquire는 fixture-only 명세의 빈 정상단계로 기록됨.
- expected8/recorded8, missingCalls0/missingReceipts0/witnessErrors0, validity PASS, performance NOT_APPLICABLE.
- 실제 raw·snapshot·receipt·inventory를 내려받아 원행 witness를 다시 검사했고 원격AUDIT와 독립 재생성AUDIT가 일치했다.
- archive: `benchmark-results/common-harness-20261005/smoke-37302094137/`; history index SHA256 `746b20a113b35317f59d98ed8d67b81a9a9d322fea1e76dd8327bb22d1b10e55`, state ARCHIVE_VERIFIED.
- 요약 machine record: [COMMON_HARNESS_V1_RESULT_20261005.json](COMMON_HARNESS_V1_RESULT_20261005.json). raw/큰실행자료는gitignore된로컬archive에보존하며요약포인터/hash만게시한다.
- 원격main은 `03b637730c5b541f4f2934be613498fbe65327fd` 그대로, 기존F/A source/start marker/제품diff0. 새실자료캠페인은실행하지않았다.
