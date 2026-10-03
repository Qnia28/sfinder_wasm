# A0 독립 증명 확인 및 고정 10쌍 재테스트

**완료: 독립 exact 공백 해소, 121개 입력의 10쌍 재테스트 전부 감사 통과. 제품 통합은 계속 보류.** 기존 모집단 p95 실패는 유지한다. 추가 native 호출은 자동 시작하지 않는다.

## 독립 증명

- 대상: `board-111--restricted-split--ordinary`, 원 K35·seed·가중 중복행·WASM 유지.
- [교정 후 실행 37115786679](https://github.com/Qnia28/sfinder_wasm/actions/runs/37115786679), source `33cac2b116b2d85112c3d472ebca9294eab752fd`.
- baseline fixed-K threshold **EXACT, 1,704 states, API 53.381221ms**. 실제 native threshold 1회, primary/PC/integrated 재계산 0회.
- 독립 감사에서 원 raw 8개 hash와 A EXACT 증거 4개를 확인했고, 전체 품질 벡터 및 sorted stable ID가 모두 일치했다. 원 minimum-K 증명 재사용.
- [PROOF_AUDIT.json](PROOF_AUDIT.json). 다른 탐색 경로를 사용했지만 coverage/gain helper와 WASM은 공유하므로 완전히 별개 구현에 의한 증명이라고 주장하지 않는다.
- 단순 누락 인자를 자율 교정하고 직접 numeric-threshold 합성 검사를 통과했다. 원 검색 상한 2M states/API30s/process45s는 그대로이며 검색 실패 재시도·예산 증액은 없었다.

## 재테스트 완료

- [실행 37116378831](https://github.com/Qnia28/sfinder_wasm/actions/runs/37116378831), source `fb8c895ed7b7590d42e79fccfb3aee49a151cf30`.
- 기존 선별 115개+비선별 대조 6개=121개. 각 입력 R/A10쌍, 5runner×2쌍. 환경 R/R·A/A 40calls 포함 총 2,460calls, runner당492calls.
- 선별·일정 불변. 공통 지침 v1.1은 단순 하네스 자율 교정만 추가했고 v1.0의 tail·변동 선별/10쌍 규칙은 바꾸지 않았다.
- 캠페인 origin `2026-10-03T10:02:53Z` 유지. compute12:42:53Z/cancel12:57:53Z/overall13:02:53Z. 기존 비용 포함 runner-hours 상한3.761667, 승인64이내.
- public standard ubuntu24.04, maxparallel5, child3GiB/swap0. state100K/API10s/process30s, fresh unpinned Worker, raw fsync-before-ACK. warmup·threshold·primary/PC 없음.
- 45분 job상한/42분 compute guard. 최악 호출시간으로 모든 호출이 안 맞으면 `NOT_RUN_BUDGET`; 대상 축소·상한 증액·좋은 runner 교체 없음.

실제 **2,460/2,460calls VERIFIED, 121/121inputs 완전10쌍**. EXACT1,830/CAPPED630. timeout·OOM·오류·누락0. 원 probe와 states/품질/IDs/completed 모두 일치했고 품질·seed·전달계약 회귀0이다. 독립 감사: source232blobs, result2,480files, raw7,380records, 가중quality2,581재계산, state/quality1,210쌍 비교. [RETEST_AUDIT.json](RETEST_AUDIT.json).

| 원 선별군 | 새 재확인 |
|---|---|
| 개선 tail10개 | 8개에서 5runner 중≥4개가 기존 개선 방향 유지 |
| 악화 tail9개 | 기존 방향의 >10% 악화(전체+≥4runner) 재현0개 |
| 입력 >10% 악화 경보10개 | 같은 기준 재현0개; 새로운 쌍비율 median0.8597–1.0250 |
| exact 상태 전환 board111 ordinary | R/A 상태 유지, A/R쌍 median0.7701; 별도 독립 증명 완료 |

**새 악화 신호도 남았다.** 전체 median 및 4개 runner에서 A/R>1.10인 입력은 아래3개다. 첫2개는 screening 악화 방향도 유지해 공통 규칙의 `REGRESSION_THRESHOLD_REPLICATED`다. 마지막1개는 원 screening의 개선 방향이 뒤집힌 **새 악화 경보**로 별도 보고하며, “회귀 재현2개”라는 분류로 숨기지 않는다.

| 입력 | A/R쌍 median | >1.10 runner | 쌍 시간차 median |
|---|---:|---:|---:|
| board106 restricted-split J | 1.1633 | 4/5 | +1.05ms |
| board119 restricted-split L | 1.2029 | 4/5 | +1.00ms |
| board115 bag ordinary | 1.2514 | 4/5 | +4.59ms |

5개 입력의 전체 쌍 median은>1.10이나 나머지2개는≥4runner 기준 미달이다. 비율이 크더라도 이 결과는 수ms대의 절대 비용이며 원인 확정은 아니다. `median(A/R)`와 `median(A)/median(R)`가 다르므로 수치를 서로 바꾸지 않는다.

## 원인 해석과 대응 결정

- host별 방향 혼재101/121개. 모든121개에서 runner전체 R/A 각각 max/min≥1.10, 같은 runner내 두 반복에서도 R102/A102개가≥1.10이었다. 변동·환경 민감성 가설은 강화됐지만 **과거9V45 이상치가 모두 noise/JIT/CPU모델 때문이라는 증명은 아니다**.
- 동일 variant 환경대조20쌍 경보0(max/min 최대1.0983). 작은 대조군의 경보0으로 모든 입력의 변동이나 위3개 악화를 부정할 수 없다.
- 5runner는 Intel6973P-C/AMD9V45/7763/9V74/7763. 모델별 표본이 작고 실제 물리host 독립성을 보장하지 않으므로 CPU모델 예외·유리한 host 선택은 하지 않는다.
- **A0 연구 후보 유지, 제품 적용 보류.** blind trail 수정·warmup/eager compilation·ID/CPU 예외·state budget 변경·gate 완화 없음. 과거 공통lower-bound hotspot은 현재 비용 위치이지 구 이상치의 인과 원인 확정이 아니다.
- 승격을 원하면 별도로 승인한 고정 전체 모집단의 공식 확인 계획이 필요하다. 지금 선택121개의 좋은 재측정값으로 원 모집단168개를 대체하지 않는다. 새3개 단기 호출 경보는 향후 조사 대상으로 남기되 자동 추가 프로파일/232·675 전수실험을 시작하지 않는다.
- 실제 캠페인 총0.224444runner-hours, 마지막 job완료10:47:18Z. 기존 origin/예산 내 완료하고 캠페인을 종료했다.

[ANALYSIS.json](ANALYSIS.json) / [DECISION.json](DECISION.json) / [STATUS.json](STATUS.json). raw와 GitHub 메타데이터는 [PROOF_RETEST_ARTIFACTS.zip](PROOF_RETEST_ARTIFACTS.zip)에 byte 그대로 보존한다. manifest는 [FROZEN_MANIFESTS](FROZEN_MANIFESTS/), 실행 source는 원격 두 commit 및 source bundles, 로컬 전체 파일 목록은 SEAL.json에 있다.

## 독립적으로 남는 제품 blocker

원 reserved p95 `1.197846065695026 > 1.10`은 계속 유효하다. 선택121개의 새 값으로 원 모집단168개의 불리한 행을 대체하거나 gate PASS를 선언하지 않는다. 독립 증명 성공은 정확성 공백을 해소한 것이지 성능 승인·Dev 적용·merge·배포 승인이 아니다.

이전 [증명 시도 및 선별 증거](../a0-proof-retest-20261003/RESULT_KO.md)는 당시 상태의 기록이며 봉인된 원문을 고치지 않았다.
