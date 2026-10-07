# A fast-path 교차검증 r7 — 간소화 실행

사용자 승인: 2026-10-07 “이어서 시행하라…절차를 간소화하고, 최소한의 확인만”.

- 질문: A의 fast 시간차가 trace OFF에서도 반복되는가? 정책×trace 상호작용과 같은 BASELINE 대조의 변동은 어느 정도인가?
- 원 설계: `benchmark-reviews/r6-fast-path-review-v2/followup-design`의 25입력/500호출/125task/42chunk. 원 순서·대상·4회 factorial·1회 sham을 유지한다. ALL 선정 fast, per-save, high-d sentinel은 별도 해석한다.
- 실제 실행: 기존 공통 action/executor/scope/checkpoint를 사용한다. 명시적8arm으로 정책과 trace를 선택한다. OFF는 반환 trace와 IPC trace 양쪽을 끈다.
- 준비1회 → 본측정1단계 → 독립 Python 종료감사1회. 기존 canary/calibration·과거 모집단 재감사는 반복하지 않는다. 새 arm은 로컬 synthetic 계약 검사로 확인하며 로컬 모집단 측정은 없다.
- 원 제품/WASM/fixture/품질/seed/thread/3GiB·swap0/300초/CP60초·120초 조건을 유지한다. 새 runtime에서 CP지원 여부만 activation의 synthetic1호출로 확인한다. 추가 canary VM 검사는 없다.
- 원장 검증에서 생성한 immutable 회계 snapshot과 원 r6 activation lock/hash를 연결한다. 역사 raw를 새 측정에 복사·pooling하지 않는다.
- 누적 정책슬롯7907+500=8407, 신규CP1까지 보수적으로8408≤8479. 원CP누적8은 별도 회계. runner 예약1255+42×2.5+control3.5=1363.5h≤1400h. 원 deadline `2026-10-11T11:51:03Z` 유지.
- 종료감사는 새500호출의 입력/hash·계획·start·조건·회수·원weighted witness·trace arm만 검증한다. solver 재실행0. 종료 결과는 증거상태이며 성능 결론은 별도 작성한다.
- 분석: OFF A−BASELINE을 주비교로, ON/OFF의 정책차이차이와 sham을 함께 읽는다. 고정4block의 첫2/뒤2/all4를 모두 보며 `max(5ms,5%)`, p95≤5ms를 유지한다. trace 비용 차감이나 통과할 때까지 재측정은 없다. 선정패널을 전체 ALL/fresh 검증으로 외삽하지 않는다.
