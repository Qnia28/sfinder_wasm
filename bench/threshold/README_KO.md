# Threshold 엔진 on/off 실험 — 2026-10-03

## 완료된 Actions 캠페인

지정 cycle-1 DB에서 315개 행렬의 K 증명 → baseline → 단독 screening → ablation →
동일 후보 확인 두 차례를 완료했다. [최종 보고서](FINAL_REPORT_KO.md)와
[실행 기록](ACTIONS_RESULTS_KO.md)을 참고한다. 현재 권장 검토 후보는 mask16이며,
dev/main에 통합하지 않았다. 아래 로컬 계획/초기20 stress 입력은 이전 단계 설명이다.

## 범위와 안전장치

- 원본 `D:\AI\sfinder-wasm\dev-branch`는 읽기 전용이다.
- 작업 저장소는 별도 clone `D:\AI\sfinder-wasm\sol\threshold-engine-20261003`.
- 로컬 branch: `experiment/threshold-engine-20261003`.
- 기준: `c0cb2a048e7275bfea587d176b1954efff0a8a08`.
- 제품 secondary 라우팅, 100K/60초, CP 선택, integrated, primary 정책은 변경하지 않는다.
- 구현/측정은 실험 ABI를 직접 사용한다. 기존 ABI는 `EXPERIMENT=false`로 컴파일된다.
- 이 작업은 commit/push/제품 승격을 자동으로 하지 않는다.

## 옵션

| Bit | 값 | 요소 | 구현 범위 |
|---|---:|---|---|
| 0 | 1 | stagedBounds | dead 상한 → top-gain 상한 → 필요할 때 pair 상한 |
| 1 | 2 | removePresort | DFS에서 다시 정렬하는 준비 단계 정렬 제거 |
| 2 | 4 | rootForced | 정규화한 원본 singleton F를 각 단계 루트에서 선택 |
| 3 | 8 | priorPropagation | 증명된 이전 target에서 필수 그룹의 singleton 전파 |
| 4 | 16 | currentPropagation | 현재 개선 목표에서 필수 그룹의 singleton 전파 |

mask는 0..31의 정수다. 모두 독립적으로 켜고 끌 수 있다. 0=all-off,
31=all-on. prior OFF/current ON도 유효하다. all-on은 채택된 최종 후보가 아니다.

원본 행/중복 가중치/품질/ID 순서를 유지한다. rootForced에서 품질 그룹을
삭제하거나 상수 기여로 재압축하지 않는다. 전파는 그룹 스캔 방식이며 pivot은
기존 primary MRV다. watcher, 새 pivot, kernel 재사용, memo, tail 전용 탐색은 미구현이다.

### 전파의 근거

목표 T에서 `slack = totalWeight - T - deadBad`.
미달성 그룹의 `weight > slack`이면 그 그룹은 필수다. available 후보가
하나면 선택한다. `weight == slack`은 강제 조건이 아니다.

중간 단계의 current 목표는 `bestCurrent+1`, 마지막 단계는 `bestCurrent`다.
마지막 동률 stable-ID 탐색을 유지한다. current 목표에서 도출한 강제 선택은
다음 품질 단계에 전달하지 않는다. 프레임의 강제 선택은 역순 undo한다.
조상 프레임의 sibling 제외는 유지한다.

### 예산/증명

실험 ABI budget=0은 실제 0, `u32::MAX`는 무제한이다.
예산 debit은 DFS 진입 1 + root 강제 선택 1 + 동적 강제 선택 1이다.
`searchedStates`는 debit 총합이다. ON/OFF의 순수 DFS 개수는 trace의
`dfsEntries`로 구분한다. 그룹 스캔/pair 검사 자체는 시간 제한으로 보호하며
작업량을 trace로 따로 기록한다. 따라서 state budget을 CPU 작업량 상한이라고
해석하면 안 된다.

budget 중단은 완전한 feasible K-incumbent만 반환하고, 완료하지 못한 단계의
prefix를 추가하지 않는다. caller가 전달하는 lockedPrefix는 동일 행렬/K에서
독립적으로 증명한 값만 허용한다. seed 점수의 일치만으로 최적성이 증명되지 않는다.

## 빌드

Node 24.13.0, Rust 1.90.0 + wasm32-unknown-unknown.

```powershell
# 로컬 도구를 쓰는 경우: dev를 향하는 activate.ps1을 그대로 사용하지 않는다.
$env:RUSTC='D:\AI\sfinder-wasm\tools\rust-1.90.0\bin\rustc.exe'
$env:CARGO='D:\AI\sfinder-wasm\tools\rust-1.90.0\bin\cargo.exe'
node bench/threshold/build.mjs
```

`build.mjs`는 이 clone의 고정 ancestor에서 Rust 소스만 archive한다.
원본 dev에 접근하거나 working tree를 checkout/reset하지 않는다.
빌드는 `bench/threshold/build/` 아래에 격리한다.

| 파일 | 목적 |
|---|---|
| original.wasm | 고정 기준 소스에서 재빌드 |
| production.wasm | 수정 소스의 기존 제품 ABI, experimental feature 없음 |
| experiment.wasm | 실험 API; 32설정을 동일 바이너리로 비교 |
| trace.wasm | 상세 카운터; 성능 승격 근거로 사용 금지 |
| build.json | 도구 버전/flags, revision/dirty 상태, Rust/harness 소스 및 WASM hash |

실험 ABI의 version=1을 검사한다. trace가 꺼진 빌드의 영(0) 카운터를 실제
관측처럼 출력하지 않는다. 현재 진단은 카운터 중심이다. **WASM의 준비/단계별
시간은 아직 따로 계측하지 않으며**, 마지막 단계 시간을 순수 tie 시간이라고
주장하지 않는다.

## 입력

manifest에 개발 12 + 미사용 검증 8개를 고정했다. 보드/반전 그룹은 두 집합
사이에서 겹치지 않는다. 검증군은 과거 자료이며 신규 수집 보드라는 뜻은 아니다.

`inputs/*.json.gz`는 원본 JSON bytes를 그대로 압축했다. 압축/해제 후 SHA256,
고정 K/seed, 원본 ID 순서를 검산한다. 총 압축 크기 약 1.04 MB.
CI는 로컬 `D:\AI\...` 경로에 의존하지 않는다.

원본 재수집이 필요한 경우 `import-fixtures.mjs <기존 작업 루트>`를 사용한다.
기존 manifest가 있으면 덮어쓰지 않고 실패한다. 입력/seed를 벤치 결과에 맞춰
교체하지 않는다. 기존 K는 감사된 capture의 증명을 신뢰하며 이 실험에서
primary K를 다시 증명하지 않는다. seed를 최적 품질 reference로 사용하지 않는다.

## 정확성

```powershell
node bench/threshold/fixtures.mjs --verify
node --test --test-concurrency=1 bench/threshold/correctness.test.mjs bench/threshold/harness.test.mjs
node bench/threshold/product-regression.mjs
```

Native Rust:

```text
cargo test --manifest-path rust/Cargo.toml --workspace --offline
cargo test --manifest-path rust/Cargo.toml -p pc-core --features threshold-trace --offline
```

- 512개의 작은 행렬 × 32설정; 최소 K부터 품질·stable-ID까지 완전열거 oracle.
- 독립 seed 2,000개 × all-off/단독 ON/all-on의 7설정.
- 160개 × 32설정 × budget 0/1/2/5/20/100/unlimited.
- trusted prefix 일부/전체 import, 최종 stable tie, 중복행/ID/희소 품질.
- native test 빌드에서 add/remove/exclude/include 후 상태를 원본에서 재계산.
- A/B/all-off는 결과뿐 아니라 bounded incumbent/prefix/상태 수도 원래 엔진과 일치.
- root/prior/current의 카운터가 실제로 발화하고, 독립 on/off가 작동하는지 확인.
- 기존 제품 entry point와 원본의 parity, 실제 CP/worker/취소 회귀.

기존 baseline의 clippy `needless_borrow`, `manual_range_contains` 두 범주만
CI에서 허용한다. 나머지는 `-D warnings`. baseline의 관련 없는 소스를
lint 정리 목적으로 수정하지 않는다.

`product-regression.mjs`는 이 checkout의 pc_wasm.wasm을 feature 없는 새
production 빌드로 잠시 대체하고 finally에서 저장한 bytes를 복원한다.
원본 dev 파일은 건드리지 않는다.

## 벤치마크

```powershell
# 출력 폴더는 항상 새 경로를 사용한다. 기존 samples.jsonl이 있으면 실패한다.
node bench/threshold/benchmark.mjs --profile smoke --out bench/threshold/results/smoke-001
node bench/threshold/benchmark.mjs --profile baseline --out bench/threshold/results/baseline-001
node bench/threshold/benchmark.mjs --profile screen --out bench/threshold/results/screen-001
node bench/threshold/benchmark.mjs --profile ablation --mask 21 --out bench/threshold/results/ablation-001
node bench/threshold/benchmark.mjs --profile confirm --mask 21 --suite all --out bench/threshold/results/confirm-001
node bench/threshold/benchmark.mjs --profile diagnostic --case qb266-full-Z --mask 31 --out bench/threshold/results/diagnostic-001
```

mask=21は説明用であり選定済み設定ではない。

| Profile | 比較 | 既定pair数 | solver制限 |
|---|---|---:|---:|
| smoke | original↔off、off↔all-on、2入力 | 1 | 10秒 |
| baseline | original↔off、開発12入力 | 3 | 20秒 |
| screen | off↔各単独ON、開発12入力 | 3 | 20秒 |
| ablation | off↔C*、C*から各ONビットを1つ除去↔C* | 3 | 30秒 |
| confirm | original↔C*、all指定で20入力 | 5 | 60秒 |
| factorial | off↔mask1..31、固定代表6入力 | 2 | 10秒 |
| diagnostic | trace/off↔trace/C* | 1 | 20秒 |

factorialは独立サンプルよりrunner差を避けるため、各maskごとにoffを
再実行するpaired方式とした。32設定×2回の単独計測より呼出し数は多い。
screen/defaultは360呼出し、confirm/all/defaultは200呼出し。

### 時間とrunner

- 各呼出しはfresh Node process + fresh WASM instance。
- 入力読込/hash検算、instance準備、固定小行列warm-up後にready通知。
- parentはready後にsolver timeoutを開始する。
- `nativeMs`を主指標：Rust ABI内の行変換・正規化・前処理・探索を含む。
- `solverMs`はJSの入力検査/packing/copy/getterも含む補助指標。
- 返却witnessの原本再計算/hashは測定外。
- 外部起動/終了込みの`outerMs`も記録。
- 同一runnerでAB/BAを交互に直列実行。比較要素の順序も反転・回転。
- 異なるrunnerの絶対時間を混ぜてON/OFF比を計算しない。
- TIMEOUTは打切り。制限時間を完了時間として中央値/加速率に入れない。
- SETUP/VALIDATION/CLEANUP timeoutとsolver TIMEOUTは別status。
- 返却K/原本coverage/重複行加重品質を再計算し、completed同士のID/品質hashを照合。
- candidateだけ完了したpairは別計上し、baselineとの最適解一致を確認したと偽らない。
- process peak RSSとWASM committed memoryを区別し、native peak heapとは呼ばない。

時間測定中にbuild/他ベンチを並列実行しない。ローカルsmokeの数値は
実装/runner疎通の確認であり、性能採用の根拠ではない。

## GitHub Actions

`.github/workflows/threshold-performance.yml`:

1. build/config/fixture検算。
2. correctnessが成功した場合のみbenchmarkを開始。
3. matrixは入力単位、max-parallel=2。各入力のON/OFFは同じjobで直列。
4. timeoutや失敗時もraw/witness/environmentをartifactに保存、30日保持。
5. summaryはjob内paired比をまとめるだけ。欠落入力を成功扱いしない。

### 新規workflowの起動

このローカルブランチをcommit/pushしたときは、**committed `ci-run.json`**
の設定でpush triggerが起動する。既定は小さなsmokeだけ。

以後 `ci-run.json` のprofile/suite/maskを変更して実験commitをpushすると、
default branchへのworkflow導入なしでも実験を指定できる。
例えばscreenはprofile=`screen`, suite=`development`、pairs/timeoutはnull。
confirmはprofile=`confirm`, suite=`all`, candidateMaskに動結候補を指定。

workflow_dispatchも備える。ただしGitHubのdefault branchに新規workflowが
まだ無い場合、UI/APIでdispatch可能とは限らない。その場合は上のpush設定
方式を使用する。ここではmain/devへのworkflow追加・mergeを行わない。

公開前に機密情報が入力に含まれないことを確認し、**このcloneから実験
branchだけをpush**する。build/results/node_modulesはgitignore済み。

## 判定手順

1. baselineでall-offの正確性と基礎コストを確認。
2. screenで単独要素を評価、疑わしい差は繰返し確認。
3. C*のmask/根拠を新しいcommitに固定。
4. ablationで各構成要素が組合せ内でも寄与するか確認。
5. confirmで開発/検証を分けて評価。同じ候補で確認runをもう一度行う。

正確性不一致は即棄却。性能の暫定基準は目標群10%以上改善またはexact
増加。入力別10%以上かつ5ms以上の回帰、baseline exact→candidate timeout、
メモリ20%以上増加は別審査。全体平均だけで回帰を隠さない。

## 今後の独立要素

- P1: 元候補集合のcoverage行kernelを一度作り、各段階のactiveマスクに適用。
- P2: 候補対のdominance関係を増分更新。active削除マスクの単純累積は不可。
- T2b: Fによる品質上限ではなく、threshold達成済み行の定数寄与分離。
- E1: 残り1/2候補のcoverage・全prior・current・IDを共同評価。

初期5要素と同時に実装せず、別bit/API version/manifestとして追加する。
