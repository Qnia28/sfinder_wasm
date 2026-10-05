# 공통 측정 하네스 v1

확정 계약: [설계 문서](../planning/COMMON_HARNESS_DESIGN_20261005_KO.md).

기존 `followup.mjs`·F/A workflow·prepared template·원자료·제품은 수정하지 않는다. 이 디렉터리는 그 실행 부품을 재사용하는 새 manifest-driven 실행 기반이다. 실제 triage/제품 end-to-end 어댑터(M5)는 아직 지원하지 않으며, 해당 명세는 실행 전에 거부한다.

## 구성

| 파일 | 책임 |
|---|---|
| `contracts.mjs` | canonical JSON/hash, append-only JSON, 경로·source 검증, 논리 ID |
| `manifest.mjs` | 엄격한 실행 schema, resolved defaults, profile, activation/continuation lock |
| `budget.mjs` | 단일 최악 비용·packing·admission·VM 합계 검증 |
| `policies.mjs` | 명령별 선별, 기존6개엔진순서, exact 반복 기반 추가 선별 |
| `adapters.mjs` | per-save/일반 ALL/fixture 의미, 제품 child 요청, 원행 witness 검산 |
| `planner.mjs` | 모집단→선별→호출→chunk, 동결 stage plan, 증명된 미실행 복구 |
| `executor.mjs` | task loop, 호출 전 durable start, 기존 owned scope, OOM 격리, task별 checkpoint |
| `evidence.mjs` | immutable snapshot, 업로드 receipt/index segment, alias, UNKNOWN, legacy reader |
| `audit.mjs` | 계획·조건·결과·보존·정확성 별도 감사, archive index 검증 |
| `action/`, `runtime-action/` | 실제 Actions SDK runtime과 공통 준비 과정 |
| `recipes/followup.mjs` | 동결된 F/A 명세의 읽기 전용 변환 |
| `recipes/smoke.mjs` | 소형 합성 입력 명세 준비; 실자료 성능 측정 아님 |

`secondary-bench-common-{launch,campaign,stage,smoke}.yml`이 공통 reusable workflow/launch를 제공한다. 기존 F/A start marker를 건드리지 않는다.

## 지원 계약

- schemaVersion1, profile `exact-cold-v1`, purpose `information`, analysis `INFORMATION_ONLY`.
- exact Human quality, cold 독립 프로세스, primary CP2/secondary CP1, 기존 Rust/HiGHS thread, Rust stateBudget null, CP `max_lp`·seed1.
- 호출마다 기존 `followup-scope.mjs`의3GiB/swap0 owned process tree와 동기 WASM 외부 감시·회수 사용.
- measurement adapter `secondary-fixture`; variants는 integrated/threshold/cpsat의 비어 있지 않은 고유 부분집합.
- capture command는 bag/bag-plus-next-draw/restricted-split, clear4/hold/N+1; per-save와 minimals ALL은 분리.
- selection: `all-nontrivial-v1`, `hash-one-per-command-v1` 및 명시적 supplement IDs. primaryHard로 ALL nontrivial을 제외하지 않음.
- 기본2~20회, 추가0~20회, exact 초기 반복의 max/min 임계값으로 추가 선별. 한 번의 additional 단계만 지원.
- `preflight/acquire/initial/additional` 네 단계. 빈 정상 단계도 `EMPTY_COMPLETE` plan을 남김.
- VM1~20, 그룹 합계≤20, matrix≤256. 초과시 거부하며 표본축소·비교블록분할하지 않음.
- budget job profile은 setup/checkpoint/reserve/final transport/audit/headroom 교차 검증. scope overhead는20초 미만으로 줄일 수 없음.
- evidence retention1~90일(기본30), 실패 전송 최대2회 재시도, 디스크 reserve 최소4GiB.

현재 코드는 성능 PASS·fresh 검증을 발행하지 않는다. 새로운 lifecycle/triage/e2e 지원은 별도 어댑터·profile·계약 검증이 필요하고, workflow/저장/복구를 다시 만들지 않는다.

## 명세와 CLI

```powershell
# 새 출력 위치만 사용. 기존 승인 template와 raw는 수정하지 않는다.
node tools/secondary-bench/common/cli.mjs convert-followup tools/secondary-bench/prepared-20261005-transportfix/F_TEMPLATE.json benchmark-results/common-v1/F
node tools/secondary-bench/common/cli.mjs convert-followup tools/secondary-bench/prepared-20261005-transportfix/A_TEMPLATE.json benchmark-results/common-v1/A

node tools/secondary-bench/common/cli.mjs resolve draft.json resolved.json
node tools/secondary-bench/common/cli.mjs activate approved.json new-lock 2026-10-05T12:00:00Z invocation-1 --confirm
node tools/secondary-bench/common/cli.mjs plan new-lock/LOCK.json downloaded-history new-plan initial
node tools/secondary-bench/common/cli.mjs audit new-lock/LOCK.json downloaded-history new-audit
node tools/secondary-bench/common/cli.mjs index-history downloaded-history campaign-id
node tools/secondary-bench/common/cli.mjs archive downloaded-history HISTORY_INDEX_SHA256 campaign-id new-archive-proof
```

변환 recipe의 `MANIFEST.json`은 approval=null이다. 명세·동등성 검토 후 별도 승인 기록을 넣기 전 실행할 수 없다. 제품/harness/input/condition hash를 분리하며 aggregate manifest hash로 연결한다. 신규 source를 수정하면 새 revision으로 재동결한다.

fixture 참조는 `{id,file,sha256,acquisition,provenance}`이다. CLI의 로컬 참조는 절대경로를 지원하지만 원격 명세는 저장소 상대경로를 써야 한다. activation bundle에 fixture bytes를 함께 담고 planner에서 같은 참조 경로로 hash 검증·복원한다. package source lock에 node_modules나 작성 manifest 자체를 넣어 순환 hash를 만들지 않는다.

실험을 바꿀 때 수정할 필드:

- `inputs.commands/fixtures/diagnostics/recovery`, `selection`.
- `measurement.variants`, `repeats`, `limits`, `budget.maxParallel/overallMs/maxCalls/job`.
- `provenance`, `approval`, 새 `revision` 및 source locks.

필드·profile·정책·variant·미지원 조합을 숨은 기본값으로 실행하지 않는다. 실행 schema는 `resolveManifest`/`validateManifest`의 코드가 권위이며 모든 실행 경로가 같은 검증기를 사용한다.

## Actions 실행

1. 해당 revision의 계약 검사를 먼저 완료한다. 대규모 캠페인과 preflight를 겹치지 않는다.
2. 단일 승인 manifest 또는 아래 launch group을 공통 launcher에 전달한다.
3. 확인 입력은 `RUN_COMMON_HARNESS`여야 한다. run rerun은 거부하며 continuation은 새 invocation으로 실행한다.

```json
{
  "schemaVersion": 1,
  "vmCap": 20,
  "campaigns": ["experiments/F/MANIFEST.json", "experiments/A/MANIFEST.json"]
}
```

각 manifest의 고정 maxParallel 합계를 검사한다. 캠페인 내 control job과 matrix는 직렬 단계여서 할당 안에 포함된다. 그룹 전체 실행은 공통 concurrency group으로 직렬화하며 activate는 다른 진행 중 Secondary workflow가 있으면 거부한다. 이 guard는 관련 없는 모든 저장소 Actions의 runner 소비까지 제어하는 semaphore가 아니다.

명시적으로 승인한 병행 캠페인은 `provenance.concurrentAllocation`에 외부run ID/head SHA/workflow path/동결template hash/maxParallel과 합산vmCap을 봉인할 수 있다. queued/waiting 상태도 예약에 포함하며 template·workflow 원bytes/상한을 검증한다. 미등록 Secondary run은 계속 거부한다. 기존외부run을 취소·재실행·수정하지 않는다. per-save128 별도workflow는 A `37280034634`의12VM + 신규4VM만 허용한다.

default branch에 새 workflow가 없는 동안 dispatch가 안 될 수 있다. 합성 smoke는 실험 branch의 `.github/secondary-common/SMOKE_START.json`만 바꾸는 push도 지원한다. marker의 confirm과 새 sourceLock을 검증한다. 하네스 준비 push의 기존 preflight가 끝난 뒤 marker-only push하며, F/A start marker는 변경하지 않는다.

합성 smoke는 실제 runtime에서 같은 공통 campaign/stage/run/audit 경로를 사용한다. 빈 preflight/acquire 단계, 실제 세 엔진 tiny fixture, task checkpoint, SDK 다운로드, witness/receipt 감사를 수행한다. capture 진단·OOM/회수 계약은 사전 검사에서 별도로 수행한다. 이를550개 실자료 측정 완료나 triage 검증 완료로 표현하지 않는다.

## 저장·감사

- 계획은 `STAGE_PLAN.json`; 호출 identity는 `logicalCallId`, 실제 시도는 `executionAttemptId`.
- task는 `starts.jsonl`, `raw.jsonl`, scope 로그·fixture, `TASK_COMPLETE.json`을 남긴다. 시작 기록은 입력 read/solver 호출보다 먼저 fsync한다.
- `SNAPSHOT.json`은 파일 bytes/hash와 checkpoint identity를 동결한다. 업로드 receipt의 `.segment-*.json`은 실제 artifact ID/digest/member를 연결한다.
- 전송은 shared flush deadline 내 FAILED/PENDING만 재시도한다. 같은 snapshot/raw/line bytes의 동일 attempt만 alias로 묶는다.
- `TRANSPORT_COMPLETE.json`은 원격 전달 상태다. 실제 다운로드 inventory·snapshot·receipt를 감사하고, 미확정 상태는 숨기지 않는다.
- archive는 index에 적힌 전체 bytes를 검사한다. `ARCHIVE_VERIFIED`는 indexed objects 보존을 뜻하며 campaign 누락 여부는 별도 AUDIT를 함께 봐야 한다.
- AUDIT는 orchestration, execution/evidence completeness, correctness, performance, required validity를 구분한다. 계획 누락·정확성 실패·전송 오류는 validity FAIL이며 solver timeout 자체는 workflow 결함과 구분한다.

## 복구

1. raw가 존재하고 전송만 실패: 봉인 bytes의 transport retry. 새 solver 호출 금지.
2. 기존 NOT_RUN 증명: 원 raw line bytes/base64와 hash, input/engine/repeat/status/sourceLock을 검증한 명시적 recovery.
3. start가 있고 final raw가 없음, 또는 예정 호출의 원기록이 없음: UNKNOWN/MISSING. 자동 재실행 금지.
4. 의도적 추가 측정: 새 phase/repeat/campaign으로 기록. 원 결과 덮어쓰기 금지.

continuation 필드는 부모 LOCK path/hash와 완전한 history index path/hash를 지정한다. 부모 origin/end·제품·조건·입력·call cap을 유지하고 하네스 교정 lock만 연결한다. 부모 history를 검증한 뒤 새 history 아래 hardlink/copy로 병합하며 원본을 변경하지 않는다. 이미 실행한 호출은 다시 계획하지 않고, 명시적 NOT_RUN만 재계획한다. portable manifest bundle에는 부모 lock와 index에 연결된 전체 history도 제공해야 하며, 공간 부족 시 거부한다.

legacy reader는 기존 record와 file/line/raw hash를 유지한다. 옛 call ID/hash를 신규 canonical 방식으로 소급 대체하지 않는다.

## 동등성의 명시적 차이

F/A conversion·정책 검사는 모집단·선별·엔진순서·반복·timeout·recovery·job packing을 대조한다. 기존 ALL550 블록의3300호출/184chunk, F 합성 전체 capture 선택의798 신규+191복구 호출을 검사한다.

- 기존 고정150초 진단 예약 대신 공통 worstCall 식으로160초를 예약한다. 진단 실행 제한 자체는 동일하다.
- campaign admission에서 최종 flush/audit/reserve를 명시적으로 확보하므로 기존 종료 경계보다 보수적으로 시작을 거부할 수 있다. 실제 deadline을 늘리거나 population을 줄이지 않는다.
- 옛 continuation을 새 clock으로 자동 변환하지 않는다. 명시적인 부모 lock/history 감사 없이는 새 승인 실험일 뿐이다.

이 차이는 `EQUIVALENCE.json`에도 기록한다. 실제 측정값을 같다고 주장하는 동등성 검사가 아니다.

## 검사

```powershell
node --experimental-wasm-stack-switching --test-isolation=none --test-concurrency=1 --test tests/secondary-bench-common.test.mjs
```

합성 local transport의 장애 주입 검사와 실제 SDK/Actions 검증을 구분한다. 원격 smoke run 및 단계별 구현 상태는 [구현 상태 문서](../planning/COMMON_HARNESS_IMPLEMENTATION_20261005_KO.md)에 기록한다.
