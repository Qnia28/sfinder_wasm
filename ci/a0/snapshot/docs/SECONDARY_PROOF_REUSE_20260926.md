# Threshold → CP-SAT 증명 구간 재사용

## 100회 결과와 다음 결정

LUNA가 native 26개, JS 계약 12개, oracle 25개 및 부분 증명 8개/전체 품질 후 tie/잘못된 prefix 검증을 통과했다. 양쪽 모두 45/50 exact, 5/50 미완료이며 완료 해답 불일치는 없다. Astra도 177개 동결 해시, 원본 커버/품질, 전달 prefix, 생략한 품질 단계, 완료 CP 정수 objective/bound를 대조했다. 감사 자료: 측정 폴더의 `audit-results.mjs`, `ASTRA_AUDIT.json`.

품질 묶음 하나를 덜 풀어도 ordinary I 평균 +0.81초, ordinary T +3.12초였으며 per-save I는 -0.27초였다. 개선/악화가 섞여 기본 재사용은 false로 유지한다. heldout은 양쪽 모두 품질 증명 미완료이며 partial selectedKeys 차이는 최종 exact 불일치가 아니다.

첫 구현은 증명된 목표마다 개별 등식을 추가하고 prefix 직후부터 다시 묶는다. prefix=4라면 남은 묶음 경계가 이동하고, prefix=3이어도 한 기수 가중 등식이 세 개의 등식으로 바뀐다. 이 모델 형태 차이가 회귀 원인인지 아직 확인하지 못했다. 이를 분리하는 [원래 CP 묶음 유지 실험](SECONDARY_PROOF_BATCHES_20260926.md)을 준비했다. 효과가 불충분하면 재사용 기본 도입을 보류하고 엔진 선택/미관측 입력 검증으로 복귀한다. 제품 기본값과 WASM은 유지한다.

## 문제와 구현

bounded threshold는 예산을 다 쓰기 전 여러 낮은 품질 임계값의 최적 건수를 증명할 수 있다. 기존 반환값에는 feasible 선택과 품질 벡터만 있어 CP가 같은 목표를 다시 증명했다. fixed-K Rust에 별도 progress 함수를 추가해 **완료한 임계값의 최적 건수만** 반환한다. 예산을 소진한 현재 단계의 incumbent 값은 증명 목록에 넣지 않는다. 기존 함수는 progress 수집 없이 기존 동작을 유지한다.

WASM은 별도 bounded progress export와 복사 가능한 getter를 제공한다. JS는 명시적인 `proofProgress:true`를 bounded threshold에만 허용하고 구형 WASM이면 오류를 반환한다. integrated나 외부 lockedPrefix와 혼용하지 않는다. 제품 WASM은 그대로 두고 실험 snapshot만 빌드했다.

실험 portfolio의 `reuseThresholdProof` 기본값은 false다. 활성화하면 이번 호출에서 얻은 증명만 다음 CP callback으로 넘긴다. 증명 길이/정수 범위와 최선 seed의 품질 건수를 확인한다. 다른 필터나 이전 요청에서 만들어진 prefix를 받는 옵션은 없다. 이 목록은 신뢰하는 Rust 엔진의 실행 결과이며 제3자가 독립 검증할 수 있는 형식적 증명 파일은 아니다.

CP 실험 모델은 증명된 품질 목표를 등식으로 고정하고 남은 품질 목표부터 최적화한다. 3개씩 묶는 품질 목표의 경계와 prefix 길이가 달라도 남은 목표 순서를 지킨다. 중복 원본 행의 가중치는 유지하고, 한 행의 같은 candidate 중복은 Rust와 동일하게 최대 품질로 정규화한다. 모든 품질이 이미 증명됐더라도 stable-ID tie 최적화는 반드시 실행한다. 미완료를 exact로 바꾸지 않는다.

증명 재사용이 얼마나 가능한지, CP의 탐색과 준비 비용을 실제로 줄이는지는 아직 측정 전이다. 최선 seed만 전달하는 경우보다 반드시 빠르다고 가정하지 않는다. threshold 내부 DFS 자체를 이어 실행하는 기능은 이번 범위가 아니다.

## 검증 묶음

위치: `D:/AI/sfinder-wasm/tools/validation/secondary-proof-reuse-20260926`.

- native: 기존 테스트에 100개 작은 무작위 행렬×여러 예산의 독립 완전탐색 대조 추가. 각 반환 prefix가 최적 해와 incumbent 모두에 일치하고, progress 유무가 선택/품질/상태 수를 바꾸지 않는지 검사한다.
- JS 계약: 기존 10개 + 정상 증명 전달/잘못된 metadata 거부 2개.
- 기존 portfolio+CP oracle 25개를 재실행한다.
- WASM→CP: 실제 partial prefix를 가진 여러 작은 행렬에서 off/on과 독립 oracle을 대조한다. CP batch 경계, 중복 행·candidate, 품질 증명 후에도 tie가 필요한 사례, 잘못된 prefix 거부를 포함한다.
- 전부 통과해야 10입력×off/on×5회=100개 측정을 시작한다. 이전 어려운 8입력과 full split I/pcinfo-018 L을 유지한다. 이전 15입력 중 빠른 비교군 5개는 이 단계 실험에서 제외하며 최종 일반화 검증에서는 복귀한다.

두 조건 모두 같은 새 WASM, integrated100k→threshold20k→CP 1-worker, 전체 60초/외부 종료 65초다. 둘 다 threshold prefix를 수집하고 CP에 넘기는지 여부만 다르다. partition/decomposition은 사용하지 않는다. 앞선 200k 실험과의 직접 가속률 비교는 하지 않는다. 상태 수·반복 시간 분포·완료율·증명한 prefix 길이·생략한 CP 품질 단계·최종 tie 비용을 비교한다.

native 테스트 실행 파일과 실험 WASM 빌드, JS 문법 검사, snapshot 일치 및 WASM export 검사는 완료했다. 새 테스트/벤치는 미실행이다. 기본 제품 경로에는 연결하지 않았으며, 결과를 확인한 뒤 공통 minimals에 적용할 정책과 브라우저 runtime 처리를 결정한다.
