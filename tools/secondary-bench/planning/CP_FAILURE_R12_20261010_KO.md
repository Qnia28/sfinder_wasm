# r12 pcinfo033 native ERROR 원인 진단

사용자 지시: 원인 분석까지 계속 진행. r11/run37916694988의 CP033 ERROR는 빈 Error로 전달됐고 kernel oom/max/oom_kill=0이다. 수집 COMPLETE/raw parity PASS, 원감사 FAIL을 유지한다. 근거 PACKAGE SHA256은5730f3e12495ee99cc7f935fb18be126757012c8f4451e4e9ab552e2fc63b1bc.

질문: native solve가 WASM 메모리 확장 거부 뒤 예외를 던지는가? 2GiB 요청 상한인가, host growth 실패인가, 다른 native 예외인가, 결과회수 오류인가?

원033 fixture/hash/weighted rows/K/seed/패턴/N+1/clear4/hold=true를 그대로 사용한다. CP_OPEN 1회/1VM,600초 watchdog,3GiB/swap0,CP1thread/max_lp/seed1,CP내부deadline null. r11과 모든 product 및WASM bytes 동일. 원결과와 별도 phase CP_FAILURE_R12/revision12이며 성능비교 또는 실패 재분류용 표본이 아니다.

공통 scope/executor/checkpoint/독립감사/수집을 재사용한다. diagnostic worker에서만 WebAssembly.instantiate의 emscripten_resize_heap import를 감싸 요청/전후capacity/성공여부를 기록하고, WebAssembly.promising으로 래핑한 solve export의 반환/원예외를 기록한다. 입력bytes/인수/반환값/throw identity를 보존한다. 성공 solve-return marker가 추가돼 native 실패와 결과회수 실패를 구분한다. Node24 WebAssembly.Exception은 name/message가 없고 기존 worker가 빈Error로 바꾸는 현상을 작은 합성으로 확인한다. 원예외와 확장실패가 관측되기 전 bad_alloc은 확정하지 않는다.

추가비용: population1+기존scoped synthetic1(작은multibatch proof 및hook 활성확인),최대350분matrix+6hcontrol예약. 실제 누적원장 r11은population13,071/CPsynthetic13/runner2,596.5h. r12누적13,086calls/2,608.3333333333335h예약. 원clock2026-10-06T11:51:03Z~2026-10-11T11:51:03Z,20,000calls/5,000h를 유지한다. 반복loop/통과할때까지재시도/새population확장 없음.

새 diagnostic trace의 fsync와 Promise wrapping은 시간계측에 영향을 줄 수 있으므로 r11대비speedup을 주장하지 않는다. 원감사ERROR는 예상돼도 FAIL로 보존한다. 종료 뒤 원로그/추가marker/원예외/메모리확장과 정적WASM 근거를 저자가 연결하고, 원장분석등록 및포터블증거인계를 수행한다. 결론이 미확정이면 누락된원인증거를 명시한다.
