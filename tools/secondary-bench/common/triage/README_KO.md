# Triage policy fixture / paired profile (M5 첫 어댑터)

제품의 `solveExactSecondaryAsync`를 직접 호출하는 개발용 exact Human-quality 비교다. 기존common v1의정보수집 profile/실행manifest 의미는바꾸지않는다. 새 `triage-cold-v1`은동일common contracts/evidence/seal/transport/pack/admission과per-call memory scope를재사용한다.

## 단위와 경계

- 저장된원weighted rows/stable-ID universe/증명된K/primary seed를재사용한다. primary나열거를재실행하지않는다.
- fixture diskread/검산/module imports 이후부터WASM init/JS packing/원구조검사/probe/T/lateCP/회수/solver close를`policySettledMs`에포함한다. 동적 import 시간은별도 `fixtureAndImportMs`로보존하고watchdog·CPU/memory scope에는포함한다.
- Node24.13.0/Ubuntu24.04/fresh process, scope합계3GiB/swap0, policy call300초. CP보조60초·자체120초·probe seed공유/실패시Rust지속은현행제품계약이다.
- seed진단은제품native primitive를써서bounded100K와T원seed/Tprobe-seed를분리한다. CP는진단에서off,정책팔에서는동일계약으로on이다.
- 분류옵션은실험branch의post-primary exact entry에만명시적으로전달한다. 기본값은baseline이며기존public minimals API에새기본정책을등록하지않았다. whole-filter/secondary pool의새candidate end-to-end transport는후속명령adapter 범위이고이번fixture adapter가대신검증했다고주장하지않는다.

## 원장·예산·관문

`protocol.mjs`는고정profile/16VM/8479call/1400runner-hour/120h계약을검사한다. 각fixture 비교task를같은VM에원자적으로입장시킨다. BASELINE/A와BASELINE/B는별도call ID/pair이며baseline을공유하지않는다.

`executor.mjs`는시작전fsync된starts,완료raw,scopeevents/stdout/stderr/cgroup자료를보존하고task마다동결snapshot을전송한다. 재전송은bytes만,solver재시도0. OOM은입력×variant만quarantine하며회수불확실/invalid result는나머지chunk호출을NOT_RUN으로남긴다.

캠페인workflow는activation→canary→calibration→ALL→per-save→seed→trivial→확인→audit 순서이며측정matrix는최대16VM. 모든phase의plan/control은측정과겹치지않는다. 계획한matrix523job +보수control36job을150분씩예약해최대1397.5runner-hour다. activation run.created_at이원clock이며rerun attempt는거부한다. 이번revision은자동continuation/replay를지원하지않고,복구필요시원장·clock·남은예산을보존한별도설계를요구한다.

초기전체분모와선정재확인은분리한다. retest는기존상위10%개선/악화·변동/상태·gate영향에더해**변경98개전체를보수적으로포함**하도록설계를구체화했다. 추가호출수는원최대안8479안이다. `analysis.mjs`는pair자료·선정근거·관문과개발보고서를내고,최종원자료해석전자동성능PASS를발급하지않는다.

## 로컬 준비

```powershell
node --test tests/triage-bench.test.mjs
python tools/secondary-bench/common/triage/prepare.py --out <새-외부-준비폴더>
node --expose-gc --max-old-space-size=1024 tools/secondary-bench/common/triage/verify-prepared.mjs <준비폴더> D:/AI/sfinder-wasm/triage-analysis/Astra/next-experiment/TARGETS.jsonl
```

`prepare.py`는580개원fixture의bytes를streaming hash/ZIP으로묶는다. 신규solver호출0. `verify-prepared.mjs`는한fixture씩GC하며입력·K증명·seed/원cover/stable-ID·모든pair·상한·source를독립확인한다.

입력은약1.98GB의원JSON이므로git에추가하지않는다. upload는추후실행승인시 **prepared ZIP을GitHub release asset으로1회전송**,START의정확한bundleSHA와asset ID로검산하여activationartifact를만드는경로다. 공유외부URL/최신이름lookup으로bytes를추정하지않는다.

START는현재 `PREPARED_NOT_ACTIVATED`,asset ID와confirm은null이다. push trigger는START변경+실험branch+`[RUN_TRIAGE_16VM]`커밋메시지로제한되며별도confirm도필수다. 일반코드push는solver실행을시작하지않는다.

경량synthetic검사는Linux/WASM/CP 실제scope의원격canary나fresh성능판정을대체하지않는다. 다른benchmark의queued/active run이있으면activation에서16VM배정을거부한다.

## 관문 보강 / 독립 Actions 감사 (r2)

- canary/calibration은허용상태(EXACT/정책TIMEOUT/INCOMPLETE)와실제회수를명시적으로검사한다. OOM(전팔동일OOM도포함),알수없는오류,시작timeout,미실행은HOLD다. 완료baseline 대비후보미완료도canary에서HOLD다. 알려진stress의정책timeout은완료시간으로승격하지않는다.
- activation과canary의각VM(최대3개)에서별도scoped CP syntheticpreflight를한다. 실제CPworker에서가중품질과stable-ID tie를증명하고회수한다. 최대4개의짧은CPsynthetic호출은모집단8479호출/성능분모와분리하며기존setup/control예산안이다. preflight실패시scope원자료를업로드하고본측정을막는다.
- CP 초기화/지원/잘못된proof 오류는Rust가완료하거나정책전체가timeout이어도trace로남겨HOLD한다. CP의정상시간상한·native미완료·Rust완료후CP취소는실패분류와구분한다. 기본CP지연/limit/seed/fallback정책은바꾸지않는다.
- `independent-audit.py`는Python표준라이브러리만사용한다. JS의검산결과를신뢰하지않고원weighted rows에서K/seed/selected vector를다시계산한다. source/fixture/snapshot hash,호출순서·pair/phase·최대budget,시작/종료scope원자료,trial seed,receipt/backend digest,기존EXACT hash와cross-variant일치를검산한다. raw원장은SQLite에임시index하고한fixture/result씩읽어메모리를제한한다.
- canary뒤와calibration뒤각각별도ActionsVM에서독립감사를통과해야다음phase가진행된다. 마지막에도기존JS보고job종료후새VM에서독립감사한다. 실패/불완전은별도 `triage-independent-.../INDEPENDENT_AUDIT.json` 및SQLite index에보존하며workflow를실패시킨다. 감사는solver호출0,모집단재실행0이다.
- 기존control36job예약이추가감사3job을포함할수있으므로1397.5runner-hour 상한은유지한다. 실제control13job(activation+plan8+JS보고+독립감사3)의hard시간합은20시간이며matrixphase의worst95시간과합해115시간이다. queue/지연은120시간campaign입장상한으로검열한다.
- 독립감사의PASS는**증거·계약·원행witness** PASS다. 신규독립최적성증명이나fresh/제품성능PASS가아니다. 초기·조건부재확인·개발성능판정은분리한다.

독립감사기능/손상검사는 `python -B tests/triage-independent-audit.test.py`로solver없이재현한다. 준비ZIP복원후 `python -B tools/secondary-bench/common/triage/independent-audit.py --config <복원폴더> --out <새-결과폴더> --inputs-only`로580개입력/원seed/예산/source를로컬에서독립검산할수있다.
