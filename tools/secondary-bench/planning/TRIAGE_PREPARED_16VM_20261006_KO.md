# Astra 계획의 벤치마크 준비 — 16VM

2026-10-06 · 작업branch `experiment/secondary-routing-20261005`
**GitHub 업로드·push·워크플로 실행 전 준비본. 실제 성능결론 없음.**

> **r2 보강:** 아래의초기준비본은관문결함확인으로대체되었다. 현재업로드대상은 `D:/AI/sfinder-wasm/files/benchmark-prepared/triage-probe-seed-16vm-20261006-r2/`이며그폴더의PACKAGE/START/검산JSON이권위값이다. 초기ZIP을실행에사용하지않는다. canary OOM/완료회귀/CP지원실패를HOLD하며canary·calibration·최종의3독립Python감사를별도ActionsVM에추가했다.

## 준비 구성

- 제품: `src/min-cover-triage-experiment.mjs`의명시적A/B와기존exact-secondary 진입점에연결. 기본값baseline,명시적실험옵션없으면현행동작유지.
- 하네스: `tools/secondary-bench/common/triage/`의profile·paired task·제품child·scope executor·선정/보고·Actionsoperation.
- 워크플로: `.github/workflows/secondary-triage-campaign.yml`, `secondary-triage-stage.yml`.
- 입력/설계: `D:/AI/sfinder-wasm/triage-analysis/Astra/next-experiment/`.
- 현재외부준비패키지: `D:/AI/sfinder-wasm/files/benchmark-prepared/triage-probe-seed-16vm-20261006-r2/`. 초기폴더는대체되었으며보존만한다.
- 검증: `tests/triage-bench.test.mjs`, `verify-prepared.mjs`, 기존common/followup/component/three-engine 계약회귀와actionlint.

관련로컬검사 **100개 중95통과/5개CP미지원skip/실패0**(Node92개=87통과+5skip,Python8개통과). 새triage21개와독립감사8개는전부통과했다. 신규정식모집단측정은0이며,로컬solver는짧은synthetic 기능검사에만사용했다.

## 고정 실행 계약

ALL451 전수와trivial97, per-save32회귀, 변경98개seed진단. 초기/진단4743호출, 추가최대3736, 총상한8479.
**16VM**,각VM당정책1개. 전체120시간/1400runner시간상한. matrix523job+보수control36job의예약상한1397.5runner시간이다.

정책호출당watchdog **300초**, startup10초·종료/회수각5초·scope여유20초를포함한340초예산. 정책전체process-tree에3GiB/swap0. CP도같은scope에포함.

CP보조는원secondary경과60초이후,CP자체limit120초. T/CP는동일probe seed를받으며CP실패시Rust지속. 이번에는single-active순차CP정책을동시에변경하지않는다.

## 실제 준비에서 구체화한 내용

1. 현행source snapshot의정확한두모듈원bytes를별도로보존해canary의PRECHANGE_BASELINE 팔에서사용한다. 같은최신assets·나머지source를복제한shadow runtime에서실행하므로numeric WeakMap과Wasm class도동일모듈그래프에속한다.
2. 주측정endpoint는fixture검산/동적module import 이후진입→WASM초기화/packing/제품policy/회수/solver close다. import/fixture시간은별도timing이며300초watchdog·scopeCPU/RSS에는포함한다. 이경계를새profile로잠갔다.
3. 재확인은상위10%·변동·상태·gate영향에더해변경98개전체를보수적으로포함한다. 최대8479호출안이며초기/재확인분모는분리한다.
4. memory scope의cgroup CPU 통계·systemd CPUUsageNSec도보존한다. timeout/OOM의CPU를child성공응답에의존하지않으며미관측은null이다.
5. EXACT가있는fixture에는최종DB의원witness hash계약을연결해완료결과의weighted quality/stable-ID 변화를검출한다. 원seed/행렬검산,미완료probe seed의feasibility,engine proof와독립최적성검증은구분한다.
6. native preparation만의별도시간/Threshold 내부same-search checkpoint는현재wrapper에서미관측이다. wrapper/probe 시간·states·seed·정책전체손익은측정하며,그미관측값을0으로만들지않는다. 세밀한native 관측은P4에남긴다.

## 업로드 직전 파일/명령 인계

준비패키지에는 `TRIAGE_16VM_INPUTS.zip`, `MANIFEST.json`, `TASKS.jsonl`, `START.json`, `PACKAGE.json`, `LOCAL_VERIFICATION.json`, `RESTORE_VERIFICATION.json`이있다. 원JSON은약1.98GB이므로git으로옮기지않고압축패키지한개를사용한다. 준비ZIP의정확한SHA/bytes는 **r2**의 `PACKAGE.json`이권위값이다. 입력/source를再검산한solver-free Python보고도r2에보존한다.

실행승인후에만:

1. 현재branch의이번변경파일만검토해commit/push한다. 기존미커밋수집/README 작업을자동으로포함하지않는다. main/dev-branch에적용하지않는다.
2. **기존수집ZIP이아닌준비ZIP**을해당저장소의실험용GitHub release asset으로upload하고immutable asset ID를확인한다. release는source commit을참조해야하며main을변경하지않는다.
3. 외부준비폴더의START내용을 `.github/secondary-triage/START.json`에넣고assetId와confirm=`RUN_TRIAGE_PROBE_SEED_16VM`만채운다. bundleSHA/manifestHash는재계산해바꾸지않고준비본과정확히일치시킨다.
4. default branch에없는workflow의경우START변경을 **`[RUN_TRIAGE_16VM]`** 메시지로실험branch에push하여명시적start를사용한다. default branch에등록되어있다면workflow_dispatch의asset-id/confirm으로실행할수있다. 일반코드push로실험이시작되지않는다.
5. activation에서source/assets/입력bundle/hash/branch/16VM외부배정/Node version/이전campaign lock을검사한다. 재실행attempt와동일campaign의새activation은거부한다.

준비script를수정하거나source/assets/workflow를바꾸면새준비폴더에서패키지를재생성하고local검증·hash를갱신한다. 이전prepared ZIP을덮어쓰지않는다.

## 실행시 남은 관문 — 로컬 미완료가 아니라 원격환경 검증

synthetic계약→canary8개→계측off/on24개가통과해야본측정이진행된다. Windows의CP미지원조건과Linux cgroup은로컬에서실제검증했다고주장하지않는다. canary/calibration이보류되면전체기준측정은시작하지않고실패evidence를보존한다.

r2에서는activation과각canaryVM에서**실제CPweighted/tie syntheticpreflight**(최대4호출)를별도기능검사한다. 이어canary뒤·계측뒤·최종에별도ActionsVM에서Python독립감사를한다. 허용상태·완료회귀·CP오류·원행렬witness·호출/시작/회수·전송receipt를검산한다. 감사는solver재실행0이며source와artifact hash로동결한다. CP정상timeout/미완료/Rust승리후취소는초기화/지원/잘못된proof 실패와구분한다.

matrix523/control예약36/1397.5runner-hour/모집단최대8479call은그대로다. 독립감사job3개는기존보수control예약안에포함하며다른phase·측정matrix와겹치지않는다. 감사PASS는독립적인witness/증거검산이고새독립최적성증명/성능PASS는아니다.

자동report는paired delta/조건부비율/group-bootstrap/자원/재확인원장을제공하되**성능PASS를발급하지않는다.** Astra가초기와추가를분리하고완료·tail·seed·CPU·회수gate를검토해개발후보유지/보류/폐기를판정한다. fresh/명령전체/browser/동시요청PASS는별도단계다.

현재push/upload/dispatch는수행하지않았다. 이전run37226653891 watch 취소는과거완료캠페인의watcher 중단이므로재실행하지않는다.
