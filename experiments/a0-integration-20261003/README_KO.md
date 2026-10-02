# A0 제품 연결부 검증

승인: 기존 A0 효과는 재사용하고, 별도 브랜치에서 구현·검증을 완료한 뒤 Dev 적용 직전에 멈춘다. 원제품 c0cb2a0 및 main/defaultbranch/배포는 변경하지 않는다. subagent 없음.

제품 변경은 `src/min-cover-exact-secondary.mjs`의 신규 일반 True integrated100K 호출에 `partitioned: decomposition === 'off'` 한 줄을 추가하는 것과 기존 Rust에서 pc_wasm만 재빌드하는 것이다. Fast 기존 dominance preview/명시엔진/CP60초/분해/routing/seed전달 계약은 그대로다. B10/B6/tuned ABI는 가져오지 않는다.

검증 구성 R/A는 동일 WASM을 사용한다. Linux 재빌드가 기존 검증 baseline SHA256 `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`와 일치하는지 검사하고, 원제품 binary와도 작은 synthetic parity를 검사한다. Windows 사전 build는 도구환경 차이로 다른 byte hash가 나와 배포용으로 쓰지 않았으며 Linux 확인을 생략하지 않는다.

기존675개 전수 A0 효과 campaign은 반복하지 않는다. 실제입력 smoke16개는 입력 E최대4개+사전 고정 hash순위 fill12개다. 128 route tuples. scope/witness/phase검증 후 동일후보를 동결하고 예약eligible104개 R/A×4=832 tuples, tiny115 metadata dispatch검사를 수행한다. 입력은 원행·중복가중quality·K·원primaryseed·증명context를 그대로 보존하며 primary/PC를 재실행하지 않는다. reserved는 freshholdout이 아니다.

제품 직렬 secondary orchestration이 실제로 probe→threshold seed를 전달하도록 검증한다. validation adapter만 threshold2Mstates를 적용하고 미완료는 INCONCLUSIVE로 남긴다. common budget-capped route는 제품오류라고 위장하지 않되, 해당 경로의 최종품질·완료시간을 증명했다고 주장하지도 않는다. 후보 동결은 예약 검사를 위한 동일구성 고정이지 제품승인이 아니다. 최종route censoring이 있으면 제품성능판정은 보류한다.

호출별 integrated API10초/process30초, threshold API30초/process45초, kill-reap2초, child3GiB/swap0, 독립phase deadline. 입력묶음 누적시간상한 없음. 이전호출 timeout이 다음조건을 생략하거나 시간예산을 줄이지 않는다. actual timeout/미실행/오류는 그대로 보존하고 성공 재실행으로 치환하지 않는다.

API phasewall은 실제 wrapper/native call만 잰다. routeWall은 제품함수의 총시간에서 외부witness검산 실측시간만 빼고 그 두값을 모두 보존한다. 이 값은 단독DFS시간이나 PC/primary포함 end-to-end가 아니다. main 성능은 Rust 직렬 경로이며 CP/Auto race의 속도이득을 주장하지 않는다.

public standard Ubuntu24.04/Node24.13.0/Rust1.90.0, max-parallel16. 전체3시간/64runner-hours 이내, campaign생성 후160분 신규호출중단/175분 cancellation watcher. build/tests30분+smoke8×30분+freeze15분+reserved16×60분+aggregate15분의job상한합계21runner-hours. artifact≤512MiB/retention1일/include-hidden-files=true, 종료즉시 local보존·독립검산·seal/sourcebundle.

최종gate는 기존예약 확인조건(exactprobe비감소、route전체ratio≤1.05/p95≤1.10、품질/취소/자원/경계회귀0)이다. 소수smoke에5%효과 재입증을요구하지않는다. confidence interval/미증명구간도보고한다. 어떤결과든 Dev적용/mainmerge/배포는이작업에서하지않는다.
