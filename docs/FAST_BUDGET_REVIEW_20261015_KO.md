# Fast 예산: 현재 경로 조사와 기존 자료 기반 가설

2026-10-15 · 기준 DEV `3a938a3` · 조사 단계 1~2 완료.
질문: **제한된 exact probe가 직접 2↔2보다 전체 시간·최종 품질에서 언제 이득인가?**
대상은 공개 `secondary:'auto'`(Fast)의 일반 minimals와 per-save다.
Boolean 및 Worker 배분 설계는 후속이다. 이번 작업은 코드·문서·보존 테스트의 정적 검토이며 solver/벤치마크 호출 0이다.
기존 `Todo.md` 미커밋 내용을 보존하고 아래 진행 기록만 추가했다.

## 1. 핵심 결론

1. 현재도 부분적인 조건부 정책이다: `primaryHard`에서는 probe를 생략하고, dominance preview에는 세 가지 크기 가드가 있다.
2. 일반 minimals와 per-save는 공통 Fast 본체를 쓰지만 **진입 경로까지 같지는 않다**. per-save의 단일 큐 직접 처리와 tiny exact는 Fast 예산 밖에 있다.
3. `fastStateBudget` 하나를 줄이면 integrated뿐 아니라 preview/grace 한도도 줄어든다. 단일 단계의 효과로 해석하면 안 된다.
4. 미완료 integrated/grace의 seed는 이어지지만 미완료 dominance preview는 의도적으로 버린다. 세 probe의 목적·평가 기준을 구분해야 한다.
5. 구조별 선택은 유망한 가설이다. 기존 exact triage만으로 Fast cutoff나 최적 예산은 결정할 수 없다. 특히 2x2 최종 품질·비용 자료가 필요하다.
6. 우선 후보는 **고정 예산 축소 대조 + 조건부 생략/유지**다. 탐색 도중 동적 연장은 현재 API에 탐색 재개가 없어 별도 구현 비용이 크다.

## 2. 공개 진입점과 우회 경로

`src/secondary-policy.mjs:8-14`에서 auto→fast, quality→exact auto, 2x2→직접 refine으로 해석한다.

| 경로 | 실제 진입점/동작 | 예산 조사에서의 의미 |
|---|---|---|
| 일반 minimals | `src/minimals-feature.mjs:141-155` → `minimumCoverAsync` | adaptive의 ≤48 tiny gate를 거치지 않음 |
| per-save 일반/숫자 행렬 | `src/per-save-minimals-core.mjs:259-325,373-508` → 필요시 `minimumCoverAdaptiveAsync` | save마다 예산 적용 |
| per-save 단일 큐 | auto primary 및 auto/rust 내부 secondary에서 `maybeDirect` | `perSaveBest` 성공 시 본체 우회, 직접 exact 반환 |
| per-save tiny | 같은 조건에서 후보 ≤48이면 legacy exact; compact/numeric 경로에는 별도 tiny 처리도 존재 | 무제한 exact 경로이며 `fastStateBudget`으로 제한되지 않음 |
| 명시적 `2x2` | direct/tiny를 우회하고 primary 후 refine | 공개 auto 대 2x2 비교는 probe만 제거한 대조가 아닐 수 있음 |
| 선택적 전체필터 Worker | `src/filter-cover-task.mjs:49-54` → adaptive | 이번 설계의 기본 비교에서는 배분 효과를 혼합하지 않음 |

따라서 나중의 비교는 (a) 실제 공개 API 전체 비용, (b) **동일 원 행렬·K·primary seed에서의 secondary-only 손익**을 구분해야 한다.
tiny/direct 결과를 nontrivial probe 적중률 분모에 섞지 않는다.

## 3. Fast 본체 실행 흐름

근거: `src/min-cover-adaptive.mjs:144-412`.

```text
원 품질 행렬 준비 → primary kernel → 정확한 최소 K 및 feasible primary seed
  ├─ 빈 행렬 / 품질 없는 요청: 즉시 반환
  ├─ exact 모드: 별도 exact 경로 (이번 대상 아님)
  ├─ 명시적 2x2 또는 primaryHard: primary seed → 2x2
  └─ 보통 Fast:
       조건부 dominance preview (exact 완료만 채택)
         ↓ 미완료/미지원이면 preview seed 폐기
       integrated bounded (원 primary seed에서 시작)
         ↓ 미완료 incumbent 전달
       threshold grace bounded
         ↓ 미완료 incumbent 전달
       2x2 refine → 품질 미증명 결과
```

### 예산과 가드

주 예산 `B = max(1, floor(Number(fastStateBudget) || 100000))`.
WASM adapter에서 실제 상태 예산은 추가로 `0xfffffffd`까지 clamp한다.
따라서 0은 probe 생략을 뜻하지 않고 기본 100K로 돌아간다. 음수는 1이 된다.
0/생략 의미, 유효성 검사, 명시적 설정과 향후 자동 정책의 우선순위는 후속 계약 사항이다.

| 단계 | 현재 한도 | 추가 조건/효과 |
|---|---|---|
| dominance preview | `max(1,min(2500,floor(B/20)))` | primary kernel entries ≤512, 원 후보 수 ≤256, 원 후보 수×원 행 수 ≤1,500,000 |
| integrated | B (기본 100,000) | preview가 exact로 끝나지 않았을 때 |
| threshold grace | `max(1,min(5000,floor(B/10)))` | integrated가 exact로 끝나지 않았을 때 |
| 2x2 | 최대 16 passes | state/time 예산이 아니며 준비·한 pass 비용도 가변 |

기본값에서 세 탐색의 설정 한도 합은 최대 107,500이지만, 이는 호출 시간·메모리 상한이 아니다.
`primaryHard`는 primary 커널의 구조 판정이지 실제 primary 소요시간이나 secondary 난도의 확정 판정이 아니다.

### seed와 증명

- preview 미완료 seed는 버리고 integrated를 원 seed에서 시작한다. dominance가 bounded DFS 순서를 바꾸므로 역사 Fast 품질 경로를 보호하는 기존 계약이다.
- integrated 미완료 keys가 K개면 grace seed로 전달한다. grace 미완료 keys가 K개면 refine seed로 전달한다. 해당 결과가 없으면 앞선 seed로 돌아간다.
- 이 전달은 **incumbent 재사용**이다. DFS frontier·전처리·진행한 증명 상태를 그대로 이어가는 것은 아니다.
- 각 bounded 단계의 completed 및 count=K인 결과만 exact로 반환한다. refine 경로는 `qualityExact:false`다.
- 2x2는 원 품질 행의 중복 가중치·전체 coverage·K를 유지하고 품질 histogram, 동률 stable ID로 개선한다.
- 더 좋은 시작 seed가 더 좋은 최종 local optimum 또는 더 짧은 refine 시간을 보장하지는 않는다. 서로 다른 출발점의 최종 결과를 실제로 비교해야 한다.

## 4. 비용·재사용·관측 공백

### 준비 비용과 재개 가능성

`src/pc-wasm-min-cover.mjs:167-290`, `src/pc-wasm-cover-matrix.mjs:44-103`:

- numeric coverage는 JS universe/packed CSR을 재사용한다. 일반 Map 경로는 각 fixed-K 호출에서 universe/품질 packing을 다시 할 수 있다.
- numeric 재사용 여부와 관계없이 현 adapter는 각 호출마다 WASM buffer 할당·복사·해제를 수행한다.
- Rust integrated는 normalize, coverage dominance, bitset, seed 품질 등을 준비한 뒤 탐색 예산을 소비한다 (`rust/pc-core/src/min_cover.rs:840-989`).
- threshold도 normalize, seed 검증, 품질 단계별 데이터 준비 후 bounded search를 수행한다 (`:2088-2183`).
- 현재 Fast 호출 API에는 동일 탐색을 중단·재개하는 handle이 없다. 작은 probe 뒤 큰 probe를 다시 호출하면 준비·탐색을 다시 수행한다.
- 2x2도 자체적으로 동일 행 묶기(128행 이상), 품질 rank, dense 배열 등을 준비한다. 주요 dense/covers 배열만 원 후보 수×묶인 행 수에 비례한다 (`src/min-cover-quality-refine.mjs:53-95`).

따라서 **probe 생략 → 전체 시간이 반드시 단축**된다고 할 수 없다. 더 나쁜 seed로 refine 비용이 늘 수 있고, 직접 refine 역시 메모리·시간의 하드 상한을 제공하지 않는다.

### 이미 있는 특징 / 새로 필요한 특징

| 특징 | 현재 Fast에서의 가용성 | 판단 |
|---|---|---|
| K, 원 후보 수 S, 원 행 수 N, primary kernel 통계, primaryHard | primary 종료 시 보유 | 첫 후보, 추가 스캔 최소화 |
| 원 entry 수 E | numeric/일반 모두 prepared.entryCount에 존재 (`src/highs-cardinality.mjs:67-105`) | 기존 준비 결과 재사용 가능 |
| 원 singleton F, d=K−F, u=S−F | exact 경로의 `inspectTrivialSecondary`가 제공하지만 Fast 본체는 호출하지 않음 | 공짜 특징이 아님. 기존 준비와 합치는 방식 검토 |
| 품질 단계 수·동치 행 수 | 후속 엔진/refine 내부에서 계산 | 분류용 선계산은 추가 비용이므로 첫 규칙에 자동 도입하지 않음 |

primary dominance 이후 forced를 원 품질 문제 F로 대체하면 안 된다.
exact의 original-row trivial proof도 Fast 본체에는 현재 공통 적용되지 않는다. 도입 시 별도 변경으로 취급한다.

### 결과 메타데이터의 한계

- 일반 minimals는 단계별 예산/상태 수·fastDecision·품질 exact 여부를 내보낸다 (`src/minimals-feature.mjs:120-128`). 단계별 시간·중간 seed 품질·복사 비용은 없다.
- per-save의 `finishPieceResultNow`는 품질/백엔드는 남기지만 Fast 세부 예산·상태 수·decision을 전달하지 않는다 (`src/per-save-minimals-core.mjs:153-178`). 공개 최종 결과만으로 save별 원인 분석이 불충분하다.
- `primaryHard` 반환의 `fastProbeBudget`은 사용자 설정 대신 상수 100K를 기록한다. tiny도 예산 표시와 실제 적용 여부가 다르다. 상태 0과 선택 경로를 함께 읽어야 한다.
- Fast 단계는 동기 JS/WASM 호출이다. 본체는 진입·primary 이후에 signal을 확인하지만 각 probe/2x2 내부 cooperative 취소나 시간 예산은 없다. 상태 예산을 deadline으로 설명할 수 없다.

## 5. 기존 자료가 뒷받침하는 것과 한계

아래 수치는 기존 보고서의 인용이며 이번 작업에서 원 DB 재집계/재실행하지 않았다.
triage 자료의 현재 위치는 작업 루트의 `../archive/triage-analysis/`다.

| 자료 | 관측/계약 | Fast 가설에 사용할 범위 |
|---|---|---|
| [Astra 10/06 분석](../../archive/triage-analysis/Astra/ANALYSIS_REPORT_KO.md), §1~2 | ALL d≤8의 226행렬, 추가 per-save128의 같은 구간 53행렬은 초기 2회 모두 I exact·최종 states≤100K. 작은 d에서도 최대 2.80초 | 작은 d 보호 가설. 현재 Fast preview/grace/2x2의 실제 paired 효과는 아님 |
| 같은 분석 | ALL d≥17의 106행렬에서 완료 20개는 모두 I100K 초과, 나머지 86개 timeout. 당시 primaryHard 제외 변경대상 93개 | 높은 d에서 주 probe 축소/생략 후보. seed 손실·2x2 손익은 미확인 |
| 같은 분석 | primaryHard18개 중 2개는 I100K 안에 완료하며 T보다 유리 | primaryHard를 secondary 난도의 완전한 기준으로 볼 수 없음. 현재 hard→2x2보다 probe가 유리한지는 별도 질문 |
| [Gemini 검토](../../archive/triage-analysis/gemini-4-argon-review-20261014/REVIEW_KO.md), §2~4 | QB015에서 미완료 probe seed가 후속 exact 완료를 바꿈. 100K/1K에 보편 ms/OOM 상한 없음 | seed 비교 필요성의 근거. 후속이 threshold인 결과를 Fast 2x2 개선 수치로 전용하지 않음 |
| 같은 검토 | QB144 104,227states, QB164 126,484states의 130K 상향 후보는 두 표본 기반 | 100K 경계 반례 보존. 상향의 순이득이나 일반화 근거는 아님 |
| `../../tools/validation/tests/fast-dominance-preview.test.mjs` | GRACE *p7, K45의 default preview exact 기대값; 미완료 preview 폐기·후보257에서 skip 계약 | preview 일괄 제거 시 보호할 역사 사례. 테스트 소스를 읽었으며 현재 실행 PASS를 주장하지 않음 |
| `../../tools/validation/tests/fast-threshold-grace.test.mjs` | 같은 GRACE에 B40K를 주면 integrated40K 후 grace≤4K로 exact라는 기대값 | 예산 축소가 preview 완료 경로까지 바꾼다는 구체적 사례. 시간 개선 여부는 이 테스트로 알 수 없음 |
| [품질 최적화 문서](MINIMALS_OPTIMIZATION.md), 끝부분 | primary cuts로 incumbent가 바뀌어 bounded Fast 품질이 나빠진 역사 사례 | 비교 시 primary/seed 고정 필요. 제외된 BOX를 새 측정 대상으로 자동 편입하지 않음 |

자료 해석 주의:

- 보존 테스트에는 출시 전 `exactHumanQuality` API가 쓰인다. 현재 공개 API에서 그대로 실행 가능한 신규 벤치 명세가 아니다.
- `tools/secondary-bench/planning/A_FAST_FOLLOWUP_20261007_KO.md`의 “fast-path”는 exact triage의 빠른 입력·trace 비용 교차검증이다. 공개 Fast 모드 비교로 오인하지 않는다.
- 기존 triage는 exact 엔진/정책 중심이다. 이번에 읽은 자료에서는 **현재 공개 Fast 대 직접 2x2의 전체 시간·최종 품질·단계별 seed를 갖춘 대응 비교**를 확인하지 못했다. 보존 ZIP의 모든 객체를 전수 조사했다는 뜻은 아니다.
- 과거 보고서의 raw 경로는 역사 경로다. 필요시 `../../research-compact-20261014/RESEARCH_REFERENCE.zip` 내부 인덱스와 `../../archive/cleanup-20261014/SUPPLEMENT_INDEX.json`에서 특정 결과를 조회한다. 이번 단계에는 대량 복원 불필요.

## 6. 검증할 가설과 기각 조건

| ID | 가설 | 근거 / 실패할 수 있는 이유 | 다음에 필요한 최소 비교 |
|---|---|---|---|
| H1 | 저-d에서는 full probe 보존이 유리하다 | 과거 ≤100K 완료 집중 / 큰 행렬 전처리는 느리고 직접 2x2도 충분할 수 있음 | 동일 행렬·seed에서 현재 Fast 대 축소·직접2x2, 최종 품질/전체 시간 |
| H2 | 높은 d에서는 축소/생략으로 이득이다 | 과거 100K 완료 부재 / 미완료 seed 손실이 refine 시간·품질을 악화시킬 수 있음 | 각 probe seed 품질과 최종 refine 결과까지 비교; exact 완료율만으로 채택하지 않음 |
| H3 | 작은 probe만으로 seed 이득 대부분을 얻는다 | R19는 seed의 중요성을 입증 / 1K면 충분하다는 Fast 근거는 없음 | 원 seed·축소 seed·100K seed에서 각각 동일 refine; 예산값은 아직 미확정 |
| H4 | preview/grace의 선택적 유지가 integrated 일괄 축소보다 낫다 | GRACE의 서로 다른 조기 exact 경로 / 추가 준비 비용이 이득을 지울 수 있음 | 주 probe와 부가 probe 효과 분리. 현재 B 축소와 integrated-only 축소를 혼동하지 않음 |
| H5 | 구조 특징을 추가하기 전에 준비 비용 감소가 효과적일 수 있다 | 최대 세 번 WASM 준비, 일반 Map 재packing / numeric 재사용이 이미 있고 실측 병목은 미확인 | 표현별 준비/탐색/refine 비용 계측 후 우선순위 판단 |
| H6 | 일부 primaryHard에 작은 probe를 재허용할 여지가 있다 | 과거 I100K 완료 반례 / Fast에서는 큰 행렬 추가 비용이 위험 | 별도 후순위 층으로 평가. 첫 후보에 hard 가드 변경까지 섞지 않음 |

추가 의미: seed가 좋아져도 서로 다른 2x2 경로의 최종 품질은 단조적이지 않을 수 있다. 최종 품질 벡터와 stable-ID 차이를 분리 기록해야 한다.
품질은 가중 정렬 벡터의 사전식 목표이므로 근거 없는 단일 “품질 %”로 축약하지 않는다.

## 7. 다음 설계 단계로 넘길 방향

최종 목표: **저비용 구조 판단 → 생략/작은 probe/기본 probe 중 필요한 경로 → 필요시 2x2**, 최소 K와 coverage 및 정직한 증명 표시 유지.

우선순위:

1. 현재 Fast와 직접 2x2의 실제 API 대조, 동일 K/seed의 원인 분리 대조를 함께 명세한다.
2. 고정 축소안을 먼저 단순 대조군으로 둔다. B를 바꾸면 부가 예산도 바뀐다는 점을 명시한다.
3. 조건부 후보는 기존 primaryHard/preview 가드 위에 최소한의 분기만 추가한다. d/u 계산의 추가 비용을 포함한다.
4. preview/grace 독립 조정 및 재준비 감소는 분리된 후보로 둔다. 탐색 재개 없는 반복 호출로 동적 연장을 흉내 내지 않는다.
5. per-save에는 save별 진단과 요청 전체 누적 비용을 함께 남기는 계측이 필요하다.

아직 결정하지 않은 것: 새 cutoff·예산값·정책 수, 허용 품질 손실/시간 이득 기준, 명시적 budget 우선순위, 실험 입력과 자원 한도.
따라서 현재 결론은 **조건부 정책의 검증 가치가 있다**이며, 고정 축소보다 우수하다고 판정한 것은 아니다.
다음은 3단계 비교·계측 명세다. 성능 측정은 비교군·입력·자원 한도를 동결하고 승인받은 뒤 진행한다.
