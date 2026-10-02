# 새로운 보드에서 검증할 원본 행렬 추출

**후속 완료:** Luna의 1회 추출은 15 jobs 중 13 COMPLETE/2 열거 TIMEOUT, 19행렬 저장/7 NO_MINIMAL로 종료했다. 30개는 최대 수다. Astra가 동결 165파일·행렬 해시·원본 가중 행·K/seed 및 선택/반전 그룹을 감사했다. [감사 결과](../../tools/validation/secondary-newboards-audit-20260926/ASTRA_AUDIT_KO.md), [다음 95입력 정책 계약](SECONDARY_POLICY_INPUT_CONTRACT_20260926.md). 아래 사전 계약은 이 완료 작업을 다시 실행하라는 지시가 아니다.

증명 재사용 방식의 모델 조정은 원래 CP 묶음 유지 후보로 마무리했다. 아직 엔진 우선순위나 임계값을 제품 기본값으로 확정하지 않는다. 새 보드에서의 정확성·회귀 증거가 필요하다.

## 사전 고정한 선택

사용자 지정 세 카탈로그의 현재 해시를 기존 catalog audit과 대조했다. 기존 일반/per-save 행렬 및 추출 시도 ID, 앞선 heldout 6개 보드를 원본 점유/좌우 반전 그룹으로 제외한다. 4×4 BOX, 3×4 BOX, runtime 부적합 항목도 제외한다. 이 그룹 판정은 기존 catalog audit의 mirrorGroup을 사용하며, 과거 모든 임의 사용자 입력을 보지 않았다고 주장하는 것은 아니다.

각 카탈로그에서 고정된 원본 순서의 첫 적격 보드, 그 뒤 필요한 미노 수가 다른 첫 적격 보드(없으면 다음 보드)를 선택한다. 시간이나 solver 결과로 선택하지 않으며, 새로 선택한 보드와 좌우 반전도 다른 카탈로그에서 중복 선택하지 않는다.

| 카탈로그 | 선택 ID |
|---|---|
| cycle1 | cycle1-hills-a, cycle1-pcinfo-030 |
| cycle3-extra-T | cycle3-extra-t-006-f000, cycle3-extra-t-009-f000 |
| cycle7 QB | c7-2plus2-qb-row-005, c7-2plus2-qb-row-006 |

모두 `*!`, `[IJL]p3,*p4`를 사용하고, 카탈로그별 첫 보드에는 독립 `*p3,*p4`도 추가한다. 총 15개 보드/큐 job에서 일반 minimals의 saves 필터 T/I를 추출하므로 최대 30개 행렬이다. per-save 실제 잔여 1미노 필터와 일반 saves 필터를 같다고 보지 않는다. 이번은 일반 minimals의 검증 범위를 먼저 넓히는 단계다.

## 실행 계약

위치: `D:/AI/sfinder-wasm/tools/validation/secondary-newboards-20260926`.

검증된 snapshot을 복사하고, snapshot의 primary 완료 지점에만 원본 prepared.cases/K/seed를 저장하는 hook을 넣었다. 저장 후 예외로 빠져나와 secondary는 실행하지 않는다. primary kernel의 축소 행렬을 저장하지 않는다. 입력 하나의 기하 열거는 T/I에서 공유한다. 실제 primary backend 및 primaryHard를 보존하고 Rust/HiGHS 1코어, ORTools 2-worker 설정을 변경하지 않는다.

새 프로세스 직렬 실행이며 시작 30초, 열거 60초, 열거 후 각 필터 준비/primary/직렬화 30초, 정리 15초 제한이다. 제한은 측정 준비 범위의 상한으로 성능 정책 임계값이 아니다. NO_MINIMAL/미시작/추출/단계별 timeout을 구분한다. 뒤 필터에서 제한에 걸려도 앞서 정상 저장한 원본 행렬은 보존한다. capture ERROR면 중지하고, timeout은 다음 고정 job으로 진행한다. 제한 확대·대체 보드·재실행은 하지 않는다.

각 행렬의 K와 seed 길이/유일성/원본 커버, candidate ID와 양의 품질, stable key 정렬을 검사하고 원자적으로 저장한다. SHA-256, 원본 Fumen과 mirrorGroup, pattern/filter, primaryHard/backend를 기록한다. 기본 snapshot·카탈로그·runner는 해시로 동결한다.

**이번 위임은 추출만 한다.** 5회 성능 반복이나 secondary 비교는 실행하지 않는다. Astra가 생성 행렬과 실패/무해답 편향을 확인한 뒤 기준 정책과 후보의 측정 계약을 별도로 고정한다. 기존 개발·회귀 입력을 제거하지 않고 새 그룹과 함께 판단한다. primaryHard=true가 나오면 기존 false 측정과 분리해 전환 정책을 검토한다.

후속 순서는 원본 행렬 검토 → 새 그룹 및 기존 회귀군의 정책 비교 → 공통 minimals의 CP runtime/오류/취소 연결 → per-save 필터 전체 primary→secondary worker 배분이다.
