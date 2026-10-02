# Exact secondary 3엔진 정책 — 2026-09-27

> **C6 한시간후속완료:** 초기compact CP1+Rust지속의개발80/새mirror50/비용24시도를감사했다. 느린CP우세입력의큰지연은줄었지만빠른Rust경로의profile·worker회수비용회귀가남아제품승격보류. 기존제품정책유지. [최종결과](../../tools/validation/secondary-upfront-20260928/CAMPAIGN_RESULT_KO.md).

> **2026-09-28 runtime후속:** 53진단/보정시도에서CPU배치가시작지연의큰요인임을확인했다. CP대기/즉시평균무제한1.65배/P1.16배/E1.00배. 그러나C4는QB059 P집합에서도threshold대비2.23배로느려미채택유지. 제품OSaffinity설정채택은없으며실제migration기전은미확정이다. [결과·남은작업](../../tools/validation/secondary-runtime-20260928/RESULT_KO.md).

> **최신C4시간합류후속:** 1초wall관측compactCP1합류후보는50비교/16진단후미채택. QB235에서CP단독대비2.43배지연이남았고새QB059에서도C3보다느렸다. 동일CP모델을1초대기후시작하면시작후실행도느려지는현상이재현돼runtime원인분리가다음이다. [C4계약·결과](SECONDARY_CLASSIFICATION_C4_20260927.md). 활성측정없음.

> **CP worker후속검증:** 현재secondaryCP1유지. 최근7단독/4동시Rust입력의1/2worker44jobs에서완료단독6입력모두평균CP1우세(CP2/CP1 1.009~1.736),동시Rust에서도증설이득없음. primaryCP2의이득을secondary에그대로적용하지않는다. [두관측·증명단계비용·QB235진단](../../tools/validation/secondary-cp-workers-20260927/RESULT_KO.md).

> **최신 후속 C3:** F1/L1/C2통합개발검증220jobs에이어독립QB검증128jobs를완료·감사했다. 새8반전그룹13입력에서C3 24/26EXACT이나,QB235독립split Z는CP단독대비평균2.62배·4.61초지연이두번재현돼 **제품승격보류**다. [C3 조건과검증범위](SECONDARY_CLASSIFICATION_C3_20260927.md), [새보드결과](../../tools/validation/secondary-c3-newboards-20260927/RESULT_KO.md). 제품기본정책은아래기존구현상태다. 측정작업없음.

> **분류 설계 후속:** C1(100K threshold 중단 후 증명50% 기준 전환)은 J/O 회귀로 거부했다. C2는 `CP변수≤4096·threshold50K미완료` 또는 `큰모델·threshold100K미완료·증명50%미만`에서 CP를 추가하고 진행 중인 Rust를 유지한다. 별도 실험 WASM의 중단 없는 관측을 사용한다.12입력2반복에서C2 EXACT24/24,baseline18/24(추가late2/timeout4),169파일·44해답·34관측감사통과. CP단독14관측감사도완료했고측정우세비교대상대비평균0.97~1.26배,관측범위최대1.37배. 제품승격/분류확정아님:integrated예산분류와짧은입력고정비용/새보드일반화가남았다. 활성작업없음. `tools/validation/secondary-classification-20260927/RESULT_KO.md`, `INTEGRATED_BUDGET_KO.md`.

> **후속 정정 — 분류 조건 설계 재개:** 아래 완료·채택은 3엔진 실행/취소 체계 및 보수적 운영 정책의 상태다. 100K/60초가 최선 또는 최선에 가깝다는 검증은 아니다. 사용자 지시에 따라 원 계획 4번(입력·탐색 특성에 따른 엔진 분류/임계값 설계)을 계속한다. 현재 코드와 동결 측정은 보존한다. 최신 분석: `tools/validation/secondary-classification-20260927/`.

**완료·기본 채택:** integrated 우선 → threshold 유지 → secondary 60초 뒤 CP 보조. 7입력×2정책×2회에서 Auto 14/14 exact, baseline 12/14 exact. Node 59/59 및 Chrome 11/11 통과. 모든 케이스별 최적 엔진을 찾는 추가 탐색은 종료한다.

## 운영 계약

- 공통 원본 singleton/all-candidates 증명 → integrated 100,000 states → threshold.
- **secondary 탐색이 60초를 넘기면 CP-SAT 1-worker를 보조로 시작한다. 진행 중인 threshold는 유지한다.** 먼저 minimum K의 원본 중복행 가중 품질과 stable-ID까지 증명한 결과를 사용한다.
- primaryHard는 기존처럼 threshold부터 시작한다. 명령 이름, 보드 ID, per-save 여부로 CP를 선택하지 않는다.
- 60초는 primary/열거/worker 대기 시간을 제외한 secondary 시간이다. 동기 integrated probe는 상태 예산을 마칠 때까지 선점하지 못한다. probe가 60초를 넘겼으면 threshold dispatch 시 CP가 즉시 합류한다.
- CP는 로딩·모델 구성 포함 120초 소프트 예산, 외부 worker 종료 유예 1초. CP 미완료/오류 시 살아 있는 threshold를 계속 기다린다. 이 120초는 전체 exact 요청의 제한이 아니다.
- CP 지원(JSPI, SharedArrayBuffer, 브라우저 cross-origin isolation)이 없으면 Auto는 기존 Rust 정책을 사용한다.
- tiny legacy exact, Fast/휴리스틱, cardinality-only 경로는 기존 계약을 유지한다. 본 정책은 exact secondary 대상이다.

## 명시 선택

JS minimals / per-save minimals API의 `secondary`:

| 값 | 의미 |
|---|---|
| `auto` (기본) | integrated→threshold, 60초 뒤 CP 보조 |
| `rust` | 이전 integrated→threshold 정책 |
| `integrated` | fixed-K integrated 무제한 증명 |
| `threshold` | fixed-K threshold 무제한 증명 |
| `cpsat` | CP 단독 120초 소프트 예산(+1초 watchdog 유예); exact 미증명은 오류 |

사용 예: `{ exactHumanQuality: 'true', secondary: 'cpsat' }`.
저수준 adaptive API에서는 `exactQuality: 'true'`를 사용한다. 공통 자명한 증명은 명시 선택보다 먼저 적용된다. Primary 옵션과 secondary 옵션은 서로 독립이다.

## 정확성과 자원

- primary의 증명된 K를 고정하고 원본 행 전체를 사용한다. 중복 행 압축 시 multiplicity를 목적함수 가중치로 보존한다.
- 품질 threshold별 달성 행 수를 사전식 최대화한다. 최대 3수준의 기수 묶음으로 증명하고, 정확한 정수 witness/objective/bound를 대조한다.
- 품질 등식을 고정한 뒤 30-bit stable-ID 블록을 증명한다. FEASIBLE, 품질만 OPTIMAL, 최종 tie 미증명은 exact가 아니다.
- 반환 시 원본 행으로 K/coverage/가중 품질 벡터를 독립 재계산한다.
- Rust/CP는 별도 worker이며, 승자 결정 또는 취소 시 둘 다 종료한다. secondary pool은 하위 worker 정리를 기다리는 stop acknowledgement를 사용한다.
- CP가 먼저 미완료/오류로 끝나면 해당 worker는 즉시 회수하고 Rust를 계속 실행한다. 기존 direct secondary-pool 호출에서 engine 필드가 없으면 이전 Rust/metadata 계약을 유지하며, 제품 adaptive 호출은 `auto`를 명시 전달한다.
- ORTools runtime은 hard 입력에서만 동적 로딩한다. 쉬운 integrated 완료는 CP를 로딩하지 않는다.
- 기존 실험적 decomposition 옵션은 Rust 경로를 유지하며 이번 자동 경쟁과 결합하지 않는다.

## 검증

실행 근거: `tools/validation/secondary-three-engine-20260927/`.

- preflight-001: 기존 portfolio/secondary/filter-worker와 신규 계약 테스트. JSPI 없는 test child의 CP 검사는 skip.
- preflight-002: JSPI를 활성화하고 test isolation을 끈 실제 CP 포함 신규 11/11 통과. 중복 가중치, brute-force oracle, uint32 품질, 65후보의 다중 stable-ID 블록, 명시 선택/worker 전송 검증.
- 고정 성능 입력: 기존 빠른 회귀 4개, 쉬운 per-save 1개, 장시간 per-save 2개. baseline/auto × 2회 = 28 jobs. 100초 엔진 판정, 105초 외부 kill. snapshot·입력·runner 108파일 동결.
- 독립 감사 `AUDIT.json`: 108파일 해시, 28개 실행, 26개 exact witness의 K/원본중복행 가중 벡터/stable-ID/기존 reference 일치. 2 timeout은 baseline ALT JAWS I뿐이다.
- preflight-003은 기존 직접 pool API의 추가 metadata 때문에 58/59였다. 필드 없는 legacy context의 Rust 경로를 보존하도록 수정하고 preflight-004에서 **59/59, skip 0**을 확인했다. 실패 로그는 보존했다.
- `BROWSER_RESULT.json`: Chrome 152/COOP·COEP에서 5가지 선택, secondary/whole-filter CP 전달, 실제 threshold 및 CP 합류 후 threshold 승리, 동시 엔진 취소, 하위 pool stop ACK까지 **11/11** 통과.

### 두 관측과 변동

단위 초. secondary만 측정하며 primary·열거 시간은 포함하지 않는다. `변동`은 각 정책 내 max/min이다. 두 번의 실행 순서는 baseline→auto, auto→baseline이다.

| 입력 | baseline 1 / 2 | Auto 1 / 2 | baseline 변동 | Auto 변동 |
|---|---:|---:|---:|---:|
| QB row002 split-I | 5.184 / 4.153 | 5.378 / 4.122 | 1.248 | 1.305 |
| extra-t006 split-I | 1.766 / 1.722 | 1.786 / 1.735 | 1.025 | 1.030 |
| pcinfo030 split-T | 2.151 / 2.139 | 2.220 / 2.142 | 1.006 | 1.037 |
| pcinfo030 split-I | 3.525 / 3.431 | 4.049 / 3.754 | 1.027 | 1.079 |
| ELEPHANT J split-J | 0.384 / 0.393 | 0.462 / 0.461 | 1.022 | 1.004 |
| ALT JAWS split-I | TIMEOUT / TIMEOUT | **74.862 / 76.336** | — | 1.020 |
| ALT JAWS split-L | 54.880 / 51.534 | 58.815 / 52.741 | 1.065 | 1.115 |

TIMEOUT은 100초 판정 내 미완료이며 외부 프로세스는 105초에서 종료했다. 실제 baseline 완료 시간은 알 수 없으므로 정확한 가속 배수는 계산하지 않는다. CP는 ALT JAWS I 두 번에서만 합류했고 두 번 모두 최종 proof의 승자였다. 나머지는 threshold가 완료했다.

**수용한 비용:** pcinfo I는 +0.524/+0.323초(약15%/9%), 작은 ELEPHANT는 +78/+68ms(약20%/17%), ALT JAWS L은 +3.936/+1.207초(약7%/2%). 준비/worker/JIT/스케줄링 각각의 인과 효과를 이 비교만으로 분리하지 않는다. 과거 수초→60초 timeout 형태의 큰 회귀는 재현되지 않았다.

### 측정 후 정리

성능 수치는 보존된 snapshot의 수치다. 이후 제품에는 중복 trivial 검사 제거, metadata/실험 decomposition 호환성, 완료·오류 worker 즉시 회수, engine 필드 없는 legacy pool 계약 보존을 반영했다. CP 모델·입력·60초 정책은 동일하다. 이 최종 소스는 Node/Chrome으로 재검증했으며 성능 수치를 다시 측정한 것으로 표시하지 않는다. `FINAL_STATE.json`에 최종 해시와 snapshot 차이를 기록한다.

## 판단 기준

모든 입력에서 최적 엔진을 고르는 것이 목표가 아니다. 기존 수초 완료 입력의 큰 회귀를 피하고, 기존 1분 이상 난제에 CP 진입 조건을 제공한다. threshold를 20k 상태에서 버렸던 과거 정책과 다르므로 그 정책의 완료율을 이번 정책의 성능으로 인용하지 않는다.

이 제한 검증을 근거로 현재 3엔진 운영 정책을 채택한다. 60초는 최적 임계값이라는 주장이 아니며 peak 메모리/모든 환경의 성능을 증명한 것은 아니다. Rust 1개+CP 1개를 활성 filter마다 사용한다. 새 임계값 후보를 추가하지 않는다. Saves 조기중단/native producer 후속은 별도 보류 상태다.
