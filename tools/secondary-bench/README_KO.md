# Secondary 3엔진 측정 하네스

작업 branch: `experiment/secondary-routing-20261005`.
baseline: `7ef62d18e1d155b6479e00d651c851ff3baa7112`.
제품 `src/`, Rust, 설치 WASM은 변경하지 않는다. 하네스·DB 복사본만 추가한다.

## 현재 구현 범위

- `catalog.mjs`: 세 DB 전체 디코딩, 실제 보드·mirror·가능한 clear/미노 수 감사. 탐색 없음.
- `import-history.mjs`: 명시한 과거 자료의 노출을 보수적으로 연결. 전체 감사 전에는 미확인 group을 fresh로 표시하지 않음.
- `propose-inputs.mjs`: 성능과 무관한 개발/보류 분할·pattern·명령 초안 생성. **DRAFT이며 실행 계획 아님.**
- `extract.mjs` / `capture.mjs`: 제품 열거·save 규칙과 exact primary를 사용하고 secondary 직전 원행·K·seed를 확보. primary-only 캡처를 exact secondary 결과로 표시하지 않음. 행렬별로 즉시 저장해 뒤쪽 primary timeout에도 앞 결과 보존.
- `child.mjs` / `isolation.mjs`: 호출당 독립 Node 프로세스, exact 품질, 직접 세 엔진 실행. Rust는 state cap 없이 호출하며 외부 wall deadline 사용. CP는 현행 CP 모델·1-worker 설정과 별도 내부 제한 사용.
- `campaign.mjs` / `plan-wave.mjs` / `run-chunk.mjs`: 최신 60초·2회씩 최대10회·6h 추가 admission/8h runtime controller. 같은 행렬의 한 2회 블록은 같은 VM에서 엔진별 직렬 실행. 추가 블록은 다른 VM일 수 있으며 runner ID를 구분한다. `run.mjs`의 고정횟수 방식은 초기 어댑터로 남아 있고 신규 campaign에서는 사용하지 않는다.
- `select-retests.mjs`: 정보 수집의 변동 선별, A/B의 양쪽 tail·변동·gate 영향 합집합 선별. gate 영향 알고리즘은 캠페인별로 별도 동결해야 함.
- `analyze.mjs`: 최초 원자료를 보존하며 정보 수집 재테스트 목록·실패 원장·cross-engine witness 비교 생성.
- `audit.mjs`: child 검산 결과를 믿지 않고 fixture bytes·원행 witness·raw/schedule를 다시 검산. 일반적인 독립 optimality oracle과는 구별함.
- `source-lock.mjs`: 실제 source·asset·DB·하네스 파일 hash 기록.
- `report-campaign.mjs`: 최초2회 변동 진단과 사용자 지정 추가 반복을 분리하고, 캡처 누락·부분 job·OOM·독립 witness 검산을 보고한다.

현재 lifecycle은 **fresh-process-cold**다. 명령 전체·pool 대기·브라우저 비용을 대표한다고 주장하지 않는다. 후속 실제 Auto/후보 정책·minimals end-to-end는 별도 실행 어댑터와 측정 계약으로 확장한다.

## timeout과 회수

`startupMs`, `callMs`, `reapMs`는 모두 필수·양의 유한 값이다. CP는 `cpLimitMs`도 필수다. 캡처는 enumeration·save별 primary의 독립 phase limit도 필수이며 전체 command deadline은 phase 전환으로 초기화되지 않는다.
부모가 동기 WASM과 독립적으로 감시하고 Windows는 소유 child에만 `taskkill /T`, Linux는 소유 process group에만 SIGKILL을 사용한다.
정상 반환 후 cleanup이 멈추면 reap 한도 뒤 강제 종료하고 다시 유한 한도 안에서 join한다. 최악 호출 비용은 `startup + call + 2×reap`로 계산한다.
timeout·회수 실패·incomplete를 exact 시간으로 집계하지 않는다. 회수 실패 시 다음 호출을 시작하지 않는다.

`responseMs`: child 호출 진입부터 엔진 반환까지(입력 read·init·packing 포함).
`callWallMs`: parent에서 child 작업 요청부터 결과 수신까지(검산·child cleanup·IPC 포함).
`wallMs`: 프로세스 생성부터 종료·회수까지.
Rust native 준비/탐색의 개별 비용, calling-thread CPU와 process-tree peak memory는 현 ABI에서 `UNOBSERVED`다. wrapper+native+search 합산 시간으로 기록한다.

Linux 실측 CLI는 cgroup v2의 **shard 전체 process tree ≤3GiB / swap 0**을 확인한다. parent+한 child+CP thread를 함께 제한하는 더 엄격한 scope이며 child만의 제한이라고 보고하지 않는다. `memory.events`의 oom_kill 증가를 OOM으로 구분하며 부모까지 죽은 경우 scope exit·COMPLETE 누락으로 남긴다. Linux 연결은 원격 preflight에서 확인해야 한다.

## 경량 계약 검사

```powershell
node --experimental-wasm-stack-switching --test-isolation=none --test-concurrency=1 --test tests/secondary-bench.test.mjs tests/secondary-bench-campaign.test.mjs
```

작은 합성 행렬에서 실제 세 엔진과 독립 JS oracle 비교, 원행 가중치·stable IDs·seed identity, Fast 거부, 무한 deadline 거부, 중단·중첩 Worker 회수, 후속 요청, 제품 collector와 추출 경로 비교를 확인한다. 로컬 테스트 시간은 성능 근거가 아니다.

`secondary-bench-preflight.yml`은 새 branch만 대상으로 하는 계약 검사 workflow다. 실측은 `secondary-bench-campaign.yml`이며 APPROVED_TEMPLATE/source lock 없이는 시작하지 않는다. 새 workflow가 default/main에 없어서 dispatch에 의존할 수 없으므로, **실험 branch에서 `planning/APPROVED_CAMPAIGN_TEMPLATE.json`을 명시 게시하는 push**도 trigger로 지원한다. 이 파일은 아직 없다. 공통 concurrency group으로 preflight와 campaign을 겹치지 않는다. 최대 16 측정 VM이며 계획·보고 job은 측정 단계와 겹치지 않는다.

실험 branch의 [Linux preflight 37221479350](https://github.com/Qnia28/sfinder_wasm/actions/runs/37221479350): 일반23/23·실제cgroup24/24 통과. [`planning/REMOTE_PREFLIGHT_RESULT.json`](planning/REMOTE_PREFLIGHT_RESULT.json)에 commit/job/artifact provenance를 기록했다. 전체 wave 실행·checkpoint 복구·실제 의도적 OOM까지 증명한 것은 아니다.

## 결과 보존과 Actions 상태

최대4 task/job, task당 2회×최대3엔진=최악8분. 캡처도 command당 별도 task다. 각 task 뒤 즉시 artifact checkpoint를 업로드하고 다음 task를 실행한다. 정상 timeout은 raw fsync·ms=null·exit0으로 남긴다. 회수 실패/불일치/저장 오류/OOM은 chunk를 격리하지만 Actions transport 성공과 검산 PASS를 혼동하지 않는다.
Job hard60분, task scope hard10분, task step11분·artifact2분. 계획상4 task의 계산 최대32분이며 준비/4번 업로드 여유를 둔다. campaign은 workflow created_at부터 캡처·대기·재시도를 포함한 단일 시계다. 8h 종료 전에 업로드용5분을 예약한다. 플랫폼 강제취소/VM 유실/업로드 서비스 장애에서 success나 아직 업로드하지 못한 마지막 task 보존까지 보장하지는 못한다.
전체 workflow의 자동 재실행은 activate에서 막는다. 같은 run을 rerun해 이미 완료한 호출을 새 결과로 교체하지 않는다. 끊긴 실행의 후속 복구는 보존한 campaign origin·원자료를 검토한 뒤 별도 승인된 미완료 일정으로만 진행한다. GitHub 서비스의 queue 지연/강제취소 때문에 dashboard상 최종 보고·업로드 종료까지 정확히8h 이내임을 보장할 수는 없으며, 계산 admission/종료 예산과 플랫폼상 run 지속시간을 따로 기록한다.

## 실측 전 필요한 합의

사용자가 지정한 범위는 두 family·N+1/N+2 중 하나·timeout60초·2회씩 최대10회·6h 추가 admission/8h runtime이다. 수정 제안은 N+1만 사용한 440 command이며 save 필터 표본은 별도 문제다. `ONE_PER_COMMAND_HASH`는 board 폭을 유지하기 위한 준비판의 행렬 선별안이다. 전체 save를 실측했다고 주장하지 않는다. 전체 노출 감사·source freeze·원격 preflight 후 template를 APPROVED_TEMPLATE로 바꾼다.
승인 provenance와 hash 고정이 없는 DRAFT manifest는 CLI가 거부한다. [측정 제안](planning/MEASUREMENT_PROPOSAL_KO.md)을 바탕으로 논의한다.

정확성 상태는 witness 유효성·엔진 exact 주장·독립 proof를 구분한다. cross-engine 일치만으로 모든 primitive가 독립이라고 주장하지 않는다.

## source byte 주의

원본 저장소의 Windows checkout은 core.autocrlf=true여서 제품 text bytes는 Git blob/Linux checkout과 CRLF/LF가 다르다. 로컬 SOURCE_LOCK은 로컬 계약 검사의 실제 bytes snapshot으로 보존하며 Linux campaign lock으로 그대로 쓰지 않는다. 제품 파일을 변환하지 않고 Linux 실제 checkout에서 다시 source freeze해야 한다. 새 하네스·DB·문서·원자료는 `.gitattributes`의 범위 제한 -text로 byte와 SHA256을 보존한다.

## 승인된 후속 5분 run

사용자 후속 지시로 첫run완료뒤 **300초/4→8→12→16→20회**, 추가block admission<5h/전체6h 캠페인을 별도로 실행한다. 첫run에서선정한309행렬의bytes/hash·원행·K·seed·stable IDs를그대로재사용하며첫run시간을후속반복에넣지않는다. 이전두회timeout 제외규칙은 engine×fixture별로유지한다.

5분timeout에서3엔진×4회블록의최악예약비용은64분이다. 따라서한task scope70분/step71분, job≤2task(최악128분)/hard160분으로조정한다. task마다checkpoint3분을예약하며동시VM16은유지한다. 각round는최대155job이며job의6시간제한보다작다. 최초run끝나기전후속시계를시작하거나source를바꾸어원run을rerun하지않는다.

후속trigger는실험branch의`planning/APPROVED_EXTENDED_TEMPLATE.json`명시게시다. activate는첫run.status=completed를검사한다. `combined-report.mjs`는두run을하나의보고서로작성하되60초와300초의조건별통계·timeout·반복·누락을분리하고cross-run exact witness일치를검사한다. 두조건시간표본을무조건pooling하지않는다.

## 실행 하네스 교정: artifact1000 제한

첫run은1376artifact를보존했지만기본download action의1000목록제한으로후속repeat eligibility/최종보고에서일부history가누락됐다. 원raw/fixture는소실되지않았다. 전체1368result archive를페이지끝까지조회·SHA검증하여다시감사한결과기본누락0/witness문제0, EXACT5118/TIMEOUT180/CAPTURED440이었다. 초기보고서는부분목록결과이므로최종판정에사용하지않는다.

최초5분launch `37225619701`도원fixture-lock검증이이누락을잡아measure job전부skip했고,실제solver호출은0이다. 반복적인cross-run440개zipREST다운로드에서secondary rate-limit까지발생했다. 교정은두가지다: (1)현재run은REST전체페이지로ID만조회하고SDKbackend ID로직접다운로드(1000cap/RESTfan-out없음); (2)과거run은동결한309fixture가들어있는단일`secondary-plan-2`bundle만다운로드하고hash검증한다.

복구run은원5분launch의origin `2026-10-04T18:44:56Z`를보존한다. 교정시간도6h예산에포함하며재시계시작을하지않는다. 최초run의막힌추가반복을완료했다고주장하지않고실제로기록된반복수/선별오류를최종보고에명시한다. 첫run원raw시간을새값으로교체하지않는다.

`artifact-action`은측정도구전용MIT `@actions/artifact6.2.1`과lockfile을사용하며제품package/source/WASM을변경하지않는다. SDK는custom Node24 action으로실행해backend runtime-token을획득한다. 설치디렉터리node_modules는git/source lock에서제외된다.

## 완료된 통합 보고서

- 보고서: [`planning/FINAL_COMBINED_REPORT_KO.md`](planning/FINAL_COMBINED_REPORT_KO.md)
- 단일 JSON 부록: [`planning/FINAL_COMBINED_REPORT.json`](planning/FINAL_COMBINED_REPORT.json)
- 60초 run `37222172267`: 실제 secondary 5,298회 / exact 5,118 / timeout 180. capture 440명령 모두 완료, 기본 누락0. 추가 선별의 artifact1000 제한은 보고서에 별도 명시했다.
- 300초 복구 run `37226653891`: 실제 secondary 16,244회 / exact15,976 / timeout253 / OOM15. OOM 뒤 격리로 기본236회 미실행. 20회에 도달한 engine×fixture 조건798개.
- 합계21,542회/원 가중치 witness 검산21,094회. 두 run의 선택 ID·quality hash 불일치0, 저장 raw 교체0. 60초 전부-timeout→300초 exact9조건.
- 후속 origin18:44:56Z 보존/종료23:26:01Z, 4h41m05s. 두 run 동시 job 최대16, 후속 최장 job120m19s<160분hard<6h.
- 제품 라우팅 변경/성능 PASS는 없다. 시간 표본은60초/300초, 기본/추가를 분리했고 timeout/OOM/미실행은 exact 시간에 넣지 않았다.
- 현재 보류55그룹은52노출가능/3미확인이다. fresh 후보 검증에는 추가 미노출 setup/fumen 출처가 필요하다.

오프라인 재생성(저장해 둔 전체 result history 및 wave plan 필요):

1. `audit-campaign-execution.mjs <campaign.json> <full-history> <all-wave-plans> <immutable-commit> <새 audit.json>`: source bytes·원계획·clock·메모리/runner·censored 상태 감사. solver 호출 없음.
2. `combined-report.mjs <첫 plan> <첫 history> <후속 plan> <후속 history> <새 combined.json> <새 combined.md> <notes.json>`: fixture/product 계약 동일성 및 모든 exact witness 재계산, 조건별·기본반복 matched 비교.
3. `publish-combined-report.mjs <첫 campaign-root> <후속 campaign-root> <새 출력 directory>`: `COMBINED_REPORT_FINAL.json`·download digest·실행 감사·VM 감사·노출 summary를 검증하여 최종 문서/JSON을 생성.

산출물은 기존 파일을 덮어쓰지 않으므로 재생성은 새 출력 directory를 사용한다. `information-analysis.mjs`는 완료된 최초 기본 반복에만 matched ratio를 계산하며 격리된 다른 엔진을 loser로 세지 않는다. 로컬 계약·제품 회귀52/52 및 actionlint1.7.12 통과(성능 측정 아님).

## 분류 기준용 개별 raw join

[`planning/CLASSIFIER_RAW_DATA_KO.md`](planning/CLASSIFIER_RAW_DATA_KO.md)에 원자료 위치, n/K/R/E/F/d/u 정의와 읽기 예를 정리했다. 로컬 `benchmark-results/classifier-raw-20261005/calls.csv`는 setup(fumen)×pattern×save×engine×timeout×repeat별 21,778개 원기록(실제21,542+미실행236)을 구조값과 join한 데이터다. `fixtures.csv`에는 capture한 모든 save 행렬2,685개와 selected309개 구분이 있다. CSV/JSONL과 각 호출의 원 raw 줄 연결을 모두 독립 검사했다.

압축 묶음은 `benchmark-results/classifier-raw-20261005-joined-tables.zip`이다. 이는 읽기 쉬운 join 파일/사전/인덱스 묶음이며 원 matrix 및 전체 witness/log ZIP을 대체하지 않는다. 원 data와 큰 join 파일은 gitignore된 로컬 파일로 보존한다. `export-classifier-raw.mjs`로 solver 실행 없이 새 폴더에 재생성할 수 있다. 기록된 F가 unknown인 all-candidates shortcut도 원 singleton 스캔으로 별도 계산하고 capturedF/d/u의 null은 보존한다.

분류용 export 추가 뒤 계약·제품 회귀54/54 통과. 출력 hash 및 독립 CSV/JSONL/원 raw pointer 검증 결과는 [`planning/CLASSIFIER_RAW_DATA_INDEX.json`](planning/CLASSIFIER_RAW_DATA_INDEX.json)에 기록했다. 큰 CSV/JSONL 자체를 source tree에 게시한 것으로 오해하지 않는다.
