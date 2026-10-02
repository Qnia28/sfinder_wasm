# A0 integrated 재검증 및 최소 통합 계획

**상태: 계획만 작성. 새 테스트/Actions/제품 적용은 실행하지 않음. 실행 범위와 판정 변경은 승인 대상이다.**

## 1. 왜 앞선 검증을 보류했는가

변경 대상은 기존 일반 True integrated100K probe의 `partitioned` 선택이다. threshold 알고리즘/제품 시간 정책은 바꾸지 않았다. 앞선 smoke128회에서 integrated timeout은0, threshold timeout56회, threshold state cap16회였다. R/A 상태는 모두 같았다. 따라서 A0 결함이 확인된 것이 아니라 **전체 secondary route 완료를 필수 조건으로 삼은 계획의 증거가 부족**했다.

긴 실제 threshold를 전수 완료시키는 것은 integrated 변경의 검증에 반드시 필요한 조건은 아니다. 그래도 A0가 capped incumbent를 바꾸면 threshold의 탐색순서/실행시간이 달라질 수 있으므로 후속 단계가 무관하다고 주장하지 않는다. 이번 안은 증명 목표를 둘로 분리한다.

1. **통합 게이트:** 변경된 integrated probe의 실제 제품 연결·정확성·bounded quality·states·시간·취소·자원 및 threshold로의 전달 계약.
2. **별도 비주장:** 전체 실제 threshold 완료시간과 Auto/CP race의 end-to-end 성능. 이를 증명하거나 개선했다고 하지 않는다.

이것은 앞선 실패를 PASS로 재분류하는 것이 아니라, 좁은 변경에 맞는 **새 사전 검증 계약**을 만드는 것이다. 앞선 실행37034641097과 모든 실패/미해결/누락 trace는 그대로 남긴다. 기존 전체route 승인조건을 계속 요구한다면 이번 bounded-probe 안만으로 충족할 수 없다.

## 2. 제품 후보는 그대로

- 기준 제품: `c0cb2a048e7275bfea587d176b1954efff0a8a08`.
- 검증한 제품 후보: `e5f2f3d1a9885085e11cde7457aad2b338ca8130`의 제품 전용 diff.
- 기존 결과를 포함한 isolated branch HEAD: `60aa9c2de06dd4fe2a6da718300db9c7f6148c33`.
- JS 변경: 신규 일반 True/Rust 경로의 integrated100K 호출에 `partitioned: decomposition === 'off'` 한 줄.
- R/A 같은 baseline-source WASM: SHA256 `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`.
- 기존 Rust/Fast/tiny/primaryHard/trivial/명시엔진/분해/CP60초/전달된probe/low-level기본값 불변. B10/B6/tuned ABI 불포함.
- 새 isolated 검증 브랜치에서 하네스만 보강한다. 원Dev/main/default branch/배포는 읽기 전용이다. 검증 시작 직전 기준에 사용자 변경이 있으면 덮어쓰지 않고 재확인한다.
- 기존675개 A0 효과 campaign,5% 개선 주장,threshold129 독립exact 확인과 rebuild/parity 증거는 재사용한다. 675개 효과 측정을 다시 하지 않는다.

## 3. 실제 입력 범위: 개발16 → 64, 예약104 전체

| 구간 | 입력 수 | 구성/반복 | 실제 integrated 호출 |
|---|---:|---|---:|
| 개발 제품 연결/운영 검증 | 64 | R/A ×4 | 512 |
| 동결 후 예약 검증 | 104 | R/A ×4 | 832 |
| 합계 | **168** | 조건 균형화 | **1,344** |

개발64개는 기존16개를 반드시 포함한다. 이전 미해결9개도 동일100K 조건으로 다시 integrated만 관측한다. 그다음 개발eligible의 metadata E최대16개를 합집합으로 넣고, 고정 salt `a0-integrated-revalidation-20261003`의 독립hash순위로64개를 채운다. 비교결과/실행시간으로 추가 입력을 선별하지 않는다. 기존16개 포함은 알려진 재현군이므로 이 전체를 독립 random sample이라고 부르지 않는다.

예약104개는 이전에 decode/solver 실행하지 않은 전체 eligible를 사용한다. **같은 A0 구성 하나**만 검증한다. freshholdout 인증은 하지 않는다. source/seed/K/weighted 원행/중복행/stable ID/aliases/primary proof/context의 byte hash를 기존 capture와 대조한다. primary/PC 재실행은0이다.

추가 native 전수 측정 없이 전체 capture1721개 metadata로 적용/비적용 분류와 aliases를 감사한다. tiny 개발806+예약115=921개는 기존 dispatch 조건을 metadata-derived spy로 확인하고 A0호출0을 검증한다. trivial3/primaryHard18도 저장된 context와 경계fixture로 우회를 확인한다. 이것은 실제 tiny legacy solver 품질/실행시간 전수 측정이 아니다.

## 4. 실제 제품 호출로 integrated를 측정하는 방법

저수준 integrated API만 별도로 실행하지 않고 **실제 `solveExactSecondary`**를 호출한다. 기존 제품이 제공하는 `deferThreshold` 경계를 이용한다.

1. 원 proven K/context/seed와 numeric weighted coverage를 복원한다. 실제 primary/PC 호출은 명시적으로 금지한다.
2. 제품 함수가 실제 일반100K probe를 실행하도록 한다. R은 기존 JS, A는 최소 후보 JS이며 binary는 동일하다.
3. integrated 완료 시 제품 `integrated-exact` 결과를 받는다. deferred callback 호출0을 확인한다.
4. capped 시 기존 `deferThreshold` callback에서 probe/context를 받아 **검증용 deferred-record**로 저장하고 native threshold를 시작하지 않는다.
5. callback은 가짜 exact witness를 반환하지 않는다. 장부는 `PROBE_EXACT` / `PROBE_CAPPED` / `TIMEOUT` / `ERROR`로 구분하고, capped에서 `qualityExact=true`를 주장하지 않는다.
6. 완료/미완료는 정해진100K probe의 정상 결과다. **CAPPED 자체는 증거 결손이 아니다.** timeout, 누락 witness, 검산 불일치는 증거 결손/실패다.

전달된 probe를 worker가 재실행하지 않는지 확인한다. 실제 제품 threshold callsite의 seed와 옵션은 별도 계약검사에서 확인하므로 defer context에 원 primary seed가 남는 것과 threshold 실제 seed가 incumbent로 바뀌는 것을 혼동하지 않는다.

### 측정 경계

main probe API wall(기존 wrapper/native packing/readback 포함), 제품 secondary의 probe/defer 경계 wall, decode/coverage준비/init/검산/IPC/fsync 각각을 기록한다. 주성능은 API wall로 판정하고 제품 경계wall도 전 입력 공개한다. 검산/IPC/fsync는 native/API 성능에 섞지 않는다. timer 시작·끝 위치는 source hash와 함께 고정한다.

이 수치는 전체 threshold route wall이나 PC/primary 포함 end-to-end가 아니다. 직렬 Rust 경로 비교이며 Auto가 같은 probe 연결을 사용하는 것은 별도 Worker/CP 회귀로 검사한다.

## 5. threshold는 연결 계약과 작은 완료 사례만 검사

### 5.1 모든 실제 capped probe의 전달 검사: native threshold 추가실행0

보존한 probe를 제품 함수의 `integratedProbe`로 전달하고 `minimumCoverAtCount`의 threshold 진입에서 validation-only sentinel로 멈춘다. 들어온 coverage/K/seedKeys/lockedPrefix/options를 기록한 뒤 명시적인 `CONTRACT_ONLY_STOP`으로 종료한다.

- 새로운 integrated 호출0, 기존 probe의 key/count/states/completed 변화0.
- 유효 K개 incumbent가 있으면 그 keys가 실제 threshold seed로 전달된다.
- threshold 옵션에서 integrated/partition/dominance 선택 없음, `lockedPrefix: []`, 제품 default state budget/timeout 정책 불변.
- 검산한 seed quality가 원 primary seed 이상이다.
- 반환된 가짜 exact 결과나 합성 threshold 완료시간을 만들지 않는다. contract-only 결과를 native correctness pass로 혼동하지 않는다.
- 직접 경로와 deferred/Worker 전달의 동일 context/버퍼 소유권/취소/replay금지를 확인한다.

### 5.2 작은 실제 native 완료 테스트

기존193개 제품 회귀를 올바른 BASELINE_ROOT/JSPI flag로 hosted에서 skip 없이 실행한다. 여기에 capped→threshold를 실제 실행하는 작은 고정 synthetic32개를 추가한다. 중복weighted행/비최적seed/동률stableID/63·64·65 블록 경계와 R/A 각각의 incumbent 전달을 포함한다. 필요하면 integrated 결과를 검증용으로 capped 표시하는 연결시험을 분리하고, 이를 실제100K가 자연스럽게 capped된 사례로 주장하지 않는다.

각 fixture는 독립 brute-force 또는 기존 oracle의 expected K/full quality/stable witness와 비교한다. synthetic oracle의 계산은 actual-input primary/PC 재실행에 포함되지 않으며 별도집계한다. 작은 fixture별 threshold validation API30초/process45초를 유지한다. fixture 구성은 실행 전 고정하고 실패 fixture를 쉬운 것으로 치환하지 않는다.

실제 큰 threshold 전수 완료, threshold cap 증액, unlimited 실제 integrated는 이번 안에서 실행하지 않는다.

## 6. 증거가 없어지는 문제를 먼저 고친다

지난56개 threshold timeout 행에서 이미 끝난 integrated witness가 저장되지 않았던 것을 하네스 결함으로 다룬다. 이번에는 각 phase 결과를 **다음 단계 시작 전에 parent에 전송→원본 append→fsync→ACK**한다.

- 시작 schedule과 timestamp를 선기록한다.
- native call이 반환하면 raw keys/count/qualityVector/completed/states/options/seed를 즉시 별도 result record로 남긴다. 무거운 검산 전에도 원결과는 살아 있다.
- 검산결과/RLE/hash는 이후 별도 audit record로 붙인다. raw result와 요약을 대조한다.
- phase마다 cgroup memory.peak/current/events, WASM memory, child/process peak RSS를 기록한다. fresh child cgroup으로 reset 경계를 분명히 한다.
- OOM/timeout/signal/kill→reap/미실행/부분기록을 그대로 보존한다. start만 있고 result없는 호출은 성공으로 집계하지 않는다.
- 일부러 phase결과 이후 hang/강제kill/검산 실패/불완전JSON/업로드실패를 주입하는 synthetic 사전 테스트로 raw witness 보존과 회수를 검증한다.
- phase시작의 API deadline은 ACK/검산 시간을 포함시키지 않고, 다음 단계에는 새 독립 deadline을 준다.

입력당 freshprocess/freshWASM, 동일VM에 R/A×4를 두고 hash-fixed ABBA/BAAB로 균형화한다. 이전 timeout을 성공 rerun으로 덮어쓰지 않는다. 신규 실행은 별도 runId/ledger이며 이전 실행과 합쳐 median을 만들지 않는다.

## 7. 사전 통합 게이트

기존route 게이트를 통과했다고 주장하지 않고 다음 **integrated 전용 기준으로 교체하는 안**을 승인받는다. 실행결과를 보고 기준을 낮추지 않는다.

### 필수 정확성·연결·증거

- 예정1,344 probe 결과/원witness/입력hash/옵션/자원/회수장부 누락0.
- 실제 입력의 primary/PC 호출0, 범위 밖 A0호출0.
- 모든 exact/capped의 K개 고유keys, 원weighted행coverage, raw qualityVector 및 incoming seed하한 검산 통과.
- R/A 양쪽 exact면 fullweightedquality/stableIDs 동일. 한쪽만 exact면 capped 상대와 exact를 동일증명으로 취급하지 않고 기존 oracle/기존 검증 참조 및 seed하한으로 교차확인한다. 새 exact를 독립 확인할 자료가 없으면 작은 별도 proof 확인 계획을 먼저 보고하고 미검증으로 승격하지 않는다.
- completed/states/keys/quality의 반복 결정성. A의 exact 완료수≥R, 동일입력states증가0, bounded raw quality회귀0.
- 모든 실제 capped incumbent의 threshold 전달 계약 pass. 작은 native threshold/Worker/cancel/oracle 사례 pass.
- ERROR/OOM/timeout/회수실패/예정run누락0. 정상100K CAPPED는 실패나 미해결에 넣지 않는다.
- 제품 전체 회귀의 skip0(실행환경 때문에 skip이 있으면 별도해결), build/export/main-pool 동일binary, source변경 허용목록 pass.

### integrated 성능·자원

- 개발64 및 예약104 **각각**: 전수 R/A4회 median API wall 합계ratio≤1.05, 행렬별ratio p95≤1.10.
- 별도 exact/capped/크기군, API+제품경계wall, RSS/WASM/cgroup peak 전체 공개. 쉬운군 overhead를 합계 뒤에 숨기지 않는다.
- mirror-group clustered fixed-seed bootstrap10,000회: 전수 API 합계ratio95% CI 상한≤1.05를 비열등 확인조건으로 삼는다. 기존5%효과 재입증 조건은 아니다.
- child3GiB/swap0 준수. paired peak-memory 증가비율 p95≤1.10 **또는** 절대증가 p95≤32MiB. baseline가0/계측누락이면 ratio를 만들어내지 않고 실패/원인 확인으로 처리한다.
- 성능/CI/자원/정확성 gate 불통과는 실제 보류 사유다. 정상CAPPED와 달리 timeout/기록누락은 여전히 증거 부족이다. 유한예산으로 이 가능성을0으로 보장할 수 없다.

## 8. 실행 단계와 자원 제안: 실행은 승인 후

public standard Ubuntu24.04 / Node24.13.0 / Rust1.90.0만 사용한다. maxparallel16, child3GiB/swap0, 각호출 독립 integrated API10초/process30초/kill-reap2초는 유지한다. startup/IO와 검산·저장용 단계도 명시적인 별도deadline을 둔다. primary/threshold가 probe 예산을 소비할 수 없다.

| 단계 | 운영안 | job 상한 합계 |
|---|---|---:|
| build/전체회귀/새 기록·강제kill preflight | 2×30분 | 1 runner-hour |
| 개발64(기존16 포함) | 8×50분 | 6.67 runner-hours |
| 독립감사·제품/하네스/schedule 동결 | 1×15분 | 0.25 runner-hours |
| 예약104+tiny115 계약검사 | 16×50분 | 13.33 runner-hours |
| 최종집계/감사/보존 | 2×15분 | 0.5 runner-hours |
| 합계 보수 상한 | — | **21.75 runner-hours** |

전체 경과3시간/총64runner-hours를 최대상한으로 유지한다. 160분 신규호출 중단/175분 취소/180분 종료 보존. 신규호출 시작 전 그 호출 전 단계의 독립deadline+보존여유가 남는지 검사한다. 입력bundle 누적 timeout으로 후속조건 예산을 줄이지 않는다. job50분은 개별 solver timeout과 다른 운영 상한이다.

개발 단계에 기존16개 재현을 포함해 별도pilot 중복호출을 만들지 않는다. correctness/scope/기록/성능 gate 통과 후 예약을 노출한다. 제품source/binary를 사후튜닝하지 않는다. 운영상 일정이 부족하면 미실행으로 보존하고 자동재시도하지 않는다.

Artifact512MiB 이하/retention1일, raw장부 압축·구분, pack25MiB 이하/include-hidden-files, 즉시localdownload/독립audit/seal/sourcebundle. paid runner/과금변경/서비스추가 없다. subagent 없음.

## 9. 검증 통과 후 통합 순서

1. 새기준 실행 승인: 특히 `전체 threshold 완료 gate 제외`와 `integrated 전용 gate/계산범위`를 명시한다.
2. isolated 하네스 보강/preflight → 개발64 → 독립감사/동결 → 예약104 → 독립감사/결과봉인.
3. 통과 시 제품전용diff, matchedWASMhash, completed/capped 전수 결과, threshold 계약, 모든pass/skip/한계를 인계한다.
4. **Dev 적용은 별도 승인 후** JS한줄+binary+필요회귀test만 최소commit으로 연결한다. experiments/Actions를 통째로 merge하지 않는다. 적용 직전 DevHEAD/worktree가 바뀌었으면 자동덮어쓰기하지 않는다.
5. 적용 후 짧은 제품회귀/브라우저main-loader/pool/cache 조합검사로 artifact연결을 확인한다. main merge/defaultbranch/공개배포는 여전히 별도 결정이다.
6. rollback은 자기 적용commit의 JS/binary를 함께 revert한다. 넓은reset/기존 사용자 작업 폐기는 하지 않는다.

**최종 주장은 “A0 integrated100K의 범위 한정 제품 연결과 비회귀를 확인했다”이며, “긴 threshold와 Auto 전체 처리시간이 개선됐다”가 아니다.**
