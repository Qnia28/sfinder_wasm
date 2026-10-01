# Gemini / LUNA 엔진 비교 감사와 후속 측정

## 2026-09-26 후속 결과

LUNA의 60회 재현 측정을 원본 JSON·로그·원본 행렬·CP 정수 objective로 다시 검사했다. 119개 동결 파일 해시는 유지됐으며 EXACT 41, INCOMPLETE 3, TIMEOUT 16, 오류/완료 해답 불일치 0이다. 감사 스크립트와 출력은 측정 폴더의 `audit-results.mjs`, `ASTRA_AUDIT.json`이다.

| 입력 / 엔진 | 기본 20초 | 기본 60초 | 관측 |
|---|---|---|---|
| I / threshold | 0/5 완료 | 0/5 완료 | 60초로 늘려도 해결되지 않음 |
| I / CP 1-worker | 5/5 완료 | 5/5 완료 | 기본 조건 약 16~20초 |
| T / threshold | 4/5 완료 | 5/5 완료 | 같은 255,741상태, 60초 조건 약 10~27초 |
| T / CP 1-worker | 3/5 완료 | 5/5 완료 | 같은 완료 분기 수, 60초 조건 약 18~57초 |

기본 60초 조건에서는 T threshold 1건, T CP 2건이 20초 이후 완료됐다. 제한 시간 때문에 완료율이 달라질 수 있다는 가설은 뒷받침되지만, 기존 Gemini/LUNA 실행의 속도 차이를 cutoff만으로 설명할 수는 없다. 같은 repeat 번호의 20초/60초 job도 별도 프로세스의 별도 실행이므로 동일 탐색의 재개나 완전히 동일한 실행 환경은 아니다.

`--no-liftoff`는 CP I의 공통 완료 5쌍에서 평균 약 5.28초 느렸고 CP T의 공통 완료 4쌍에서 약 4.66초 느렸다. T의 나머지 1건은 60초 미완료였다. 제품 적용 후보에서 제외한다. CPU 시간과 호스트 부하를 기록했으나 CPU 코어 배치·클럭·런타임 내부의 기여까지 분리하지 못했으므로 원인은 미확정이다. 원인 추적을 확대하기보다 상태 수/완료율/반복 시간 분포를 함께 사용해 정책 비교를 진행한다.

기존 runner summary는 짝수 표본의 중앙값을 위쪽 값으로 기록했다. 감사 JSON은 가운데 두 값의 평균을 쓴다. LUNA 보고서의 일반 중앙값 계산과 runner 수치가 일부 다른 이유이며 해답/완료 상태 차이는 아니다. 다음 runner에 일반 중앙값을 적용했다.

다음 작업은 [공통 3엔진 전환 실험](SECONDARY_PORTFOLIO_EXPERIMENT_20260926.md)이다. 아래 절들은 9월 25일의 감사와 당시 고정한 측정 계약을 보존한 기록이다.

## 결론

완료된 해답의 불일치는 없었다. 그러나 완료 여부 4건의 차이를 단순히 20초 경계에서의 분류 차이라고 설명할 수는 없다. 동일 입력·코드의 실행 속도가 달랐고 제한 시간이 그 차이를 완료/미완료로 드러냈다. 실행 속도가 달라진 원인은 현재 로그만으로 확정하지 않는다. 제품 WASM, exact 계약, 기본 엔진 정책은 변경하지 않는다.

원자료 루트: `D:/AI/sfinder-wasm/tools/validation/secondary-engine-choice-20260925`.

- Gemini: `run-01/results.json`, `run-01/raw/`, 보존된 `run-01/GEMINI_RESULT_KO.md`.
- LUNA: `run-01/luna-reexec/run-01/results.json`, 해당 `raw/`.
- 독립 감사: `audit-comparison.mjs`, `ASTRA_COMPARISON_AUDIT.json`. 이번 Astra 작업은 기존 로그·행렬 재계산이며 solver 재측정은 하지 않았다.

## 확인한 범위

두 manifest가 동일하고 각 135개 동결 파일 및 15개 입력의 현재 해시가 일치한다. 실행당 300개 고유 job, 요약과 raw JSON·engine-end 이벤트, 20초 기준 상태 분류를 대조했다. 모든 완료 결과의 K·품질 hash·stable keys가 일치한다. 차이가 난 LUNA 완료 4건은 원본 행렬에서 커버/K/품질을 재계산했다. CP 3건의 품질·동률 목표도 최종 선택으로 재계산하여 OPTIMAL, 정확 정수 objective 및 bound 허용오차 조건을 확인했다. 이는 solver 증명 계약과 산출물의 일관성 검사이며 대형 입력 전체의 별도 완전탐색은 아니다.

| 실행 | EXACT | EXACT_LATE | INCOMPLETE | TIMEOUT | ERROR |
|---|---:|---:|---:|---:|---:|
| Gemini | 195 | 0 | 30 | 75 | 0 |
| LUNA | 199 | 0 | 27 | 74 | 0 |

완료 여부 차이는 모두 ordinary ALT JAWS split의 LUNA 첫 반복에 몰려 있다.

| 필터 / 엔진 | Gemini | LUNA |
|---|---|---|
| I / CP 1-worker | 20.097초 INCOMPLETE | 16.785초 EXACT |
| I / CP 2-worker | 20.033초 INCOMPLETE | 17.878초 EXACT |
| T / threshold | 프로세스 wall 25.139초 TIMEOUT | engine 10.235초 EXACT, 255,741상태 |
| T / CP 1-worker | 20.099초 INCOMPLETE | 18.020초 EXACT |

threshold의 25.139초는 프로세스 전체 wall이며 정확한 엔진 시간은 없다. runner는 engine-start 이후 25초에 외부 종료하도록 설정됐다. 이 조건의 다른 반복들도 외부 종료됐다. 20~25초 사이에 완료한 EXACT_LATE가 한 건도 없으므로 단순 재분류 문제가 아니다.

CP 1-worker 첫 반복의 공통 OPTIMAL 단계는 목표와 분기 수가 같은데 실행 시간이 크게 갈린다. I 품질 단계 11–13은 3,311분기로 Gemini 5.375초/LUNA 1.523초, 14–16은 3,358분기로 6.999초/2.006초다. T 단계 11–13은 3,537분기로 7.564초/2.051초다. 분기 수 일치만으로 모든 내부 연산이 동일하다고 증명하지는 않지만 실행 비용 변동을 조사할 근거는 충분하다. 기존 기록에는 Node/V8·flags·CPU 사용량·호스트 부하가 없어 CPU 경쟁, 전원/클럭, 런타임 컴파일, solver 변동 중 원인을 특정할 수 없다.

보고서 서술도 원자료와 구분한다. Gemini의 동결 파일 수 137은 135로 정정한다. CP 1-worker가 모든 평균에서 우세하다는 주장은 LUNA의 Z 변동 때문에 성립하지 않는다. 품질만 증명한 결과를 exact로 허용하자는 제안은 채택하지 않는다. stable-ID 동률까지 유지한다.

## 이번 자료가 최적화에 주는 근거

- 공통 비교용 7입력에서 integrated가 가장 빠른 입력 5개, threshold 2개다. threshold나 CP를 일괄 우선하지 않는다.
- ELEPHANT J의 J/O는 기존 integrated가 각각 157,931/144,914상태에서 완료됐다. LUNA 평균 163.6/92.6ms로 threshold 287.3/107.3ms보다 빨랐다. 고정 100,000상태 전환이 조급한 사례는 확인됐으나 보편적 새 임계값을 확정할 근거는 아니다.
- per-save ALT JAWS I/L/S/T/Z에서는 CP 1-worker가 5회 모두 exact였다. 어려운 필터의 CP 경로를 후속 통합할 근거가 된다. 쉬운 입력의 준비 비용과 stable-ID 증명 비용을 함께 반영해야 한다.
- ordinary full split I는 threshold, T는 integrated가 유리했다. 큐 폭만으로 선택하지 않는다.
- 개발·회귀용 15입력의 관측이다. 미관측 보드 그룹 검증과 명령 전체 시간 측정 전까지 제품 기본값과 per-save 배분 정책은 유지한다.

## 고정한 다음 측정

실행 루트: `D:/AI/sfinder-wasm/tools/validation/secondary-cutoff-audit-20260925`.

ALT JAWS ordinary split I/T × threshold/CP 1-worker × 세 조건 × 5회 = 60 jobs. 새 solver 모델은 없으며 직전 snapshot과 CP 모델을 복사했다. 두 엔진에서 원인 후보를 먼저 줄이고 CP 2-worker 확대는 필요할 때 한다.

| 조건 | 엔진 제한 | 추가 Node flags | 목적 |
|---|---:|---|---|
| default20 | 20초 | 없음 | 기존 변동 재현 |
| default60 | 60초 | 없음 | 제한 증가 후 완료율·탐색 상태 비교 |
| optimized60 | 60초 | `--no-liftoff` | WASM 컴파일 설정 영향 진단 |

외부 종료는 엔진 제한+5초, startup 60초, 검산/정리 15초다. 매 job 새 프로세스, 순서 정방향/역방향 교대, 직렬 실행이다. `--no-liftoff`는 진단용이며 제품 적용 제안이 아니다. 초기 컴파일 비용을 포함한 initAndEngineMs도 비교한다.

추가 기록: Node/V8·실행 flags·실행 파일 hash·OS/CPU·행렬/seed hash·UTC, 엔진 CPU user/system 시간, 단계별 누적 CPU/RSS, 호스트 전체 CPU busy 비율. 호스트 busy 비율로 특정 앱의 간섭까지 단정하지 않는다. timeout에서 관찰하지 못한 최종 상태/CPU 시간을 추정하지 않는다.

완료 결과는 앞서 감사한 witness와 대조한다. witness는 대형 입력의 독립 완전탐색 oracle이 아니다. 조건별 EXACT_LATE는 해당 조건의 제한 기준이므로 별도로 `completedWithin20s`도 집계한다. 제한이 다른 조건의 완료 표본만 평균 내어 속도 우위를 주장하지 않는다.

코드 문법 검사와 snapshot 준비만 완료했다. 새 60회 측정은 미실행이다. LUNA에 사용자 수동 전달 후 한 번 실행하며 직접 메시지를 보내지 않는다. 이후 Gemini는 읽기 전용 결과 감사에 사용할 수 있다. 독립 재측정이 필요하면 별도 사용자 전달 후 `run-gemini`에 직렬 실행한다. 같은 PC에서 벤치·빌드를 동시에 돌리지 않는다. 실행 lock은 이 묶음 내부 동시 실행만 막는다.
