# Threshold 제품 경로 통합 준비 — 완료

## 판정

**currentPropagation(A)을 우선 통합 후보로 권고한다. rootForced는 독립 선택 가능한 B 후보로 보존한다.**
기존 제품 전체 등급 **currentPropagation A / rootForced B**를 유지한다.
이는 Dev merge·기본 ON·배포 승인이 아니다. 준비 브랜치에서는 두 feature 모두 기본 OFF다.

`integration/threshold-candidates-20261004`에 Dev 기준
`c0cb2a048e7275bfea587d176b1954efff0a8a08`에서 필요한 알고리즘만 이식했다.
currentPropagation과 rootForced는 각각 `30acce9`, `fdac46d`로 분리했다.
실험 브랜치 전체 병합, 실험 mask/trace export, priorPropagation, 32/64 보완안은 포함하지 않았다.
기존 제품 JS·WASM wrapper·worker·integrated/CP 라우팅·100K/CP60초 정책은 변경하지 않았다.

## 검증 근거

- 측정 소스: `56e4f08809fb6350cd776fa96f5e26b50f864ddf`.
- [Actions 37179296189](https://github.com/Qnia28/sfinder_wasm/actions/runs/37179296189): 39 jobs 전부 성공.
- 실행 2026-10-04 05:14:18Z–08:49:45Z, wall 215.45분, job elapsed 합계 6.265833시간.
- [상세 결과](reports/product-37179296189/REPORT_KO.md), [모든 기본 샘플](reports/product-37179296189/initial.json),
  [별도 새 10쌍](reports/product-37179296189/repeat.json), [대조 bridge](reports/product-37179296189/control.json).
- [독립 raw 감사](reports/product-37179296189/raw-audit.json): **828 actual calls = 819 EXACT + 9 TIMEOUT**.
  모든 완료 witness·paired 계산·시간·메모리·budget/조기종료·미실행 회계를 재검산했다.
- [소스/실행 감사](reports/product-37179296189/source-audit.json): **440 immutable Git blobs** 일치.
  benchmark 32 jobs의 최대 동시성 10, recheck 2 jobs의 최대 동시성 2.
- [Linux 테스트](reports/product-37179296189/validation.json): native C/A/B 각83개(**249개**),
  실제 제품 secondary/portfolio/worker/CP D/C/A/B 각53개(**212개**), 실패·skip 0.
- [제품 ABI 검사](reports/product-37179296189/correctness.json): 보존200행렬·synthetic60 oracle,
  **6,440 검사**. C/D 결과·states·progress 동일, A/B는 실험 mask16/20과 동등하다.
  A/C states 차이246, B/A 차이96으로 실제 기존 제품 export에서 후보가 활성화됨을 확인했다.
- [Chromium](reports/product-37179296189/browser.json): S/D/C/A/B 모두 기존 제품 모듈/API·실제 Worker·
  bounded/progress/locks·시작된 긴 작업 취소·회수·메인 스레드 heartbeat·재실행 통과.
- [측정 WASM byte-identical 로컬 재생](reports/product-37179296189/replay.json): 보존200행렬의
  bounded 1,400호출 + QB 완료700호출, **2,100 correctness-only replays**, 새 성능 샘플0.
  모두 frozen witness/reference와 일치. bounded20은 대부분 budget에서 states가 포화되므로
  해당 receipt의 root states 차이0을 비활성 증거로 해석하지 않는다. 활성화는 위 완료·oracle 검사에서 별도로 확인했다.

## 성능 — 기본5쌍과 재확인은 분리

사전에 고정한 targeted cycle1 16개 + QB 16개다. 새로운 무작위 모집단 추정이 아니다.
같은 VM에서 양측을 직렬 fresh process로 호출하고 AB/BA를 교대했다.
호출당 solver timeout300초, 전체 캠페인 deadline은 없다.
양측2 solver TIMEOUT·관측EXACT0일 때만 해당 입력/비교를 중단한다.
미실행은 TIMEOUT이 아니다.

한 샘플은 변경 없는 제품 `minimumCoverAtCount`를 통해 threshold export를 **정확히1회** 호출한다.
`nativeMs`는 Rust ABI 변환/준비/검색, `productMs=solverMs`는 제품 JS packing/검증/결과회수까지 포함한다.
요청의 numeric metadata 준비는 측정 밖이다. Worker 왕복시간은 browser correctness의 설명적 수치이며
아래 paired benchmark와 합산하지 않는다. CPU 종류가 runner마다 달라 절대 시간을 runner 간 합산하지 않는다.

| cohort | 비교 | 완료쌍 있는 입력 / 전체 | 완전5쌍 | native geomean | product geomean | 빠름 / 느림 |
|---|---|---:|---:|---:|---:|---:|
| cycle1 | D→A | 15/16 | 14 | 1.044628 | 1.048229 | 12/3 |
| QB | D→A | 16/16 | 16 | 0.990724 | 0.985687 | 6/10 |
| cycle1 | A→B | 15/16 | 15 | 1.018675 | 1.021031 | 12/3 |
| QB | A→B | 16/16 | 16 | 1.052054 | 1.046140 | 13/3 |

ratio>1은 후보가 빠르다는 뜻이다. geomean은 input별 speedup의 점추정이며 총 절약 시간이나
모든 입력에서 보장되는 개선률이 아니다. cycle1 D/A의 완전5쌍만 geomean은1.042478이다.

- 기본32입력: 요청640, 실행628 = EXACT619 + TIMEOUT9, 미실행12.
- `cycle1-pcinfo-031-S`: 두 비교 모두 양측2 TIMEOUT, 실제8호출 후 각3쌍씩 미실행.
  이 입력의 완료·속도 우열은 판단할 수 없다.
- `cycle1-pcinfo-032-Z` D/A: 기본 D 4EXACT/1TIMEOUT, A 5EXACT.
  A-only 완료쌍1개를 별도 기록했고 TIMEOUT에 가상 시간을 부여하지 않았다.
- 별도 고정6개 bridge S/D·D/C 각5쌍: 120EXACT, material/완료차이/메모리 경보0.
  D/C 비활성 동등성은 기능·states 검사로 확인했으며, 짧은 bridge의 잡음 속에서
  성능이 수학적으로 동일하다고 주장하지 않는다.
- 기본 완료 샘플에서 process peak RSS 최대321,028KiB(약313.50MiB), WASM memory 최대55,705,600bytes(53.125MiB).
  기본 완료쌍의 side-median RSS비율 최대1.046273, WASM비율 최대1.0이며 >20% 경보0.
  재확인·bridge도 같은 경보기준0이다. TIMEOUT 샘플의 peak memory는 수집되지 않아 완료샘플의 값으로 대체하지 않는다.

### 긴 입력에서 currentPropagation

- `pcinfo-030-Z`: 기본5/5빠름, paired ratio약1.048, paired 약11.62초 절약.
- `pcinfo-031-O`: 기본5/5빠름, ratio1.129, paired 약10.57초 절약.
- `pcinfo-032-Z`: 완료 차이 때문에 별도 새10쌍. D/A **10/10빠름**, ratio**1.071979**,
  paired **11.785초 절약**, 모두EXACT.
- 032-Z 기본 CPU는 EPYC7763, 재확인은 EPYC9V45였다.
  기본 D 약299초와 재확인 D 약175초를 같은 환경의 절대 시간 변화로 해석하지 않는다.
  개선 방향은 각 동일-runner paired 비교에서 재확인됐으나, 300초 완료율 우위는 재확인에서
  양측 모두 완료했으므로 일반적인 완료율 개선으로 단정하지 않는다.
- 재확인 032-Z A/B: ratio1.000402, 5/5빠름·5/5느림, paired 약64.48ms 절약 점추정.
  긴 입력에서 rootForced의 실질적 추가 이득이 확립되지는 않았다.

### 잡음과 작은 지연도 보존

range-noise는 한 side의 `(max-min)/median >10%`로 기술한다. 이를 통계적 신뢰구간으로 쓰지 않는다.

| cohort / 비교 | range-noisy / 완료 입력 | 방향 바뀜 / 완료 입력 |
|---|---:|---:|
| cycle1 D/A | 10/15 | 10/15 |
| cycle1 A/B | 10/15 | 14/15 |
| QB D/A | 16/16 | 15/16 |
| QB A/B | 16/16 | 13/16 |

- QB `row-072-T` A/B의 기본 material 경보(ratio0.898981, paired+9.771ms)는
  새10쌍에서 **9/10빠름**, ratio1.104950, paired−9.506ms로 재현되지 않았다.
  같은 입력 D/A 재확인은6/10빠름, ratio1.015124, paired−1.190ms다.
- 두 재확인 입력 모두 완료 차이·메모리>20% 경보0, material 반복 회귀0.
  반복 material 판정은≥10%+≥5ms, ≥8/10느림이다. 이를 모든 지연의 부정으로 해석하지 않는다.
- `row-271-T` D/A는 기본 **5/5느림**, paired **+2.790ms**, ratio0.883388다.
  material5ms 기준 미만이라 자동 재확인 대상은 아니지만 작은 일관된 초기 지연으로 남긴다.
- `row-035-L` A/B는4/5느림·+1.194ms, `row-084-L` A/B는4/5느림·+2.364ms다.
  `row-159-S` D/A는4/5느림·+4.418ms다.
- cycle1 `jeremy-a-Z` D/A는4/5느림·**+9.127ms**, ratio0.927123이다.
  상대10% material 기준에는 미달하지만 절대 지연을 숨기지 않는다.

## 후보별 권고와 남은 승인

1. **currentPropagation A**: 기존 폭넓은 실험 근거에 더해 실제 제품 경로의 정확성과
   긴 cycle1 입력의 개선 방향이 확인됐다. 우선 Dev 통합 후보로 권고한다.
   QB 단독 개선이나 모든 짧은 입력의 무회귀를 주장하지 않는다.
2. **rootForced B**: 이식 정확성과 독립적인 compile-time 선택은 확인됐다.
   이번 짧은 targeted QB의 방향은 이전보다 긍정적이지만 잡음·선정 범위·미미한 긴 입력의 추가 이득을
   고려해 일반/default-ON 등급으로 승격하지 않는다. A와 별도 선택·rollback 가능한 옵션으로 보존한다.
3. **최종 배포 구성**: 측정한 A/B release feature 구성은 각각 native·제품 API·Worker·CP·Chromium 검사에서 검증됐다.
   실제 기본 feature 선택, 소비 앱 연결, Dev merge, tracked WASM 교체, main push, 배포는 하지 않았다.
   승인 시 우선 A만 활성화하는 release 구성을 선택하고 동일 검증을 최종 배포 산출물에 적용할 수 있다.
4. **소비 앱 UI**: 이 저장소는 엔진 라이브러리라 실제 소비 앱의 UI 입력/렌더링/전체 사용자 flow는 이번 범위가 아니다.
   Chromium 제품 모듈 검사를 소비 앱 UI 전체 완료로 표현하지 않는다.

## 보존·재현

`reports/product-37179296189/archive.json`은 모든 compact archive 파일의 SHA256을 보존한다.
모든828실제호출기록과 witness hash·환경 identity를 남기고, full source/build 표는 build.json 한 곳에 보존했다.
브라우저 완료 witness도 frozen witness와 대조한 hash로 압축해 반복된 전체 quality/keys 벡터는 저장하지 않았다.
원시 full witness artifacts는 Actions30일 보존이다. 원래cycle1/QB 각100의 ID·순서·중복·seed·gzipbytes는
immutable evidence `908efa3`와 직접 대조하는 `evidence.test.mjs`로 검사한다.

```powershell
$env:THRESHOLD_INTEGRATION_ARCHIVE = 'bench/threshold-integration/reports/product-37179296189'
node --test bench/threshold-integration/evidence.test.mjs bench/threshold-integration/harness.test.mjs bench/threshold-integration/timeout-policy.test.mjs
```

build/replay/local audit 명령은 `README_KO.md`와 각 스크립트에 기록한다.
로컬 재빌드된 Windows WASM은 측정 Linux WASM과 바이트가 달라 성능/재생 근거로 대체하지 않는다.
original reference hash425888e5…는 앞선 실험에서 측정한 WASM과도 바이트가 같다.
