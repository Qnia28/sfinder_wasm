# R17: 네 RC 회귀의 원인 분리와 최소 수정 후보

작성: GPT-6 Astra, 2026-10-12. 판정: **linMax 단독복구를 최소 후보로 제작한다. 제품 승격은 보류한다.**

## 1. 증거·범위

- run38227051624 / commit b7c0fe76c4452db3b8cb0e5471d47db734ad8642.
- RC 공통기반 2c406b98cadc186bfaf4490f4b8568535a60ea01. P0는 실제 DEV의 baseline(!primaryHard), P1은 P15. C0=120초, C1=무기한. M0=DEV linMax, M1=RC compact.
- 4원명령×8arm×2회=64호출, 독립8VM block에서 두번째 반복 역순. 외부600초, 3GiB, 원입력·thread 유지. 계측 실행이다.
- 원 독립감사 PASS/오류0, EXACT52/TIMEOUT_CALL12/OOM0. 완료 witness는 arm·반복 간 동일하다. 시간초과는 품질 증명 완료로 세지 않는다.
- 수집 후 원74artifact를 사용한 독립감사 재실행도 PASS/64호출/오류0 (solver 재실행0). `saved-evidence-reaudit/INDEPENDENT_AUDIT.json`에 별도 보존했다.
- 5파일 패키지: `files/benchmark-packages/38227051624-attempt1/`. PACKAGE.json SHA256 `3ba87f03dbc3c470d076849c0c68c1a195b11145e67c7db7c4cb3be32ae0aad8`.
- manifest SHA256 `80fdf603b42243e1181adcc7dcff622e9af7aaa99e245229505f6509b21ec448`.
- 자료 투영: `files/triage-database/triage-experiments/rc-regression-r17/`의 calls/segments/stages/contrasts/traces JSONL·CSV 및 FACTORIAL.sqlite. 모든 행은 callId와 원 artifact/member/line을 포함한다. 96개 요인 대조, CP stage3296개.
- 공통 수집 COMPLETE/evidenceValidity PASS/errors0. 공통 executionCompleteness=MISSING은 일반 REPORT 계약 부재이며 실제64 raw/64 start/64 planned와 전용감사 PASS를 별도로 확인했다. 이 필드를 완료로 덮어쓰지 않았다. runner 예약의 일반 계약 미지원/UNKNOWN도 원 SUMMARY에 보존한다. 일반 수집기의 audit90분 추정도 R17 workflow의30분과 다르므로 실제예약의 근거로 쓰지 않는다.
- 앞선 실패3건(38223727424,38224519856,38226458711)은 모두 측정전 실패다. 성공64호출과 섞지 않는다. 누적예약272슬롯/93runner-hours는 실패예약을 보존한 상한이며 실제측정272회라는 뜻이 아니다.

## 2. 생산조건(C1)에서의 직접 대조

아래는 두 반복의 산술평균 초. T/T는 두번 모두 외부600초 timeout이다.

| 원명령 restricted-split | 현재RC P1C1M1 | 모델만복구 P1C1M0 | probe만복구 P0C1M1 | 둘다복구 P0C1M0 |
|---|---:|---:|---:|---:|
| per-save QB068 | T/T | 195.953 | T/T | 195.958 |
| per-save QB293 | T/T | 502.448 | 493.244 | 505.735 |
| ALL QB321 | 163.267 | 144.600 | 163.796 | 145.201 |
| ALL QB318 | 164.786 | 150.814 | 164.493 | 150.795 |

これはDEV直接比較ではなく、RC共通基盤上の介入比較である。R15/R16のDEVとの絶対時間差は別run/VM/計測条件を跨ぐため回復率として扱わない。

### QB068: seed復旧だけでは足りず、モデル表現が決定的

M0はP/Cの全4組合せ×2反復=8/8完了。M1は8/8timeout。
P0でseed hashは変わるがcompactの停止を解消しない。したがってR16で見たDEV優位seedを単独の主要原因とした仮説は修正する。
C1のcompactは両P/両反復でSave Iのquality stageIndex3、levels[11,12,13]から返らない。stable-ID段階まで到達していない。
P1C1M0はSave Iのquality約27.1秒、tie約20.2–20.5秒で完了。
具体例: RC call `e89e7a162f8e78b48db71476541a0305ac4b6791212880568473f8a1fb76a326` と M0 call `e193dfc7d55c5f0b7d1e2048bfaa8e25161877b5f08b542d56c512c556e65ea0`。後者stage原位置 `triage-data-RC_REGRESSION_R17_FACTORIAL_20261012-worker-0/part-0/diagnostic-traces/2405-4.jsonl`（stages表に各line）。

### QB293: P15×compactの相互作用

P1M1はCによらず4/4timeout、それ以外12/12完了。
P0M1の完了はprobe復旧がcompactとの組合せで有効な因果的証拠である。一方M0ではP1のまま完了するため、probe復旧は必要条件ではない。
P1C1M1はSave Sのquality stageIndex4、levels[14,15,16]から返らない（両反復）。M0はquality68.374/72.651秒、tie10.925/11.554秒で完了。
具体例: RC `18b53ec7d46df2d2a852b82970cf416cda744344936de7f701710f687488e4ee`、M0 `c4116cc6c14b33ed6b1f9cf3c1d6d1a22ba275e824a208daf3b98dee5b365c03`。
ただしP0M1はM0より速い反例でもある。C1平均493.244秒に対しP1M0は502.448秒。linMaxが普遍的に速いとは言えない。

### ALL: 同じseedでもquality段階が遅い

両入力は全armで同じseed hash。全16個のM直接対照でcompactが遅い。
QB321差16.602–20.501秒、QB318差13.677–14.342秒。P1C1では平均18.667秒/13.972秒の復旧であり、RC比約11.43%/8.48%短縮。
QB321 P1C1 quality: compact97.094/90.496秒→linMax76.919/73.549秒、tie約8.5秒でほぼ同程度。
QB318 P1C1 quality: compact90.373/93.755秒→linMax77.067/80.325秒、tie11–12秒。
具体例QB321: RC `ca09a3a9be6bbe33a8068b9f5f75d5489cd879f3b657c769308f5f7538b3ab31`、M0 `43480c9fabf2fd5104ade666d2c552ec1e43eacf733f8f2d4f52b01caeaaacb6`。
QB318: RC `39ce66ca73f4f463e546f3f880084ee559d0d7b536f45ff7ff524a4ffdf58a6c`、M0 `2d74fcd5c98e96d45b57a21be581793929ef401c6abb0c1859c0ae2b038da29c`。

### CP制限: 主要原因という説明は支持されない

32個のC対照で完了状態の不一致0。共通EXACT26対照の無期限−120秒差は−3.413～+1.802秒で、M効果より小さい。120秒停止でもper-saveのtimeoutは解消しない。
これはCP競合が一切存在しない証明ではない。今回の4入力の主要な回帰を持続CPで説明する根拠がないという結論であり、production deadlineは導入しない。

## 3. 機序について分かること・分からないこと

Booleanとして同値のモデル表現変更が、同じRC共通基盤・固定入力で完了性とquality証明時間を変えた。停止はstable-ID tieではなくquality目的の段階に局在する。
ただしpresolve/LP/cut/branch内部のどれが効いたかは、今回の粗いstage markerでは判別できない。native search統計・エンジン別CPUは取得しておらず、全scope CPUをCP専用CPUと呼ばない。補助cpu.max UNKNOWNは実scopeの3GiB/swap0契約とは別である。
piece対応は現4fixtureでKが一意であることをassertした投影であり、一般のper-saveに無条件で再利用しない。

## 4. 最小修正と採否

`src/cpsat-secondary-model.mjs` のshared quality ORを
`addBoolOr(xs).onlyEnforceIf(y)` + `addBoolAnd(!xs).onlyEnforceIf(!y)` から
`addMaxEquality(y,xs)` に戻す候補を作成した。これは実験P1C1M0のモデル介入と同じである。
P15、CP無期限、Rust/CP失敗時の相互継続、qualityとstable-IDの双方の証明条件を保つ。
family/K/時間gate追加や両probe/model同時復旧は、4回帰を直すために不要なので今回の最小候補には入れない。

合成原row全探索oracleでNode/browser両API・compact対照・全quality/tie段階を比較し、shape確認と失敗復旧検査を実施: 12PASS/5SKIP。SKIPは実CPを用いるopt-in検査であり成功扱いしない。ローカルpopulation benchmarkは0。

**候補採用は研究用、製品昇格は保留。** 二反復の局所因果screenは完了したが、2回×3周の無計測確認は未実施である。
特にOOM改善の後退が重要な反例候補である。今回の小さい4入力でもP1C1M0のpeakはおおむね高い（QB068約460–480MiB対compact431–443MiB）。異なる実行長を含むpeak比較であり一般的な割合へ外挿しない。過去のOOM代表でlinMaxは不利だったため、単に4入力でOOM0という理由で全体復旧を製品化してはいけない。

## 5. 次の判定実験

同一の無計測製品DEV/元RC/候補を、今回4回帰＋R15既存イ득代表＋OOM改善代表で2反復×3周比較する。原fixture/family/hold/thread、外部600秒と12VM上限を維持する。
事前に対象と追加予算を凍結し、呼出し完了性・exact witness・平均所要時間損益・OOMを別々に評価する。反例が存在しても対象群の平均利益が損失を上回ることを重視するが、未完了を成功時間へ補完しない。
本報告はこの確認実験を実施済みとしない。最小候補のdiffとハンドオフにより次の確認を再現可能にする。
