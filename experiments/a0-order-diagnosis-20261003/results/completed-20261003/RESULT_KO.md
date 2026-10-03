# 단일 입력 원인 탐색 완료 — 큰 선행 실행 효과는 이번 호스트에서 관측되지 않음

## 결론

**고정된 24호출을 모두 완료하고 독립 감사를 통과했다. 이번 9V74 호스트에서는 R/A 독립 첫 호출이 모두 약 6초였고, 선행 다른 variant 실행의 효과는 약 0.6~0.9%였다.**

따라서 “같은 프로세스에서 R을 먼저 실행하면 A가 항상 크게 빨라진다”는 일반적 설명은 이번 결과로 지지되지 않는다. 그러나 이전 50% Cold 차이는 9V45 호스트에서 발생했다. **호스트가 달라졌으므로 그 환경에서의 조건부 효과까지 반증한 것은 아니다.**

판정: `ORDER_DIAGNOSIS_COMPLETE_KEEP_PRODUCT_UNCHANGED`. 계획한 최소 진단을 여기서 종료한다. 유리한 호스트를 찾기 위한 재실행, 제품 수정, 공식 재벤치마크는 하지 않는다.

## 질문과 설계

직전 원자료에서 board-028의 공유 세션 A는 **자기 첫 호출부터 3.819초**였다. 따라서 자기 warmup 반복만으로 빨라졌다는 설명은 불충분했다. 앞서 R이 실행된 사실을 단일 입력의 순서 개입으로 확인했다.

- 입력: `board-028--restricted-split--ordinary` 하나. 원본 compressed segment, weighted rows, K, seed, primary proof, stable IDs 불변.
- 조건: R 단독 / A 단독 / R→A / A→R 각 4회. 16개 fresh process, 24개의 integrated100K 호출.
- 각 Worker는 **native 호출 딱 한 번**. pair의 첫 Worker는 두 번째 호출까지 살아 있고 재호출하지 않음.
- 모든 조건의 loader 경로 동일. 각 호출 OS thread는 같은 logical CPU0에 고정. 배경 컴파일 스레드, 주파수, SMT 경쟁은 고정하지 않음.
- 4개 block의 고정 Latin 순서로 조건 배치. 실패 치환/재시도/결과 기반 순서 변경 없음.
- Node24.13.0 / Linux / AMD EPYC9V74 / 표준 public GitHub Actions 단일 VM에서 직렬 실행.

## 관측값

입력별 4회 API median. API는 wrapper packing/native/readback을 포함하고 로딩·coverage 생성·IPC/fsync·검산은 제외한다.

| 조건·호출 위치 | API median | 호출 스레드 CPU median |
|---|---:|---:|
| R 단독 | 6.002초 | 6.002초 |
| A 단독 | 6.007초 | 6.005초 |
| R→A의 첫 R | 6.012초 | 6.011초 |
| R→A의 두 번째 A | 5.969초 | 5.969초 |
| A→R의 첫 A | 6.006초 | 6.005초 |
| A→R의 두 번째 R | 5.959초 | 5.958초 |

- A 단독/R 단독: **1.000698**, 약 +0.070%.
- R 이후 A/A 단독: **0.993815**, 약 -0.619%.
- A 이후 R/R 단독: **0.992706**, 약 -0.729%.
- pair의 A 두 번째/A 첫 번째: **0.993906**, 약 -0.609%.
- pair의 R 두 번째/R 첫 번째: **0.991121**, 약 -0.888%.
- 각 block의 모든 대비에서도 10%를 넘는 차이는 없었다. 이 10%는 **추가 구간 계측을 선택하는 진단 기준**이지 제품 성능 통과 기준이 아니다.

선행 효과가 비대칭적으로 크지 않고 R/A 모두 두 번째 호출이 약간 빨랐다. 큰 공유 효과는 관측되지 않았다. 다만 4회/한 VM 자료로 1% 안팎의 차이를 확정적인 최적화 효과로 주장하지 않는다.

사전 고정한 조건부 계측 기준을 만족하지 않아 추가 profile4호출은 **실행하지 않았다**. 실패를 warm/profile 결과로 대체한 것이 아니다. 이번에는 구간 계측과 compiler trace가 없으므로 native 내부나 tier를 확정하지 않는다.

## 기존 이상치와 함께 해석

| 관측 환경 | R 단독 Cold | A 단독 Cold | 공유 세션의 각 첫 호출 |
|---|---:|---:|---|
| 이전 9V45, affinity 미고정 | 3.819초 | 5.732초 | R 먼저3.839초 → A3.819초 |
| 이전 9V74, affinity 미고정 | 5.984초 | 5.997초 | A 먼저6.043초 → R5.952초 |
| 이번 9V74, 호출 스레드 affinity 고정 | 6.002초 | 6.007초 | RA/AR 모두 약6초 |

이번 결과는 이전 9V74 결과와 가깝다. 새로운 affinity 통제가 “문제를 고쳤다”고 주장할 수 없다. 호스트와 실행 시점이 바뀌었고, 이전 9V74에서도 큰 차이는 없었다.

현재 가장 안전한 추정:

1. **A0에 환경과 무관한 고정 50% 추가 비용이 있다는 설명은 자료와 맞지 않는다.**
2. **프로세스 내 선행 실행만으로 항상 1.9초가 줄어드는 설명도 지지되지 않는다.**
3. 남은 후보는 특정 실행 환경과 코드 경로/엔진 실행 상태의 상호작용이다. CPU 모델 차이 자체, V8 tier 전환, 코드 공유, 코드 배치 중 어느 것인지는 미확정이다.
4. 호출 스레드 CPU≈wall은 이번 실행이 주로 실제 CPU 작업으로 채워졌음을 보여 준다. 이를 이전 9V45에서 DFS가 느렸다는 증명으로 소급하지 않는다.

직전 짧은 F14 지연은 별개의 질문이다. 이번 입력 하나의 결과로 이를 해결하거나 기존 reserved p95 실패를 무효화하지 않는다.

## 대응 결정과 남은 일

**제품 그대로 유지, 통합 계속 보류.** sibling/trail blind 수정, 제품 warmup 자동 추가, ID/CPU 예외, state budget 변경, gate 완화 모두 하지 않는다.

추가 원인 조사가 필요하다면 다음은 대규모 입력 반복이 아니라 **같은 한 입력의 엔진 실행 상태를 직접 관측·개입하는 사전 고정 진단**이어야 한다. compilation/tier trace는 별도 실행으로 분리하고, 실제 실행 tier를 확인한 조건만 해석한다. 어떤 호스트에서 현상이 나오든 그대로 보고하고 좋은 호스트가 나올 때까지 반복하지 않는다. 이번에는 해당 후속 진단을 자동 실행하지 않았다.

미검증 exact `board-111--restricted-split--ordinary`는 별도 문제로 그대로 남아 있다. 이번 결과는 성능 승격이나 독립 exact 증명이 아니다.

## 감사·보존

- 실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/37099783258 (`success`).
- source: `50fcc0b0ff8beb33ae18abe96f221ae93dfbdcd8`.
- 기존 baseline-source WASM SHA256: `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`.
- 24/24 native 결과, 모두 CAPPED/100K. 누락/timeout/OOM/오류0. 반복 결정성 및 seed/quality/states 계약 통과.
- 독립 감사: source Git blob169개, 결과 파일28개, raw journal72record, weighted quality+seed48회 검산. fresh session PID/서로 다른 Worker OS TID/CPU affinity도 확인.
- raw는 별도 writer의 append/fsync 후 ACK, 그 뒤 검산. 독립 startup/API/process/audit/durability/reap 제한 유지.
- 전체 cgroup3GiB/swap0, public standard runner1개. 실제 primary/PC/native threshold/공식 확인 호출0.
- 전체 경과4.05분(큐 포함), 관측 runner0.04833h, 압축 artifact77146bytes. 사전 job15분/0.25runner-hour 상한 안에서 종료.
- 보호 Dev clean/HEAD `c0cb2a0…`, localmain `187fbf9…`, remotemain `03b6377…`, defaultmain 불변. 제품/Dev/main/배포 변경0.
- 이전 원자료와 실패 결론은 변경하지 않는다. 이번 plan/source/lock/원결과/감사/판정을 별도 봉인한다.
