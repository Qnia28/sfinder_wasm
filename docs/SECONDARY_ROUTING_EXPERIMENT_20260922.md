# 짧은 integrated 탐색 이후 선택적 분해

공통 exact secondary에 실험용 `solveRoutedSecondary`를 추가했다. `solveExactSecondary`의 내부 `decomposition: 'auto'`로 호출할 수 있으며, 제품의 기본값은 계속 `off`다. 저수준 `createSecondarySession`의 `auto`는 기존대로 전체 세션을 뜻한다. 제품 UI 설정은 추가하지 않았다.

## 실행 순서와 정확성 계약

1. 원본 singleton 등으로 유일한 최소 K 선택이 증명되면 바로 반환한다.
2. 전체 integrated를 짧은 상태 예산으로 실행한다. 완료하면 성분 분석·복사 비용을 지불하지 않는다.
3. 미완료이면 원본 품질 행렬의 연결 성분을 분석한다. 충분히 많은 성분이면 분해 세션을 만들고, 전체 integrated 예산의 남은 부분만 사용한다.
4. 계속 미완료이면 같은 세션에서 threshold로 전환한다. 완료된 성분의 증명과 미완료 성분의 incumbent를 재사용한다. 성분 수가 기준보다 적으면 전체 threshold를 실행한다.

probe 1,000/10,000, 총 integrated 100,000 상태, 성분 수 3은 측정 후보다. 운영 정책으로 확정하지 않았다. 상태 예산은 시간 상한이 아니며 JS에서 실행 중인 WASM 전처리를 중단하지 않는다. 측정용 유한 threshold 예산은 미완료를 반환할 수 있지만 일반 exact 경로는 최종 증명 완료를 요구한다.

분해는 증명된 최소 K와 실제 feasible seed를 전제로 한다. primary kernel의 지배 제거를 원본 품질 그래프에 적용하지 않는다. 모든 원본 중복 행의 품질과 stable-ID 동률 결정을 유지한다. 기존 방식의 `integratedProbe`에는 routing 예산/소유권 정보가 없으므로 auto 경로에 섞어 전달하면 명시적으로 거부한다. worker로 위임할 때는 로컬 probe를 먼저 실행하지 않고 routing 매개변수를 함께 보낸다.

## 현재 한계

- 탐색 후 분해를 선택하면 연결 관계를 세션 준비에서 한 번 더 분석한다. 2026-09-23 경량화 이후 routing은 성분 수/최대 크기만 구하며, 성분별 후보·행 목록은 세션에서만 만든다. 이 비용을 측정에 포함한다.
- 전체 probe의 미완료 탐색 트리는 분해 세션에서 재개하지 않는다. feasible incumbent만 전달한다.
- CP-SAT 선택, threshold 품질 prefix 이전, 전체 필터 primary→secondary worker 배정은 후속 작업이다.
- 기존 70개 저장 행렬의 primaryHard는 모두 false이므로 해당 플래그에 따른 전환 효과를 이 자료로 검증할 수 없다.

## 검증

80개 작은 행렬의 독립 완전탐색 결과와 probe 0/1/10,000 경로 240회를 비교하여 최소 K, 품질 벡터, 선택 키가 일치했다. 공유 integrated 예산, 0 예산, 유한 threshold 미완료, 잘못된 예산, worker 전달과 exact 결과 동일성을 검사했다. 프로젝트 테스트 123 통과, 0 실패, 조건부 baseline 검사 1 skip. 외부 회귀 61파일 269검사도 모두 통과했다.

성능 원본은 `D:/AI/sfinder-wasm/tools/validation/secondary-routing-20260922`에 고정 snapshot, 입력/소스 hash, runner와 함께 기록한다. 기존 개발용 70행렬과 별도 보드/미러 그룹 6개를 구분한다. 별도 그룹은 측정 전에 카탈로그 순서로 선정했다. `*!`, 제한 split `[IJL]p3,*p4`, 독립 full split `*p3,*p4`를 합쳐 보고하지 않는다. 4×4 BOX exact는 제외한다.

## Probe-first 5회 반복 결과

LUNA가 사용자 요청에 따라 기존 70행렬 × 3조건 × 5회 = 1,050개 작업을 새 프로세스에서 직렬 실행했다. 반복 순서는 ABC/CBA/ABC/CBA/ABC이며 작업당 외부 제한은 5초다. 주 지표는 `productionMs = prepareMs + solverMs`로, numeric 준비와 엔진의 내부 병합까지 포함하고 WASM 초기화·후보 열거·primary·별도 결과 검산은 제외한다. `totalMs`의 나머지 부분은 제품 병합 비용이 아닌 독립 검산 비용이다.

기준선은 315/350 exact, 각 routing 후보는 340/350 exact 완료했다. 나머지는 timeout이고 오류는 0이다. 기준선과 후보가 함께 완료한 630쌍의 선택 키·품질 벡터가 일치했다. 서로 다른 완료 집합의 전체 평균을 직접 가속 배수로 해석하지 않는다.

아래는 각 조건이 5/5 완료한 동일 사례의 평균 productionMs다.

| 입력 | 기존 | probe 1천 | probe 1만 |
|---|---:|---:|---:|
| minimals cycle3-000 T, `*p3,*p4` | 208.07 | 413.69 | 421.56 |
| minimals QB row-002 T, `[IJL]p3,*p4` | 58.82 | 324.98 | 58.80 |
| per-save ALT JAWS O, `[IJL]p3,*p4` | 2325.03 | 40.14 | 50.99 |
| per-save ALT SHOES S, `[IJL]p3,*p4` | 39.89 | 38.56 | 46.29 |

분해 이득이 큰 사례가 있지만, 짧은 probe의 미완료만으로 threshold를 선택하면 심각한 퇴보가 있다. cycle3 full split T는 기존 integrated가 19,193 상태에서 끝나며, threshold 경로는 상태 수가 적어도 더 느리다. 준비와 상태당 처리 비용을 구분하려면 추가 계측이 필요하다. QB T 역시 integrated가 1천 상태는 넘지만 1만 이내에 끝나므로 1천 probe 정책에서 퇴보한다. **현재 probe-first 정책의 기본 적용은 보류한다.**

별도 6보드 그룹에서는 12개 열거/primary 캡처 작업이 모두 완료되어 21행렬을 얻었다. 이들은 3회 반복하여 모드별 51/63 완료, 12회 timeout, 오류·완료 결과 불일치 0이었다. 완료된 17행렬은 자명한 해 13개와 짧은 전체 탐색 완료 4개이므로, 독립 성분 분해 효과의 일반화 근거가 되지 않는다. 이 자료를 확인한 뒤 선정한 후속 사례는 새로운 미관측 검증셋으로 부르지 않는다.

원본: `runs/routing-bench-70x5-20260922`, `heldout/runs/heldout-routing-repeats-20260922`.

## 구조 선확인 비교 경로

후속 실험용 `structureFirst: true` / 공통 진입점 `routingStructureFirst: true`를 추가했다. 자명한 해 확인 후 구조를 먼저 분석한다. 성분 수가 기준 미만이면 **한 번의 integrated 호출에 기존 100,000 상태 예산**을 부여한다. 기준 이상이면 기존 짧은 전체 probe → 필요시 분해 순서를 사용한다. 분석 결과는 routing 내부에서 재사용한다. 제품 기본값과 실험 옵션의 기본값은 바꾸지 않았다.

이는 전체 탐색의 재시작으로 probe 비용을 중복 지불하지 않고 조기 threshold 전환 회귀를 막는 후보이다. 대신 쉬운 비자명 작업에도 구조 분석 비용이 추가되므로 후속 5회 비교에서 비용을 검증한다. 동일 80개 완전탐색 행렬에 두 정책 × probe 0/1/10,000을 적용한 480회가 일치했고, 단일 integrated 호출 예산 및 두 정책의 worker 동일성을 검사했다. 최종 프로젝트 회귀는 124 통과, 1 조건부 skip이다.

## 2026-09-23 구조 선확인 5회 비교와 적용 판정

개발 사례 6개와 이미 확인한 별도 보드의 후속 회귀 6개를 각 조건 5회, 총 180회 비교했다. 165회 exact 완료, 15회 timeout, 오류 0이었다. timeout은 QB row-004 제한 split I 한 사례가 세 조건 모두 5/5 미완료한 것이다. 완료된 선택 키·품질은 조건·반복 간 전부 일치했고 측정 전후 소스 hash도 일치했다.

평균 productionMs이며 앞선 70×5와 별도 실행이다. 이 표 내부의 동시 비교값으로 판단한다.

| 입력 | 기존 | probe 1천 | 구조 선확인 + probe 1천 |
|---|---:|---:|---:|
| minimals cycle3-000 T, full split | 222.28 | 421.03 | 222.33 |
| minimals cycle3-000 I, full split | 558.00 | 449.80 | 586.68 |
| minimals QB row-002 T, 제한 split | 57.93 | 327.27 | 60.68 |
| minimals ALT SHOES T, 제한 split | 337.41 | 199.81 | 333.80 |
| per-save ALT JAWS O, 제한 split | 2441.04 | 41.41 | 39.27 |
| per-save ALT SHOES S, 제한 split | 39.30 | 39.57 | 39.11 |
| 후속 QB row-003 I, 제한 split | 30.31 | 29.51 | 33.02 |
| 후속 QB row-003 T, 제한 split | 24.57 | 25.55 | 28.68 |
| 후속 BIG JAWS I, 제한 split | 19.73 | 19.09 | 26.87 |
| 후속 BIG JAWS T, 제한 split | 17.39 | 17.33 | 18.04 |

full split은 독립 `*p3,*p4`, 제한 split은 `[IJL]p3,*p4`다. 구조 선확인은 두 큰 조기 전환 회귀를 기존 수준으로 되돌리지만, 짧은 probe에서 이미 끝났던 작업에도 구조 분석을 추가한다. BIG JAWS I는 중앙값도 20.18→24.62ms로 늘어 평균의 한 번 튄 값만으로 설명되지 않는다. 반대로 full split I와 ALT SHOES T에서 짧은 probe가 주던 조기 threshold 전환 이득은 포기한다. **두 routing 후보 모두 기본 적용을 보류하고 내부 비교 경로로 유지한다.**

정식 원본은 `runs/structure-fixed-20260923/{manifest,results,summary}.json`, driver는 `run-structure-fixed.mjs`다. LUNA가 실행하고 Astra가 결과와 제품 소스 동일성을 대조했다. 중단된 preliminary `structure-first-compare-20260923`는 00:09:20에 종료됐고 정식 fixed는 00:09:51에 시작하여 겹치지 않았다. preliminary 수치는 표에 사용하지 않았다.

다음 구현 우선순위:

1. routing 판정에서 필요한 성분 수/최대 크기만 계산하고, 실제 분해 시에만 성분별 행 목록을 만드는 경량 구조 분석을 비교한다. 현재 분석은 전체 행 목록까지 준비한다.
2. 짧은 integrated 탐색을 WASM 안에서 이어갈 수 있는 continuation/준비 상태 재사용을 검토한다. 그러면 쉬운 입력에는 구조 비용을 생략하면서, 연결된 입력에서도 재시작 없이 기존 integrated 예산을 유지할 수 있다. 상태 객체 수명·취소·입력 소유권 계약이 필요하다.
3. 위 비용 개선과 독립적으로 P3a의 중복 분기 제거를 검증한다. 이후 연결된 어려운 문제에 대해 threshold/CP-SAT 선택을 다시 비교한다.
4. 새 per-save 보드/미러 그룹에서 실제 분해되는 비자명 필터를 추가 검증한 뒤 운영 임계값과 P4 전체 필터 worker 배정을 진행한다.

## 2026-09-23 경량 구조 분석 결과

`summarizeSecondaryComponents`를 추가해 routing에서 후보/행 그룹 배열 생성과 두 번째 행 순회를 생략했다. Map 입력은 구조 확인에 품질 값 packing을 하지 않는다. 원본 중복·품질 전용 행의 연결은 모두 보존하며 실제 분해 세션은 기존의 전체 분석과 입력 소유권을 유지한다. 예산·전환 조건은 동일하다.

LUNA가 `secondary-topology-20260923/run-01`에서 동일 12입력 × 3조건 × 5회, 총 180회를 완료했다. 프로젝트 테스트 125 pass, 1 skip. 벤치마크 165 exact, 15 timeout, 오류 0. 완료 결과 K/품질/stable keys 및 기존 구조 선확인↔경량화의 routing/상태 수가 일치했다. 측정 snapshot과 현재 JS·제품 WASM의 동일성도 확인했다.

대표 평균 productionMs (같은 실행 내 비교):

| 입력 | 기본 정책 | 기존 구조 선확인 | 경량 구조 선확인 |
|---|---:|---:|---:|
| cycle3-000 full split T | 205.10 | 217.30 | 210.79 |
| QB row-002 제한 split T | 56.08 | 62.10 | 62.16 |
| 후속 QB row-003 제한 split I | 28.69 | 33.23 | 30.41 |
| 후속 BIG JAWS 제한 split I | 18.35 | 21.13 | 20.82 |
| per-save ALT JAWS 제한 split O | 2330.97 | 39.58 | 39.62 |

경량화를 유지하되 자동 전환 기본 적용은 계속 보류한다. 기존 구조 선확인 대비 비용이 일부 줄었어도 기본 정책 대비 손해는 남는다. 예를 들어 BIG JAWS I의 중앙값도 기본 18.33ms 대비 경량 21.14ms다. 5회 평균의 작은 차이를 보편적 가속이나 회귀 부재의 증명으로 해석하지 않는다. 이 corpus는 이미 관찰한 회귀 자료다.

다음 검증은 P3a integrated sibling partition을 독립적으로 비교한다. 제품 WASM·라우팅 임계값을 바꾸지 않고 저장된 원본 행렬에 같은 integrated 100,000 상태 예산을 적용한다. 준비 재사용/continuation은 별도 후속이며 이번 구현에 포함하지 않았다.
