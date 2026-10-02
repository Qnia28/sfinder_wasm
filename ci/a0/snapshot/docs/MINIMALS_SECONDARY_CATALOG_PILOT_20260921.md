# Minimals secondary 카탈로그 및 초기 측정 — 2026-09-21

사용자가 지정한 cycle1, cycle3 extra T, cycle7 2+2 QB 카탈로그를 측정 모집단으로 등록했다. 이번 작업은 **측정 절차 확인용 pilot**이며 전체 카탈로그 성능 조사 또는 선택/전환 임계값 확정이 아니다. 운영 solver와 worker 정책은 변경하지 않았다.

## 모집단과 제외 조건

| 카탈로그 | 항목 수 |
|---|---:|
| `D:/AI/tetrispc/setups/cycle-1-setups.json` | 45 |
| `D:/AI/tetrispc/setups/cycle-3-extra-t-setups.json` | 55 |
| `D:/AI/tetrispc/setups/QB/cycle-7-2plus2-qb-setups.json` | 356 |

456개 Fumen의 점유 보드를 placements와 대조하여 전부 일치함을 확인했다. 색상을 무시한 동일 보드는 338종이고 좌우 반전까지 합친 그룹은 297개다. 반복 등록을 독립 표본으로 세지 않고, 동일/반전 보드를 임계값 학습과 검증에 나누어 넣지 않는다.

4×4 BOX `*!` exact는 사용자의 integrated/threshold 1시간 미완료 이력에 따라 제외한다. 이 이력은 이번 측정에서 재현하지 않았다. 이름이 다른 동일 모양도 제외할 수 있도록 16개 점유 셀이 완전한 4×4 사각형인지 판정한다. 해당 항목은 다음 13개다.

- cycle1: `cycle1-pcinfo-015`, `cycle1-pcinfo-020`.
- QB: `c7-2plus2-qb-row-027`, `072`, `087`, `119`, `120`, `143`, `152`, `159`, `177`, `184`, `185` (모두 같은 ID 접두사).

기존 3×4 BOX 8P 및 모바일 제외도 유지한다. 이번 세 카탈로그의 점유 셀 검사에서는 3×4 완전 사각형은 없었다. 4×4 BOX의 분할 패턴은 `*!`와 동일한 제외 근거로 취급하지 않지만 이번 대표 표본에는 넣지 않았다.

## 초기 실험

대표 셋업은 ALT SHOES, ALT JAWS, `cycle3-extra-t-000-f000`, `c7-2plus2-qb-row-002`의 4개다. 일반 minimals의 마지막 bag save 필터 `T`, `I`를 사용했다. 잔여 한 미노를 분류하는 per-save 행렬과 구분한다.

- `*!`, `[IJL]p3,*p4`: 4개 셋업 모두 측정.
- 독립 `*p3,*p4`: ALT JAWS, cycle3, QB에서 측정.
- 한 셋업/패턴 내에서 기하 열거를 한 번 수행하고 필터별로 원래 품질 행렬과 primary가 증명한 K 및 seed를 저장했다. primary의 기존 Auto 정책과 내부 worker 설정은 유지했다.
- 11개 입력 중 9개에서 추출을 마쳤고 비어 있지 않은 필터 행렬 16개를 얻었다. ALT JAWS와 QB의 전체 split 2개는 **열거 단계에서** 15초 제한에 걸렸다. 이를 secondary 시간 초과로 세지 않는다.
- 세 cycle에 공통 패턴을 적용한 알고리즘 비교다. 카탈로그 표시 이름에서 실전 큐 패턴을 추론하지 않았으며, cycle별 실제 사용 빈도를 반영한 표본이라고 주장하지 않는다.

동일 행렬·K·seed에서 integrated, threshold, CP-SAT을 각각 새 Node 프로세스로 1회 실행했다. CP-SAT은 우선 1-worker, max_lp, 최대 3개 품질 목표 묶음, 정확한 동률 선택까지 실행했다. Rust에는 프로세스 전체 5초 제한, CP-SAT에는 모델 처리 기준 5초와 외부 8초 제한을 뒀다. 준비/초기화 포함 범위가 다르므로 제한 직전의 미세한 완료율 차이를 공정한 승패로 해석하지 않는다.

## 초기 관찰

표의 시간은 행렬 준비 및 secondary 계산 시간이며 후보 열거·primary·별도 프로세스 시작을 포함하지 않는다. CP-SAT 런타임 첫 사용 비용은 측정에 포함된다. 반복 중앙값이 아닌 단일 실행이다.

| 입력 / 필터 | integrated | threshold | CP-SAT 1-worker |
|---|---:|---:|---:|
| QB row-002 / 제한 split / T | 52ms | 296ms | 5초 내 미증명 |
| QB row-002 / 제한 split / I | 5초 제한 미완료 | 3,255ms | 5초 내 미증명 |
| ALT SHOES / 제한 split / T | 5초 제한 미완료 | 167ms | 5초 내 미증명 |
| ALT SHOES / 제한 split / I | 438ms | 138ms | 5초 내 미증명 |
| cycle3 000 / 전체 split / T | 211ms | 316ms | 758ms |
| cycle3 000 / 전체 split / I | 906ms | 334ms | 768ms |

같은 큐 패턴과 셋업에서도 필터에 따라 integrated와 threshold의 우열이 달랐다. 전체 split에서도 integrated가 더 빠른 필터가 있다. 큐 폭만으로 threshold를 우선하는 기준은 부적절하다.

16행렬×3엔진의 최종 48개 조합에서 integrated 12개, threshold 14개, CP-SAT 10개가 exact 완료했다. 완료한 36개 결과 중 동일 행렬에서 여러 엔진이 완료한 경우 선택 ID와 품질 벡터가 모두 일치했다. 4개 행렬은 K가 전체 후보 수와 같아 선택 자체가 자명하므로, 후속 정책에서는 일반 난도 표본과 분리해야 한다.

표본이 작고 CP-SAT은 1-worker/단일 모델 변형만 측정했으므로 **CP-SAT의 일반적인 우선순위를 낮추거나 상시 후순위로 확정하는 근거가 아니다.** 기존 난제 실험, 2-worker, 모델 준비 비용과 표현 방식도 후속 비교에 포함한다.

## CP-SAT 실험 코드 보완

초기 48회 중 cycle3의 3개 행렬에서 목적값이 `1304026520.0000002` 등의 double 반올림 오차를 포함해 기존 정수 assertion이 실패했다. solver 미완료가 아닌 실험 코드의 처리 오류다.

새 실험 사본에서는 선택된 Boolean 해와 원본 품질 행렬에서 각 목표의 **정확한 정수 값**을 재계산해 다음 단계의 등식에 사용한다. OPTIMAL, zero-gap 설정을 유지하고 보고된 objective/bound가 재계산 값과 부동소수점 허용오차 안에서 일치하는지도 검사한다. 허용오차는 0.25 미만으로 제한한다. 보고값을 무조건 반올림하여 제약에 넣지 않는다.

완전탐색 및 여러 동률 블록을 포함한 25개 모델 테스트가 통과했고 오류 3개 행렬도 재실행하여 Rust exact 결과와 일치했다. 최초 오류 기록을 보존한 총 시도 수는 51회다. 이전 실험 사본과 운영 코드는 수정하지 않았다.

## 다음 단계

1. 카탈로그의 서로 다른 보드 그룹·필요 미노 수·행렬 특성에 걸친 표본 확대. T/I 외 save 필터도 추가.
2. 선택이 자명한 경우와 작은 exact 작업을 분리하고, 주요 행렬에서 순서를 교대해 반복 측정.
3. CP-SAT 1/2-worker 및 목표 묶음 모델 비교, 난제에 충분한 증명 시간 부여.
4. 후보 수·K·품질 단계·가중 중복 행·연결 밀도와 짧은 탐색 진행도로 초기 선택/전환 규칙 작성.
5. 별도 보드 그룹과 실제 혼합 실행에서 누적 probe 비용, 최선해 전달, 최종 exact 및 동률 결과를 검증한 뒤 per-save worker 분배에 적용.

## 재현 자료

`D:/AI/sfinder-wasm/tools/validation/minimals-policy-20260921/`

- `catalog.json`: 원본 파일 해시, 456개 항목, 동일/반전 그룹 및 BOX 판정.
- `snapshot/`: 운영 소스 사본에만 행렬 추출 hook 추가.
- `capture-jobs.json`, `capture-results.json`, `matrix-index.json`, `matrices/`: 단계별 추출 상태와 원본 행렬·K·seed.
- `pilot-results.json`: 최초 48회 기록.
- `retry-results.json`, `resolved-results.json`: 오류 3회 재검증 및 48개 최종 조합.
- `cp-model-batched.mjs`, `model-tests-batched.mjs`, `model-tests-batched.json`: 보완된 실험 모델과 25개 검증.
- 실행 스크립트와 개별 로그는 같은 디렉터리에 보존했다.
