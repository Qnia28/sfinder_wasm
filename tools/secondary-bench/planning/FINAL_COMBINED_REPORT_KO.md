# 3엔진 광범위 측정 — 통합 최종 보고서

총 호출 **21542회**, exact 완료 **21094회**. 두 run은 같은 원행·K·seed·stable-ID 행렬을 사용한다.

## 결과 해석 요약

- 총 21,542회 실제 호출 중 21,094회 exact witness를 원 가중치 행에서 재계산했고, 엔진·반복·두 run 사이 선택 ID/quality 일치에 문제가 없었다. 이는 공유 제품 증명과 witness 검산이며 별도 대형 최적화 oracle 검증이나 제품 성능 PASS가 아니다.
- 300초 run의 기본 반복 255개 행렬에서 세 엔진이 모두 exact를 완료했다. 그 부분집합의 가장 작은 중앙값 수는 Integrated 215, Threshold 40, CP-SAT 0다. 완료하지 않은 행렬에는 이 순위를 확장하지 않는다.
- Integrated는 완료된 쉬운 행렬에서 강하지만 긴 제한에서 3 GiB OOM도 발생했다. Threshold는 일부 행렬에서 더 빠르고, CP-SAT는 더 넓은 완료 범위를 보여 모든 입력에 한 엔진만 쓰는 결론은 지지되지 않는다. 다만 OOM 뒤 격리된 엔진은 직접 비교 자료가 없다.
- 60초 전부-timeout에서 300초 exact로 이어진 조건은 Integrated 3, Threshold 3, CP-SAT 3개다. timeout 증가가 전부 해결하는 것은 아니다. 동일 조건의 반복 분산·VM 차이가 있으므로 이 수를 timeout 연장의 순수 인과효과로 보지 않는다.
- 현재 Auto는 Integrated 100K probe → Threshold, 60초 뒤 CP 병행이다. 이번 direct Integrated 측정은 uncapped이므로 이 결과만으로 Auto의 end-to-end 시간을 계산하거나 새 gate 성능을 주장할 수 없다.

## 커버리지와 미측정의 분리

- 440개 명령의 capture는 모두 완료했다. 비trivial 선택 행렬 309개, trivial-only 명령 129개, 실제 빈 결과 명령 2개다. 첫 run의 빈 명령은 c7-2plus2-qb-row-251/bag 및 c7-2plus2-qb-row-005/bag이며 capture timeout이 아니다.
- 명령당 hash로 선택한 비trivial save 하나만 엔진 측정에 썼다. 선택되지 않은 save·mirror alias와 보류 55개 그룹을 새 독립 측정 표본으로 세지 않는다.
- 300초 run에서 engine×fixture 798개 조건은 20회를 완료했다. 기본 호출은 3472회/3708회이며 나머지 236회는 OOM 뒤 격리다. 엔진별 실제 호출 0인 행렬은 Integrated 7, Threshold 16, CP-SAT 15개다.
- 안전 격리로 OOM 원인 행렬과 같은 job의 이웃 행렬도 미측정이 됐다. 나중에 별도로 회수하려면 미측정만을 대상으로 source·메모리·origin·중복 방지 계약을 다시 승인해야 하며, 이번 6시간 예산을 새 시계로 초기화하지 않았다.

## 검증과 다음 결정

- 원자료 ZIP digest, Git 원본 source bytes, schedule stable-ID/seed, fixture hash, timeout/OOM/미실행 구분, runner별 메모리·시간 제한을 재감사했다. 후속 run의 eligibility는 전체 history 기준 재구성과 일치한다. 첫 run의 801개 decision 차이는 하네스 한계로 기록했다.
- 기존 55개 보류 그룹 중 52개는 과거 자료 노출 가능성이 있고 3개는 미확인이다. 새로운 라우팅 규칙을 fresh 검증하려면 과거 실험에 사용하지 않은 setup/fumen과 alias·mirror 출처 자료가 추가로 필요하다.
- 후속 작업은 이 자료의 구조별 오류·시간 분포를 바탕으로 후보를 설계한 뒤, 미노출 입력에서 minimals 전체·쉬운 케이스 회귀·동시 요청 비용을 검증하는 것이다. 이번 단계에서 제품 라우팅을 변경하지 않았다.

## 실행 조건과 결과

| run | timeout | 기본/최대 반복 | 추가 시작/총 예산 | 호출 |
|---|---:|---|---|---:|
| secondary-wide-20261005-37222172267 | 60초 | 2/10 | 6h/8h | 5298 |
| secondary-extended-20261005-37226653891 | 300초 | 4/20 | 5h/6h | 16244 |

### 60초 run

검산: PASS_FOR_RECORDED_EXACT_RESULTS; 수집 상태: BASE_SCHEDULE_RECORDED.

기본 반복 누락 0회; 실행하지 않은 기록 0회; 비정상 scope 종료 0개.

| 엔진 | 호출 | exact | timeout | OOM | incomplete/기타 | 행렬별 중앙값의 중앙값(ms) |
|---|---:|---:|---:|---:|---:|---:|
| integrated | 1678 | 1576 | 102 | 0 | 0 | 33.84 |
| threshold | 1792 | 1744 | 48 | 0 | 0 | 61.51 |
| cpsat | 1828 | 1798 | 30 | 0 | 0 | 690.14 |

완료한 호출만 시간 통계에 포함했다. 엔진마다 완료 행렬이 달라 위 중앙값끼리 나눈 값을 speedup으로 해석하면 안 된다.

| 표본 구분 | 엔진 | 호출 | exact | timeout | OOM | 행렬별 중앙값의 중앙값(ms) |
|---|---|---:|---:|---:|---:|---:|
| 기본 반복 | integrated | 618 | 516 | 102 | 0 | 35.34 |
| 기본 반복 | threshold | 618 | 570 | 48 | 0 | 61.31 |
| 기본 반복 | cpsat | 618 | 588 | 30 | 0 | 686.86 |
| 추가 반복 | integrated | 1060 | 1060 | 0 | 0 | 33.13 |
| 추가 반복 | threshold | 1174 | 1174 | 0 | 0 | 60.75 |
| 추가 반복 | cpsat | 1210 | 1210 | 0 | 0 | 685.65 |

기본+추가 반복의 exact 표본을 포함한 비교: 세 엔진 모두 exact가 관측된 행렬 257개에서 가장 작은 관측 중앙값: integrated 223, threshold 34, cpsat 0.

### 300초 run

검산: PASS_FOR_RECORDED_EXACT_RESULTS; 수집 상태: PARTIAL_OR_REVIEW_REQUIRED.

기본 반복 누락 236회; 실행하지 않은 기록 236회; 비정상 scope 종료 15개.

| 엔진 | 호출 | exact | timeout | OOM | incomplete/기타 | 행렬별 중앙값의 중앙값(ms) |
|---|---:|---:|---:|---:|---:|---:|
| integrated | 5243 | 5100 | 128 | 15 | 0 | 35.29 |
| threshold | 5446 | 5369 | 77 | 0 | 0 | 61.15 |
| cpsat | 5555 | 5507 | 48 | 0 | 0 | 702.24 |

완료한 호출만 시간 통계에 포함했다. 엔진마다 완료 행렬이 달라 위 중앙값끼리 나눈 값을 speedup으로 해석하면 안 된다.

| 표본 구분 | 엔진 | 호출 | exact | timeout | OOM | 행렬별 중앙값의 중앙값(ms) |
|---|---|---:|---:|---:|---:|---:|
| 기본 반복 | integrated | 1163 | 1020 | 128 | 15 | 34.50 |
| 기본 반복 | threshold | 1154 | 1081 | 73 | 0 | 61.13 |
| 기본 반복 | cpsat | 1155 | 1107 | 48 | 0 | 680.91 |
| 추가 반복 | integrated | 4080 | 4080 | 0 | 0 | 34.57 |
| 추가 반복 | threshold | 4292 | 4288 | 4 | 0 | 59.55 |
| 추가 반복 | cpsat | 4400 | 4400 | 0 | 0 | 680.19 |

기본+추가 반복의 exact 표본을 포함한 비교: 세 엔진 모두 exact가 관측된 행렬 255개에서 가장 작은 관측 중앙값: integrated 216, threshold 39, cpsat 0.

## 수집 하네스와 복구 기록

- 60초 run 37222172267은 2026-10-04T17:52:29Z부터 18:43:29Z까지 진행했다. 1,376개 artifact 중 원결과 1,368개를 전체 페이지로 다운로드하고 ZIP digest를 검증해 재감사했다. 최초 기본 반복 누락은 0이며, 저장된 원자료는 교체하지 않았다.
- 60초 run 도중 기본 download action의 1,000-artifact 조회 제한 때문에 추가 반복 선별용 history가 일부 누락됐다. 실제 2/4/6/8/10회 조건 수는 90/140/545/116/36이다. 이 편차는 시간 예산이나 엔진 성능만으로 설명하지 않으며, 의도한 전체 적격 추가 반복이 모두 실행됐다고 주장하지 않는다.
- 최초 300초 launch 37225619701은 부분 다운로드를 fixture hash-lock 검증이 거부했고, 이어 cross-run REST 다운로드의 secondary rate-limit을 만났다. 모든 측정 job은 skip됐고 solver 호출은 0이었다. 복구 run 37226653891은 이미 완료된 측정을 재실행하거나 대체하지 않았다.
- 복구 run의 시계는 최초 300초 launch의 2026-10-04T18:44:56Z를 유지한다. 교정·대기 시간도 6시간 예산에 포함한다. 추가 블록 시작 제한은 2026-10-04T23:44:56Z이며 전체 경계는 2026-10-05T00:44:56Z이다. 계산 종료를 위해 마지막 5분을 업로드에 예약했다.
- 교정된 현재-run 운송 경로는 REST 전체 페이지로 artifact ID를 확인한 뒤 SDK backend ID로 다운로드한다. 과거-run 입력은 동결된 309개 행렬을 담은 단일 secondary-plan-2 bundle로 재사용하고 hash를 검증한다. Linux preflight 37226558157에서 실제 backend 다운로드 및 digest 일치를 확인했다.
- 반복 수는 엔진×행렬별 누적치이며, 각 블록의 적격 엔진은 동일 VM에서 순차 실행했다. 후속 블록은 다른 VM일 수 있다. 최초 기본 반복과 추가 반복은 서로 구분하고, 60초와 300초 raw 시간을 합쳐 동일 조건의 시간 표본으로 취급하지 않는다.
- 300초 run은 2026-10-04T23:26:01Z에 종료했으며 보존된 origin 기준 4시간 41분 5초였다. 전체 6시간 경계와 추가 admission 5시간 경계 안에서 끝났다. Actions job 시작/종료 구간을 재검산한 동시 job 최대치는 두 run 모두 16이었다. 가장 긴 job은 60초 run 13분 58초, 300초 run 2시간 19초로 각각 설정 hard limit 및 GitHub 6시간/job 제한 안이었다.
- 300초 run에서 실제 OOM 15회가 모두 Integrated에서 발생했다. 원 cgroup oom_kill 증가를 보존했고, scope 오류 후 같은 VM의 나머지 호출을 격리했다. 기본 반복 누락 236회는 15개의 OOM 발생 행렬과 같은 job에 배치된 7개의 인접 행렬, 총 22개 행렬에 걸친 미실행이다. 격리된 Threshold/CP-SAT를 timeout 또는 패배로 세지 않는다. OOM을 memory cap 변경이나 새 시간 예산으로 재측정해 기존 raw를 교체하지 않았다.
- 60초 run의 추가-wave 선별 결정을 전체 원자료 기준으로 재구성하니 6/8/10회 wave에서 각각 140/545/116개, 합계 801개의 엔진×행렬×wave 결정이 누락-history 때문에 적격에서 제외돼 있었다. 이 수치는 서로 다른 행렬 801개나 801회 측정이 아니며, 원래 실행되지 않은 반사실적 반복을 결과로 채우지 않았다.

## 같은 행렬의 기본 반복끼리 비교

각 엔진의 기본 반복이 모두 exact인 행렬만 비교했다. 추가 반복은 이 표에 넣지 않았다. 비율은 오른쪽 엔진 시간÷왼쪽 엔진 시간이며, 1보다 크면 왼쪽이 빠르다.

| timeout | 엔진 쌍 (왼쪽/오른쪽) | 비교 행렬 | 시간비 중앙값 | 오른쪽/왼쪽 ≥1.10 | 왼쪽/오른쪽 ≥1.10 |
|---|---|---:|---:|---:|---:|
| 60초 | integrated/threshold | 258 | 1.58 | 214 | 35 |
| 60초 | integrated/cpsat | 257 | 17.91 | 242 | 14 |
| 60초 | threshold/cpsat | 283 | 11.21 | 275 | 8 |
| 300초 | integrated/threshold | 255 | 1.59 | 210 | 38 |
| 300초 | integrated/cpsat | 255 | 17.76 | 237 | 18 |
| 300초 | threshold/cpsat | 268 | 11.64 | 261 | 7 |

이 비교도 완료된 부분집합에 조건부다. OOM으로 격리된 다른 엔진은 패배로 세지 않았다. 엔진의 전역 우열이나 새 라우팅 규칙의 성능을 증명하지 않는다.

## 두 run의 연결

60초 run의 모든 반복이 timeout이었으나 300초 run에서 exact가 완료된 조건: **9개**.
두 run exact witness 일치: AGREEMENT_FOR_RECORDED_EXACT_WITNESSES.

서로 다른 timeout의 시간 표본은 합쳐서 중앙값·변동을 계산하지 않았다. timeout/incomplete는 완료시간으로 넣지 않았다. 최초 기본 반복과 추가 반복·runner ID·누락·회수/OOM 오류는 JSON 부록에 보존했다.


## 기본 반복의 변동 진단

| timeout | 엔진 | 기본 반복 모두 exact인 조건 | max/min ≥1.10 |
|---|---|---:|---:|
| 60초 | integrated | 258 | 91 |
| 60초 | threshold | 285 | 77 |
| 60초 | cpsat | 294 | 31 |
| 300초 | integrated | 255 | 175 |
| 300초 | threshold | 269 | 153 |
| 300초 | cpsat | 275 | 73 |

같은 엔진·같은 행렬의 기본 반복 내부 시간비다. 60초 기본 2회와 300초 기본 4회는 극값 비율이 직접 비교 가능한 동일 표본 수가 아니다. 추가 반복은 사용자 지정 정보 수집이며 이 변동값으로 선별한 A/B retest가 아니다.

## 한계와 다음 단계

- 현재 자료는 secondary-only fresh-process-cold 정보 수집이다. 새 Auto 분류 정책의 end-to-end·동시 요청 개선을 증명하지 않는다.
- 행렬 선별은 명령당 비trivial save 하나이며 모든 save의 시간 분포를 대표하지 않는다.
- 시간 상한·직전 두 timeout으로 반복 수가 다르다. 서로 다른 VM의 반복을 독립 보드 표본으로 세지 않는다.
- 노출 감사에서 보류 그룹의 대부분이 과거 자료에 등장했다. 새로운 정책의 fresh 검증에는 추가 독립 데이터가 필요할 수 있다.
- 제품 src/Rust/WASM 및 원본/main은 변경하지 않았다. 이 보고서는 제품 적용·성능 PASS 결정이 아니다.

## 원자료와 재생성

- [run 37222172267](https://github.com/Qnia28/sfinder_wasm/actions/runs/37222172267): source `df8de899edb7eda765a60a0b349bd8f48bc0e334`, 결과 archive 1368개, source file 178개 검증.
- [run 37226653891](https://github.com/Qnia28/sfinder_wasm/actions/runs/37226653891): source `6df5d0420bee0e64469ad0842f9d04b4361531d8`, 결과 archive 1414개, source file 188개 검증.
- JSON 부록: `FINAL_COMBINED_REPORT.json` (조건별 표본·phase·누락·반복·OOM·matched 비교·artifact digest·source/실행 감사). 원 ZIP/raw는 로컬 ignored `benchmark-results/campaign-*`에 그대로 보존했다.
- 재생성 도구: `combined-report.mjs` → `publish-combined-report.mjs`. solver 호출 없이 원자료를 다시 읽고 검산한다.
