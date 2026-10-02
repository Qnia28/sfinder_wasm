# 승인된 integrated 전용 재검증 실행

사용자 승인: “실행하라”. `PLAN_KO.md`/`PLAN.json`의 integrated 전용 게이트와 개발64/예약104 범위를 따른다. 기존실패37034641097은 수정하지 않는다. 제품source/binary는 e5f2f3d 후보 그대로다. 원Dev/main/default branch/배포를 변경하지 않는다.

실제 제품 `solveExactSecondary` + 기존 `deferThreshold` 경계로 integrated100K를 R/A×4 측정한다. 완료는 PROBE_EXACT,정상100K 미완료는 PROBE_CAPPED다. native 실제입력threshold/primary/PC는0. 모든capped는 기존probe를 재전달해 threshold실제callsite의 seed/옵션을 확인한 뒤 sentinel로 멈춘다. 이 계약spy를 threshold완료로 기록하지 않는다. 기존32개synthetic만 실제threshold를 실행하며 그 probe의 capped표시는 검증용 강제표시임을 명시한다.

phase-result는 rawwitness/seed/options/states/completed/APIwall을 parent journal에 append+fsync한 후ACK한다. 검산/후속단계는ACK이후다. 각호출freshcgroup3GiB/swap0, RSS/WASM/cgrouppeak 기록. source/pack/alias/seed/proofhash와scheduled tuple/자원/원weightedquality를 독립Python으로 검사한다.

APIwall은 최소cover wrapper/native packing/readback을 포함하고, 제품경계wall은 secondary호출에서defer/완료까지다. init/decode/coverage/IPC/fsync/외부검산은 분리한다. 전체secondary/Auto/PCend-to-end 성능을 증명하지 않는다.

개발512호출과 예약832호출은별도집계하며,capped를제외하지않는다. 각군합ratio≤1.05/p95≤1.10/clusterCI상한≤1.05,states/quality회귀0,exact완료비감소,기록누락/timeout/OOM/reap실패0가필수다. peakmemory p95비율≤1.10 또는p95증가≤32MiB. 동결뒤사후튜닝금지,게이트실패시예약미실행,성공rerun치환금지다.

publicstandardrunner,maxparallel16,3시간/64runner-hours상한,160분신규호출중단/175분취소를유지한다. 실제workflow job상한합계21runner-hours로계획21.75이내다. 빌드native소스동일성/이전debug-release26개증거는재사용하고,hosted전체제품193개는JSPI/BASELINE_ROOT를명시해skip0를검사한다.

로컬사전검사: persistence/schedule2개PASS,synthetic64variantRuns(실제integrated64+threshold64)PASS. hosted반복과별도원장을보존하며실제input campaign호출량1,344와합쳐숨기지않는다. 개발/예약노출전pack/reference선택고정,675개효과campaign재실행없음,subagent없음.
