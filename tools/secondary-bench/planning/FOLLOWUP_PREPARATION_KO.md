# F/A 실행 직전 준비 — Sol / Build

2026-10-05 · **checkpoint 재전송 보완 / 사용자 실행 승인 / 원격 사전검사 포함 실행 예정**

> **첫 원격 실행의 clock Bash 오류 교정:** F `37277545146` / A `37277545174`의 실제 Linux OOM 계약은 통과했지만 matrix clock의 `node -p Date.now()`가 Bash syntax 오류로 실패했다. F59개/A1개 실자료 job 모두 checkout 전에 실패하여 dataset 호출은0이다. [교정 감사](CLOCKFIX_AUDIT_20261005.json)와 원run/log를 보존했다. 실행본은 `prepared-20261005-clockfix/{F_TEMPLATE.json,A_TEMPLATE.json}`이며 `node -p 'Date.now()'`로 수정했다. 실제 Bash에서7개clock명령을 실행하는 계약을 추가하여 로컬76/76 통과. 새run을 쓰되 원origin **2026-10-05T07:24:17Z**와 F36h/A108h, VM/threads/반복/timeout을 유지한다. 아래 준비 시점의 미실행 문구는 과거 상태다.

현재 사용자 지시를 반영한 실행 계약이다. 새 분류기·제품 solver는 구현하지 않는다. 원본 `dev-branch`, GitHub `main`, 기존 측정 raw는 변경하지 않는다.

## 두 workflow와 자원 계약

| 자료군 | workflow | 병렬 VM 상한 | wall 안전 경계 |
|---|---|---:|---:|
| F: 기존 잔여 미노 필터 행렬 보완 | `.github/workflows/secondary-bench-followup-f.yml` | 8 | run 생성 시각부터36시간 |
| A: 일반 minimals saves=ALL | `.github/workflows/secondary-bench-all-a.yml` | 12 | run 생성 시각부터108시간 |

- **두 workflow 동시 실행, 합산 최대20VM**. 이전 공통16VM 지침에 대한 이번 F/A 캠페인의 사용자 지정 예외다. 과거 캠페인의16VM 계약은 변경하지 않는다.
- 각 workflow 안의 activate/plan/measure/report는 의존성으로 순차 연결되므로 planner/report VM을 matrix 상한에 더해 겹쳐 실행하지 않는다. F/A의 concurrency group은 서로 다르고, 같은 자료군의 중복 실행은 직렬 대기한다.
- CP-SAT primary **기본2 solver worker**, CP-SAT secondary **1 worker**, Rust/HiGHS **1 worker** 유지. 제품 source·WASM을 기존 Git/Linux bytes와 대조했다. primary adapter의 `await worker.terminate()` 및 capture 프로세스 회수 후 별도 secondary 프로세스를 실행한다.
- 2는 CP solver 설정이며 전체 OS thread 수가2라는 주장은 아니다. secondary-only 시간과 primary/열거/직렬화 시간을 분리한다. 명령 전체 비용에는 primary2-worker 비용이 포함된다.
- 36/108시간은 최악 block·setup·업로드·실패checkpoint 재전송을 수용하기 위한 유한 wall 경계다. 28/90h 준비본에 final flush15분/전송audit3분을 추가 예약한 실행본이다. 시간이 남는다는 이유로 반복·timeout을 추가하지 않는다. queue·VM 유실 때문에 전셀 완료를 보장하는 값도 아니다.
- [오프라인 최악예산 검산](FOLLOWUP_WORST_CASE_BUDGET.json): VM당 setup10분 + task별checkpoint2분(최대6분) + final flush15분/audit3분 + stage planner각90분 + activate15분/report90분을 포함한다. 모든checkpoint가 재전송경계를 사용한다고 가정한 보수적 상계이며 실제 queue 포함 원clock에서36/108h를 넘으면 새block을 입장시키지 않는다. 인프라대기시간은 유한보장하지 않는다.

## 동결한 입력·반복

### F

- 미capture55group의110개 per-save명령, enumeration60초 / primary60초-save.
- 새 명령의 사전hash 선별save 최대110개 + BOX9개와 특징범위밖15개의 **실제 합집합23개**. 새 기본 측정 최대133행렬 ×3엔진 ×2회 =798호출.
- 제한60초. 엔진×fixture별 기본2회 모두exact이고 max/min≥1.10인 경우만 별도2회 재검사(최대798호출). timeout/OOM을 완료시간으로 대입하지 않는다.
- 별도 RECOVERY **191호출**, 원300초·K·seed·행렬 유지. I OOM행렬 자체의 미실행45개는 재시도하지 않는다. 기존236개NOT_RUN 원기록은 유지한다.
- 과거 fixture45개를 원bytes/base64로 봉인한16,502,960-byte gzip을 준비했다. 압축 SHA256 `ad63a51003764b77ae1a0cac055ecae6d390f744ea29170cb74d0021a89a7811`. matrix 입력과 출처만 포함하며 과거 실행 결과를 새 호출로 넣지 않는다.

### A

- 전체275mirror group ×bag계열/restricted-split 두family =550명령. `kind=minimals`, `wantedSave=ALL`, clear4/hold=true/N+1/exact 명시. BOX 포함, independent-split 제외.
- 먼저 BOX2명령에서 하네스와 제품 `collectCompactMinimals`의 canonical case/key/weighted-quality 행을 대조한다. 미실행·실패이면 전체capture를 차단한다. preflight는 시간표본이 아닌 진단이다.
- enumeration60초 / primary300초. 증명된 모든nontrivial ALL행렬의 세 엔진을300초·각2회 측정(최대3,300호출). 같은조건 변동항목만 추가2회(최대3,300호출).
- primaryHard로 Integrated를 미리 제외하지 않는다. primary미완료·empty·trivial을 전체분모에 별도 기록한다. 기존per-save d17 규칙은 적용하지 않는다.

## 실패 격리·job·artifact

- 호출마다 새로운 systemd service에 **MemoryMax3GiB / Swap0 / OOMPolicy=stop / KillMode=control-group / RuntimeMaxSec**를 설정한다. scope 안에는 supervisor+solver child+하위CP/Worker가 함께 들어간다.
- 바깥 runner는 OOM scope에 속하지 않는다. 해당 엔진×fixture의 남은 반복만 NOT_RUN_AFTER_OOM으로 남기고 T/CP 및 이웃fixture는 새로운scope에서 실행한다. 회수 불확실·프로토콜/정확성 오류는 해당chunk를 중단한다.
- task마다 전체block을 입장 심사한다. job당 최대3task, 계산soft125분(마지막5분보존), GitHub hard150분. packing 용량은 **125−5−setup10−checkpoint6 =104분**이다. A최대550개의34분block을184chunk로 나누므로256matrix 제한과6시간job 제한을 넘지 않는다. setup10분/업로드각2분/세block102분을 포함한118분의 모의시계 검사에서18호출 전부 입장했다. 이전105분 입장마감에서 세 번째block이 빠지던 결함을 수정했다.
- task 사이에 부분raw/fixture/lock/log를 checkpoint한다. 정상timeout/OOM은 측정상태이지 Actions 실패 사유가 아니다. platform hardkill·VM유실의success는 보장하지 않으며, 최종보고서가 missing/harness/witness 오류를 별도 판정한다.
- planner가 **chunk별 payload**를 SDK로 업로드하고 정확한artifact backend ID+SHA256을 matrix에 전달한다. 각 VM이 전체550개fixture를 반복 다운로드하지 않는다.
- 결과/계획 history는 REST전체pagination+현재run backend-ID 다운로드로 확인한다.1,000artifact listing cap을 사용하지 않는다. 원raw파일/1-based-line 연결을 보고서에도 보존한다.
- 새F/A history는 한 번에 하나의 압축ZIP만 SDK의 `skipDecompress`로 내려받는다. SHA256 검증 후 ZIP중앙목록의 실제 비압축총량+블록오버헤드를 검사하여 **추출 후에도4GiB 여유가 남을 때만** 추출한다. 순회경로/중복멤버/symlink를 거부한다. 성공한 임시ZIP만 삭제하고 실패ZIP·DOWNLOAD_INDEX/COMPLETE 진단은 남긴다. 옛 캠페인 transport에는 이옵션을 적용하지 않는다.
- planner payload는 동일filesystem의 capture fixture와 **hardlink**로 연결한다. cross-volume 등의 fallback 복사는 개별disk 입장검사를 통과해야 한다. `STORAGE_ADMISSION/COMPLETE.json`에 계산치와 복사/링크 수를 기록하고, 작은lock/chunk metadata의 추가공간도 예약한다.
- 실제550개 ALL fixture 총량은 아직 알 수 없다. 남은disk를 초과하면 전체history를 유효한것으로 취급하지 않고 진단과 원격artifact를 남긴 채 중단한다. 공간부족을 이유로 입력이나fixture를 몰래 샘플링하지 않는다. **디스크guard는 안전 중단 보장이지 전체550개 완료 보장이 아니다.** planner/report hard90분도 동일하다.
- activate는 초기환경·디스크스냅샷, pipefail을 유지한 계약검사/활성화로그, 실제Linux scope의 REQUEST/CALL_LOCK/이벤트/결과를 독립 `followup-activation-diagnostics` artifact에 `always()`로 올린다. campaign lock 생성 전 실패해 report가 생략되어도 진단은 보존한다(플랫폼 VM유실/hardkill은 별도한계).
- 각task checkpoint는2분제한과 continue-on-error를 유지하되, SDK호출 전 durable PENDING receipt와 immutable 파일별SHA256 snapshot을 남긴다. **종료 전15분 final flush가 FAILED/PENDING checkpoint만 각각최대2회 재전송**한다. UPLOADED는 제외하고, 기존bytes 변경은 거부한다. solver호출·반복·clock은 추가하지 않는다. artifact ID/digest/실패사유/terminal상태는 독립3분 audit artifact로 보존한다. 재전송까지불가하면 UNDELIVERED/PENDING으로 기록하며 성공을가정하지않는다. 네트워크전체장애·VM유실의무손실보장은하지않는다.
- 업로드는성공했지만ack를잃은경우같은raw의복수archive가남을수있다. 동일TRANSPORT_SNAPSHOT 및 전체raw SHA256과각line bytes가 일치하는경우만 원본/alias포인터를모두유지하고실행count는1회로계산한다. 다른checkpoint/다른bytes의같은callId는여전히오류다. 최종report는transport receipt 누락·미전송을 별도표시한다.

## 데이터 보완과 검사

- exporter의 `wave_decisions.engine` 누락을 수정하고 유일key를 검증했다.
- 로컬 `benchmark-results/classifier-raw-20261005-v2`로 신규export를 생성했다. 기존v1/ZIP은 변경하지 않았다. 2,685fixture /21,778call /9,270decision을 유지하고 commandKind/filter 의미, primaryHard/kernel/backend, tinyEligible, Ruststates를 연결했다. CP0states는 UNOBSERVED로 표시한다.
- 별도 Python CSV/JSONL/hash/원plan 대조에서9,270decision의 engine·eligible·reason·repeats를 확인했다. 이는 오프라인 보완이며 새 성능 측정이 아니다.
- 로컬 계약·관련 제품회귀 **74/74 PASS**. 추가검사는 최악시계의세task실행, disk/hardlink/fallback, 실제Python ZIP의disk부족/경로공격 거부, plan 생성 전실패진단보존, 실패checkpoint만재전송/ack유실alias대조/변경bytes거부와미전송표시다. 실제솔버 호출은 작은합성검사뿐이며 실셋업 성능벤치는 실행하지 않았다.
- actionlint1.7.12에서 두workflow PASS(shellcheck/pyflakes 비활성). 실제입력은 사용하지 않은 mocked-history planner dry run: Fcapture37chunk/110명령, A BOX1chunk/2진단, Acapture184chunk/550명령. 모든 ALL550개의 기본block matrix분할도 합성계약으로 검증했다.
- 보완 후 전체550개 합성ALL행렬을 실제planner에 넣어3,300호출/184chunk의 payload 생성까지 검증했다. `STORAGE_COMPLETE`의 hardlink550개/fixture 복사0byte를 확인했다. F원fixture45개도 재사용payload로 다시검증했다. 이dry run은 solver호출0/원격실행0이며 fixture총용량 성능예측 자료가 아니다.
- **Linux의 실제3GiB OOM 격리와 원격artifact 업로드는 아직 미실행**이다. 두workflow의 activate 단계에 실제 Linux owned-scope 계약검사를 넣어, 통과 전에는 캠페인이 시작되지 않는다. 로컬mock 성공을 원격PASS로 부르지 않는다.
- F는 큐의 잔여한미노 필터 자료다. 일반saves 식의 마지막bag 미추첨미노 의미와 다른경우가 있으므로 `saves=T`로 일괄소급label하지 않는다. 동등성 연결은 canonical 행/키/품질과 K/seed계약을 확인한 범위에 한정한다.

## 시작 방법 — 지금은 수행하지 않음

준비파일: `tools/secondary-bench/prepared-20261005/{F_TEMPLATE.json,A_TEMPLATE.json,READINESS.json,F_ORIGINAL_FIXTURES.json.gz}`.

1. 승인된시점에 정확한준비source를 실험branch에 게시한다. 이때 기존preflight가push로실행될수있으므로 종료를확인한다. **이번준비단계에서는push하지않았다.**
2. 등록된workflow면 두파일을같은ref로각각dispatch한다. 서로다른workflow이므로동시에진행한다.
3. main에파일을등록하지않고첫실행이필요하면 **marker-only 별도commit**에 `.github/secondary-followup/F_START.json`, `A_START.json` 두파일을넣고한번push한다. 각marker는 다음필드가필요하다:

```json
{"confirm":"RUN_APPROVED_FOLLOWUP","dataset":"F 또는 A","templateSha256":"해당 TEMPLATE.json의 SHA256","sourceLock":"READINESS.json의 sourceLock"}
```

이 전용path만새workflow를시작하며기존tools광범위preflight를함께시작하지않는다. **marker-push 경로에서는** source/hash가다르거나marker가없으면activate가거부한다(manual dispatch는별도명시적시작경로다). **현재시작marker는존재하지않는다.**

첫실행attempt만허용한다. 완료값을교체하는rerun/clock reset은하지않는다. transport오류등하네스오류는원clock·원예산·원자료를보존하는별도교정계약으로처리한다. 새source로구성한F/A를옛캠페인의재개로부르지않는다.

## 현재 경계

독립실험branch의로컬준비물만완성했다. 원격dispatch/push·시작marker·실셋업벤치·새제품라우팅은없다. fresh 검증자료공백은여전히남아있지만개발측정준비를막지는않는다.
