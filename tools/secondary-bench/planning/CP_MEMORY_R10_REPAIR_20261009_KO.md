# r9 미시작 복구 — revision10

원진단설계 `CP_MEMORY_R9_20261009_KO.md`의4입력/8호출/계측/solver조건은그대로다. 사용자 “--continue”에따라하네스출력연결을고쳐진행한다.

## 실패와 원증거

run37815474702,commit44b92b90d27a43d31266a42fb327bdd953dcf8f6에서activation과CP실제native계측사전검사는성공했다. 그러나`action.mjs`가쓴`large-phase`를composite`action/action.yml`의outputs에선언하지않아다음plan의phase가빈문자열이됐다. `phasesFor(m).includes(phase)`가실행전거부했다. 모델/ORTools OOM은아니다.

수집된원패키지 `benchmark-packages/37815474702-attempt1`은collection COMPLETE,rawDatabaseParity PASS,원감사INCOMPLETE다. raw0/starts0/scheduledMatrixJobs0이다. 실패plan/job및원동결8슬롯은보존한다. synthetic1회와control예약5.5h를차감한다. 실패한r9실행을소급성공으로바꾸지않는다.

## 복구 계약

- 수정:composite출력전달1개,해당전달경로회귀검사,미시작복구계약. 제품/계측sourceFiles.product는r9과byte hash동일이어야한다.
- campaign `TRIAGE_CP_MEMORY_20261009_R10`,revision10,phase는같은진단설계`CP_MEMORY_R9`.
- 부모는실패한r9LOCK. fixture source는r8LOCK. `RECOVERY_PROOF.json`에원5파일패키지hash/원summary/원collection/jobs/계측사전검사PASS를연결한다.
- 이전8슬롯은실행전미시작이확인돼도보수적으로예약을유지한다. 신규8호출은revision10 identity다. 측정재실행이아니며자동rereun을사용하지않는다.
- 누적13,055population예약+11synthetic+8+1=13,075호출. 원clock/cap변경없음.
- 누적runner2538.833333333333h+4×350분+control6h=2568.1666666666665h. 별도preflight는경량계약검사이며population0.

실제CP사전검사와원activation로그에서진단경로가작동한것은확인했지만,실자료OOM원인결론은아직없다. 성공한synthetic을대표OOM해결근거로삼지않는다.
