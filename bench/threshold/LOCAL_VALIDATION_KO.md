# 로컬 구현 검증 — 2026-10-03

## 상태

- 작업: 별도 clone의 `experiment/threshold-engine-20261003`.
- 기준 commit: `c0cb2a048e7275bfea587d176b1954efff0a8a08`.
- 원본 dev의 HEAD/branch/working tree는 변경하지 않았다.
- commit/push 및 GitHub Actions 원격 실행은 수행하지 않았다.
- 초기 5요소/32조합 구현 완료. P1/P2/T2b/E1은 별도 후속이며 미구현이다.
- 모든 수치는 구현 검증용이다. 성능 승격/전체 입력 비회귀를 주장하지 않는다.

## 성공한 검사

| 검사 | 결과 |
|---|---|
| Feature 없는 Rust workspace | 80 pass (batch 3 + pc-core 73 + legal oracle 4), fail 0 |
| threshold-trace native pc-core/lib | 78 pass, fail 0; 기존 + 신규 5개 테스트 |
| 실험 WASM/oracle/harness | 10 pass, fail/skip 0 |
| 기존 secondary/portfolio/components/parallel/filter-worker | 53 pass, fail/skip 0; 실제 CP 포함 |
| fixture SHA256 / seed / mirror 분리 | 20개 검산 성공 |
| changed Rust rustfmt | 성공 |
| Clippy | baseline의 두 기존 lint 범주만 허용하고 -D warnings 성공 |
| Workflow YAML | YAML parser로 중복키/구문, branch trigger, correctness gate, matrix, permissions 확인 |
| Benchmark smoke | 2개 실제 행렬 × original/off 및 off/all-on; 8호출 EXACT, witness 일치 |
| Timeout 경로 | original/off 각각 TIMEOUT을 정상 기록하고 자식 종료/다음 비교 진행 |
| Summary 경로 | paired 집계와 expected-case 누락 검사 성공 |

원시 로그는 로컬 `results/final-validation/`, 마지막 smoke는 `results/final-smoke/`,
집계는 `results/final-summary/`에 있다. 이 경로는 gitignore이며 Actions에서는
해당 workflow 실행의 artifact로 결과를 보존한다.

### 최종 검증에 사용한 WASM SHA256

```text
original   aac18952a36ee9112219702ce084a9534ad42a244565cc24e0b8f52a79bcd48c
production 2d02d435deeb0c4b653f3aa42639726731cb898cfdb500d5308fafbb3c2fc381
experiment 9852db6f2c35c08f905fc804b092590f9007377e9d93f9f2844992877fa3fd18
trace      428803c4b524aa1920e3236ae9ead484d3d941cd68e4d1cd944020ab791e3ba6
```

WASM hashにはビルド環境/ソース位置等が影響しうる。GitHub側は同一runで
再ビルドしたartifactのhashを使用し、ローカルhashとの一致を要求しない。

## 限界と失敗試行

- ローカルnativeはWindows GNU + rust-lld/self-containedで実行。
  最初のMSVC既定target試行はlink.exe不在で失敗した。
- 既存baselineには`needless_borrow`と`manual_range_contains`警告があり、
  無条件`-D warnings`試行は失敗した。 unrelated sourceを修正せず、この
  2範囲だけCIでも許可した。
- Powershellのnpm.ps1制限を避けてnpm.cmdを使用。cargo-fmtのPATH不足は
  rustfmt.exe直接実行で対応した。
- GitHub-hosted Linux上のworkflowは未実行。YAML解析成功はActions実行成功の証明ではない。
- Chrome/ブラウザでの新実験ABI検証、全製品Nodeテスト、全20入力の本ベンチは未実行。
- 詳細traceはカウンターのみ。準備/段階別WASM時間、純粋tie時間は未計測。
- 最後のsmoke以外の初期疎通測定にはビルドと重なった試行がある。
  それらの時間は性能評価に使用しない。最後のsmokeも1pairなので性能判断には不足する。

## 次の実行

1. 実験cloneの差分を確認して、このbranchでcommit。
2. 当初のci-run.json（smoke）のまま、このbranchだけpush。
3. Actionsのcorrectness/smoke成功を確認。
4. baseline → screenの順でci-run.jsonを変更した実験commitを実行。
5. C*を選定してablation/confirmを実行。all-onを既定採用しない。

詳細仕様とコマンドは [README_KO.md](README_KO.md)。
