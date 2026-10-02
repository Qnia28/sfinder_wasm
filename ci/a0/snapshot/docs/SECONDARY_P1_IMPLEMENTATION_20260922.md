# Exact secondary P1 구현 및 검증

2026-09-22. 통합 로드맵 P1의 첫 구현 묶음이다. primary, 후보 열거, Rust/WASM 바이너리 및 fast 모드는 변경하지 않는다.

## 구현 범위

- `src/min-cover-components.mjs`: 원본 행 기반 자명한 해 판정, 원본 품질 그래프의 연결 성분 분석, 동일 엔진의 전체/순차 분해 실행.
- `src/min-cover-exact-secondary.mjs`: 공통 exact 진입점의 자명한 해 즉시 반환, 내부 분해 옵션, 미완료 threshold 결과의 exact 반환 방지.
- `tests/secondary-components.test.mjs`: 독립 완전탐색 참조, 중복 행 가중치·stable ID·품질 전용 연결·예산 종료·잘못된 seed 회귀.

사용 중인 공통 exact 경로에는 `findTrivialSecondary`를 적용한다. 원본 singleton으로 강제되는 후보 집합 F가 K개이고 모든 원본 행을 덮거나, 활성 후보 전체를 선택하는 K이면 선택은 유일하다. 품질은 원본 행 전체에서 다시 계산한다. primary kernel의 forced는 사용하지 않는다.

현재 후보 48개 이하의 legacy 진입 경로는 이 공통 계층을 우회한다. tiny 정책 통합은 P2 범위다. 명시적 secondary worker 설정은 기존과 같이 먼저 worker로 전송하며, worker 안에서 같은 자명한 판정을 수행한다. primary를 worker로 옮기는 P4는 아직 구현하지 않았다.

## 내부 실험 계약

`solveStructuredSecondary(coverage, options)`:

- `count`, `seedKeys`, `cardinalityProven: true`: 최소 K 증명이 선행해야 한다. 임의 고정 K의 seed 분배에는 적용하지 않는다.
- `decomposition: 'off' | 'on' | 'auto'`: off는 전체, on은 독립 성분별 순차 실행. **auto는 검증된 선택 정책이 마련될 때까지 off와 같다.**
- `engine: 'integrated' | 'threshold'`: 분해 유무에 관계없이 같은 엔진을 사용한다.
- `stateBudget: null | 정수`: null은 무제한. 정수는 모든 성분의 탐색 상태 수를 합산한 예산이며, 0이면 탐색 없이 feasible seed 또는 자명한 증명만 반환한다.
- 결과 `completed`는 모든 성분이 품질과 stable tie까지 완료한 경우에만 true다. 미완료 성분은 유효한 incumbent를 유지한다.

`solveExactSecondary`의 내부 `decomposition: 'on'` 옵션은 기존 integrated 100,000-state probe → threshold 정책을 분해 경로에 연결한다. 기본값은 off다. 새로운 사용자 설정은 추가하지 않는다.

연결 분석은 원본 품질 CSR에서 수행하고 후보/행 인덱스만 보존한다. 각 성분을 실제로 처리할 때에만 로컬 행렬을 만든다. 로컬 후보 순서는 전역 key 순서를 보존하며 중복 행은 제거하지 않는다. 각 성분의 K는 증명된 전역 최소 K의 feasible seed에서 배분한다.

현재 실험 구현은 성분 행렬과 엔진 전처리를 재개 단계에서 다시 만들 수 있다. 완성된 성분 증명 재사용, 작은 성분 묶음, 공통 CSR 재사용 확장은 후속 항목이다. 상태 예산은 준비 시간이나 벽시계 시간 상한을 의미하지 않는다.

## 검증 운영

반복 실행과 집계는 별도 `sfinder LUNA 테스트·벤치마크` 작업(gpt-5.6-luna, max)에 위임한다. Astra는 구현과 결과 검토를 담당한다.

- 검증 폴더: `D:/AI/sfinder-wasm/tools/validation/secondary-p1-20260922`.
- 기준 파일 보존: `D:/AI/sfinder-wasm/tools/validation/secondary-exact-pre-p1-20260922.mjs`.
- 기존 54 per-save + 16 일반 minimals 행렬을 재사용한다.
- 기본 정책 baseline/candidate 비교와 같은 엔진의 off/on 비교를 분리한다. off/on 양쪽에 같은 자명한 처리를 적용한다.
- 4×4 BOX `*!` exact, 기존 3×4 BOX 8P, 모바일 제외를 유지한다.
- 측정 시 소스/WASM 스냅샷과 입력 hash를 고정하고 타임아웃을 완료 시간으로 집계하지 않는다.
- v2에서 off/auto 실험 경로의 불필요한 연결 성분 분석을 제거했다. 순수 분해 A/B는 v2를 기준으로 하여 분해 준비 비용이 on 쪽에 포함되도록 한다. 기본 운영 경로 비교에는 이 변경이 영향을 주지 않는다.

### 구현 직후 회귀 검사

`node --experimental-wasm-stack-switching --test tests/secondary-components.test.mjs tests/parallel-secondary.test.mjs`: **12/12 통과**.

신규 완전탐색 검사는 작은 원본 행렬 80개에 대해 두 엔진 × 세 분해 설정의 480개 결과를 대조한다. K·품질 벡터·stable key가 모두 일치했다. 기존 Node worker 재사용·전송·취소·오류 검사도 함께 통과했다. 이 실행은 성능 측정 자료로 사용하지 않는다.

### 저장된 실제 행렬의 첫 측정

5초 외부 제한, 각 1회. baseline은 70개 중 exact 62 / timeout 8 / error 0, 기본 변경판은 exact 63 / timeout 7 / error 0이었다. 공통 완료 62개에서 선택 key와 품질이 모두 일치했다. baseline과 기존 참조를 대조할 수 있는 완료 20개도 모두 일치했다. 명령 종류가 다른 동일 파일명의 참조를 혼동한 runner 집계 오류는 수정했다.

완료 집합이 다르고 단회이므로 각 군 전체 중앙값을 직접 비교해 가속률을 산출하지 않는다. 이 측정은 후보 열거·primary를 제외한 저장 행렬의 secondary 비교다. 전체 사용자 요청이 빨라진 비율로 해석하지 않는다.

v2 integrated off/on 비교는 **같은 seed, 같은 자명한 처리, 필터 전체 100,000 상태 예산**을 사용했다. 시간은 원본 수치 행렬 준비와 분석·분해·탐색·병합을 포함하며 WASM 초기화는 제외한다. 아래 모든 split은 제한 패턴 `[IJL]p3,*p4`다.

| 행렬 | off 상태 수 / 완료 | on 상태 수 / 완료 | off → on 시간(ms) |
|---|---:|---:|---:|
| 일반 QB row-002 T | 3,492 / 완료 | 1,471 / 완료 | 53.15 → 77.26 |
| 일반 ALT SHOES T | 100,000 / 미완료 | 100,000 / 미완료 | 170.15 → 193.67 |
| 일반 cycle3-extra-t-000 I | 15 / 완료 | 13 / 완료 | 18.08 → 23.97 |
| 일반 cycle3-extra-t-000 T | 13 / 완료 | 9 / 완료 | 18.40 → 25.55 |
| per-save ALT JAWS I | 100,000 / 미완료 | 205 / 완료 | 190.77 → 31.54 |
| per-save ALT JAWS L | 100,000 / 미완료 | 192 / 완료 | 148.77 → 25.37 |
| per-save ALT JAWS S | 100,000 / 미완료 | 209 / 완료 | 122.71 → 28.09 |

이 표는 단회 진단이며 off의 미완료 시간을 exact 완료 시간으로 취급하지 않는다. 순수 분해만으로도 탐색 상태가 크게 줄어드는 사례를 확인했지만, 상태 수 감소가 시간 감소를 보장하지 않는 회귀 사례도 재현됐다. 따라서 **자동 분해는 활성화하지 않는다.** 행렬·완료 성분 재사용과 짧은 탐색으로 쉬운 문제를 판별하는 정책을 다음에 비교한다. 후보 1천/1만 상태 등을 운영 기본값으로 바로 채택하지 않는다.

프로젝트 JS 검사는 116 통과 / 0 실패 / 1 건너뜀이다. 건너뛴 것은 BASELINE_ROOT가 있을 때만 실행하는 기존 batch 비교 검사다. 외부 검증 묶음도 Failed test files: 0을 확인했으며 최종 합계와 반복 측정 결과는 LUNA 집계 보고서를 참조한다.

현재 자명한 처리만 기본 적용하며, 자동 분해/엔진 전환 임계값은 변경하지 않는다.

최종 P1 검증은 `D:/AI/sfinder-wasm/tools/validation/secondary-p1-20260922/FINAL_REPORT.md` 및 `final-summary.json`에 기록했다. 실제 자명한 `*!` 두 사례의 AB/BA/AB 3회 반복에서 준비 포함 중앙값은 일반 cycle3 T 5.0665→2.7130ms, per-save pcinfo-019 J 8.6473→5.6068ms로 줄었고 6개 전후 쌍의 결과는 모두 일치했다. 외부 검증은 269/269 통과했다.

후속 [P2 세션 재사용](SECONDARY_SESSION_IMPLEMENTATION_20260922.md)을 추가했다. 이 문서의 v2 수치는 P1 고정 스냅샷의 결과다.

## 후속 검토: 강제 후보를 고정한 뒤의 추가 분해

현 구현은 원본 전체 그래프를 그대로 분해한다. 원본 singleton으로 강제된 후보 F가 여러 행을 연결하면, 선택의 자유가 없는 후보 때문에 큰 성분으로 남을 수 있다. 다음 확장은 아직 미구현이며 성능 효과도 미측정이다.

각 행의 고정 품질 `b[r] = max(quality(f, r), f ∈ F)`를 계산하면 남은 목적값은 `max(b[r], 선택된 자유 후보의 품질)`이다. 이미 F가 덮는 행에서 `quality <= b[r]`인 자유 후보의 연결은 품질에도 커버에도 영향을 주지 않는다. 남은 자유 후보의 유효 연결로 분해하면 원본 그래프보다 작아질 수 있다. F가 덮지 않는 행에서는 모든 원본 커버 연결을 보존해야 한다.

최소 K가 증명됐다는 조건에서는 F가 이미 덮는 행만 덮는 후보는 어떤 최소 해에도 들어갈 수 없다. 그런 후보를 선택한 최소 해가 있다면 해당 후보를 제거해 더 작은 커버가 되기 때문이다. 따라서 품질만 높이는 추가 후보를 넣기 위해 K를 늘리는 방식은 허용하지 않는다.

구현하려면 고정 baseline 품질을 solver에 전달하거나, 성분별로 항상 선택되는 합성 후보와 강제 행으로 표현해야 한다. 합성 후보·행은 실제 출력과 원본 품질 벡터 복원에서 제외하고, stable-ID 순서도 보존해야 한다. 현재 원본 그래프 분해와 별도 스위치로 비교하며, 작은 완전탐색으로 K/품질/tie 보존을 먼저 검증한다. 이 축약에서 primary dominance의 forced를 가져와 사용하면 안 된다.
