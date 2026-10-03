# 확대 3회차: 100행렬 / 5분 / 동일 VM의 OFF↔ON

사용자 요청에 따라 기존 2회차 캠페인에 후속 확대 확인을 추가한다.
Rust 구현/제품 라우팅/후보 mask16은 변경하지 않는다. dev/main도 수정하지 않는다.

## 고정 조건

- 입력100: 기존20의 bytes/K/seed를 유지하고 구조 기반 선정80개를 추가.
- 동일DB 45setup의 증명완료315행렬에서 선정. 100개 독립보드라는 뜻은 아니다.
- 41개 보드·좌우반전 그룹을 모두 포함하고 그룹당 최대3행렬로 제한한다.
- 추가선정: 그룹별 K-F/품질단계/n/행수/ID순 정렬, 24/12/16칸 그룹 round-robin.
  후보의 성능이나 exact 완료 결과를 읽지 않는다.
- 구성: 기존개발12 + 기존검증8 + 추가80. 추가80은 미사용 독립 holdout이라고 부르지 않는다.
- 점유량별: 12칸31개 / 16칸63개 / 24칸6개.
- `cycle1-100/manifest.json`, `selection-policy.json`, 압축입력100개를 commit으로 고정한다.

## 비교와 병렬 실행

- OFF=experimental mask0, ON=experimental mask16(currentPropagation만).
- 이전 확인은 original↔candidate였지만 이번에는 같은 실험WASM의 순수옵션비교다.
  따라서 지난2회차비율과 같은 비교라고 합산하지 않는다.
- 입력별VM(job)1개, 같은VM에서OFF/ON을AB/BA교대로직렬실행한다.
- 각호출freshNode/WASM, 고정작은warm-up, 입력IO/검증은측정밖이다.
- 5pairs를유지하여100×5×2=1,000호출이다.
- 각호출solver timeout=300초(5분). setup/validation/cleanup timeout은별도다.
- 최대20VM 병렬. GitHub 계정의 실제 동시실행 여유가 작으면 나머지는 자동대기한다.
- benchmark job제한65분: 최악의10호출×5분=50분 +15분여유.
- 모든호출이timeout이면최대약83시간20분의누적VM측정시간이며,
  20VM이모두가용할때약4시간10분 +CI/대기/업로드가걸릴수있다.
- 다른실행과동일branch동시벤치는막고 correctness성공후에만측정한다.

## 검산/보고

- 100입력hash/seed/기존20동일성/그룹상한검사.
- 100입력의budget1 OFF/ON witness검사, 기존oracle/32mask/undo/worker회귀 유지.
- 입력별완료pair비율, OFF-only/ON-only완료, timeout, memory, 회귀를기록한다.
- 다른VM의절대시간으로OFF/ON비율을만들지않는다.
- 결과군은기존개발/기존검증/추가80을분리하고, timeout을완료시간으로치환하지않는다.
- 정답불일치는즉시reject; 요약에누락입력이있으면성공취급하지않는다.
- 완료후실험branch에추가보고하며 main/dev 통합은하지않는다.
