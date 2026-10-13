# 실험 결과 수집·패키지·단일 원장

실행 하네스가 만든 증거를 **solver 호출 없이** 인계 가능한 단위로 모은다. 현재 지원 대상은 `secondary-triage-campaign.yml`의 triage artifact 계약이다. 기존 information/F/A 수집기를 묵시적으로 대체하지 않는다.

`postprocess/`는 동결된 실행 source 밖의 후처리 도구다. 실행 중인 run을 변경하거나 새 Actions job을 배정하지 않는다. 지금 r6에는 종료 후 로컬에서 사용한다. CLI는 Python 3.11+ 표준 라이브러리와 인증된 `gh`를 사용한다.

## 1. 기준 경로와 실제 사용

원장 하나를 프로젝트 전체에서 공유한다. 이 프로젝트의 기본 위치:

`D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite`

```powershell
# 승인된 실행을 등록. LAUNCH는 선언의 스냅샷이며 완료 증명이 아니다.
python -B tools/secondary-bench/postprocess/package.py register --ledger D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite --launch D:\AI\sfinder-wasm\files\benchmark-prepared\triage-probe-seed-16vm-20261006-r6-launch\LAUNCH.json --manifest D:\AI\sfinder-wasm\files\benchmark-prepared\triage-probe-seed-16vm-20261006-r6-launch\MANIFEST.json

# 종료 후 한 번 실행. 실패 종료도 수집 대상이다.
python -B tools/secondary-bench/postprocess/package.py collect --repo Qnia28/sfinder_wasm --run 37487586383 --out D:\AI\sfinder-wasm\files\benchmark-packages\37487586383-attempt1 --ledger D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite

# 다른 디스크로 복사한 뒤 오프라인 재검증/원장 등록
python -B tools/secondary-bench/postprocess/package.py verify --out D:\copied\37487586383-attempt1
python -B tools/secondary-bench/postprocess/package.py ingest --out D:\copied\37487586383-attempt1 --ledger D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite

# 원장에서 재생성하는 읽기 전용 상태 투영. --out은 새 파일이어야 한다.
python -B tools/secondary-bench/postprocess/package.py status --ledger D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite --out D:\chosen\STATUS.json
```

`observe --repo ... --run ... --ledger ...`는 요청받은 시점의 원격 run/jobs를 **한 번만** 조회해 운영 상태를 원장에 추가한다. 자동 polling은 없다. 최초 정상 실행 확인 뒤 전체 캠페인 감시를 다시 시작하지 않는다.

## 2. 결과 패키지

| 파일 | 의미 |
|---|---|
| `ANALYSIS.zip` | 원보고서·최종 raw SQLite·manifest/lock·원 TASKS·stage plan·선정확인 근거·실행환경·패키지/회계 요약 |
| `EVIDENCE.zip` | activation/data/report/audit의 **원 artifact ZIP bytes**를 SHA256 object로 보관. activation에 fixture와 indexed parent history 포함 |
| `SUMMARY.json` | 수집·분석자료 가용성·원 독립감사·실행완전성·원장 회계와 artifact 원경로/index |
| `COLLECTION.json` | 원격 run/attempt/jobs, 전체 artifact inventory, 해당 commit workflow bytes, 수집 오류 |
| `PACKAGE.json` | 위 네 파일의 bytes/SHA256. 전달할 때 이 파일까지 함께 보존 |

보관·이동할 단위는 위 다섯 파일이다. `objects/`는 재시도용 다운로드 cache이며 `EVIDENCE.zip` 검증 후 없어도 `verify`와 `ingest`가 동작한다. 원증거를 복원하려면 `EVIDENCE.zip`에서 `SUMMARY.json`의 `artifactIndex[].object`에 해당하는 원 ZIP을 꺼낸다. `artifactId/name/digest`와 내부 원경로가 그대로 연결된다.

`triage-payload-*`는 실행 입력의 중복 복사본이므로 개별 다운로드하지 않는다. 그 artifact ID/digest와 제외 역할은 전체 inventory에 남긴다. 원 source는 commit·manifest hash로 참조하며 소스 저장소 전체를 패키지에 재복사하지 않는다. 따라서 source까지 장기 독립 보존하려면 해당 commit의 저장소/WASM 보관도 별도로 유지한다.

### 수집이 보장하는 것

- REST 페이지 끝까지 inventory/jobs 수집, 다운로드 전후 artifact ID/digest와 attempt 변화 검사.
- 선택된 artifact별 backend SHA256, nested snapshot 파일 집합·bytes·hash 검증.
- 최종 SQLite의 원 raw/start 내용과 개별 JSONL의 일치 확인. 누락·다른 중복은 오류로 남김.
- 최초 origin/end, run/phase/manifest/call/attempt identity 보존. 재사용 phase를 새 호출로 만들지 않음.
- 원 보고서의 FAIL/INCOMPLETE/REVIEW_REQUIRED를 수정하지 않음.

이는 **전송·패키지·raw DB 일치 검사**다. witness 독립감사의 결과는 원 감사 artifact에서 읽으며 후처리가 최적성/성능을 다시 증명하지 않는다.

### 실패·재시도

- 기본적으로 완료된 run만 수집한다. `--allow-active`는 명시적 중간 스냅샷이며 항상 INCOMPLETE다. 최종 인계로 사용하지 않는다.
- 다운로드 실패는 `COLLECTION.json`과 원장의 `COLLECTION_ATTEMPT`에 남긴다. 같은 `collect --out` 재실행은 hash가 일치하는 cache를 재사용하며 solver 재실행은 없다.
- `pack --out ... --ledger ...`는 저장된 `COLLECTION.json`과 object cache를 사용한 오프라인 패키징이다.
- `PACKAGE.json`으로 봉인된 출력은 덮어쓰지 않는다. 후속 관측은 새 출력 디렉터리다. 만료/누락 증거를 대체 측정하지 않는다.
- 보고서/DB가 없어도 가용 증거의 부분 패키지는 만들 수 있다. `analysisMaterials=PARTIAL`과 원 실패·누락을 함께 전달한다.
- 도구 종료 `DONE`은 작업 완료이지 campaign 성공이나 후보 채택이 아니다. `SUMMARY.json`의 서로 다른 상태 필드를 읽는다.

## 3. 단일 원장

SQLite `events`는 hash-chain append-only이며 변경/삭제 trigger를 거부한다. 같은 종류·payload의 재등록은 중복 사건을 만들지 않는다. 조회 시 chain을 검증한다. 패키지는 원자료, 원장은 원자료의 위치·identity·회계·진행을 연결하는 기준이다.

사건 종류:

1. `RUN_REGISTERED`: launch·manifest 원문/해시. 선언된 실행과 예산.
2. `RUN_OBSERVED`: 원격 run/jobs 1회 관측. 실행 종료와 증거 완성을 혼동하지 않음.
3. `COLLECTION_ATTEMPT`: 미완료 수집의 inventory hash·오류.
4. `COLLECTION`: 검증된 패키지 위치·해시·상태, 원 plan/raw/start에 연결한 회계.
5. `LLM_ANALYSIS`: 작성자, 분석 문서 원문/해시, 근거 패키지 hash. 별도 분석 기록.
6. `DATASET_PUBLISHED`: 검증된 분석용 DB/배포 ZIP의 경로·해시, 근거 패키지와 기존 DB 보존 해시. `datasets` 상태 뷰로 노출한다.
7. `EXPERIMENT_DESIGN`: 연구설계 파일·예산 상한·근거의 해시. 미실행설계이며 실행예약으로중복차감하지않고 `experimentDesigns`로표시한다. 실제 admission/실행lock과구분한다.
8. `DATASET_RELOCATED`: 사용자 요청으로 바뀐 데이터셋·ZIP 위치와 보존 해시. 기존 출판 사건은 유지하고 생성 뷰의 `datasetRelocations`에서 현재 경로를 해석한다. 실행·측정·분석 판정을 추가하지 않는다.

현재 데이터 분류: 기초 자료는 `triage-database/minimals-all/`, `per-save/`; 정책·구현 실험은 `triage-database/triage-experiments/`, 실험 ZIP은 그 아래 `packages/`다. 기초 ZIP은 루트 `packages/`에 있다. 아래 역사적 출판 명령·봉인 문서는 당시 배치를 설명한다. 현재 경로는 루트 `COLLECTION_COMPLETE.json` 및 `triage-experiments/README_KO.md`를 따른다. `relocate_experiments.py --collection TRIAGE_DATABASE --ledger LEDGER`는 기존 6개 실험의 이동을 hash 검증·원장 기록·목록 갱신으로 마무리하는 일회성 도구다.

각 쓰기 후 `LEDGER.CURRENT.json`은 자동 재생성한다. 이 파일은 **캐시/뷰**이며 편집하지 않는다. 등록 당시 원 LAUNCH 상태와 이후 원격 관측·패키지 상태는 서로 다른 증거다. 기존 `benchmark-prepared/CURRENT.json`·`LAUNCH.json`은 역사/탐색용으로 남기고 새 상태를 병렬로 수작업 갱신하지 않는다.

### 회계 규칙

- 슬롯은 repository/campaign/invocation/callId로 합집합한다. 재사용 원행은 1번만 집계. 다른 epoch는 별도 호출이다.
- 모든 수집 사건의 알려진 증거를 합집합한다. 뒤의 부분 관측이 앞서 보존한 raw/예약을 지우지 못한다. 운영 상태는 최신 관측을 별도로 표시한다.
- raw가 없는 계획 슬롯은 `PLANNED_WITHOUT_RESULT`; start만 있으면 `UNKNOWN_START`. 이를 NOT_RUN으로 추정하지 않는다. 둘 다 예약을 차감한다.
- 알려진 호출 합계와 UNKNOWN을 같이 표시한다. 증거 누락 시 이 합계는 관측된 하한이며, 잔여 숫자를 새 실행 허가로 사용하지 않는다.
- 수집 불완전/UNKNOWN/충돌이면 `remainingCallCap=null`; `remainingCallCapUpperBound`만 표시한다. 수집된 예약에서 계산한 상한이지 미확인 실행이 없다는 증명이 아니다.
- runner 예약은 해당 commit workflow의 timeout과 jobs에서 계산한다. queued도 배정으로 포함한다. 계획됐지만 아직 job으로 나타나지 않은 matrix도 예약한다. 모르는 job은 `null`과 ID를 남기며 0시간으로 대체하지 않는다.
- parent 누적 예약 + current 예약을 계산하며 continuation 관측들의 누적값을 다시 더하지 않는다. prior 회계는 동결 provenance의 선언값임을 필드로 보존한다. 실제 경과시간과 timeout 예약시간은 다른 값이다.
- scoped CP synthetic은 원 REQUEST의 callId로 센다. 경량 unit test 실행은 이 population/CP 원장과 별도다.
- 회계 충돌/시계·cap 변경은 `conflicts`에 남긴다. 이 도구는 실행 admission을 대체하지 않는다.

## 4. LLM 정리·분석 단계 — 자동 후보 보고서 생성 금지

도구는 자료를 정리하고 근거를 검증한다. **질문별 의미 해석·반례 비교·KEEP/HOLD/REJECT는 LLM/사람이 작성**한다. 원 `REPORT.json`의 자동 통계는 입력 자료이지 최종 분석문이 아니다.

분석자는 다음 순서로 작업한다.

1. `SUMMARY.json`과 원 감사 보고서를 읽고 어떤 phase·모집단·반복이 완료/누락됐는지 먼저 적는다. 패키지 hash와 원 run/commit을 인용한다.
2. 원 질문을 복원한다: A high-d probe 생략, B hard low/mid-d 추가 probe, 완료범위·빠른 입력 회귀. 새 가설은 원 질문과 구분한다.
3. ALL을 주근거로, per-save를 보조·반례로 사용한다. 초기/선정확인/seed 진단/과거 회계를 섞지 않는다.
4. 각 주장에 inputId·phase·variant·repeat·callId 또는 artifact/member를 연결한다. 필요할 때 원증거 패키지에서 scope/IPC를 확인한다.
5. 시간뿐 아니라 완료범위·검열·CPU/메모리·seed 원인을 검토한다. timeout/OOM/NOT_RUN/UNKNOWN을 성공시간으로 대체하지 않는다.
6. 확인 측정의 **존재**와 회귀의 **확인**을 구분한다. 계측 screen과 독립 확인을 구분하고, QB051 같은 불확실성과 반례를 설명한다.
7. 결론마다 지지 근거·반례·미해결 질문·주장 가능한 범위를 적는다. 추가 측정은 결정을 바꿀 질문에 한정하고 별도 승인/동결 후 진행한다.

권장 분석문 구조: **근거/범위 → 질문별 관찰 → 반례와 불확실성 → 결정과 이유 → 남은 작업**. 필드를 채우는 것만으로 판정을 만들지 않는다. fresh 검증/제품 전체 검증을 수행한 것으로 표현하지 않는다.

```powershell
# LLM/사람이 작성한 문서를 근거 패키지에 연결. 자동으로 승인/채택하지 않는다.
python -B tools/secondary-bench/postprocess/package.py record-analysis --ledger D:\AI\sfinder-wasm\files\benchmark-ledger\LEDGER.sqlite --package D:\AI\sfinder-wasm\files\benchmark-packages\37487586383-attempt1 --file D:\chosen\ANALYSIS_KO.md --author "LLM review / reviewer-name"
```

## 검사

### 실제 정책 A/B 분석용 DB

수록 여부는 LLM이 평가한다. `policy_dataset.py --package PACKAGE --out NEW_STAGE --legacy TRIAGE_DATABASE`는 검증된 패키지에서 분석용14테이블을 작성하며 후보 결론을 만들지 않는다. `policy_facts.py NEW_STAGE`는 phase별 확인/fast/seed 기술통계를 추가한다. 원 raw·fixture·WASM·전송 캐시는 분석 DB에 복제하지 않는다. 호출별 artifact/member/line 및해시로 원증거에 연결한다.

`policy_verify.py NEW_STAGE --package PACKAGE`는 원7875행 필드·trace 대조, SQLite/JSONL/CSV 일치 및pair 관계를 검증한다. 현재 exporter/verifier는 r6 계약(580fixture/7875행) 전용이며 다른 캠페인에 묵시적으로 적용하지 않는다.

LLM이 `ANALYSIS_KO.md`, 데이터사전·AI 안내·질의 예제를 작성한 뒤, 사용자가 DB추가를 승인한 경우 `policy_publish.py --source NEW_STAGE --collection TRIAGE_DATABASE --package PACKAGE --ledger LEDGER`로 새 sibling `policy-ab-r6/`와 분석 ZIP을 봉인한다. 기존 ALL/per-save/연결DB 해시를 보존하고 출판 사건을 원장에 기록한다. 기존 직접엔진 시계열과 실제정책 A/B 시계열을 합산하지 않는다.

### H9 + 지속 CP / r8 분석용 DB

`h9_dataset.py`는 run37623263031의 검증된 attempt2-reviewed 패키지 전용이다. r6 exporter의 phase/선정 계약을 재사용하지 않는다. 최초 감사의4520행 불변과 신규120행을 대조하고, 580fixture/4640슬롯·반환/timeout IPC trace·4개contrast·자원·fixture hash연결을10테이블로 투영한다. 과거 ALL/per-save/연결DB와 r6정책DB는 보존한다.

```powershell
python -B tools/secondary-bench/postprocess/h9_dataset.py build --package PACKAGE --out NEW_STAGE --collection TRIAGE_DATABASE
python -B tools/secondary-bench/postprocess/h9_dataset.py verify --out NEW_STAGE --package PACKAGE
# 작성자가 분석/데이터사전/AI안내/README/queries.sql을 완성한 뒤 사용자 DB추가 승인에 따라:
python -B tools/secondary-bench/postprocess/h9_dataset.py publish --out NEW_STAGE --package PACKAGE --collection TRIAGE_DATABASE --ledger LEDGER
python -B tests/h9-dataset.test.py
```

새 sibling은 `h9-cp10m-r8/`, 배포 ZIP은 `packages/H9_CP10M_R8_ANALYSIS.zip`이다. 출판 사건을 append-only 원장에 먼저 등록하고 `COLLECTION_COMPLETE.json`에 탐색 항목을 추가한다. 원감사의 OOM후생략21건/INCOMPLETE는 유지한다. 공통exact와 공통full-watchdog timeout의 자원비를 분리하고, 결측을0/600초로 채우지 않는다. 이 도구도 연구결론을 작성하지 않는다. 배포본 `verify.py verify --out .`는 원패키지 없이 표준Python으로 DB/CSV/JSONL/파생pair/봉인hash를 확인한다.

### r8 OOM 원로그 복원·정적 모델 조사

OOM raw의 `execution.policyTrace`가 없어도 원artifact의fsync된 `events.jsonl`은 남을 수 있다. `oom_forensics.py --package PACKAGE --bundle FROZEN_INPUT_ZIP --out NEW_STAGE --repo REPOSITORY --collection TRIAGE_DATABASE`는r8 OOM21호출의원파일147개를SHA256/SNAPSHOT대조후복원하고,실제OOM6fixture+CP생존큰E대조8fixture의threshold/OR/linMax표현개수를계산한다. solver/model runtime은로드하지않는다. 정적전체stage개수를실제로도달한stage또는heap bytes로주장하지않는다.

`verify_oom_forensics.py --out NEW_STAGE --package PACKAGE`는DB/CSV/JSONL/복원event/원artifact bytes를대조한다. 작성자가분석문·README·queries.sql과소스비교증거를완성한후 `publish_oom_review.py --source NEW_STAGE --collection TRIAGE_DATABASE --package PACKAGE --ledger LEDGER`로새 `h9-cp10m-r8-oom-review/`와ZIP을출판한다. 기존r8봉인DB의UNAVAILABLE trace투영및역사문서는수정하지않고보조정정문서로연결한다.

검사: `python -B tests/oom-forensics.test.py`, `node --test tests/cpsat-model-shape.test.mjs`. 후자는실제JS모델builder의작은합성입력을solver spy로멈춰정적표현개수만검증한다. WASM/실제solver호출은0이다.

### r9 CP 단계별 메모리 진단

설계는 `planning/CP_MEMORY_R9_20261009_KO.md`. 공통 하네스가 4입력×2arm의 새 phase `CP_MEMORY_R9`를 실행한다. 후처리는 종료된 5파일 패키지를 받은 뒤 `cp_memory_report.py --package PACKAGE --out NEW_STAGE`로 수행한다. 원artifact/SNAPSHOT의 `memory-PID-threadId.jsonl`을 대조해 SQLite/CSV/JSONL과 호출별 단계 관측값을 만든다. 이 도구는 OOM 원인 판정을 작성하지 않는다.

`verify_cp_memory.py --out NEW_STAGE`는 표·원로그·검열 상태를 solver 없이 검증한다. 최종 작성 분석과 함께 봉인한 배포본에서는 `verify.py --out .`로 사용한다. RSS는같은process의worker마다공유하는값이므로합산하지않으며,마지막native marker만으로presolve/LP/search내부원인을확정하지않는다. r8과계측시간을직접성능비교하지않는다.

실제 완료 실행은 phase CP_MEMORY_R9의revision10/run37886233804다. r9/run37815474702는composite출력누락으로실자료미시작이며별도보존한다. 저자분석을작성하고원장에등록한뒤 `publish_cp_memory.py --source NEW_STAGE --collection TRIAGE_DATABASE --package R10_PACKAGE --failed R9_PACKAGE --ledger LEDGER`로보조DB와`CP_MEMORY_R10_COMPLETE.zip`을출판한다. ZIP에는저자분석/SQLite/CSV/JSONL/원메모리로그와두실행의5파일증거패키지가함께들어간다. 기존DB해시는보존한다.

### r11 compact OR 비교

`cp_memory_report.py`는 별도 phase `CP_COMPACT_R11`/revision11도 지원한다. `compare_cp_memory.py --before SEALED_R10 --after NEW_R11 --out NEW_R11/comparison`은 원fixture hash/arm별 8슬롯을 연결하고 호출 상태·관측 CPU/peak·단계별 marker를 정리한다. 두 revision 모두 EXACT인 경우만 완료시간 비율을 계산한다. OOM/ERROR/NOT_RUN을 timeout이나 성공시간으로 대체하지 않는다. 순번상 같은 marker여도 levels와 도달 여부를 함께 확인한다. 관측 CPU/peak는 다른 실행길이의 전체 자원비이지 동일구간 인과효과 추정이 아니다.

봉인된 r10 디렉터리를 `NEW_R11/comparator-r10`으로 복사하면 `verify_cp_memory.py --out NEW_R11`이 두 DB·원로그·비교표·누락 marker를 검증한다. 기존 r10 파일을 수정하지 않는다. 저자 분석·README·queries.sql을 완성하고 원장에 기록한 뒤 `publish_cp_compact.py --source NEW_R11 --collection TRIAGE_DATABASE --package R11_PACKAGE --comparator R10_PACKAGE --ledger LEDGER`로 `cp-compact-r11/` 및 `CP_COMPACT_R11_COMPLETE.zip`을 출판한다. ZIP은 두 분석 데이터셋과 두 실행의 각5파일 증거패키지를 포함한다. 실패 감사도 원상태로 보존한다. 검사: `python -B tests/cp-memory-report.test.py`.

### r12 CP033 native 실패 원인 진단

`cp_memory_report.py`와 `verify_cp_memory.py`는 별도 `CP_FAILURE_R12`/revision12의 원033 CP_OPEN 1회도 지원한다. `FAILURE_FACTS.json`은 `verify_cp_memory.failure_facts(samples)`가 원 event에서 추출한 성장 거부/예외 및 artifact/member/line 참조이며 원인 결론은 저자가 작성한다. `wasm_static_facts.py`는 바이너리를 실행하지 않고 imported memory 한계와 tag/export를 읽는다.

저자 분석·README·queries.sql 작성과 원장 `record-analysis` 후 `publish_cp_failure.py --source NEW_R12 --collection TRIAGE_DATABASE --package R12_PACKAGE --ledger LEDGER`로 `cp-failure-r12/` 및 `CP_FAILURE_R12_COMPLETE.zip`을 봉인한다. r12 분석/5파일 증거와 기존 r11 통합 ZIP의 동일 bytes를 포함한다. kernel OOM과 WASM 성장 거부를 구분하고, 역사적 ERROR/감사 FAIL은 유지한다. r12 조사는 원인 경로 확인 후 종료했으며 추가 실행은 예정하지 않는다.

### A fast-path 원인 분석·후속 설계

`fast_path_review.py --dataset POLICY_DATASET --out NEW_REVIEW`는기존fast pair의init/packing/trace구간을분해한다. 반환trace없는구간은null이고,구간차이를원정책시간에서차감하지않는다. 서로다른comparator의baseline비교는인접무작위대조가아닌변동참고자료다.

`plan_fast_followup.py --dataset POLICY_DATASET --ledger LEDGER --out NEW_DESIGN`은A/BASELINE×trace ON/OFF와baseline sham 연구설계를작성한다. **실행manifest가아니며승인·dispatch하지않는다.** `verify_fast_review.py --dataset POLICY_DATASET --review NEW_REVIEW`는`NEW_REVIEW/followup-design`의선정·call순서·chunk·예산과기존pair구간을검산한다. 분석결론은LLM이별도작성하고원장에연결한다.

`python -B tests/secondary-result-package.test.py`

합성 artifact만 사용해 ZIP/DB 변조·start 누락·단일 원장 재등록·UNKNOWN·예약 중복차감 방지를 검증한다. 실제 종료 run 수집 검증과 구분한다.

## R18 linMax RC2 출시 검증

공통 `package.py collect`는 R18의 원 `RAW.sqlite`/동일 artifact 안의 REPORT,
78worker/plan/audit workflow 예약을 지원한다. 원 DB에 starts 표가 없으므로
별도 saved starts를 모든 raw 필드와 직접 대조한다. 392시간 동결 선언에는 별도
10분 contract job이 포함되며, R18 run 자체의 예약은391시간50분이다.

`rc2_review.py --package PACKAGE --out NEW_REVIEW`는5파일봉인과860artifact를 검증·복원해
원전용독립감사를 solver 없이 다시 수행한다. `rc2_facts.py --audit AUDIT_DIR --out NEW_FACTS`는
1560call/780pair와 모집단·바퀴별 기술통계를 만든다. 실패600초벌점은 민감도점수이며
실제완료시간 추정이 아니다. 저자판정은 `planning/RC2_R18_ANALYSIS_20261013_KO.md`에 있다.
인계본 `verify.py`는 `verify_rc2_handoff.py` 사본으로오프라인hash/DB/pair/원증거를검사한다.
