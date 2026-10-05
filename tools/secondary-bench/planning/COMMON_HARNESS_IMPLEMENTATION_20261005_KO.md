# 공통 하네스 구현 상태

2026-10-05 · 확정 계약: [COMMON_HARNESS_DESIGN_20261005_KO.md](COMMON_HARNESS_DESIGN_20261005_KO.md)

## 구현 범위

- `tools/secondary-bench/common/`: manifest/profile/lock/ID/budget, 정책·어댑터, planner/executor, immutable evidence·receipt/index·복구·감사·archive·legacy reader.
- `.github/workflows/secondary-bench-common-*.yml`: 공통 reusable campaign/stage, manifest/그룹 launcher, 소형 합성 smoke.
- `tests/secondary-bench-common.test.mjs`: F/A 원계획 대조, raw·실행/전송 구분, 장애 주입, budget·VM·미지원 조합 거부, 실제 세 엔진 tiny fixture, 실제 Bash clock 검사.
- [사용 절차·지원 조합·복구 운영](../common/README_KO.md).

기존 F/A 하네스/manifest/start marker, 원자료, 제품 solver 및 main은 변경하지 않는다. 문서 작성 시 사용자에게 실험 branch에만 게시하고 원격 합성 검증까지 수행하는 승인을 받았다. 기존 실자료 캠페인은 재실행하지 않는다.

## 관문

| 단계 | 상태 |
|---|---|
| M0 기준 동결 | 기존 파일을 보존하며 frozen template/source의 읽기 전용 대조 구현 |
| M1 명세·정책·예산 | 구현 및 로컬 계약 검사 |
| M2 evidence·legacy·감사 | 구현 및 합성 장애·archive 계약 검사 |
| M3 실제 Actions 전체 경로 | 준비됨; 원격 결과는 아래 실행 증거에 기록 |
| M4 F/A 인계 | 읽기 전용 변환·조건/일정 대조 구현; 실자료 재실행 없음 |
| M5 triage/e2e 어댑터 | 미구현. schema에서 실행 거부; 별도 cutoff/제품 변경 없음 |

공통 실행 기반의 완료 표시는 M3 원격 관문 통과 뒤에만 한다. 로컬 transport mock이나 actionlint만으로 원격 완료를 주장하지 않는다.

## 명시적 차이

- 진단 최악 예약: 기존150초 고정 → 공통식160초. 실제 호출·phase 제한은 유지.
- campaign end 전 최종 transport/audit/reserve를 명시적으로 예약하는 보수적 admission.
- 기존 ID는 원 포인터로 보존하며 새 실행의 ID는 canonical v1 계약을 사용.
- 과거 continuation은 자동 이관하지 않고, 부모 lock·완전 history·원시각 검증을 요구.

## 실행 증거

- 게시 전 로컬: 기존77개 + 공통21개 = **98/98 PASS**. 공통 테스트에는 실제 세 엔진의 소형 합성 fixture 실행과 실제 Bash clock 검사가 포함된다.
- 신규4개workflow actionlint 통과(shellcheck/pyflakes 비활성). runtime Bash는 별도 실제 실행 검사로 보완했다.
- 원격 run/artifact/archive 및 최종 관문은 원격 검증 뒤 아래에 기록한다. 미기입은 원격 PASS를 뜻하지 않는다.
