# CP OOM 단계 계측 r9

## 질문과 승인

사용자의 “이어서 진행하라”(2026-10-09)는 직전 제안인 대표 입력의 단계별 메모리 계측을 진행하는 지시로 해석한다. 목적은 CP 경로의 OOM이 입력/JS 모델 확장, Protobuf encode·WASM copy, native solve 중 어느 구간에서 발생하는지 좁히는 것이다. 속도 우열/제품 승격 실험이 아니다.

근거는 r8 run37623263031, reviewed PACKAGE SHA256 `34a2df7182773f7ed029c9dac8d83c8c4a3069fbf702317345fccfdecd0c2376` 및 `h9-cp10m-r8-oom-review/ANALYSIS_KO.md`다. 21OOM 모두 durable CP-start를 복원했지만 내부 단계 표본이 없어 정확한 할당 영역이 미확정이다.

## 동결 모집단과 조건

|ALL fixture|선정 이유|
|---|---|
|pcinfo033 restricted-split|CP단독 약7.7초, Auto 약67초의 빠른 OOM, 가장 큰 모델|
|pcinfo030 restricted-split|이전 직접 wrapper에서 생존했으나 r8에서 OOM인 경계 사례|
|pcinfo031 bag-plus-next-draw|CP단독 약238초의 늦은 OOM, H9는 빠르게 exact인 반례|
|pcinfo040 restricted-split|큰 모델이지만 r8에서600초 생존한 대조|

- 원 fixture bytes/hash/K/seed/weighted rows/패턴/N+1/clear4/hold=true 전부 유지.
- CP_OPEN/H9_OPEN 각1회: 총8호출,입력별1chunk,최대4VM. 입력 순서 고정, arm 순서는 CP→H9/H9→CP 교대. 반복정밀도 연구가 아니며 OOM 후 자동재시도 없다.
- 기존 common executor/admission/scope/quarantine/checkpoint/전송/독립감사를 사용한다.
- 외부600,000ms,MemoryMax3GiB/swap0,secondary1thread,max_lp/seed1,CP내부deadline null,Auto CP60초합류 유지.
- 새 phase `CP_MEMORY_R9`,revision9,새 campaign. 기존 r8 결과를 교체하거나 동일 성능모집단에 풀링하지 않는다.

## 계측과 해석

진단 job만 env로 opt-in한다. 각 isolate가 자기 `memory-PID-threadId.jsonl`에 scalar JSON을 append+fsync한다. worker IPC 전송 대기/부모 event loop 처리 전에 OOM이 나도 직전 완료 marker를 보존한다.

- 부모: fixture 읽기 전/원Rust init/packing,250ms sample.
- CP worker:payload,rows 전개 전후,정규화 전후,coverage/level 준비,quality batch 시작,모델완성,encode 전후,runtime 로드 전후,WASM copy 전후,native 진입/반환,stage status.
- T worker:native 진입/반환과WASM bytes.
- 공통: wall clock,PID/threadId,process RSS,isolate heapUsed/heapTotal/external/arrayBuffers,cgroup current/peak/events. CP 경계에서는HEAPU8.buffer.byteLength.

RSS는worker별 독립값이 아니라process전체이므로 합산 금지. arrayBuffers는external과 중첩될 수 있고shared WASM의accounting 범위는관측으로명시한다. WASM capacity를physical RSS로취급하지않는다.250ms사이의peak는cgroup.peak로보완하지만영역별정밀분해로간주하지않는다.

마지막 marker와 다음 marker 사이가OOM후보구간이다. native-enter 이후라면presolve/LP/search 중 어느 내부구간인지까지증명하지않는다. 계측은GC·시간에영향을주므로동일failure의재현여부부터검토하고r8과시간비를성과로쓰지않는다. 이번에는모델식이나solver설정을바꾸지않는다.

## 비용·회계·검증

기존 scoped CP synthetic1회를진단hook검증에도사용한다. 추가 synthetic solver 호출0. native marker/메모리값이남는지사전에확인해 “계측배선오류를CP모델생성OOM으로오인”하는것을막는다. 별도canary/calibration이나population local실행은없다.

원clock `2026-10-06T11:51:03Z`~`2026-10-11T11:51:03Z`,cap20,000calls/5,000runner-hours 유지. 원장누적13,047population slots+10CPsynthetic+신규8+1=13,066. 누적runner reservation2533.333333333333h+4×350분+control6h=2562.6666666666665h. matrix의실제task budget45분이지만기존workflow hard timeout350분전부보수적으로예약한다.

원장 budgetEvidenceComplete=false는attempt1의불완전수집관측도남기기때문이다. 잔여상한을허가로사용하지않는다. 새동결회계는원장head와attempt2-reviewed의전체4,640rawHash/unknown allocation0/collection COMPLETE/2533.333h예약을함께묶는다. 원실험의NOT_RUN_AFTER_OOM21/INCOMPLETE는유지한다.

경량합성모델·serialization spy·동결task JS/Python대조와독립fixture감사후source/manifest/ZIP을봉인한다. 실행후5파일증거패키지및추가저자분석을원장에연결한다. 해결가능성판단은구간별관측·생존반례·미확정사항을검토해작성한다.
