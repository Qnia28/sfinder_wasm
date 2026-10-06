# 16VM 시작 오류 수정 / r4 제한 재개

- r2 run `37459154685`: 일반 composite shell에 artifact runtime 인증이 없어 activation 실패. 모집단 호출 0. JavaScript action으로 수정한 r3에서 activation/CP 사전검사 통과.
- r3 run `37460239102`: canary의 원본 ALL witness JSON 계약을 준비기가 잘못 지정해 fail-closed 중단. 원본 DB와 ZIP raw 2,508 EXACT 행 / 509 파일 / 387 fixture를 무solver 검증했다. 실제 계약은 `INSERTION_SELECTED_QUALITY`; 원본 hash/자료는 변경하지 않는다.
- r4는 **동일 campaign의 제한된 canary 검증 계약 수정 재개**다. 실패 run의 상태를 EXACT로 바꾸지 않고 성능 표본과 pooling하지 않는다. 감사/복구 목적 solver replay가 아니다. 현재 prerequisite 조건으로 새 canary 실행이 필요하다.
- 최초 origin `2026-10-06T11:51:03Z`, 120h, 최대 16VM, 전체 policy tree 3GiB/swap0, 300s watchdog, Rust/CP thread 계약, T/CP seed 공유, CP 60s 지연 / 120s 제한은 그대로다. prior lock/plan backend ID와 digest를 activation에서 실제 다운로드·검증한다. 독립 Python 감사도 봉인된 prior lock/plan과 source/fixture/witness/hash/clock 관계를 재검증하며 solver 0회다.
- 이미 계획한 canary **32 슬롯 전부**를 누적 8,479 호출 한도에서 보수적으로 차감한다. NOT_RUN/unknown도 예약 환급하지 않는다. 현재 실행 최대 8,447; 모든 conditional confirmation이 필요하면 최대 schedule과 잔여 예산이 충돌할 수 있다. 그 경우 필수 확인 대상을 버리지 않고 stage planning이 fail-closed 중단한다. 확인 결과를 자동 PASS 처리하지 않는다.
- 과거 예약 runner-hours 14h(실패 activation 0.5h + r3 activation/plan/canary 3VM/final audits의 최대 13.5h)는 원래 36 control-job 예약 90h 안에서 소비한다. 새 control 13 jobs를 모두 2.5h로 잡아도 46.5h≤90h. 새 matrix 최대 523 jobs와 합친 원래 상한 1,397.5h≤1,400h는 유지한다.
- 새 VM의 실제 CP scoped 사전검사는 여전히 activation 1회 + canary VM 최대 3회이며, 실패 r3의 4회와 합쳐 **최대 8회 별도 synthetic**다. 모집단 호출과 합산하거나 성능 근거로 쓰지 않는다.
- 재귀적인 두 번째 canary repair, post-canary population 실행이 존재하는 prior run, solver/product 변경, original witness hash 변경, origin 초기화, 필수 confirmation 자동 축소는 금지한다.
- 사용자 요청에 따라 activation → canary/독립감사 → calibration/독립감사 → ALL_INITIAL의 첫 durable paired checkpoint를 확인한 뒤 startup watch를 종료한다. 전체 campaign 완료까지 watch하지 않는다.

실패 및 원본 계약 감사: `D:\AI\sfinder-wasm\files\benchmark-prepared\triage-failure-37460239102\`.
