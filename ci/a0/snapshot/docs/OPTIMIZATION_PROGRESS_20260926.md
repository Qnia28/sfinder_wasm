# 최적화 진행 현황 — 2026-09-26

이 문서는 최근 완료된 작업과 다음 작업을 모은 현재 인덱스다. 이전 문서의 “미실행” 문구보다 완료 보고서와 최신 감사 상태를 우선한다.

## 수행한 작업

| 항목 | 구현·검증 상태 | 제품 적용 판단 |
|---|---|---|
| Saves outcome-only 탐색/packed전송 | 기존완료. 기하복원·orderCount를생략하고완성outcome보존. 과거전체split전수대조완료 | 기본적용된기반기능 |
| Saves code→문자열 캐시/lazy regex 재사용 | 요청내캐시·regex최초평가시생성,9개회귀통과 | 반영 |
| 새보드 원본행렬 확보/감사 | 15추출jobs→19행렬,기존76과합쳐95입력. 해시·K·원본중복행가중치감사 | 검증자료확보 |
| CP batch 재사용·정책비교 | 5조건대규모계획을중단후2조건×2관측으로축소. 신규340+과거40,완료해답불일치0 | 신규보드회귀로공통기본승격거부;기존baseline유지 |
| 3엔진 운영 정책 확정(09-27) | integrated→threshold 유지+60초 CP 보조,명시5옵션. Auto14/14 vs baseline12/14,26완료해답일치,Node59/Chrome11 | 기본Auto 채택;두관측·작은회귀명시,추가임계값탐색종료 |
| 전체필터 primary→secondary worker | opt-in2 구현. Node신규7+기존33,Chrome4primary/하위worker취소검증 | 기본filterWorkers0 |
| 전체필터 성능pilot | 12jobs/85초/전부일치. 작은dispatch+67~69ms,행렬구간약1.5~2%개선 | opt-in보존,기본승격보류 |
| Astra/Luna 협업·자동통보 | Sol제외. 고정job+idle확인+synthetic queue+durable보류/receipt/ack 검증 | 운영중 |
| 동일완성outcome집합캐시(S21-6 C) | opt-in구현,15회귀통과. pilot12/12응답일치·11.2초,126파일/실패큐순서 독립감사 완료 | 단일식회귀로 기본false·명시적opt-in 유지 |
| 1미노잔여 mask/정확한outcome ID bitset | Node20/20·Chrome8·pilot20/20·133파일/전체응답감사. 넓은8개식−334/−347ms | 조건충족시기본적용 `singleSaveMask:true`,명시적false가능 |
| S21-7 조기성공 독립계약 | task012 테스트13/13·동결18파일 감사완료(2026-09-27) | 프로토타입검증완료,제품탐색연결미완료 |
| S21-7 다중root/중단확인 | task013 테스트12/12·WASMtrace6조건/72대조·129파일감사 | 모델계약완료. 실제재생중단root0,작업절감근거필요 |

## 다음 작업 — 우선순위

**한시간 C6 후속완료:** 개발80/새mirror50/비용진단24=154시도144EXACT/8TIMEOUT/2INCOMPLETE,캡처9시도49행렬별도.394/119/408/412해시감사,새3그룹5비자명입력에서조기CP이득·빠른Rust회귀동시재현. C6승격보류. upfrontprofile만으로약20ms,CP포함전체worker회수약78~81ms를지불하는빠른입력확인. 다음빠른Rust보호와초기integrated/threshold선택조건. [캠페인결과](../../tools/validation/secondary-upfront-20260928/CAMPAIGN_RESULT_KO.md). 023~026ACK/활성작업없음/부모폴링없음.

**C5분리설계검증완료·미채택:** Luna72/72EXACT,Astra387해시/72witness/466진행/8시간관측감사. QB059 CP합류억제로C4보다22~30%빨라졌으나QB235는20~22%느려져최악단독대비3.458배/+6.332초. C3-phase대조평균C3의0.986~1.021배. 분리계측기반보존,제품승격없음. 다음초기엔진선택/늦은합류별도설계→새mirror holdout. [결과](../../tools/validation/secondary-phase-dispatch-20260928/RESULT_KO.md). task022 synthetic수신/ACK,부모폴링없이완료,활성작업없음.

**2026-09-28 runtime후속완료:** CPU계측4,tier5시도(4exact/1error중단),CPU집합12,분류보정32=53시도감사. 배치통제후CP대기지연이무제한1.65배→P1.16배/E1.00배로축소. 정확한migration은미계측. QB059 C4회귀는P에서도2.23배로남아C4미채택/C3승격보류. [결과·남은작업](../../tools/validation/secondary-runtime-20260928/RESULT_KO.md). 다음분류는integrated비용과threshold실제진행을구분해야한다.

**C4시간관측완료·미채택:** 새QB3그룹54행렬캡처,새2비자명+기존3대조군50jobs비교,16기전진단완료.333해시/42완료witness/10관측,진단608증명단계감사통과. QB235 C4/CP평균2.43배회귀잔존. 단순1초대기후CP실행시간증가가동일모델/탐색카운트로재현돼원인미확정runtime문제부터분리해야한다. [C4계약](SECONDARY_CLASSIFICATION_C4_20260927.md), [전체결과](../../tools/validation/secondary-walltime-20260927/RESULT_KO.md). 활성측정없음.

**CP worker질문 후속완료:** 최근7입력단독/4입력동시Rust의CP1/2worker44jobs와QB235기전진단8jobs완료.221해시/36완료witness/732증명단계감사통과. 평균CP1우세(CP2 1.009~1.736배),기존1worker조건유지. QB235는관측OFF도11,468상태에약5초여서상태수기반합류기회의한계가남는다. [결과](../../tools/validation/secondary-cp-workers-20260927/RESULT_KO.md).

**새 보드 검증 완료:** 캡처20jobs/118행렬,비교128jobs완료·감사(213해시/110완료witness/12관측). QB235독립split Z에서C3평균2.62배·4.61초지연이두반복재현돼제품승격보류. 새13입력C3 24/26EXACT,모든엔진미완료입력1개. 상세`secondary-c3-newboards-20260927/RESULT_KO.md`. 상태수가작아도수초가소요되는경우50K CP합류기회가없다는반례를확인했다. 다음설계는새holdout필요.

**현재 후속 완료:** F1 진행량 기반 integrated 연장100관측+52독립비교, L1 고정비용 개선40비교, 통합C3 28비교를 모두 완료·감사했다. C3 통합28/28EXACT,191파일해시 검증. [C3 조건](SECONDARY_CLASSIFICATION_C3_20260927.md). 두 미해결 문제에 대응하는 개발 후보가 생겼으며, 새로운 보드/반전 그룹 일반화와 제품 적용은 남았다. 활성 작업 없음. 과거 상태를 C3의 측정 결과처럼 합산하거나 해석하지 않는다.

**분류 설계 후속 완료상태:** 이번iteration438jobs/모든감사완료,활성작업없음. C1거부,J/O반례를반영한C2는12입력2회24/24EXACT. 동일모델CP단독14관측과baseline중빠른비교대상대비C2평균0.97~1.26배(전체관측범위최대1.37배). `secondary-classification-20260927/RESULT_KO.md`. C2는개발후보이며분류확정/제품승격/새보드일반화성공이아니다. step4에는integrated예산분류와짧은입력의profile/worker고정비용이남았다.

**최신 사용자 정정:** 원 계획 4번인 3엔진 **분류 조건 설계를 계속**한다. 100K/60초는 실행 체계의 임시 운영값이며, 이하 "확정/탐색 종료"는 분류 조건 검증 완료를 뜻하지 않는다. 기존 측정의 특성별 재분류→integrated 예산 독립 비교→threshold 증명 진행도/CP 모델 비용의 조건 설계 순서다. Saves/worker 후속으로 이동하지 않는다.

**2026-09-27 완료:** [3엔진 정책](SECONDARY_THREE_ENGINE_20260927.md)을 확정했다. integrated 우선→threshold 유지→secondary 60초 뒤 CP 보조가 기본 Auto다. 두 반복과 Node59/Chrome11 검증을 완료했고 진행 중 측정/위임은 없다. 추가 엔진 후보·임계값 탐색을 종료한다. 아래 Saves 후속은 별도 보류 항목이다.

1. **완료:** 일반캐시기본false와1미노잔여mask기본true를각각판정했다. task011의20job/Chrome8/133파일감사를끝냈고진행중Luna위임은없다.
2. **조건부:** whole-filter 자동적용 검토는primary/integrated가실제로직렬병목인요청이확인될때만한다. 현재secondary-heavy입력의작은이득을근거로새임계값이나4-worker를추가하지않는다.
3. **S21-4 후속:** JS집계특화는완료했다. Rust의공유DAG/QueueTrie에서직접u8를전송하는후속은전송/coverage병목근거부터확인한다. 단일큐DAG로되돌아가공유를잃지않는다.
4. **S21-7:** [단조성·case완료·오류순서계약](SAVES_EARLY_SUCCESS_CONTRACT_20260926.md)을정리했다. atom직접complement는안전할수있지만`!`/group complement/ALL은일반조기완료하지않는다. 현재동기packedAPI에는탐색중case종료전달계약이없다.
   - task012/013으로단일·다중root모델계약과중단확인/오류장벽을검증했다. [다중root프로토콜](SAVES_MULTIROOT_PROTOCOL_20260927.md). 다음은coverage단계비중과생략가능작업량확인→실익있는범위의native producer연결→취소/오류/브라우저대조→제한성능비교다. 현재진행중위임은없다.
5. **S21-9/M21-9:** 이후에도남는실제병목에한해열거/DAG/큐투영/JS집계를분리하고작은개선부터진행한다. 전체카탈로그재측정은기본절차가아니다.

## 보류·미완료 범위

- CP 지원 브라우저의 60초 지연 경쟁은 2026-09-27 기본 채택했다. 과거 20k 조기전환 정책과 자동 성분 분해는 계속 미채택이다.
- 자동성분분해,영구worker/runtime공유,4-worker확대는미채택이다.
- 동일집합캐시 pilot 판정과1미노잔여bitset은완료했다. 긴큐의일반bitset/sparse표현,탐색조기종료는남은별도항목이다.
- BOX/모바일제외유지. commit/push/deploy는수행하지않았다.

## 근거

- [정책비교감사](../../tools/validation/secondary-policy-shortlist-audit-20260926/ASTRA_AUDIT_KO.md)
- [전체필터pilot감사](../../tools/validation/filter-whole-worker-audit-20260926/ASTRA_AUDIT_KO.md)
- [Saves캐시구현](SAVES_OUTCOME_CACHE_20260926.md)
- [Saves캐시감사](../../tools/validation/saves-outcome-cache-audit-20260926/ASTRA_AUDIT_KO.md)
- [Saves1미노mask기본적용](SAVES_SINGLE_MASK_20260926.md)
- [Saves다중root계약감사](../../tools/validation/saves-multiroot-contract-audit-20260927/ASTRA_AUDIT_KO.md)
- [자동통보명령](../../tools/coordination/completion/README.md)
