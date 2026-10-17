# Fast routing 대규모 비교 (2026-10-17)

출처 표기: GLM. 목적은 최적화된 2x2에서 **probe를 실행할 가치가 있는 입력 영역**을 측정하는 것이다. 우선 벤치마크와 결과 정리까지 수행한다. 에이전트 분석 패키지·새 triage 채택은 후속 요청 사항이다.

## 고정 비교군

| arm | preview | integrated | GRACE | 미완료 시 |
|---|---:|---:|---:|---|
| BASE100 | 2.5K | 100K | 5K | 2x2 |
| DIRECT | 0 | 0 | 0 | 바로2x2 |
| PREVIEW_ONLY | 적격이면2.5K | 0 | 0 | primary seed에서2x2 |
| I1K | 0 | 1K | 0 | integrated seed에서2x2 |
| I10K | 0 | 10K | 0 | integrated seed에서2x2 |
| S200_OR_D16 | 2.5K | S≥200 또는 d≥16이면10K, 나머지100K | 5K | 2x2 |
| U192_OR_D16 | 2.5K | u≥192 또는 d≥16이면10K, 나머지100K | 5K | 2x2 |

모든 arm은 c522f49의 최적화된 refine 최대16pass를 사용한다. 공통 tiny/단일큐/direct exact/hard dispatch를 유지한다. DIRECT는 **Fast 품질 probe를 건너뛰는 opt-in 정책**이며 과거 `secondary:'2x2'`의 tiny guard 변경 효과를 섞지 않는다. 최소 K primary는 항상 수행한다. hard 우회 등에서 arm이 실제로 같은 경로가 되어도 호출을 생략하지 않는다.

`fastPolicy:'DIRECT_2X2'|'PREVIEW_ONLY'`를 추가했다. 명시 `fastStateBudget`는 여전히 정책보다 우선한다. 기존 `fastStateBudget:0`은100K이며 integrated 생략 의미로 바꾸지 않는다. 생략은 새 opt-in route가 담당한다. preview 미완료 seed는 버리고 integrated/GRACE의 유효 incumbent는 이어받는다.

## 모집단·반복

기존 동결 source scope의 **전체1,113명령**: ALL548 + per-save548 + edge16 + regression1. 이전359명령 선택집합보다 넓게 시행한다. 과거 개발 모집단이며 fresh holdout이라고 부르지 않는다.

- 주 E2E: 1,113 ×7arm ×3반복 = **23,373호출**, timing.
- 명시된 긴/회귀13명령: 추가4반복 = **364호출**, 별도 `long-repeat` phase. 주3반복과 합치면 각7회.
- 진단32명령: 7arm ×2반복 ×OFF/timing/trace = **1,344호출**, 별도 `trace` phase.
- 총 측정 **25,081호출**, capture1,113호출 및 원격 실제 API 계약검사27호출은 별도.

같은 명령의 모든 arm·반복·진단은 동일 VM에서 수행한다. 각 호출은 fresh process/cgroup이다. arm 순서는 command/phase hash+반복으로 회전하고 진단 모드 순서도 회전한다. trace 선택은 명시된13명령 및 edge/ALL/per-save의 capture 특징 층화로32명령을 채운다. 정책별 시간·품질 결과를 보기 전에 schedule을 동결한다.

원행 capture는 secondary를 실행하지 않는다. F는 **원 singleton 행의 서로 다른 후보 수**이고 u=S−F, d=K−F다. 정확한 S,K,F,u,d,N,E·kernel 특징·원행·입력 command·mirrorGroup·capture seed를 보존한다. 밀도 E/(N×S)는 offline 산출한다. 제품의 부분 F/u/d 관측과 capture의 정확한 특징, 실제 적용 예산을 구분한다.

## 자원과 검열

- 최대16VM, 최대1,200 runner-hours 예약, 원래 clock 기준96시간 기한.
- 전체 호출당3GiB cgroup, swap0, startup30초, reap5초.
- 일반 명령: 실행100초 + 공통40초 예약 =140초.
- 명시13명령: 실행180초 + 공통40초 예약 =220초. 모든 arm·반복·진단에 같은 한도.
- capture: 실행300초, enumeration60초 guard, 공통40초 예약.
- dry schedule:203 measure chunks, 총예약 **1,163.194시간**. 예상 실제 소비시간이 아니라 최악 예약이다. capture 특징이 생기면 trace 입력이 달라지므로 원격 최종 plan으로 다시 검사한다.
- 긴 입력의 전체91호출을 한 VM에 유지하려고 chunk 최대20,100초, control900초, measure job360분이다. capture job240분.

일반 입력의100초 한도는 이 캠페인의 동결 조건이다. 과거180초 실행과 직접 timeout 발생률 우열을 주장하지 않는다. 모든 arm에 같은 한도를 적용해 이번 비교 안에서 판정한다. TIMEOUT/OOM은 정상 검열로 남기며 누락/NOT_RUN도 분모에 포함한다. OOM 이후 같은 입력·arm 재호출은 기존 executor 규칙에 따라 NOT_RUN_AFTER_OOM으로 남긴다.

## 검증과 분석 계약

K·원행 coverage·품질 벡터·프로세스 회수·소스 고정·증거 완전성을 필수 검사한다. E2E 엔진/seed·최종 품질/proof 변동은 정상 관측이며, 진단 모드 사이 최종 hash 차이를 불변조건 위반으로 판정하지 않는다. 원 audit의 부정적 결과를 지우거나 재실행하지 않는다.

주 분석은 전체 E2E 분포, 호출별 손익, 입력별3반복 중앙값, timeout/누락 분모, 실제 품질 손실 크기·빈도다. ALL/per-save/edge/regression과 long-repeat/diagnostic phase를 구분한다. 원행 quality와 정렬 벡터 quality를 모두 보존한다. secondary exact는 보조 메타데이터이며 Fast 채택 필수 조건이 아니다.

trace는 중간 seed·witness·단계시간·refine pass를 남긴다. 계측 영향은 별도2반복 raw 관측이며, 이를 확정 overhead나 E2E 시간에서 뺄 상수로 해석하지 않는다. 새로운 기준을 자동 채택하거나 품질 허용 임계값을 임의 확정하지 않는다.

추후 d,K,u,S 기준 설계 시 mirrorGroup 단위 의존성 및 과거 데이터 재사용을 명시해야 한다. 같은 입력의 반복/filter/mirror를 독립 표본으로 보지 않는다. 미래 holdout 검증은 별도 실험이다.

## 실행·보존

- 전용 브랜치: `experiment/fast-routing-20261017`, workflow: `fast-routing-comparison.yml`.
- main merge/release 생성 없음. 제품 기본 정책은 legacy.
- 로컬 population benchmark 없음. 기능 테스트·dry plan·완료 원자료 재분석만 로컬 실행.
- run-attempt2 거부. 실패는 원자료를 보존하고 원인을 확인한 뒤 별도 continuation 여부를 판단한다.
- 공통 campaign executor의 delta checkpoint·입력 artifact·summary·source lock·schedule hash를 재사용한다.

결과 보존 경로: `D:/AI/sfinder-wasm/fast2nd/20261017/`.

```powershell
node tools/fast-bench/download-results.mjs RUN_ID D:/AI/sfinder-wasm/fast2nd/20261017/fast-routing-run-RUN_ID --full
```

회수 후 backend archive digest·snapshot·schedule/terminal record·최종 witness·시간 합계를 검증한다. 결과 정리에는 전체 원자료, 호출별 scalar, 특징·품질 변화, 상태/검열, 한국어 요약과 출처 GLM·hash manifest를 포함한다.

## 중단·재개 통합 결과 재검산

`CONTINUATION_39030155561.json`에 따라 원본39026013968의915명령, 실패재개39030155561의 완결38명령, 최종재개39030482572의160명령을 선택한다. 시작-only8호출은 최종재개에서 입력 전체 블록과 함께 재측정한다. 이전 시도는 삭제하지 않는다.

`analyze-results.mjs`는 세 run의 archive receipt와 schedule을 대조하고, raw byte offset 인덱스로 원행 witness·K·coverage·품질·trace·예산을 검산한다. 최종 선택과 이전 시도를 분리하며 BASE100과 DIRECT 양쪽 대비를 제공한다. `report-results.py`는 한국어 요약과 특징 구간·7반복·진단 차이 집계를 작성한다. 둘 다 solver를 실행하지 않는다.

```powershell
node --max-old-space-size=8192 tools/fast-routing/analyze-results.mjs D:/AI/sfinder-wasm/fast2nd/20261017 D:/AI/sfinder-wasm/fast2nd/20261017/fast-routing-results
python tools/fast-routing/report-results.py D:/AI/sfinder-wasm/fast2nd/20261017/fast-routing-results
python tools/fast-routing/check-results.py D:/AI/sfinder-wasm/fast2nd/20261017/fast-routing-results
```

실패재개39030155561의 digest 검증 회수 경로는 `fast-routing-run-39030155561-verified/`다. 최초 failure dump 회수본도 별도 보존한다. 분석 출력 경로는 새 디렉터리여야 한다. `MANIFEST.json`·`REPORT_MANIFEST.json`은 각각 분석과 보고서 파일 SHA256을 기록한다. 자료 회수는 `FAST_DOWNLOAD_WORKERS=1..4`로 병렬도를 설정할 수 있으며, 실패 archive를 보존하고 최대6회 제한된 backoff 재시도를 한다. 이는 전송에만 적용되고 원격 측정을 재실행하지 않는다.

검산 완료 결과: 25,081/25,081 starts/raw/terminal, 최종 witness89,152개·trace witness7,086개, 선택 결과 timeout/오류/누락0. Python 독립검산은 모든 pair delta·입력 중앙값 합계·21개 품질쌍의 원행·18개 산출물 hash를 확인했다. 상세 보고서는 위 결과 폴더의 `RESULTS_KO.md`이며 성능·품질 판정은 해당 분모와 함께 읽는다.
