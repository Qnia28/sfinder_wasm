# 실험 목적에 맞춘 하네스·판정 보완 — adjudication v2

## 목적과 이번 수정

질문은 **실제 Auto 대비 A의 high-d probe 생략 이득, B의 hard low/mid-d probe 추가 가치, 완료범위·빠른 입력 회귀**다. ALL451이 주분모이고 per-save32/seed98/trivial97은 보조 층이다. 하네스의 목표는 이 비교의 신뢰할 수 있는 결과를 수집하는 것이다.

원계획 r1은 계측 관문 미통과를 전체 수집 보류로 연결했다. 구현은 2pair 중앙값 초과를 입력별 **확인된** 계측 부담으로 취급했고, canary에서 후보 완료회귀가 관측되면 본측정을 막았다. 계획과 구현 모두 목적을 과도하게 제한했다. 이번 변경은 사용자 지시에 따른 **판정 계약 변경**이며, 실패 run을 통과로 바꾸는 수치 재튜닝이 아니다.

## 실행과 연구 판정의 경계

| 관측 | 수집 처리 | 연구 판정 |
|---|---|---|
| 원입력/hash/K/weighted witness/tie/seed 불변 위반 | 중단 | 증거 무효 |
| source/runtime/threads/scope 불일치, CP 초기화·proof 오류, 미회수 descendant | 중단 | 비교조건/실행 무효 |
| 누락된 호출·불완전 pair·UNKNOWN start·전송 불완전 | 다음 단계 차단 | INCOMPLETE 유지 |
| 남은 clock/누적 calls/runner-hours 부족 | 신규 task 입장 중지 | NOT_RUN/INCOMPLETE 유지 |
| 정상 scope에서 회수된 TIMEOUT/INCOMPLETE/OOM | 검열 관측으로 보존, 전체 실험 중단 사유로 쓰지 않음 | 완료범위·자원·회귀에 반영 |
| canary의 후보 완료손실 / 원baseline 상태변동 | 관측 경고와 원값 보존, 본측정 진행 가능 | ALL INITIAL/선정확인의 별도 근거로 판단 |
| off/on 시간차·상태차·완료표본 부족 | `REVIEW_REQUIRED`, 본측정 진행 가능 | 비계측 제품시간·빠른 경로 비회귀/승격 주장 제한 |
| off/on exact witness 또는 동일 native 완료 states 불일치 | 중단 | 계측이 비교 대상을 바꿨을 가능성 |
| 후보가 느리거나 완료범위가 나쁨 | 유효한 부정적 실험 결과로 수집 | KEEP/HOLD/REJECT 분석 대상 |

OOM 뒤 동일 input/variant를 반복하지 않는 기존 executor quarantine은 유지한다. 그로 인한 NOT_RUN을 완료로 바꾸지 않는다. 모든 OOM을 재실행하거나 성공표본으로 바꾸는 지시가 아니다.

## 계측 24개/96호출의 역할

- 기존 2pair AB/BA, thresholds `max(2ms,2%)` / `max(5ms,5%)`, 최소 완료12입력은 그대로 **screen 지표**로 기록한다. 임계값을 6ms로 올려 QB051만 통과시키지 않는다.
- 2pair 중앙값은 독립 재확인이 아니다. `confirmedOverhead=false`; 추가시간·두 원pair·순서·입력·limit을 보고한다.
- 초과/미달은 결과 해석의 불확실성이다. 같은 trace 조건의 BASELINE/A/B 본측정은 수집하되, 계측 영향이 후보별로 다를 가능성까지 후속 판정에서 검토한다. 공통 계측이라는 이유만으로 영향이 상쇄됐다고 가정하지 않는다.
- 계측 delta를 본측정 시간에서 빼거나, timeout을 300초 완료시간으로 대체하거나, 작은 차이를 정책 개선으로 단정하지 않는다.
- 추가 calibration 반복을 자동 생성하지 않는다. 본측정 이후 후보 선택을 실제로 바꿀 쟁점만 좁혀 별도 동결한다. 반복해서 통과할 때까지 측정하지 않는다.

## 구현 계약

- `triage/gates.mjs`: 명시적 `evidence-first-v2` 판정 계약. 새 performance manifest와 revision>=6에만 적용.
- `triage/analysis.mjs`: execution validity와 calibration assessment 분리. 판정 screen은 상세값과 함께 개발 보고서에 남긴다. ALL/per-save INITIAL/CONFIRMATION을 구분하고 phase별 검열 상태를 보고한다.
- `triage/independent-audit.py`: 독립적으로 같은 구분을 검산한다. `status/evidenceStatus=PASS`는 증거 계약 통과이며 `decisionStatus=REVIEW_REQUIRED`, `performancePass=false`를 명시한다.
- `triage/action.mjs`: artifact upload 메시지 뒤에 실패 이유가 가려지지 않도록 audit errors/missing 및 계측 초과 입력을 로그와 Actions Summary에 표시한다.
- 계약 미기재 manifest는 legacy 판정 그대로다. r5 소스·ZIP·raw·FAIL을 소급 변경하지 않는다. 새 packaging에는 `--gate-contract evidence-first-v2 --revision <6 이상>`이 필요하다.
- 현재 `prepare.py`의 r5용 continuation recipe는 r3의 32호출/14h만 회계한다. r5를 parent로 넣어 128호출과 완료 phase를 누락하는 준비는 명시적으로 거부한다. 새 재개 bundle은 아래 누적 원장을 먼저 연결해야 한다.

## 현재 관측과 다음 실행 순서

r5 `37467543995`: canary32 + calibration96 = **128호출**(EXACT88/TIMEOUT40), 누락0, witness 오류0. canary 기능/독립감사 통과. 계측 입력 QB051의 두 delta는 +10.505/+1.303ms, 중앙값 +5.904ms, screen5ms 초과. 전체 delta 중앙값 -1.985ms는 screen 통과. 기존 계약에서 CALIBRATION FAIL, 새 계약의 오프라인 검토는 evidence PASS / calibration REVIEW_REQUIRED다. 이 검토는 새 실행 허가나 성능 PASS가 아니다.

1. 완료된 canary/calibration의 immutable raw/plan/receipt를 common indexed history에 연결한다. 변경이 판정·보고만이라면 완료된128호출을 재측정하지 않는다. 원run/revision별 분모를 유지한다.
2. 원r3의32 계획 슬롯 + r5의128 = 누적160을 차감한다. **잔여8319**, origin `2026-10-06T11:51:03Z`부터120h, 총8479calls/1400runner-hours/16VM 유지. control과 이미 배정된 matrix VM도 같은 원장에 포함한다.
3. 원자료 재감사는 solver0. 변경된 source/판정 계약을 명시한 다음 manifest를 새로 봉인하고, 검증된 완료 phase를 인계한 뒤 미시작 **ALL_INITIAL부터** 진행한다. 기존 r5용 준비 recipe/START를 그대로 rerun하지 않는다.
4. ALL451 → per-save32 → seed98 → trivial97 → 필수 선정확인. 초기/추가/관측층 분리 유지. 모든 후보를 느리다는 이유로 생략하지 않는다.
5. 미시작 전체일정은 최대8351호출이므로 최악 전원confirmation에서는 잔여8319보다32 초과한다. 실제 필수 선정이 cap을 넘으면 수집불완전으로 명시하며 대상 자동축소/시계 초기화로 숨기지 않는다.
6. 최초 durable ALL paired checkpoint 확인 후 startup watch 종료. 후보 채택은 full phase evidence 검토 뒤 별도 결론이다.

## Sol 작업 기준

새 하네스 변경을 추가할 때 **어느 실험 질문을 답하게 하는지**, **어떤 잘못된 비교를 막는지**, **추가 호출·시간·수집 중단 비용이 얼마인지**를 먼저 설명한다. 이 연결이 없는 일반화·새 프레임워크·새 강제 gate를 추가하지 않는다. 운영 성공, 증거 유효성, 연구상 후보 채택을 같은 PASS 하나로 묶지 않는다.

이번 보완은 하네스·계획·경량 회귀검사 및 기존 증거 재검토까지다. 새 캠페인 시작과 제품/정책/solver 조건 변경은 수행하지 않았다.

## 사용자 실행 승인 후 r6 연결

- r5 artifact inventory73/공통 data57개 ZIP hash 검증과 원128행·start·scope·receipt를 수집했다. r3 원32슬롯도 별도 ancestor lock/history로 보존해 누적160을 차감한다.
- r5 배정18jobs의 보수적 timeout 예약38.5h + r3/r2예약14h = 누적52.5h. 새 control 최대32.5h와 함께 원90h control reserve에 들어간다. 재사용11matrix를 뺀 미시작512matrix + 원36control 기준 최악1370h다.
- `prerequisiteReuse=adjudication-only-prerequisites-v1`: 입력·product·runtime·실행 source가 동일할 때만 원 CANARY/CALIBRATION을 재사용한다. 판정/보고/테스트 source 외 변경은 거부한다. 원row의 invocation/manifest/callId를 새 ID로 바꾸지 않는다.
- common stage plan은 재사용 phase에 빈 matrix를 반환한다. 독립감사는 원phase의 compiler/lock/receipt로 재검산하고 새 gate 계약으로 별도 판정한다. 신규 본측정은 epoch6, 원본 phase는 epoch5다. r3 오류 phase는 회계에만 남기며 원본128행과 섞지 않는다.
- 실제 CP preflight는 원8회로 고정; 새 activation은 검증된 원CP proof를 재사용해 추가0회다. 테스트는 별도의 경량 synthetic 검사다.
- 준비 bundle을 실제 복원해 독립감사를 실행했고580fixture·88witness·128raw가 PASS, solver0이었다. QB051 시간 screen은 REVIEW_REQUIRED로 보존했다. 실행 이후 최초 durable ALL pair만 확인하고 감시를 종료한다.
