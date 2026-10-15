# Fast Actions artifact 전송 개선

2026-10-15 · 사용자 승인: sfinder_wasm의 별도 실험 브랜치에서 진행, 최대16VM.
브랜치: `experiment/fast-budget-20261015`.

## 확인한 병목과 한계

최근 완료 R20 run38424279935의 jobs API114개를 조회했다. 명시적 upload-artifact113단계 합168초, download-artifact113단계 합561초, artifact SDK npm설치112단계 합398초다. 개별 다운로드 최대27초(audit), 측정 worker 최대23초였다.
이는 병렬 job 전체의 누적 단계 시간이며 사용자가 기다린 wall-time과 다르다. custom action 내부 업/다운로드 시간도 모두 분리된 값은 아니다. 이 수치로 캠페인 전체의 병목 비율이나 개선율을 단정하지 않는다.

기존 코드에서 개선 가능한 구조:
- `common/action/index.mjs:120-124`는 shard payload를 하나씩 직렬 업로드한다.
- `common/action/index.mjs:54-56,116-118` 및 `common/triage/product-action.mjs:39-42`는 plan/audit에서 prefix에 해당하는 전체 이력을 다시 받는다.
- `download-artifacts.mjs:26-28,83`의 storage-guard 모드는 디스크 안전을 위해 다운로드를 직렬 처리한다. 단순히 동시성만 올리면 disk admission이 경쟁하므로 그대로 변경하지 않는다.
- executor는 task마다 checkpoint를 올린다. 각 task가 짧으면 네트워크 왕복 고정비가 커진다.

## Fast에 적용할 계약

1. **Control-plane 분리:** planner는 작고 검증된 phase summary/index로 다음 단계의 completeness를 확인한다. 최종 감사만 원 starts/raw/선택 행렬을 모두 읽는다. summary가 raw 감사 완료를 뜻하지는 않는다.
2. **입력은 필요한 shard만:** source/WASM은 고정 commit checkout을 활용하고, 전체 fixture/역사 묶음을 모든 worker에 배포하지 않는다. 입력 행렬은 hash로 중복 제거해 해당 shard의 refs만 포함한다.
3. **준비 업로드 최대3개 병렬:** payload별 directory·receipt·name을 독립 소유하고 실패도 모두 회수한다. SDK 압축은 JSON/CSR level1, 이미 압축된 묶음은 level0. 속도/크기 trade-off는 원격 smoke에서 기록한다.
4. **Delta checkpoint:** 매 호출 start/raw는 로컬 durable append. 네트워크 checkpoint는 완료된 paired block들을 묶어 10분 또는16MiB(먼저 도달한 조건), 그리고 job 종료/실패 시 flush한다. 측정과 업로드를 겹치지 않는다. 단일 긴 block으로 넘긴 시간은 그대로 기록한다.
5. **복구 경계 명시:** 마지막 업로드 이후 VM 소실 구간은 원격에 영구 기록됐다고 주장하지 않는다. 계획에는 있으나 완료 증거가 없는 구간은 UNKNOWN/INCOMPLETE이며 자동 재측정하지 않는다. delta에 포함된 원본/hash/index/receipt는 불변으로 유지한다.
6. **재다운로드 최소화:** phase당 결과 delta를 한 번 수집하고 compact summary를 별도 게시한다. 동일 job 내 이미 받은 artifact는 ID/digest 및 로컬 member hash로 검증 후 재사용한다. 다른 VM의 로컬 캐시 존재를 가정하지 않는다.
7. **전송 계측:** artifact수, 압축전/후 bytes, seal/압축/upload/download/extract 시간, retry, cache-hit, 미전달 개수를 phase별로 남긴다. solver 시간과 섞지 않는다.

task 묶음은 실험군/반복/seed/VM pairing을 바꾸지 않고 전송 경계만 바꾼다. 전체 CPU16VM 및 source/input hash 검증은 유지한다. GitHub cache를 연구 원자료의 유일한 보존소로 사용하지 않는다.

## 현재 구현 상태

- `tools/fast-bench/transport.mjs`: Fast 전용 payload 병렬 업로드 기반 구현. 공통 seal/hash/receipt/retry 규약을 재사용하고 최대3개 동시 업로드, level1/0, 전송시간 기록을 제공한다.
- `tests/fast-bench-transport.test.mjs`: 동시성 상한·순서·receipt, 실패/재전송, 소유권 중복 검증. solver 호출 없음.
- 계획/요약 분리·delta checkpoint·download cache는 **Fast 실행 adapter/workflow를 연결하면서 구현할 다음 항목**이다. 현재 helper가 기존 캠페인 속도를 이미 바꿨다는 뜻은 아니다.
- 다음 원격 준비 검사는 작은 파일의 실제 upload/download/해시 대조다. 그 뒤 Fast capture와 측정 workflow를 연결한다. 아직 population benchmark는 시작하지 않았다.

## 원격 준비 검사 구현 (후속)

- `.github/workflows/fast-budget-preflight.yml`: 별도 실험 브랜치에서만 최초 push로 등록하고 workflow_dispatch도 지원한다. default branch에 없는 새 workflow는 이름 기반 dispatch가404이므로 branch-local push trigger로 시작했다.
- `tools/fast-bench/adapter.mjs`: 12군의 fixed-K 실험 계약. 미완료 preview 폐기, integrated/grace seed 전달, hard 가드, 기존2x2, 단계별 incumbent 및 원 행 검산을 구현했다. exact-only 하네스의 거부 계약은 그대로 사용한다.
- `remote-preflight.mjs`: synthetic weighted triangle1개에서 12군×trace ON/OFF24회, 현재 제품 경로와5군 대조5회, 동기 무응답 watchdog/회수1회 = **30단위**. 모집단 입력은 호출하지 않는다.
- 필요성: adapter와 제품의 다른 seed/목표를 같은 정책으로 비교하는 오류, trace가 결과를 바꾸는 오류, 동기 WASM 정지 시 프로세스가 남는 오류를 사전 검출한다. 별도 성능 우열/overhead 판정 검사가 아니다.
- 비용: 1측정 VM, 준비 job15분+별도 다운로드 검증 job5분 상한. 전체 preflight64슬롯 중30슬롯을 예약한다. timeout/reap·process-tree3GiB/swap0은 기존 supervisor를 재사용한다.
- 실제 SDK로3개 payload를 최대3개 병렬 업로드하고, 다음 job은 receipt의 **artifact ID3개만** 다운로드한다. 원 starts/raw/lock/receipt는 별도 evidence artifact에 보존한다.
- 이 단계의 LOCK은 준비 검사 전용이다. 모집단 본 실행의 source/runtime/schedule lock이나96시간 origin을 대신하지 않는다. 준비 검사 소비도 본 캠페인의 누적 자원 산정에 포함해야 한다.
- [실행 기록](FAST_ACTIONS_PROGRESS_20261015_KO.md): 첫 run은30개 계약 검사 PASS 뒤 shell SDK 인증 오류로 전송 FAIL. 후속 run38755431827에서 JavaScript Action으로 수정하여 solver 재실행 없이 전송·왕복 검증까지 PASS했다. 초기 failure와 후속 success를 모두 보존한다.

기존1,200runner-hours/96시간 상한은 유지한다. 실제 artifact 시간을 확인하기 전 절감률이나 최악 startup 예약을 낮추지 않는다.
