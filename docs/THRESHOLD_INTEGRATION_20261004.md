# Threshold 최소 제품 통합 — 2026-10-04

## 결정과 범위

사용자 승인에 따라 Dev 기준 `c0cb2a048e7275bfea587d176b1954efff0a8a08`에
**B = currentPropagation + rootForced ON**을 기본 통합했다.
작업 branch는 `integration/threshold-minimal-20261004`다. main merge·push·배포는 하지 않는다.

- `min_cover.rs`와 후보 단위 검사는 평가본 `56e4f08` / 보존 tip `be679ae`와 동일하다.
- `pc-core`의 두 feature는 독립 선택이며 default OFF다. 제품 `pc-wasm`은 둘 다 default ON이다.
- singleton 원행에서 도출한 root 강제선택, 현재 threshold의 weighted 전파, budget charge와 부분 적용 undo만 채택했다.
- experimental ABI·mask·측정 하네스·stagedBounds·removePresort·32/64·priorPropagation은 이식하지 않았다.
- JS wrapper, secondary routing, CP 합류 시점, Worker 구현, primary/integrated 알고리즘, batch WASM은 그대로다.

## 빌드 및 rollback

```bash
# 기본 B
bash scripts/build-wasm.sh
# A: currentPropagation ON, rootForced만 OFF
SFINDER_THRESHOLD_MODE=A bash scripts/build-wasm.sh
# 현재 Dev Rust의 두 개선 OFF 대조
SFINDER_THRESHOLD_MODE=reference bash scripts/build-wasm.sh
```

스크립트는 default feature를 명시적으로 끈 뒤 해당 모드의 feature만 선택한다.
`cargo build -p pc-wasm`을 직접 실행해도 기본은 B다.
직접 A 빌드는 `--no-default-features --features threshold-current-propagation`, OFF는 `--no-default-features`다.
rootForced rollback은 **재빌드/asset 교체**이며 요청별 runtime toggle은 아니다.
스크립트의 `reference`는 현재 제품 Rust OFF(C)에 해당하며 실험 ABI reference가 아니다.
OFF 재빌드도 옛 tracked WASM(S)과 byte 동일하다는 뜻은 아니다.

## 제품 산출물

제품 `wasm/pc_wasm.wasm`에는 제품 캠페인 **37179296189**에서 실제 측정·검증한 Linux B를 그대로 설치했다.
원본 S는 validation의 `ORIGINAL_DEV_PC_WASM.wasm`에 보존했다.

| 산출물 | SHA-256 |
|---|---|
| 설치 B | `15bcd1171821d53c0e44d7b556d7d0680e957bbca5630643b34155c44b5923fd` |
| A 복귀용 평가 asset | `f81c02daf812354c12262860284456bb1266178df28a2829eba12c347ae8679f` |
| 원본 S | `640232e30c586e87d6c5f5ad5ab52856c9ab173df984e4915f383e9fd399eee2` |

원본 캠페인 `build.json`의 candidate Rust hash와 최종 source를 대조했고 exports도 일치했다.
새 export 구현은 추가하지 않았다. 다만 원본 S에는 현재 Dev source에 이미 있던
partitioned/progress/proven-prefix 관련 4 exports가 없었으므로, 설치 asset과 S의 exports는 완전히 같지 않다.
Linux Rust 1.90.0 / release(opt3, LTO, codegen-units1, panic abort, strip symbols) 평가 산출물이다.
로컬 Windows default B도 release 컴파일했지만 byte가 달라 제품 asset을 덮어쓰지 않았다.
향후 재빌드 역시 source·feature·toolchain·exports와 실제 제품 회귀를 확인해야 하며 기존 hash 일치를 자동 보장하지 않는다.

## 최종 설치 asset 검증

- Node 전체 185개: 최초 184 pass / 1 환경 skip, 동일 기준 Dev snapshot을 지정해 누락 1개 pass. **고유 185 pass, fail 0, 미해결 skip 0**.
- 200개 기존 matrix: 최종 Dev factory/wrapper threshold 500회와 측정 B 500회의 completed/K/states/selected IDs/quality/proven-prefix 일치.
- 비threshold integrated 400회, 대표 primary 16회: Dev 재빌드 D와 일치.
- Chromium 151: 4개 기존 exact witness, budget/prefix/locks, 실제 threshold Worker, 취소 후 회수·재시작 통과.
- `cycle1-elephant-a-O`: 실제 integrated 100K cap → threshold Worker fallback 및 known exact witness 일치.
- 실제 CP 명시 선택, auto 60초 도달 상태의 CP 합류 및 threshold 결과 일치 통과. CP 승리나 전체 Auto 응답시간 개선을 주장하지 않는다.
- Rustfmt, WASM workspace/all-targets check, B release build, A/OFF check, build script syntax 통과.

제한: 네이티브 Rust 단위 검사는 MSVC linker 부재로 이번 환경에서 실행하지 않았다.
엄격 Clippy는 baseline과 같은 경고 24개로 실패했고 신규 경고 종류/개수는 없다. 평가본 source를 유지하기 위해 기존 경고 수정은 섞지 않았다.
설치하지 않은 Windows B의 추가 200-matrix runtime parity 시도는 외부 60초 상한에서 중단되어 **미완료**이며 성공으로 집계하지 않는다.
이 시도는 설치 Linux B의 완료한 검증과 별개이며 timeout을 새로운 결과로 치환하지 않았다.

이번 작업의 새 성능 표본은 **0**이다. B 선택은 기존 근거와 사용자 제품 정책 결정이며 보고서의 A 우선 공식 권고를 새 성능 PASS로 덮어쓰지 않는다.
초기 무작위 QB에서 남은 소규모 rootForced 손실·변동도 유효한 한계로 유지한다.

## 근거 진입점

- [제품 검증 영수증·재현 코드](../../tools/validation/threshold-dev-integration-20261004/README_KO.md)
- [독립 검토 및 기존 7,776-call oracle](../../tools/validation/threshold-review-20261004/REVIEW_KO.md) — 이번 성공 수에 재합산하지 않음.
- [원제품 보고서](https://github.com/Qnia28/sfinder_wasm/blob/integration/threshold-candidates-20261004/bench/threshold-integration/RESULT_KO.md)
- A asset 원경로: `sol/threshold-integration-20261004/bench/threshold-integration/results/remote-37179296189/integration-build-37179296189-1/A.wasm`.

Integrated A0/M1 연구는 종료 상태를 유지하며 Dev에 반영하지 않았다. 두 threshold 연구 repo와 원증거도 변경하지 않았다.
