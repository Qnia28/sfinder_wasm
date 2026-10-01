# Secondary 정책 비교 대상 설계 — Astra

**최신 상태:** 사용자가 기존 실행을104건에서 종료하고 **Sol 없는 Astra/Luna2체제**를 확정했다. 아래5조건/3체제는 이전계약이다. 다음 작업은 [축소 비교 확정안](../../tools/validation/secondary-policy-shortlist-20260926/PLAN_ASTRA_KO.md)의2조건·2회·340개 신규jobs·전체90분예산이며 아직 실행 전이다. 반복2회는Windows 스케줄링편차를확인하라는사용자후속지시다. 기존동결자료/부분출력은 보존한다.

후속 상태: Sol runner 보완과 bounded correctness 검증을 Astra가 감사하여 최종 manifest를 동결했다. [최종 1회 실행 승인](../../tools/validation/secondary-policy-freeze-review-20260926/ASTRA_APPROVAL_KO.md) 및 [검토 증거](../../tools/validation/secondary-policy-freeze-review-20260926/ASTRA_FREEZE_REVIEW.json)가 아래 준비 단계 기록보다 최신이다. 실행 결과는 아직 이 설계의 성능 결론이 아니다.

## 최신 역할과 현재 단계

2026-09-26 사용자 지시: **비교 대상과 실험 질문은 Astra가 설계**하고, **runner 스크립트와 구체적인 실행 계획은 Sol이 작성**한다. 하네스 설정이 완료되어 위임을 재개한다. Sol은 승인·동결된 실행만 Luna에게 전달하며, Astra에게 선제 메시지를 보내지 않는다.

이번 Sol 위임은 아래 대상의 runner/계획 **준비**다. 실행 계획을 읽어 검토하고 snapshot/manifest를 최종 동결하기 전까지 Luna 실행을 전송하지 않는다. 기존 추출·완료 벤치를 다시 실행하지 않는다.

## 비교할 질문

1. 현재 제품 기본 정책 대비 기존 CP 전환 후보가 신규 보드에도 완료율/시간 분포상의 이점을 유지하는가?
2. 쉬운 입력과 기존 ordinary/per-save 회귀를 악화시키지는 않는가?
3. 동일한 integrated/threshold 예산에서 batch-aligned prefix 재사용 자체의 효과가 있는가?

제품 기본 정책 변경은 결과 감사 후 판단한다. 이번에 integrated 10K 같은 새 임계값 탐색을 임의 추가하지 않는다. 사용자 메시지의 10K/100K는 역할 구분의 예시였으며 그 수치의 새 실험 요청으로 해석하지 않는다.

## 고정 입력

[입력·정확성 계약](SECONDARY_POLICY_INPUT_CONTRACT_20260926.md)의 **95개 전부**를 사용한다.

- 기존 `secondary-partition-policy-20260923/manifest.json` cases 76개(ordinary16/per-save54/과거 heldout6).
- 신규 `secondary-newboards-20260926/run-luna/matrices.json` 19개.
- 입력/후보를 결과에 따라 선별하지 않는다. 5개의 신규 trivial 입력도 보존한다.
- 추출 실패/NO_MINIMAL 11개 필터는 원래 추출 모수에 별도로 기록하고 secondary 비교 분모에는 넣지 않는다.

원본 행 가중치, K/seed, stable keys, 일반 saves/per-save 구분 및 primaryHard 근거를 그대로 보존한다. 신규는 capture에서 false, 기존은 기존 측정 계약의 false다. 이번 비교에 primaryHard=true를 인위적으로 추가하지 않는다.

## 고정 비교 조건: 5개

| mode ID | 경로 | threshold 증명 전달 |
|---|---|---|
| `baseline100k` | trivial → integrated 100,000 → threshold exact | CP 없음 |
| `i200k-cp` | trivial → integrated 200,000 → CP | 없음 |
| `i200k-t20k-cp` | trivial → integrated 200,000 → threshold 20,000 → CP | 없음 |
| `i100k-t20k-prefix-control` | trivial → integrated 100,000 → threshold 20,000 → CP | threshold progress는 수집하되 CP에는 빈 prefix 전달 |
| `i100k-t20k-prefix-batched` | trivial → integrated 100,000 → threshold 20,000 → CP | 같은 threshold progress에서 완전히 증명된 원래 batch만 재사용 |

batch 효과의 유효한 인과 대조는 마지막 두 조건뿐이다. `reuseThresholdProof`에 따른 progress 수집 overhead도 두 조건에서 동일하게 유지한다. CP는 모두 **1-worker**, 품질 batch 크기는 기존 **3**, 마지막 짧은 batch 및 stable tie는 기존 검증 모델 계약을 따른다. solver 옵션·hint 정책·준비 경로는 공통으로 고정하고 차이를 보고서에 명시한다.

모든 조건은 동일한 trivial proof 처리와 decomposition/partition off를 유지한다. individual proof locks, threshold300k, `--no-liftoff` 및 새 셋업별 하드코딩은 비교에 넣지 않는다. 조건을 줄이거나 새 엔진 조건을 추가할 필요가 생기면 Sol이 근거를 보고서에 남기고 Astra가 결정한다.

## 공통 판정 기준

- 정확성 우선: 최소 K + 원본 중복행 가중 품질 벡터 + stable-ID tie까지 증명. 불일치/거짓 exact/오류는 채택 불가.
- 신규 seed의 품질 해시는 feasible 기준일 뿐 oracle가 아니다. 완료 결과끼리 전체 벡터와 stable keys를 대조하고 이전 reference가 있는 입력은 함께 대조한다.
- 완료율/시간 내 exact, incomplete/timeout/error/EXACT_LATE를 구분한다. timeout을 제외한 평균만으로 우세를 주장하지 않는다.
- 입력별 대응쌍 분포, 빠른 입력의 절대 시간 차이, ordinary/per-save, 신규/기존, trivial/비trivial, 패턴별 결과를 별도로 제시한다.
- CP lazy runtime/model 준비 및 tie 증명 비용을 포함한다. WASM 초기화, 행렬 준비, solver 구간, 전체 child wall time의 경계를 별도로 명시한다. warm CP 단독 과거 수치와 섞지 않는다.
- 위 95개와 5조건을 바탕으로 정책 결론을 내린다. 신규 결과를 본 뒤 임계값을 조정하면 별도 탐색이며 같은 heldout 검증으로 인정하지 않는다.

## Sol이 구체화할 사항

- 반복 수, 균형 있는 고정 실행 순서, 공통 시간 예산과 supervisor grace, startup/cleanup 제한. 기존 20초/60초 자료를 참조하되 임의 retry나 결과 기반 제한 확대를 넣지 않는다.
- 예상/최악 실행량과 시간, 중단·실패 보존·재시도 금지·단일 호스트 자원 점유, 출력/lock 소유권.
- 입력 manifest와 별도 snapshot, child runner, 집계 및 검증 코드, 검증 테스트, 실행 안내, 동결 파일 목록/해시 초안.
- 공개 정책 API 호출/원본 numeric matrix adapter, stage/CP proof 상태 로깅, 정확성 확인과 실패 분류를 구현한다.
- capture hook이 있는 추출 snapshot을 수정하거나 runner로 직접 재사용하지 않는다. 이전 proof-batches의 solver/model을 독립 새 디렉터리로 복사해 사용할 수 있으나 복사 전 source manifest hash를 확인한다. 제품 WASM을 교체하거나 새 Rust/WASM 빌드를 하지 않는다.
- 모든 실행 조건과 소유권을 검토 가능한 보고서에 기록한다. 충돌/모호성/새 빌드 필요/비현실적인 예상 비용이 있으면 임의 우회하지 않고 보류 사유와 질문을 기록한다.

## 작업 소유권 및 인계

Sol 소유 신규 경로: `tools/validation/secondary-policy-generalization-20260926/**`.

그 밖의 제품/기존 bundle/원본 결과/이번 설계 문서는 읽기 전용이다. 새 경로 안에서도 향후 Luna 소유로 예약할 `run-luna/**`, `execution-luna.log`, `RESULT_LUNA_KO.md`와 runner 전용 `measurement.lock`은 준비 단계에서 생성하지 않는다.

Sol은 준비에 필요한 파일 복사·JSON/해시 생성·`node --check` 구문 검사만 수행한다. 테스트/solver/벤치 실행 및 Luna 전달은 이번 준비 위임에 포함하지 않는다. 검증 테스트는 작성해 다음 승인된 실행 단계에 포함한다.

Sol의 완료 보고서: `tools/validation/secondary-policy-generalization-20260926/PLAN_SOL_KO.md`. Astra가 이를 읽고 runner/계약을 감사한 뒤 최종 동결 및 Luna 1회 실행을 승인한다. 최종 동결 전 새 bundle manifest는 검토용 초안으로 명시한다.
