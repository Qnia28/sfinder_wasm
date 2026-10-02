# A0 적용 직전 인계: 통합 보류

실행과독립감사는완료됐지만예약p95성능gate불통과및신규exact1개확인공백이남는다. **Dev에연결하지않는다.** 상세수치는 `RESULT_KO.md`/`STATUS.json`과원summary를읽는다.

- 후보제품commit:e5f2f3d1a9885085e11cde7457aad2b338ca8130
- 제품기준:c0cb2a048e7275bfea587d176b1954efff0a8a08
- 실제측정source:13b274ef91a2debe07121f7b4a0e670ed39e034f
- 감사순서보정/예약연속source:8b2dcc1419518023ba95d5d660dc7f190a479d58
- 브랜치:validation/a0-integrated-20261003
- WASM SHA256:73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3

`PRODUCT_ONLY_PENDING_APPROVAL.patch`는JS한줄+pc-wasm교체만포함한다. 원Dev에대한apply-check만실행했고적용하지않았다. 새gate를충족하지않으므로적용을추천하지않는다. experiments/Actions/원장전체를제품에merge하는산출물이아니다.

현재rollback할Dev변경은없다. 향후별도승인으로적용한다면JS와binary를같은단위로다루고,그자기적용commit만revert한다. 사용자의추가작업을넓은reset/checkout으로폐기하지않는다. mainmerge/defaultbranch변경/공개배포도별개다.

다음에확인할독립exact는board-111--restricted-split--ordinary **한입력**뿐이며primary/PC를다시증명할필요는없다. 그러나이확인만으로예약API p951.197846을통과로바꿀수없다. p95최대1.10의사후예외나예약결과에맞춘특정IDguard는새승인없이고안/적용하지않는다.

개발measurement재실행0,threshold실제입력전수실행0,timeout이나실패를성공rerun으로치환0. 원실행의auditor순서오류도기록에서삭제하지않는다.
