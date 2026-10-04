# 광범위 측정 실행 승인

사용자 2026-10-05: 실행하라. 중대한 설계 오류가 아니라면 스스로 교정·진행하며 실행/하네스 오류는 자율 교정한다.

- 기존220개 개발 mirror 그룹, 두family440command, clear4/hold=true/Human-quality exact.
- 각family는 N+1 큐 하나만. 55개보류그룹은 미측정. 과거노출감사는 부분이며 fresh 주장없음.
- 캡처 전체60초, 기본각엔진2회, 직전2회모두timeout이 아닌 engine×fixture에2회씩최대10회.
- 추가block admission은공통시계6h미만, 전체8h. clock은최초workflow.created_at부터캡처·대기·startup까지포함.
- 명령당비trivial save행렬하나를frozen hash로선정. 전체save행렬은캡처·보존하되전부측정한것으로보고하지않음.
- job≤4task, task마다원격checkpoint. timeout/incomplete는검산PASS도완료시간도아니며Actions실패로취급하지않음.
- source bytes는canonical Git index→Linux actual byte hash로검증. 제품source/Rust/WASM불변.
- 최초원자료보존, 상태·불일치·회수/OOM오류격리, source별교정과원campaign origin유지. 완료측정값교체금지.
- 실험branch에서만승인manifest게시trigger. 원본dev/main은변경하지않음.

과거직접시간은이번신규raw에섞지않는다. 전체노출·과거시간재사용감사를실측과병행하되원래frozen입력·선정·측정조건을바꾸지않는다.
