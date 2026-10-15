# Fast v2 본 실행 연결

사용자 지시: 본 벤치 실행까지 완료. 별도 브랜치 `experiment/fast-budget-20261015`, 최대16VM.

## 동결 계약

- v2 범위 JSON은 보존한다. 실행 승인은 bootstrap의 별도 LOCK에 기록한다.
- 1,113 capture: ALL548/per-save548/경계16/실제GRACE1. capture에는 secondary solve가 없다.
- primary 증명과 원행렬을 수집한 뒤 non-hard/nontrivial per-save를48칸×초기8개, group당4개 상한과 round-robin으로 최대384개 선정한다.
- ALL 및 GRACE는 확보된 모든 행렬을 유지한다. main9군×3회, 보조96개×추가3군×3회, e2e273개×5군×3회, trace최대32개×3군×ON/OFF×2회를 동결한다.
- 정적 동치 생략은 이번 구현에서 사용하지 않는다. v2가 허용한 전군 상한 안에서 음성대조를 그대로 측정한다.
- 입력별 반복/군은 같은VM에서 실행한다. 각 군은 fresh process/solver. 군 시작 순서는 고정hash와 반복별rotation이다.
- Map/numeric 표현을 capture에 보존하고 복원한다. 원 중복행과 edge quality, stable keys, 원seed/K를 gzip으로 손실 없이 보존한다.

## 사전 검사와 비용

- 이전 synthetic 계약30개는 재사용한다.
- bootstrap에서 추가12개: 실제GRACE capture1+matrix3+공개API3, N+1 per-save capture1+공개API2, 단일큐 per-save capture1+공개API1.
- 이는 synthetic-only adapter 검증으로는 잡지 못하는 collection/save/K/witness 불일치를 검출한다. preflight64개 예약 중 총42개를 사용한다. GRACE K45를 현재 구현에서 확인한다.
- 로컬은 pure 계약/스케줄 검사만 수행한다. 모집단 solver는 Linux Actions에서만 실행한다.

### 첫 bootstrap의 수집기 오류와 재개

- run38758374047은 GRACE와 N+1 per-save의10개 검사를 통과한 뒤 단일큐 capture에서 중단됐다. 모집단 실행0.
- 원인: scalar per-save 수집기가 일반 minimals에만 필요한 `prepareSaveCase(lastBag)`를 불필요하게 호출했다. 이를 minimals 경로로 한정하고 mock scalar 회귀 검사로 확인했다.
- 이전10개 성공 결과를 재사용하고 실패한 capture+미실행 e2e2개만 실행한다. 소비한 preflight는30+11+2=43개이며64상한 안이다.
- 원 origin `2026-10-15T15:13:29.732Z`와96시간 deadline을 승계한다. 원 실패 기록·source·hash는 새 LOCK에 연결하며 population 측정은 수정된 source로만 수행한다.
- JavaScript Action의 실제 Node는 runner 내장24.19.0으로 관측됐다. setup-node24.13.0은 shell 계약 검사에만 적용된다. child는 Action의 `process.execPath`를 사용하므로 실제 runtime 버전을 LOCK에 고정하고 각 VM에서 일치 여부를 검사한다.

## 전송·자원

- capture32개job, max-parallel16. 각 명령 입력은 압축 fixture들과 hash snapshot으로 별도1회 게시한다.
- planner는 capture summary만 받으며 원행렬 전체를 재다운로드하지 않는다.
- measurement는 최대5시간 호출 예약으로 chunk를 배치한다. 각 작업은 필요한 입력 artifact ID만 다운로드하며 task 종료 시 캐시를 회수한다.
- starts/raw는 로컬 fsync append. 결과 delta는10분 또는16MiB에 flush하고 측정과 upload를 겹치지 않는다. 최종/오류 시 flush한다.
- 1,000 artifact 목록 제한을 피하도록 summary/plan 검색은 REST 전체 페이지를 조회한다. 다운로드는 backend ID, 원본은 member hash로 검증한다.
- scope당3GiB/swap0, startup30초/reap5초×2; matrix60/e2e180/capture300초, 열거60초를 유지한다.
- 96시간 origin은 bootstrap에서 한 번 정한다. job별 추가 control allowance는 capture300초/measurement900초이며 전체100h 예산 안에 드는지 planner가 검사한다. scope 사전예약+100h≤1,200h를 검사한다.
- VM 소실/수집 오류/미전달은 성공으로 취급하지 않는다. 취소된 job의 미업로드 자료는 failure artifact로 가능한 범위까지 보존하며 재측정은 자동으로 실행하지 않는다.

## 관측과 한계

- matrix 단계별 incumbent/quality/예산/states와 최종 원행 검산을 유지한다. trace 검산은 policy timer 밖이다.
- e2e는 공개 API의 trace OFF 비용을 측정하며 최종 키/품질/원행 coverage/K와 Fumen을 보존한다. 공개 API가 제공하지 않는 내부 primary seed 및 세부 phase 시간은 **UNOBSERVED**로 명시한다. 독립 capture seed와 동일하다고 가정하지 않는다.
- 최종 audit는 전체 schedule의 중복/누락/회수 및 trace ON/OFF 결과 정합을 확인한다. 입력 witness 검산은 각 worker가 수행하며 전체 원자료는 delta/input artifacts에 있다.
- 분석 index의 calls.jsonl.gz는 scalar 조회본이다. 완전한 seed/원행렬/품질 벡터를 대체하지 않는다. audit에는 전체 원자료 artifact pointer를 남긴다.
- 완료/미완료/실패/품질proof를 분리하며 실행 성공을 정책 채택으로 해석하지 않는다.

## 보존·재집계 도구

```
node tools/fast-bench/download-results.mjs RUN_ID OUTPUT_DIR
node tools/fast-bench/download-results.mjs RUN_ID OUTPUT_DIR --full
node tools/fast-bench/analyze-index.mjs ANALYSIS_ARTIFACT_DIR NEW_ANALYSIS_DIR
```

기본 다운로드는 작은 계획/summary/analysis index만 받는다. `--full`은 input과 raw delta 및 failure 자료까지 받으며 artifact ZIP digest/member hash, 디스크 여유를 검증한다. 이미 받은 자료는 receipt/hash 검사 후 재사용한다. 불완전한 로컬 다운로드는 덮어쓰지 않고 중단한다.

scalar 재집계는 BASE100/DIRECT 대비 완료쌍 비용과 전체 상태 전이, trace 원쌍을 CSV로 만든다. quality hash가 다르면 DIFFERENT로만 표시하고 better/worse를 추측하지 않는다. 품질 순서 판정에는 원 raw의 가중 벡터를 사용해야 한다.
