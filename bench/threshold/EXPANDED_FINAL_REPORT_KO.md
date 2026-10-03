# Threshold 확대 검증 최종 보고: 100행렬 + 선택66행렬 10회 재테스트

## 결론과 범위

**currentPropagation(mask16)은 일부 입력에서 개선을 보이나 모든 입력을 개선하지 않는다. 자동 통합·기본값 변경은 하지 않는다.**
최초100에서는 양측 완료80개 중57개에서 향상이 관찰됐다. 선정66개를10회 재테스트한 결과는45개 향상/21개 악화이며, 1.10배 이상인10개는 모두8회 이상 빨랐다. 최초 회귀경보3개는 동일 경보기준으로 재현되지 않았다.
다만61개는 반복편차가10% 이상이고 19개는 속도방향이 바뀌었다. 따라서 작은 차이는 확정적 효과라고 주장하지 않는다.
로컬 dev와 원격 main은 수정하지 않았다. 실험 브랜치에서만 실행·보고한다.

- 최초100: [run 37097238109](https://github.com/Qnia28/sfinder_wasm/actions/runs/37097238109), 입력별5쌍, OFF/ON각5회, 호출당300초.
- 재테스트66: [run 37105932317](https://github.com/Qnia28/sfinder_wasm/actions/runs/37105932317), 입력별10쌍, OFF/ON각10회, 호출당300초.
- 같은 experimental WASM의 OFF(mask0)/ON(mask16)을 동일 VM에서 직렬 AB/BA 비교. 입력별 최대20VM 병렬.
- 실제 측정step의 최대 동시실행: 최초20VM, 재측정13VM. 측정 구간은 각각100.4분/47.9분(전체workflow 대기·CI시간과는 구분).
- 재테스트의 Rust/제품JS/실험WASM/입력hash는 최초100과 동일. 완료 witness는 원본행과 최초실행hash로 재검산.
- 100개 ID는99개 핵심행렬/41개 보드·반전그룹이다. grace-system-a/O와b/O는중복이며 사용자지시에따라 유지했다.
- 최초20확인의 original↔candidate 비교와 이번 same-binary OFF↔ON 비교는 다른실험이다. 비율을합산하지않는다.

## 최초100 전체결과 (재테스트로 대체하지 않음)

- 1000호출: EXACT 805, TIMEOUT 195; OFF완료 400/500, ON완료 405/500.
- 양측완료80개 중57개향상,23개악화. 속도비≥1.10은23개, 시간감소≥10%는22개.
- 완료80의 paired-median비율 기하평균 1.057배. 100전체비율이아니다.
- ON-only완료1개(pcinfo032/Z, 5회모두약294~298초), 양측timeout19개. OFF-only완료없음.
- ON-only입력의witness는검산됐지만 완료한OFF최적해와교차확인하지못했다. 5분경계에가까워추가완료를일반화하지않는다.
- 기존회귀경보3개: cycle1-big-jaws-a-S, cycle1-elephant-j-a-O, cycle1-jeremy-a-L. 메모리20%증가경보없음.

## 재테스트 선정

- 양측5쌍완료80개의OFF/ON속도비 상위/하위10%(R7): P90=1.186241, P10=0.950700; 각8개.
- 반복편차는 (최대−최소)/중앙값이며 OFF nativeMs, ON nativeMs, paired비율중하나라도≥10%를선정했다.
- 극단성능·편차합집합66개. 성과기반선정이므로 새로운무작위검증군/전체100재실행이아니다.
- timeout을300초완료시간으로대체하지않았다. 기존중복/입력은교체하지않았다.

## 10회 재테스트 결과

- 1320호출: EXACT 1320, TIMEOUT 0.
- OFF완료 660/660, ON완료 660/660.
- 양측완료66개: 향상45개, 악화21개; 완료군기하평균 1.042배.
- 10회에서도편차≥10%인입력 61/66. 최초와속도방향이바뀐입력 19개.
- side별시간중앙값기준회귀경보: 없음.
- 같은pair시간차중앙값≥5ms이면서paired비율로ON시간≥10%증가인회귀: 없음.
- 두회귀기준은다를수있다: OFF시간중앙값/ON시간중앙값의비율과 개별paired비율중앙값은동일한통계량이아니다.
- 편차는 range 기반이라 5회보다10회에서 극단값을 포함할 기회도 늘어난다. 편차가 줄지 않았다는 사실만으로 구현이 불안정하다고 단정하지 않는다.

### 1.10배 이상 + 8/10회 이상 ON이 빠른 입력

| 입력 | 최초비율 | 재측정비율 | 빠른pair | OFF 중앙값(ms) | ON 중앙값(ms) |
|---|---:|---:|---:|---:|---:|
| cycle1-elephant-a-O | 1.328 | 1.321 | 10/10 | 1095.18 | 832.08 |
| cycle1-hills-a-S | 1.187 | 1.196 | 10/10 | 1062.29 | 888.12 |
| cycle1-jaws-a-I | 1.147 | 1.143 | 8/10 | 110.99 | 100.42 |
| cycle1-legs-a-O | 1.139 | 1.131 | 10/10 | 260.31 | 229.75 |
| cycle1-legs-a-Z | 1.131 | 1.131 | 10/10 | 2950.78 | 2611.78 |
| cycle1-pcinfo-021-J | 1.358 | 1.372 | 10/10 | 327.74 | 241.95 |
| cycle1-pcinfo-022-J | 1.625 | 1.633 | 10/10 | 1123.18 | 688.73 |
| cycle1-pcinfo-037-S | 1.237 | 1.214 | 10/10 | 3363.94 | 2769.17 |
| cycle1-pcinfo-039-I | 1.195 | 1.203 | 10/10 | 153175.28 | 127348.04 |
| cycle1-shoes-a-Z | 1.080 | 1.116 | 10/10 | 93.59 | 83.64 |

### 최초 P90 개선·악화 입력의 후속 결과

| 입력 | 최초 선정 | 최초비율 | 재측정비율 | 빠른pair |
|---|---|---:|---:|---:|
| cycle1-6p-pco-a-O | 개선 상위10% | 1.216 | 1.040 | 6/10 |
| cycle1-alt-shoes-a-Z | 악화 상위10% | 0.946 | 0.967 | 3/10 |
| cycle1-big-jaws-a-S | 악화 상위10% | 0.885 | 0.943 | 3/10 |
| cycle1-elephant-a-O | 개선 상위10% | 1.328 | 1.321 | 10/10 |
| cycle1-elephant-j-a-Z | 개선 상위10% | 1.313 | 1.076 | 7/10 |
| cycle1-hills-a-S | 개선 상위10% | 1.187 | 1.196 | 10/10 |
| cycle1-jeremy-a-L | 악화 상위10% | 0.917 | 0.982 | 2/10 |
| cycle1-pcinfo-013-T | 악화 상위10% | 0.907 | 0.955 | 4/10 |
| cycle1-pcinfo-016-T | 악화 상위10% | 0.899 | 0.999 | 5/10 |
| cycle1-pcinfo-021-J | 개선 상위10% | 1.358 | 1.372 | 10/10 |
| cycle1-pcinfo-022-J | 개선 상위10% | 1.625 | 1.633 | 10/10 |
| cycle1-pcinfo-024-I | 악화 상위10% | 0.947 | 1.008 | 6/10 |
| cycle1-pcinfo-024-Z | 악화 상위10% | 0.918 | 1.065 | 8/10 |
| cycle1-pcinfo-027-S | 악화 상위10% | 0.944 | 0.991 | 5/10 |
| cycle1-pcinfo-037-S | 개선 상위10% | 1.237 | 1.214 | 10/10 |
| cycle1-pcinfo-039-I | 개선 상위10% | 1.195 | 1.203 | 10/10 |

### 최초 회귀3개의 재현 여부

| 입력 | 최초비율 | 재측정비율 | paired ΔON−OFF(ms) | side회귀경보 | paired회귀 | 편차≥10% |
|---|---:|---:|---:|---|---|---|
| cycle1-big-jaws-a-S | 0.885 | 0.943 | 2.17 | false | false | true |
| cycle1-elephant-j-a-O | 0.973 | 1.014 | -0.83 | false | false | true |
| cycle1-jeremy-a-L | 0.917 | 0.982 | 1.64 | false | false | true |

### 재테스트 전체 입력 (최초와재측정 별도)

| 입력 | 이유 | 최초비율 | 재측정비율 | 빠른pair/완료pair | OFF편차 | ON편차 | 비율편차 |
|---|---|---:|---:|---:|---:|---:|---:|
| cycle1-6p-pco-a-I | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.036 | 1.021 | 6/10 | 51.4% | 130.1% | 53.8% |
| cycle1-6p-pco-a-O | p90-fast, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.216 | 1.040 | 6/10 | 61.2% | 50.6% | 91.8% |
| cycle1-6p-pco-a-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.055 | 0.999 | 5/10 | 75.2% | 57.0% | 132.9% |
| cycle1-alt-jaws-a-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.004 | 1.008 | 6/10 | 35.3% | 31.6% | 14.4% |
| cycle1-alt-jaws-a-S | off-spread>=10%, paired-spread>=10% | 0.997 | 1.015 | 6/10 | 10.9% | 9.7% | 14.1% |
| cycle1-alt-jaws-a-Z | off-spread>=10%, paired-spread>=10% | 0.978 | 0.972 | 3/10 | 11.3% | 7.5% | 9.7% |
| cycle1-alt-shoes-a-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.004 | 1.009 | 6/10 | 14.8% | 30.4% | 28.2% |
| cycle1-alt-shoes-a-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.951 | 1.010 | 6/10 | 25.1% | 17.6% | 23.5% |
| cycle1-alt-shoes-a-Z | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.946 | 0.967 | 3/10 | 28.6% | 18.0% | 32.1% |
| cycle1-big-jaws-a-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.067 | 0.997 | 5/10 | 33.8% | 38.4% | 52.4% |
| cycle1-big-jaws-a-S | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.885 | 0.943 | 3/10 | 19.4% | 23.3% | 24.3% |
| cycle1-cliff-o-a-I | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.979 | 0.960 | 4/10 | 42.7% | 59.4% | 30.5% |
| cycle1-cliff-o-a-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.041 | 1.034 | 8/10 | 26.6% | 22.9% | 31.5% |
| cycle1-elephant-a-I | off-spread>=10%, paired-spread>=10% | 1.018 | 0.957 | 2/10 | 15.2% | 29.9% | 28.3% |
| cycle1-elephant-a-O | p90-fast | 1.328 | 1.321 | 10/10 | 9.3% | 5.7% | 10.4% |
| cycle1-elephant-j-a-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.973 | 1.014 | 5/10 | 29.6% | 42.7% | 13.9% |
| cycle1-elephant-j-a-Z | p90-fast, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.313 | 1.076 | 7/10 | 52.7% | 34.3% | 76.5% |
| cycle1-grace-system-a-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.064 | 1.006 | 5/10 | 38.2% | 41.7% | 62.3% |
| cycle1-grace-system-a-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.127 | 1.056 | 6/10 | 81.7% | 74.2% | 105.0% |
| cycle1-grace-system-b-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.986 | 1.096 | 6/10 | 52.7% | 52.6% | 47.0% |
| cycle1-hills-a-O | off-spread>=10% | 1.013 | 1.020 | 9/10 | 6.0% | 2.2% | 5.9% |
| cycle1-hills-a-S | p90-fast | 1.187 | 1.196 | 10/10 | 8.1% | 3.0% | 9.3% |
| cycle1-jaws-a-I | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.147 | 1.143 | 8/10 | 30.0% | 19.7% | 35.6% |
| cycle1-jaws-a-S | on-spread>=10%, paired-spread>=10% | 1.024 | 1.007 | 6/10 | 22.3% | 8.1% | 21.5% |
| cycle1-jaws-a-Z | off-spread>=10%, paired-spread>=10% | 1.017 | 1.023 | 7/10 | 12.2% | 33.0% | 23.3% |
| cycle1-jeremy-a-L | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.917 | 0.982 | 2/10 | 32.2% | 53.0% | 24.0% |
| cycle1-jeremy-a-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.011 | 0.987 | 3/10 | 7.2% | 19.3% | 21.0% |
| cycle1-jeremy-a-Z | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.977 | 0.963 | 4/10 | 22.8% | 17.4% | 37.4% |
| cycle1-legs-a-O | paired-spread>=10% | 1.139 | 1.131 | 10/10 | 11.3% | 6.4% | 15.9% |
| cycle1-legs-a-Z | off-spread>=10%, paired-spread>=10% | 1.131 | 1.131 | 10/10 | 5.9% | 0.9% | 6.1% |
| cycle1-pcinfo-007-J | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.145 | 1.093 | 7/10 | 42.3% | 37.6% | 46.6% |
| cycle1-pcinfo-007-S | off-spread>=10%, paired-spread>=10% | 1.007 | 1.055 | 7/10 | 33.0% | 9.5% | 37.5% |
| cycle1-pcinfo-011-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.060 | 1.013 | 7/10 | 55.7% | 10.7% | 60.1% |
| cycle1-pcinfo-011-Z | on-spread>=10%, paired-spread>=10% | 1.006 | 1.027 | 7/10 | 25.9% | 15.5% | 39.0% |
| cycle1-pcinfo-013-S | off-spread>=10%, paired-spread>=10% | 1.012 | 1.026 | 8/10 | 19.3% | 21.3% | 26.4% |
| cycle1-pcinfo-013-T | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.907 | 0.955 | 4/10 | 54.4% | 53.8% | 43.7% |
| cycle1-pcinfo-014-L | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.006 | 1.029 | 6/10 | 29.6% | 43.1% | 42.6% |
| cycle1-pcinfo-014-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.999 | 1.044 | 9/10 | 40.4% | 33.1% | 18.3% |
| cycle1-pcinfo-015-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.996 | 1.024 | 5/10 | 25.6% | 30.0% | 48.4% |
| cycle1-pcinfo-015-Z | off-spread>=10%, paired-spread>=10% | 1.061 | 1.018 | 5/10 | 48.2% | 38.8% | 59.0% |
| cycle1-pcinfo-016-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.007 | 1.063 | 8/10 | 33.0% | 14.3% | 38.4% |
| cycle1-pcinfo-016-T | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.899 | 0.999 | 5/10 | 20.4% | 24.1% | 41.7% |
| cycle1-pcinfo-018-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.063 | 1.053 | 8/10 | 34.9% | 68.1% | 51.5% |
| cycle1-pcinfo-018-Z | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.138 | 1.084 | 8/10 | 25.6% | 24.5% | 30.6% |
| cycle1-pcinfo-019-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.965 | 0.963 | 4/10 | 19.9% | 42.2% | 36.8% |
| cycle1-pcinfo-019-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.054 | 1.009 | 6/10 | 31.6% | 23.0% | 37.2% |
| cycle1-pcinfo-020-O | off-spread>=10%, paired-spread>=10% | 1.032 | 0.976 | 2/10 | 26.1% | 10.3% | 22.8% |
| cycle1-pcinfo-021-J | p90-fast | 1.358 | 1.372 | 10/10 | 12.5% | 12.2% | 14.4% |
| cycle1-pcinfo-021-S | off-spread>=10%, paired-spread>=10% | 1.060 | 1.029 | 9/10 | 6.2% | 23.0% | 18.2% |
| cycle1-pcinfo-022-J | p90-fast | 1.625 | 1.633 | 10/10 | 4.1% | 5.3% | 8.3% |
| cycle1-pcinfo-023-L | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.025 | 1.080 | 6/10 | 42.2% | 19.0% | 59.9% |
| cycle1-pcinfo-023-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.032 | 1.007 | 5/10 | 20.4% | 18.1% | 24.3% |
| cycle1-pcinfo-024-I | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.947 | 1.008 | 6/10 | 42.1% | 14.4% | 47.6% |
| cycle1-pcinfo-024-Z | p90-slow, off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.918 | 1.065 | 8/10 | 48.0% | 40.0% | 31.7% |
| cycle1-pcinfo-025-I | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.982 | 1.058 | 6/10 | 43.5% | 21.3% | 49.8% |
| cycle1-pcinfo-025-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.995 | 1.013 | 6/10 | 22.2% | 29.2% | 49.3% |
| cycle1-pcinfo-026-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.000 | 0.948 | 3/10 | 26.2% | 20.2% | 47.6% |
| cycle1-pcinfo-027-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.012 | 0.968 | 5/10 | 17.6% | 32.8% | 30.9% |
| cycle1-pcinfo-027-S | p90-slow, on-spread>=10%, paired-spread>=10% | 0.944 | 0.991 | 5/10 | 27.8% | 31.2% | 39.4% |
| cycle1-pcinfo-028-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.957 | 0.979 | 3/10 | 27.3% | 28.8% | 30.1% |
| cycle1-pcinfo-029-O | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.009 | 0.951 | 4/10 | 19.2% | 50.4% | 45.9% |
| cycle1-pcinfo-029-S | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.066 | 0.996 | 5/10 | 28.1% | 26.3% | 38.0% |
| cycle1-pcinfo-037-S | p90-fast | 1.237 | 1.214 | 10/10 | 8.7% | 10.2% | 9.5% |
| cycle1-pcinfo-039-I | p90-fast | 1.195 | 1.203 | 10/10 | 1.6% | 2.9% | 1.9% |
| cycle1-shoes-a-I | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 0.996 | 0.963 | 2/10 | 32.5% | 57.2% | 53.0% |
| cycle1-shoes-a-Z | off-spread>=10%, on-spread>=10%, paired-spread>=10% | 1.080 | 1.116 | 10/10 | 24.9% | 16.4% | 18.7% |

## 최종 판단과 한계

- 개선과회귀를동시에보고한다. 10회반복만으로통계적유의성이나모든입력비회귀를증명하지않는다.
- 짧은입력의큰비율/편차는VM잡음·JIT·메모리할당등의영향을받을수있다. paired비율/절대ms/방향일관성을함께본다.
- 19개양측timeout의정확한완료시간과최적witness는미확인이다. 메모리값은완료호출의RSS/WASMcommittedmemory이며nativepeakheap은아니다.
- 추가80과재테스트66은동일보드·반전그룹에서연관된행렬을포함한다. 독립보드100개라고주장하지않는다.
- currentPropagation의 일부 큰 개선은 재현돼 후속 통합 검토 가치가 있다. 최초 경보3개가 같은 기준으로 재현되지 않은 점은 긍정적이지만, 작은 악화/방향 혼재/높은 편차/timeout을 고려해 무조건ON 권고는 보류한다. 제품 승격은 별도 승인과 회귀 검증이 필요하다.
- 원본raw/환경/witness는Actions artifact에,장기요약은reports/expanded100.json,retest10.json,expanded-final-review.json에보존한다.
- 로컬dev/GitHubmain/제품routing/CP선택정책/제품WASM은변경하지않았다.
