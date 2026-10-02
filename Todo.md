# 통합 최적화 TODO

**2026-09-29 작업본 정리:** 폴더를 `dev-branch`로 이동(main/기존수정 보존). 기존 trivial 검사에서 원본singleton 구조요약 F/d/u를 회수하는 `inspectTrivialSecondary`와 exact 결과의 `secondaryStructure`를 반영했다. 새cutoff·엔진직행·C3~C6승격은 검증대기다. 현재auto의60초CP보조는 기존 운영정책이다. [현재 코드 상태](docs/DEV_BRANCH_STATUS.md). SOL 검증 호출은provider오류로시작전실패했으며 기존회귀는별도기록한다.

**2026-09-29 설계 재분석:** Astra가기존115행렬파일의특징·직접엔진자료를재구성. 원본singleton의남은선택수d/u를기존trivial스캔에서회수해빠른integrated를보호하고,불확실입력은짧은same-search관측후단일엔진을선택하는방향. F1완료가능성과계속실행이득은별개. 정적CP/threshold직행규칙은미확정,새cutoff/측정없음. [설계·SOL 실험개요](../tools/validation/secondary-routing-design-20260929/DESIGN_KO.md). 역할:Astra분석/설계/최종핵심구현,SOL상세실험설계/시제품/조건비교/검증. 요청내race를기본으로삼지않음.

**한시간후속캠페인완료:** C6설계/개발80+새mirror50+비용진단24=154시도,144EXACT/8TIMEOUT/2INCOMPLETE감사(캡처9작업별도). 새CP우세입력에서C3대비최대반복4.179초단축,빠른입력최악단독4.172배/+8.780ms회귀로승격보류. upfrontprofile/전체worker회수비용확인(pcinfo018회수약78~81ms). 023~026synthetic소비/ACK,부모폴링없음/활성작업없음. 다음빠른Rust보호조건→초기Rust선택→새holdout→제품/browser. [최종결과](../tools/validation/secondary-upfront-20260928/CAMPAIGN_RESULT_KO.md),[남은목록](../tools/validation/secondary-upfront-20260928/REMAINING_KO.md).

**21:06~22:06KST 계속작업:** C6compact모델upfrontCP1+RustC3지속을동결하고개발80jobs를Luna task023에위임한다. 신규cutoff학습없음,6lifecycle/2real smoke통과. 부모는synthetic완료로재개하여감사후시간내다음단계를계속한다. [C6계약](docs/SECONDARY_CLASSIFICATION_C6_20260928.md),마감/CAMPAIGN은`secondary-upfront-20260928`참조. 제품미채택.

**C5 개발비교 완료·미채택:** task022 synthetic수신후72/72EXACT,387해시/72해답/466진행snapshot/8시간관측감사·ACK완료. integrated비용/threshold진행분리로QB059 불필요CP합류를막아C4대비22~30%개선했지만QB235는20~22%악화,최악단독CP대비3.458배/+6.332초. 분리관측기반보존,조건미채택. 다음초기엔진선택과늦은합류별도설계→새holdout→제품/browser. [결과](../tools/validation/secondary-phase-dispatch-20260928/RESULT_KO.md). 활성측정없음/부모폴링없음.

**2026-09-28 C5 설계·구현:** integrated시간과threshold-native-ready이후시계를분리하고,1초관측에서compact모델/품질증명절반미만일때CP1합류하는개발후보를구현했다. 기존F1/L1/C2유지,관측OFF/ON정확성·생명주기검사통과. Luna제한비교후감사예정이며부모는synthetic완료만대기한다. [C5계약](docs/SECONDARY_CLASSIFICATION_C5_20260928.md). 미채택/새holdout미검증.

**2026-09-28 후속완료:** CPU/tier/affinity/분류보정53시도(52EXACT/1ERROR,계획7미실행)감사. CP대기/즉시평균은무제한1.65배/P1.16배/E1.00배로배치영향확인. 고정C4는QB235 P집합에서CP대비1.57배로줄지만QB059는P에서도threshold대비2.23배라미채택유지. [결과](../tools/validation/secondary-runtime-20260928/RESULT_KO.md), [남은목록](../tools/validation/secondary-runtime-20260928/REMAINING_KO.md). 다음:측정조건확정→integrated비용/threshold진행분리분류→새holdout→제품/browser. 주변최적화보류.

**21:30한도후속완료:** C4(1초wall관측+compactCP1합류)9캡처/50비교/16진단완료·감사. C4는QB235에서CP단독대비2.43배/+3.79초가남고새QB059에서도C3보다느려미채택. 단순1초대기만으로CP시작후시간이약2.7→4.6~4.8초로증가하며초기모델/seed/38증명단계branches/conflicts/목표는동일했다. **다음우선순위는runtime시작시점민감성의wall/CPU/phase대기분리**다. [결과](../tools/validation/secondary-walltime-20260927/RESULT_KO.md). 제품미승격·측정종료.

**worker후속완료:** Luna task01644jobs/221해시/36완료witness/732CP증명단계감사통과. 완료단독6입력모두평균CP1우세(CP2는1.009~1.736배),동시Rust에서도증설이득없어CP1유지. Astra기전진단8jobs는QB235동일11,468상태/해답을확인했으며기존관측OFF도약5초였다. 다음은상태수이전경과시간관측·합류설계,새미사용반전그룹검증이다. [결과](../tools/validation/secondary-cp-workers-20260927/RESULT_KO.md). C3승격보류유지.

**새 보드 검증 완료·C3 승격 보류:** Luna128/128jobs,Astra213해시/110완료witness/12관측감사통과. QB8새반전그룹13행렬에서C3 24/26EXACT이나,QB235독립split Z는CP3.120/2.581초대비7.873/7.047초로평균2.62배·4.61초느렸다. threshold11,468상태완료로50K합류기회를놓친다. QB022제한split L은모든조건미완료. 다음분류설계는상태당비용/경과시간관측을검토하고다른미사용반전그룹에서검증해야한다. [결과](../tools/validation/secondary-c3-newboards-20260927/RESULT_KO.md). C3조건동결유지·제품미승격.

**사용자 "이어서 진행" 후속 완료:** F1(DFS 진행량에 따른 integrated100K→최대200K 연장)과 L1(worker 준비 중첩·CP profile 지연)을 독립 비교한 뒤 C3로 통합했다. 추가220jobs 모두 완료·감사, 통합28/28EXACT. ELEPHANT J는 C2 459/467→C3 182/172ms, 빠른pcinfo018 L은246/236→190/198ms. 활성 측정/위임 없음. [고정한 C3 조건](docs/SECONDARY_CLASSIFICATION_C3_20260927.md), [상세 결과](../tools/validation/secondary-combined-policy-20260927/RESULT_KO.md). 개발 후보 검증이며 제품 미승격·새 보드/반전 그룹 일반화 미검증. 아래 미해결/진행중 기록은 당시 이력이다.

**분류 설계 최신 상태:** 이번iteration의438jobs와감사완료,활성작업없음. C1은J/O회귀로거부. C2(중단없는threshold관측+모델크기/증명진행도CP합류)는12입력2회24/24EXACT; CP단독추가14/14EXACT와비교해관측한우세대상대비평균0.97~1.26배(관측범위최대1.37배). 개발후보유지,제품미승격. **step4미완료항목:** integrated근접완료분류(ELEPHANT J약2.5배·0.23초차),짧은입력고정비용(pcinfo018 L약1.5배·80ms). 새보드일반화미검증. [최종iteration결과](../tools/validation/secondary-classification-20260927/RESULT_KO.md). 아래 진행중 기록은 시간순 이력이다.

**최신 우선순위 — 3엔진 분류 조건 설계 계속:** 사용자 원 계획 4번으로 범위를 명확히 했다. 100K/60초 구현은 보수적인 임시 정책이며 분류 조건 최적화 완료가 아니다. 95행렬 재분류와 50행렬×3 bounded probe×2회(300jobs/183초)를 완료했다. integrated200K는 3개 추가 완료, threshold100K는38개 완료. 잔여12개에서 증명 단계 비율로 threshold/CP를 구분하는 C1 하나를 구현하고 테스트5/5 후 15입력×2정책×2회(60jobs/25분상한)를 실행 중이다. [설계/반례/한계](../tools/validation/secondary-classification-20260927/DESIGN_KO.md). 제품 정책 승격 없이 개발 후보를 검증한다. step5 새 입력 검증, step6 worker, step7 saves 후속으로 이동하지 않는다.

**2026-09-27 3체제 확정 완료:** integrated100k→threshold를 유지하고 secondary 60초 뒤 CP 1-worker가 합류하는 기본 Auto 정책을 채택했다. threshold는 계속 실행하며 완전한 exact proof의 선착 결과를 채택한다. 명시적 `secondary` 5옵션 제공. 7입력×2정책×2회에서 Auto14/14·baseline12/14 exact, 26개 완료 witness 일치·108동결해시 확인. ALT JAWS I 74.9/76.3초(기존 두 번100초 미완료); 작은 지연은 문서에 명시해 수용. 최종 Node59/59·Chrome11/11. [계약·두 관측·판정](docs/SECONDARY_THREE_ENGINE_20260927.md). 추가 임계값 탐색은 종료, Saves 후속은 별도 보류. 진행 중 측정/Luna 위임 없음. 아래 "다음 작업" 역사 기록보다 이 상태가 최신이다.

**19시 작업 후속:** 1미노잔여 mask 집계+정확한outcome사전 bitset evaluator를 구현하고 **`singleSaveMask:true` 기본 적용**. Node20/20·Chrome8대조·Luna20job/2회·133파일/전체응답 독립감사 완료. 넓은8개식 전체−334/−347ms,JS−358/−341ms; 작은입력JS+0.19/+0.94ms 수용. [계약·결과](docs/SAVES_SINGLE_MASK_20260926.md). Rust DAG의직접mask탐색/전송변경은후속별도범위다.

**현재 작업 인덱스:** [수행한작업/다음작업목록](docs/OPTIMIZATION_PROGRESS_20260926.md). 동일완성outcome집합캐시 구현·15/15회귀 및 pilot12/12응답일치·126파일 독립감사 완료. 넓은 단일식+22/+88ms,8개식−146/−69ms로 기본 `outcomeCache:false`와 명시적opt-in을 유지한다. 현재 진행중 위임은 없다. [구현계약](docs/SAVES_OUTCOME_CACHE_20260926.md), [결과감사](../archive/saves-experiments-20261002/records/tools/validation/saves-outcome-cache-audit-20260926/ASTRA_AUDIT_KO.md).

2026-10-02: A5+A4 최소통합및saves실험정리완료범위는 [결정기록](docs/SAVES_INTEGRATION_20261002.md) 참조. B4전체통합미채택,3체제정책변경없음. saves원자료의과거경로는 [archive인덱스](../archive/saves-experiments-20261002/README_KO.md)로이전했다.

**전체필터 pilot 완료:** task009의12/12 exact·85초·오류0,105동결파일/6대응쌍 감사통과. 작은 dispatch +67~69ms, 실제두행렬묶음 약1.5~2.0% 개선에그쳐 기본 `filterWorkers:0` 유지, opt-in2 구현만보존한다. 자동적용/일반화는미완료이며추가조건·반복을늘리지않는다. [결과감사](../tools/validation/filter-whole-worker-audit-20260926/ASTRA_AUDIT_KO.md).

**최신협업(2026-09-26):** Sol없는Astra/Luna2체제, Astra가설계·runner·직접위임·감사한다. 새Luna는 `ses_f2383191affe6eAImIQYKEg83W`. 완료통보는 [notify 고정명령](../tools/coordination/completion/README.md)의idle확인→synthetic+queue/receipt, busy시durable보류방식을사용한다. 아래과거무선제메시지/사용자수동전달규칙보다최신이다.

**95입력정책비교완료:** 2조건×2관측380건(신규340+기존40),32분05초,완료해답불일치0,동결15+364파일유지. 신규ordinary exact baseline34/38→batch30/38로악화했고2반복모두약2~3초→60초timeout회귀를확인했다. **batch의공통기본승격거부,baseline유지**,전체후보탐색/반복확대는종료한다. 다음은고정baseline하의per-save전체필터worker분배설계(M21-1~3)다. [독립감사·단계진단](../tools/validation/secondary-policy-shortlist-audit-20260926/ASTRA_AUDIT_KO.md).

**협업 원칙(2026-09-23 사용자 지시):** 구현·runner·입력·측정 조건을 확정하고 snapshot을 고정한 뒤 LUNA에 벤치/테스트 실행을 한 번 위임한다. 위임 중인 파일은 Astra가 수정하지 않으며 실행 중 추가 지시로 대체·중복 실행을 만들지 않는다. 결과 검토 후 다음 변경을 진행한다. 병렬 작업은 변경 범위와 측정 자원이 겹치지 않는 경우에만 한다. 상세 절차: [LUNA 운영 메모](../tools/validation/luna-worker-20260921/README.md).

**응답 수신 원칙:** LUNA는 Astra가 working일 때 메시지를 보내지 않는다. 기본적으로 선제 전송 없이 자신의 작업과 결과 파일에 진행·완료·오류를 기록하고, Astra가 필요할 때 `read_thread`로 회신을 읽는다. 완료 알림·수신 확인도 Astra로 별도 전송하지 않는다.

**최신 위임 방식(2026-09-23 사용자 지시):** Codex 메시지 오배송 문제로 다음 LUNA 작업은 Astra가 직접 전송하지 않는다. 변경·실행 명세·snapshot을 고정한 뒤 위임문을 현재 채팅에 출력하고 사용자가 직접 전달한다. 기존의 단일 실행·위임 범위 동결·읽기 조회 원칙은 유지한다.

**2026-09-25 진행:** 경량 topology 이후 sibling partition과 전체 secondary 정책을 각각 1,140회 비교했으며 기본 적용은 보류했다. 이어 15입력×4엔진×5회 비교를 Gemini와 LUNA가 각각 완료했다. 300회당 exact는 195/199, 완료 해답 불일치 0, 동결 파일·입력 일치다. 완료 여부 차이 4건은 LUNA 첫 반복이며 10.2~18.0초 완료라 단순 20초 경계 차이라고 단정할 수 없다. 두 입력의 20/60초·WASM 컴파일 설정·CPU 계측 비교 60회를 준비하고 동결했으며 새 측정은 미실행이다. 제품 WASM과 기본 정책은 유지한다. [partition 결과](docs/SECONDARY_PARTITION_EXPERIMENT_20260923.md), [엔진 비교 계약](docs/SECONDARY_ENGINE_CHOICE_20260925.md), [교차 감사 및 다음 측정](docs/SECONDARY_CUTOFF_AUDIT_20260925.md).

**2026-09-26 진행:** 후속 60회는 exact 41/미완료 3/timeout 16, 완료 해답 불일치 0, 119파일 해시 유지다. 같은 상태·분기 수에서 큰 시간 변동이 재현됐으며 `--no-liftoff`는 CP를 악화시켜 제외했다. 동기 Rust 상태 예산과 비동기 CP를 연결하는 명시적 실험 portfolio를 구현했다. 기본 10만→threshold와 20만→CP / 20만→threshold 2만→CP / 20만→threshold 30만→CP의 15입력×5회 비교를 준비한다. 제품 기본값·WASM은 유지하며 새 테스트/측정은 LUNA 위임 전 미실행이다. [실험 계약](docs/SECONDARY_PORTFOLIO_EXPERIMENT_20260926.md).

**2026-09-26 후속:** portfolio 300회 완료, 테스트 10+25 통과, 완료 결과 261개 불일치 0. baseline 55/75 exact→CP 직행/threshold20k 후보 70/75로 개선됐지만 ordinary ALT JAWS T와 빠른 입력의 회귀 때문에 기본 적용하지 않는다. threshold가 이미 증명한 품질 구간을 CP에 전달하는 기능을 별도 opt-in으로 구현하고 실험 WASM을 빌드했다. integrated100k/threshold20k 고정, 증명 재사용 off/on의 10입력×5회 검증 묶음을 준비했다. 새 테스트/100회 측정은 아직 실행하지 않았다. [구현 및 다음 검증](docs/SECONDARY_PROOF_REUSE_20260926.md).

완료일: 2026-09-12. 작업본: `D:/AI/sfinder-wasm/release3.0-20260906`.
`f4fd90180e1a05b96899663bcc4dff1493d8e8c8`까지 통합한 뒤 남은 항목을 구현·검토했다.
기존 Fumen 처리, 로컬 compact/CSR·PATH geometry, 브랜치 Cover/Congruent 통합 작업을 보존했다.

[구현 및 API 계약](docs/TODO_OPTIMIZATION_20260912.md)과
`D:/AI/sfinder-wasm/tools/validation/todo-20260912/RESULT_KO.md`에 측정·검증 근거가 있다.

**증명 재사용 후속:** 100회에서 양쪽 45/50 exact, 완료 해답 불일치 0. native 26/JS 12/oracle 25 및 부분 증명 검증 통과. 단계 하나 생략에도 ordinary T 평균 +3.12초 회귀가 있어 기본 적용은 보류한다. 원래 CP 묶음과 기수 가중 등식을 유지하는 재사용 후보를 구현하고 7입력×3조건×5회 묶음을 준비했다. 새 테스트/105회 측정은 미실행이며 제품 기본값·WASM은 유지한다. [결과](docs/SECONDARY_PROOF_REUSE_20260926.md), [다음 검증](docs/SECONDARY_PROOF_BATCHES_20260926.md).

**묶음 유지 재사용 후속:** 105회에서 제어군 35/35, 개별 등식 30/35, 묶음 유지 35/35 exact. 테스트/모델 구조 비교 통과, 완료 해답 불일치 0. 개별 등식은 후보에서 제외하고 묶음 유지 방식만 선택적 후보로 남긴다. 제품 기본값은 유지한다. 모델 형태 조정을 마무리하고 세 카탈로그의 새로운 6개 보드 그룹에서 15개 큐 job/T·I 원본 행렬을 추출하는 묶음을 준비했다. 이번 후속 위임은 추출만 하며 secondary 벤치를 실행하지 않는다. [측정 결과](docs/SECONDARY_PROOF_BATCHES_20260926.md), [추출 계약](docs/SECONDARY_NEW_BOARDS_20260926.md).

## 이번 완료 항목

**2026-09-26 새 보드 추출 후속:** 15 jobs의 1회 실행 완료(13 COMPLETE/2 열거 TIMEOUT), 최대 30개 중 19행렬 저장/7 NO_MINIMAL/4 미추출. Astra가 165파일 해시와 19행렬의 선택·원본 가중 행·K/seed를 감사했다. 신규는 전부 primaryHard=false이며 fullsplit 완료는 QB005만이다. 기존 76+신규 19의 [정책 입력 계약](docs/SECONDARY_POLICY_INPUT_CONTRACT_20260926.md)을 정리했고 후속 runner/측정은 미동결·미실행이다. [감사](../tools/validation/secondary-newboards-audit-20260926/ASTRA_AUDIT_KO.md).

| 상태 | ID | 항목 | 결과 |
|---|---|---|---|
| 완료 | M1 | 단계별 계측 | 진단 전용 JS/WASM 및 Rust DAG/복원 구간, 캐시·전송·메모리 통계 |
| 완료 | M2 | desktop 측정 확대 | 20개 입력 × Node/Chrome × 전후 × 5회, history/T-spin/중복/7~15 operations; 모바일은 사용자 요청으로 제외 |
| 완료 | B1 | 작은 Congruent 라우팅 | 4개 이하 scalar MRV; 7 operations 이하 Boolean, 8개 이상 suffix; 5개 엔진 조합 비교 |
| 완료 | B2 | 큐 staging 1회화 | 값 스냅샷과 generation handle, 교차 호출·예외·수명 검증 |
| 완료 | L3a | Chance queues prefix | 실패 suffix만 복원, 큐 순서·중복·한도 유지, 짧은 큐는 concrete 경로 |
| 완료 | L3b | Chance 요청 내 재사용 | 동일 multiset DAG 공유, 32 MiB/64그룹 제한과 종료 시 해제 |
| 완료 | B3 | incremental MRV | placement/cell 역색인·active bitset·후보 수·undo |
| 완료 | B4 | 기하학적 가지치기 | 연결 성분 면적 + 제한된 negative memo; 성공 색칠 구분 |
| 완료 | B5 | multiset root 색인 | 미노/필요 수별 root 비트셋 교차 |
| 완료 | B6 | Rust/JS 한도 통일 | 수락된 고유 해 단위, 정확 한도 허용, 다음 해에서 명시적 exhaustion |
| 완료 | B7 | Congruent bulk 전송 | operation/order owned buffer와 구형 getter fallback |
| 완료 | L4 | 정확 최선해 압축 | 색칠별 성공 suffix 공유와 정확 count, 안정적인 동점, 표현 예산 fallback |
| 완료 | B8 | batch 성공 suffix language | Queue/Hold·physics·원래 행 상태 포함, 일반 Congruent adapter |
| 완료 | B9 | 불필요한 출력 생략 | 명시적인 congruent-cover coverage/count 계약 |
| 완료 | B10 | 가중 prefix count | congruent-cover·cover-percent, BigInt·target/mirror 합집합 |
| 완료 | B11 | unique queue/remap | 중복 가중치와 실패 순서 보존, sparse/dense 선택 |
| 완료 | B12 | PC oracle 호환성 검토 | 반례로 직접 대체 불가 확인; exact-lock 유지, 증명 가능한 기하 검사만 적용 |

- [x] 로컬 geometry의 0/2 상태 예산 소진 및 정확 fallback 검증.
- [x] 네이티브 Rust 단위 테스트. 로컬 Rust GNU 도구 구성으로 71개 통과.
- [x] JavaScript 회귀 363개 통과(조건부 baseline 비교는 경로를 지정해 별도로 실행).
- [x] 기존 Chrome 회귀 28개와 새 출력 계약 7개 통과; 별도 fresh Worker 비교 400회 결과 일치.

## 측정에 따른 해석과 제외

다중 target staging과 Congruent-cover의 초기화 후 연산은 개선됐다. 새 Worker 전체 시간은 개선·퇴보가 섞이며 모든 입력의 속도 향상을 주장하지 않는다.
L4는 정확한 언어 표현 공유를 구현했고, 추가 품질 상한 가지치기는 안전성이 증명되지 않아 넣지 않았다.
B12는 호환성 **검토**를 완료한 항목이다. 반례가 있는 PC oracle 직접 대체는 적용하지 않았다.
Chance 요청 내 재사용은 DAG에 적용하며 서로 다른 배치의 trie까지 모두 재사용한다고 주장하지 않는다.
메모리 표본은 프로세스/페이지와 WASM committed memory를 구분한다. 전체 peak heap의 상한을 입증한 것은 아니다.

사용자 요청에 따라 모바일 및 모바일 에뮬레이션, 3×4 BOX 8P는 제외했다.
기존 정확 품질 기본값·save 표현식·Hold·physics 차이·operation history·실패 큐 순서와 중복을 유지한다.
영구 결과 캐시·근사 종료·원격 배포·commit/push는 추가하지 않았다.

## 이전 완료 작업과 근거

- [x] Fumen JavaScript 필드 복사·디코딩·출력 변환 감소 — [계약](docs/FUMEN_PROCESSING.md).
- [x] 로컬 1 per-save-minimals compact/CSR 공통화, 로컬 2 PATH·solve-all·per-save-all geometry.
- [x] 브랜치 1 Cover trace/Boolean 판정/가지치기, 브랜치 2 요청 캐시·flat DAG·bulk, 브랜치 3 compressed frontier·tall·count.
- [x] 공통 Rust 소스 통합 및 PC/batch WASM 재빌드.
- [브랜치 원본 TODO](https://github.com/Qnia28/sfinder_wasm/blob/f4fd90180e1a05b96899663bcc4dff1493d8e8c8/Todo.md)와 [기존 구현 설명](docs/BATCH_OPTIMIZATION.md).
- 이번 변경 직전 원문: `D:/AI/sfinder-wasm/tools/validation/todo-20260912/baseline/Todo.md`.

## 2026-09-21 신규 개선 계획 — 미구현 항목

이 절은 9월 12일 완료 목록과 구분하는 후속 계획이다. 아래 체크되지 않은 항목은 설계·실험 단계이며 운영 코드에 적용됐다는 뜻이 아니다.

근거: [per-save 실측](docs/PER_SAVE_PROFILE_20260921.md), [공통 필터 실행 구조](docs/MINIMALS_FILTER_EXECUTION_PLAN_20260921.md), [CP-SAT secondary 실험](docs/CPSAT_SECONDARY_EXPERIMENT_20260921.md).

### Minimals / per-save 공통 실행

**현재 작업 순서와 적용 기준:** [통합 최적화 계획](docs/OPTIMIZATION_ROADMAP_20260921.md). 자명한 exact 처리·선택적 순차 분해 → 공통 행렬/예산/증명 상태 → integrated 개선 비교 → 3엔진 선택·전환 → per-save worker 분배 순으로 검증한다. minimals/per-save 모두 동일 정책을 사용하며 명령 이름으로 분해를 강제하지 않는다. 전체/분해 비교 시 엔진·즉시 완료 규칙·필터 누적 예산을 맞추고 준비·병합 비용까지 측정한다. 작은 문제·한 성분이 지배적인 문제·분해로 느려진 문제를 필수 회귀군에 포함한다. 아래 R21/M21 항목은 이 계획의 세부 작업 목록이다.

2026-09-21 재검토 제안(미구현): [구조 검토 및 분해 실험](docs/SOLVER_ARCHITECTURE_REVIEW_20260921.md). 엔진 전환 임계값 확정 전에 아래 항목을 우선 비교하는 것을 제안한다. 기존 운영 정책은 아직 변경하지 않았다.

- [ ] R21-1: 원본 품질 행렬의 독립 성분 분해 및 원본 singleton 기반 자명한 exact 해 처리를 공통 계층에 도입·검증. primary kernel의 forced를 원본 강제 후보로 오인하지 않는다. 분해 비용이 더 큰 작은/거의 연결된 문제는 전체 경로와 비교한다.
  - 2026-09-22: [P1 첫 구현 및 검증](docs/SECONDARY_P1_IMPLEMENTATION_20260922.md). 자명한 처리를 기본 적용하고 내부 off/on 순차 분해를 검증했다. 실제 행렬 공통 완료 62개 일치, 일반 minimals의 분해 비용 회귀도 확인. 자동 분해 정책은 비활성화하며 항목 전체는 미완료다.
- [ ] R21-2: 후보 ≤48의 무제한 tiny exact 경로를 예산 정책에 포함. prepared matrix와 best feasible/증명된 품질 prefix/최종 동률 증명 상태를 공유하는 API를 설계하여 전환 시 재준비·재증명을 줄인다.
  - 2026-09-22: [세션 내 행렬·완료 성분 재사용](docs/SECONDARY_SESSION_IMPLEMENTATION_20260922.md) 구현 및 검증. 전체 성분 증명과 feasible seed만 재사용하며 tiny 정책, WASM 전처리, threshold prefix 및 worker 간 증명 전달은 남아 있다. 최초 복사 비용이 드는 빠른 입력은 기본 전체 경로로 유지한다.
- [ ] R21-3: integrated DFS의 품질 상한 가지치기 및 pivot 형제 제외를 통한 중복 조합 탐색 제거를 검증. 기존 histogram/threshold 그룹화·dominance와 중복 구현하지 않는다.
- [ ] R21-4: 분해 후 남은 문제를 기준으로 3엔진 선택·전환 기준을 재측정한 뒤, 필터/성분 묶음의 primary→secondary worker 배정을 설계. 작은 성분마다 worker를 만들지 않고 전송·시작 비용을 포함한다.
  - 2026-09-27: **3엔진 운영 정책 부분 완료.** 자동 분해와 별개로 integrated→threshold+60초 CP 보조를 확정했다. 자동 성분 분해/전체필터 자동 배정까지 완료했다는 뜻은 아니다. [최종 판정](docs/SECONDARY_THREE_ENGINE_20260927.md).
  - 2026-09-22: [짧은 whole probe 이후 선택적 분해](docs/SECONDARY_ROUTING_EXPERIMENT_20260922.md) 실험 경로와 worker 전달 회귀를 추가했다. 1천/1만 상태 및 성분 수 기준을 기존 70행렬·별도 카탈로그 6그룹으로 비교한다. 제품 기본값은 off이며 CP-SAT 연결과 운영 임계값 확정은 미완료다.
  - 후속: 70행렬 조건당 5회에서 완료 결과 불일치 0. 조기 threshold 전환으로 full split T 약 2배, QB 제한 split T 약 5.5배 퇴보를 확인해 probe-first 기본 적용을 보류했다. 구조 선확인 후 성분 수가 적으면 단일 integrated 10만 상태를 유지하는 후보를 추가하여 5회 대조한다. 별도 보드의 완료 17행렬은 trivial/whole-probe만 포함하므로 분해 효과의 일반화는 추가 검증이 필요하다.
  - 2026-09-23: 구조 선확인 후속 180회에서 165 exact/15 timeout/오류·완료 불일치 0. 큰 조기 전환 회귀는 해소했지만 빠른 BIG JAWS I에 평균 19.73→26.87ms 비용이 추가돼 기본 적용은 계속 보류한다. 경량 성분 요약, integrated continuation/전처리 재사용, P3a 분기 중복 제거 및 새 per-save 분해 사례 검증이 다음 순서다.

카탈로그 조건: 사용자 지정 cycle1(45), cycle3-extra-T(55), cycle7-2plus2-QB(356) 카탈로그를 사용한다. 4×4 BOX `*!` exact는 사용자 보고상 두 Rust 방식 모두 1시간 미완료이므로 우선 제외한다. 이름이 아닌 점유 보드로 검출한 13개 카탈로그 항목에 적용하며 기존 BOX 8P/모바일 제외도 유지한다. 같은 보드/좌우 반전은 임계값 학습·검증 사이에 섞지 않는다. 상세 측정 조건은 [실행 계획](docs/MINIMALS_FILTER_EXECUTION_PLAN_20260921.md)에 기록한다.

- [ ] M21-1: 공통 해법 열거·큐별 품질 계산 후 필터별 행렬을 만들고, **필터 하나의 primary→K 확정→secondary 전체**를 worker 작업으로 분배한다. 일반 minimals는 작업 하나, per-save는 미노별 여러 작업으로 같은 실행 계층을 사용한다. 열거를 필터마다 반복하지 않는다.
  - 2026-09-26: baseline유지판정후 [전체필터worker구현계약](docs/FILTER_WHOLE_WORKER_DESIGN_20260926.md)을작성했다. 현secondary.worker의빈primaryCases를그대로재사용할수없고ORTools nested2-worker/취소회수를별도검증해야함을확인했다. 첫비교는기존경로vsopt-in2filter-worker,각2회로제한한다. 구현/새실행은아직미완료다.
  - 후속: [opt-in2filter-worker구현](docs/FILTER_WHOLE_WORKER_IMPLEMENTATION_20260926.md),Node새7/7·기존33/33·Chrome4primary/취소회수검증통과. 기본0유지. 성능검증은소형12jobs/10분상한pilot으로준비했다. 전체M21항목의기본적용은아직미완료다.
- [ ] M21-2: 정말 작은 작업은 로컬 완료, 무거운 작업은 integrated부터 worker에서 수행한다. 후보 수·활성 큐 수·연결 수·품질 단계/동치 클래스 수와 실측을 사용해 판단하며 단일 K/큐 수나 셋업 ID로 하드코딩하지 않는다.
- [ ] M21-3: 필터 worker 2~4개와 내부 solver 스레드를 포함하는 총 계산 예산을 설계한다. primary Rust/HiGHS 싱글코어·ORTools 2-worker 정책을 유지한다. worker 준비 지연, 취소·오류 복구·메모리 정리 및 필요 시 풀 재사용을 검증한다.
- [ ] M21-4: integrated/threshold 선택과 worker 배정을 구분하여 함께 설계한다. 고정 10만 상태 probe, 짧은 probe, 단독 엔진 및 동적 전환을 같은 행렬·K·seed·CPU 예산에서 비교한다. 짧은 integrated 미완료를 threshold 우위의 증거로 취급하지 않는다. 로컬 probe를 둘 경우 필터별 및 요청 전체 누적 예산·이전 seed 전달·중복 탐색 비용도 관리한다.
- [ ] M21-5: CP-SAT을 어려운 exact secondary의 선택지로 공통 계층에 연결하는 방안을 검증한다. max_lp 및 정확한 품질 목표 묶음 모델을 우선 후보로 삼고 1/2-worker, 준비 시간, 품질 증명, stable-ID 동률 비용 및 메모리를 분리 측정한다. 쉬운 문제는 기존 Rust가 훨씬 빠르므로 전면 교체하지 않는다.
  - 2026-09-27: 공통 제품 연결·1-worker 묶음 모델·명시 선택·60초 자동 합류는 구현/검증 완료. 기존 단계별 비교에 이번 제한 검증을 더해 운영 정책을 확정했다. 추가 메모리 계측/스레드 후보 비교를 완료 요건으로 확장하지 않는다.
- [ ] M21-6: 여러 필터가 남아 있으면 필터 간 병렬화를 우선하고, 하나의 난제만 남으면 남는 예산으로 integrated/threshold/CP-SAT 경쟁 실행을 검토한다. 최종 exact 증명 완료 결과만 채택하고 다른 작업 종료·자원 회수를 보장한다.
  - 2026-09-27: 각 활성 filter에서 60초 뒤 threshold+CP 경쟁과 exact 검증/종료/취소를 구현했다. 전역 잔여 토큰 재배분은 별도 미구현이며 이번 정책의 필수 후속으로 두지 않는다.
- [ ] M21-7: threshold 품질 단계와 최종 stable-ID 증명을 분리 계측한다. 이미 존재하는 하한·상한·정적/동적 dominance·lexicographic 가지치기의 효과를 측정하고 강화한다. memoization은 covered뿐 아니라 남은 후보·K·품질 목표·동률 의미를 포함해 안전성을 검증한다.
- [ ] M21-8: 원래 품질 행렬, 큐 중복 가중치, save 의미, 안정적 ID/표시 순서를 보존한다. primary 전용 kernel/dominance로 삭제한 후보를 secondary에서 무조건 제외하지 않는다. minimals의 마지막 bag 기반 save와 per-save의 실제 잔여 1미노 분류 차이를 유지한다.
- [ ] M21-9: 전체 독립 `*p3,*p4`(176,400큐) 후보 열거의 DAG 구성·경로 복원·order coverage·품질 집계를 분리 계측한다. 기존 DAG/QueueTrie 공유를 보존하면서 order 압축·호환성 조기 적용을 검토한다. root 병렬화는 공유 상태 중복 및 peak 메모리까지 비교한다.
- [ ] M21-10: cycle1의 쉬운/어려운 필터와 `*!`, `[IJL]p3,*p4`, 전체 독립 `*p3,*p4`를 구분하여 검증한다. 최소 K·품질 벡터·stable-ID·Fumen 및 complete-row 회귀를 대조한다. BOX/모바일 제외 조건 유지. 시간 제한 미완료를 exact 결과로 취급하지 않는다.

### 완료된 조사·실험 (운영 통합과 별개)

- [x] 사용자 지정 세 카탈로그 456개 등록 및 Fumen/placements 일치 확인. 동일 보드 338종, 반전 포함 297그룹, 4×4 BOX `*!` 제외 대상 13개 식별. 일반 minimals의 대표 4셋업에서 16행렬×3엔진 초기 비교 및 CP-SAT 목적값 정수 재계산 검증 완료. [pilot 결과](docs/MINIMALS_SECONDARY_CATALOG_PILOT_20260921.md). 전체 카탈로그 측정과 우선순위·전환 임계값 확정은 아직 미완료.

- [x] 현재 per-save 병목 계측 및 Chrome worker 2/4개 비교. primary보다 secondary와 전체 split 열거가 주요 병목임을 확인.
- [x] 실제 필터 행렬 54개 추출, 대표 10개에서 Rust integrated/threshold/혼합 및 CP-SAT 비교 80회 수행. 완료 결과 63회 상호 일치.
- [x] CP-SAT 단계별·정확한 목표 묶음 프로토타입, 완전탐색/동률 검증 50개, Chrome 검증 4회 통과. ALT JAWS 난제에서 이점을 확인하되 운영 기본값은 유지.

### Saves 후속 검토

- [x] S21-1: saves 호출 경로 및 열거/집계 구간 계측 완료. 미사용 기하 해답·orderCount 계산을 확인했으며 Rust 내부 세부 단계 계측은 후속 항목으로 남긴다.
- [x] S21-2: saves 전용 outcome 존재성 탐색, compact 전송, 표현식 평가 개선 설계 완료. saves는 minimals secondary를 수행하지 않으므로 CP-SAT 적용과 별도 과제로 취급한다.

Saves 조사 결과: [구조·실측·후속 계획](docs/SAVES_OPTIMIZATION_PLAN_20260921.md). 기본 4조건 각 3회 결과 동일, 전체 독립 split은 saves 15초 미완료 대비 Boolean 존재성 약 0.58~0.77초. 두 계산의 요구 결과가 다르므로 후자를 saves 예상 성능으로 해석하지 않는다.

결과 원본: `D:/AI/sfinder-wasm/tools/validation/saves-plan-20260921/`.
- [x] S21-3: save outcome-only 탐색 API 구현 및 기본 saves 경로에 적용. multiset DAG/성공 순서 압축/QueueTrie를 공유하되 사용 미노 개수 조합별 root 식별을 유지하여 큐 coverage만 계산한다. 기하 해답 복원 및 품질 카운팅은 생략하고 표현 예산 초과 시 exact fallback한다.
- [ ] S21-4: queueLength=req+1 특수 경로에서 구조적 DAG의 reachable save u8 mask를 계산하는 방법 비교. 일반 saves의 마지막 bag 잔여 및 중복 미노 의미를 후처리에서 유지하고 긴 큐에는 일반 multiset 경로 적용.
  - JS 집계특화완료: 기존packed coverage에서실제잔여mask를집계하고branch별정확한문자열사전으로해석한다. 기본활성화/20회귀/Chrome8/20job감사완료. Rust구조적DAG직접mask계산은아직미구현이다.
- [x] S21-5: saves 전용 packed [사용 개수, 큐 개수, 큐 ID...] 레코드 일괄 전송 구현. geometry/quality 전송을 생략하고 JS 소유 배열로 복사. 기존 compact geometry 열거 API와 별도 경로이며 구 WASM/대체 solver는 기존 열거로 호환.
- [ ] S21-6: 표현식 RegExp 사전 컴파일, 요청 내 code→문자열/동일 outcome 집합 평가 캐시, outcome ID 비트셋·sparse 표현을 비교. `I&&J`와 `IJ`, `^I`와 `!I`, `T`와 `TT`, branch metadata 및 empty outcome 계약을 보존.
  - 2026-09-26: 요청 내 code→문자열 캐시와 queue-level regex의 최초 평가 시 생성·재사용을 반영했다. Astra 직접 신규 6개/기존 WASM 3개 회귀 통과. 동일 outcome 집합 캐시·sparse/bitset 비교는 남아 있으며 벤치마크 및 성능 판단은 보류한다. [설계](docs/SAVES_EXPRESSION_DESIGN_20260926.md), [구현·검증](docs/SAVES_EXPRESSION_IMPLEMENTATION_20260926.md).
  - 후속: 동일완성집합캐시C는12job감사후단일식회귀로기본false유지.1미노잔여의고정사전bitset은20job감사후기본활성화했다. 일반긴큐의sparse/bitset일반화는남아있다.
- [ ] S21-7: 단조성이 증명된 표현식만 조기 성공 종료. `ALL`/부재 조건은 미탐색 결과가 남은 상태에서 완료 처리하지 않는다. raw queue 탐색 중복 제거와 branch별 마지막 bag 해석/remap을 분리한다.
  - 2026-09-27: 독립JS prototype 계약13/13·동결18파일 감사완료. 실제root/case완료집계·producer stop ack·오류규약및Rust/WASM연결은미완료. [감사](../archive/saves-experiments-20261002/records/tools/validation/saves-early-stop-contract-audit-20260927/ASTRA_AUDIT_KO.md).
  - task013: 다중root→case완료집계·명시적중단ack·request-wide오류장벽을독립구현.12/12테스트·실제WASMtrace6조건/72대조·129파일감사완료. 실제재생중단root0이므로coverage비용/생략가능작업량확인을다음우선순위로둔다. native연결/성능입증은미완료. [계약](docs/SAVES_MULTIROOT_PROTOCOL_20260927.md).
- [x] S21-8: 기존 saves 전 결과, 성공률·failedQueues 순서/중복·alias/regex 대조 완료. complete-row, Hold on/off, 2~6줄 및 전체 독립 split 포함. ALT SHOES/ALT JAWS 각각 176,400큐의 개별 outcome을 기존 기하 열거와 전수 비교. Rust 77개, JS 380개, Chrome Worker 30회 통과.
- [ ] S21-9: outcome-only 이후 병목을 재측정하여 상태 공유를 해치지 않는 병렬화의 실익을 판단한다. S21-4/6/7과 함께 우선순위를 비교한다.

구현 및 결과: [Saves outcome-only 구현 검증](docs/SAVES_OUTCOMES_IMPLEMENTATION_20260921.md). 전체 독립 split Node 중앙값 ALT SHOES 0.757초, ALT JAWS 0.767초(기존 단일 요청은 15초 제한 미완료). minimals/per-save 실행 구조는 이번 saves 변경에 포함하지 않았다.
