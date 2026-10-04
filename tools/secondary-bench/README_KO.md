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
