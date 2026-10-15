# Fast 본측정 전송 장애 및 승인된 재개

## 원 실행

- run38759068303 / solver source `cf6b930942381cfdcf3eeb94db1b47cbef13c7bd`.
- capture32job 및 plan 성공. 고정 스케줄30,480단위.
- measure137은 solver 호출 전 `fast-bootstrap` 목록 검색 실패로 종료했다. 해당 artifact는 ID11985076675로 실제 존재한다. 실행 중 변하는 목록의 페이지 조회는 원자적 snapshot이 아니므로 이를 재개 의존성으로 사용하지 않는다.
- fail-fast로 후속 job이 취소됐다. 원 audit: observed19,497/missing10,983/anomalies18. anomalies는 취소된11scope 및 그중 회수 확인이 없는7scope이며, quality mismatch나 OOM 판정은 아니다.
- 원 failure/INVALID audit를 수정하거나 성공으로 승격하지 않는다.
- shard134의 failure artifact에서67개 완료 scalar/raw와68개 durable start를 복구했다. 마지막1개는 시작 후 결과가 없으므로 UNKNOWN_INTERRUPTED로 보존한다.

## 사용자 추가 승인

사용자는 아티팩트 문제로 중단된 묶음도 재측정하도록 명시적으로 지시했다.
이에 따라 최초의 '미시작 묶음만 재개' 방식을 변경한다.

- 정상 완료된 비교 묶음18,879호출은 그대로 재사용한다.
- 미시작 묶음과 중단 묶음12개를 포함하여 **11,601호출 /80chunk**를 실행한다.
- 이 중 이전에 시작된 호출163개가 포함된다. 완료/취소/UNKNOWN 등 이전 상태를 보존하고 새로운 attempt로 기록한다.
- 중단 묶음은 전체를 다시 실행하여 동일 입력의 모든 비교군/반복/trace가 같은VM에 있다는 조건을 유지한다. 정상 종료된 묶음의 TIMEOUT/OOM은 재시도하지 않는다.
- 최종 기본 조회본은 새로 완결한 묶음을 사용한다. ATTEMPTS.jsonl.gz, PARENT_CALLS, PARENT_AUDIT, 원 raw artifact에는 이전 기록을 모두 남긴다.
- 원 비교 슬롯30,480개는 늘리지 않지만 이전 시작163개를 추가 attempt로 보존한다. 모두 시작된다고 가정하면 누적 실행 단위 상한은 capture1,113+preflight43+측정30,480+추가attempt163=**31,799**다. 이는 최초31,711 단위 상한보다88개 많으며, 사용자의 중단 묶음 재측정 승인에 따른 continuation 범위 변경이다.1,200h/96h/16VM 상한은 늘리지 않는다.

## 실행 조건·예산

- source/child/supervisor/adapter는 원 commit을 `product/`에 별도 checkout하여 byte hash 검증한다. 새 코드는 외부 재개·전송·감사 driver뿐이며 solver 시간 경로를 변경하지 않는다.
- runtime은 원 LOCK의 실제 Node24.19.0, scope3GiB/swap0, 기존 timeout과1,200h 상한, max16VM을 유지한다.
- origin `2026-10-15T15:13:29.732Z`와96시간 deadline을 유지한다.
- closed parent job interval 합148,349초를 보수적으로 부과하고 이전 준비 검사1h를 추가한다. 새 호출 최악1,187,100초+제어79,200초를 합한 **누적 보수 예약393.958h**로1,200h 이하를 확인했다. 과거 미실행 슬롯에 비용0의 성공을 부여하지 않으며, 닫힌 실행의 실제 job interval과 새 남은 예약을 구분하는 continuation 예산 v2다.

## 전송 수정

- bootstrap/plan/input은 고정 artifact ID와 ZIP SHA256을 사용한다. 변하는 전체 artifact 목록을 worker마다 다시 조회하지 않는다.
- 데이터 다운로드만 최대3회 재시도한다. solver 자동 재시도는 없다.
- 입력은 safe ZIP extraction 및 member snapshot hash를 검증한다.
- audit는 종료한 재개 run의 명시적 summary 이름만 서버 측 필터링으로 조회한다.
- 동결 명세: `tools/fast-bench/CONTINUATION_38759068303.json`.
- 생성기/증거 대조는 solver0회로 수행했으며18,879+11,601=30,480의 원 슬롯 정합과 추가 승인 범위를 검증했다.

## 재개 실행

- Actions: https://github.com/Qnia28/sfinder_wasm/actions/runs/38766815700
- 재개 driver commit: `73625b3`; 측정 source는 원 `cf6b930942381cfdcf3eeb94db1b47cbef13c7bd`를 별도 checkout한다.
- 원 run의 input/raw/failure artifacts는 `../../fast2nd/20261015/actions-38759068303/preserved/`로 ZIP digest 및 member hash를 검증하며 보존 중이다.
- 최종 결과는 이 재개 run의 `fast-analysis-index`와 두 run의 raw/input artifacts를 함께 읽어야 한다.
