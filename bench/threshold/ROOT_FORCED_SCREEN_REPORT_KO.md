# rootForced 보완 재평가: 중단 후 재개한100입력 screening

## 결론

**rootForced는 B(추가 테스트 필요)를 유지한다. 이번100입력에서는 긍정적 신호가 있으나1회screening이므로 A 승격 근거로는 부족하다.**
- 기존rootForced 단독(0→4)은완료80개에서1.078배,mask16에추가(16→20)는완료81개에서1.036배였다.
- 추가효과비교에서는54개향상/27개악화,회귀경보4개였다.다음확인후보로는보완본보다기존mask4를우선검토한다.
- 정규화통합수집(4→36)은0.983배,루트커버준비(4→68)는1.007배,두보완(4→100)은0.979배였다.추가보완의확실한성능가치는확인하지못했다.
- 두보완까지mask16에추가(16→116)는1.030배,회귀경보6개였다.기존rootForced추가보다우월하다고주장할근거가없다.
- 이번보완32/64는현단계 C(우선순위낮음)로보류한다.1회관측만으로폐기를확정하거나제품통합하지않는다.

## 범위와 자료 결합

- 이전run에서12호출이모두기록된58개를유지하고,미완료42개를동일조건으로전부재실행했다.
- [run 37113754448](https://github.com/Qnia28/sfinder_wasm/actions/runs/37113754448): 58개, commit c7303b5.
- [run 37118105522](https://github.com/Qnia28/sfinder_wasm/actions/runs/37118105522): 42개, commit d482836.
- 재실행의최대병렬12VM.모든입력은6비교×1pair×2호출,호출당300초.동일입력ON/OFF는같은run/같은VM의직렬ABBA측정이다.
- 실제측정step 최대동시실행은재실행12VM이었다.측정구간120.5분,빌드/CI포함workflow 126.0분.개별job가120분걸린것이아니라12VM로여러wave를수행한시간이다.
- 재사용58개는job상태가아닌12실측호출과summary/trace/witness의완전성으로선정했다.취소전에12호출과artifact를완성한job도포함된다.
- 양run의Rust/제품JS/experimentalWASM/입력hash일치를확인했다.과거부분자료120호출은종합통계에서제외하고별도보존했다.
- 100ID는99개핵심행렬/41mirror그룹이다.중복1개를유지했다.통합된실행이며독립적인단일run100검증이라고부르지않는다.
- 1회screening이며반복편차/통계적유의성/최종통합등급을확정하지않는다.기존20개단독screen이나mask16확대·10회재테스트와도합산하지않는다.

## 전체측정과비교

- 실제1,200호출: EXACT 964, TIMEOUT 236.누락을timeout으로치환하지않았다.
- 19개입력은모든6비교에서양쪽TIMEOUT이었다.pcinfo032/Z는currentPropagation이없는4비교에서양측TIMEOUT,있는2비교에서양측EXACT다.
- pcinfo032/Z에서16→20은약286.2→287.6초(0.995배),16→116은약287.3→290.9초(0.988배)다.완료경계에가까우며rootForced가완료를늘린사례는아니다.
- 모든비교에서왼쪽만/오른쪽만완료pair는0개,메모리20%증가경보도0개였다.
| 비교 | mask | 양측완료/100 | 향상/악화 | 완료군기하평균 | EXACT L/R | paired회귀경보수 |
|---|---|---:|---:|---:|---:|---:|
| old-root-alone | 0→4 | 80 | 62/18 | 1.078 | 80/80 | 3 |
| old-root-incremental | 16→20 | 81 | 54/27 | 1.036 | 81/81 | 4 |
| fused-collection | 4→36 | 80 | 36/44 | 0.983 | 80/80 | 14 |
| prepared-root-coverage | 4→68 | 80 | 44/36 | 1.007 | 80/80 | 7 |
| both-refinements | 4→100 | 80 | 28/52 | 0.979 | 80/80 | 16 |
| refined-root-incremental | 16→116 | 81 | 62/19 | 1.030 | 81/81 | 6 |

비율은왼쪽/오른쪽시간비이며1보다크면오른쪽이빠르다.완료군기하평균은100전체의속도비가아니다.

## 해석

- 0→4는기존rootForced단독효과,16→20은currentPropagation에대한추가효과다.
- 4→36은정규화중필수후보수집,4→68은kernel중루트커버준비,4→100은두보완의조합이다.
- 16→116이최종mask16후보에보완rootForced를추가하는주비교다.후속후보선정에서이를우선검토한다.
- 보완32/64는oracle/budget/locks/undo검사에서기존rootForced와탐색순서및결과가동일했다.전처리비용만비교하는보완이다.
- trace는별도의bounded진단이며wall time성능근거가아니다.예산소진trace의DFS수를전체탐색량처럼해석하지않는다.
- paired회귀경보는ON시간10%이상증가와paired Δms≥5를함께본다.1회경보는재현된회귀가아니다.
- 이campaign의실험WASM은기존mask16 확대검증의바이너리와다르다.이번OFF/ON은동일바이너리지만기존campaign과수치를pool하지않는다.

### 비용과탐색감소 진단

- trace state budget1000에서8설정모두완료한동일36입력만작업량을비교했다.나머지64개는하나이상budget소진으로전체탐색량비교에서제외했다.
| mask | DFS entries합계 | budget charge포함states | quality그룹갱신 | 추가행스캔 | 루트OR word | 루트copy word |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 18473 | 18473 | 3543626 | 0 | 0 | 0 |
| 4 | 5396 | 22848 | 4133518 | 119157 | 17452 | 0 |
| 16 | 14579 | 16728 | 3267222 | 0 | 0 | 0 |
| 20 | 4354 | 22381 | 4022452 | 119157 | 17452 | 0 |
| 36 | 5396 | 22848 | 4133518 | 0 | 17452 | 0 |
| 68 | 5396 | 22848 | 4133518 | 119157 | 0 | 697 |
| 100 | 5396 | 22848 | 4133518 | 0 | 0 | 697 |
| 116 | 4354 | 22381 | 4022452 | 0 | 0 | 697 |
- 16→20의DFS는14,579→4,354로약70.1%줄었지만quality그룹갱신은3,267,222→4,022,452로약23.1%늘었다.강제선택이DFS를줄여도상태갱신비용은증가할수있다.
- fused수집은추가행스캔119,157회를0으로,prepared커버는OR17,452word를0으로줄였지만kernel에서새계산을수행하고copy697word가생긴다.작업제거가전체시간향상으로직결되지는않았다.
- kernel중forced membership검사의작업량은별도counter가없으므로OR감소만으로총전처리비용이감소했다고주장하지않는다.단계별wall time도측정하지않았다.

### 회귀·완료차이·메모리 경보

- **old-root-alone**
  - paired회귀: cycle1-cliff-o-a-S, cycle1-pcinfo-019-O, cycle1-pcinfo-013-T
  - side중앙값회귀: cycle1-cliff-o-a-S, cycle1-pcinfo-019-O, cycle1-pcinfo-013-T
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음
- **old-root-incremental**
  - paired회귀: cycle1-pcinfo-016-S, cycle1-pcinfo-024-I, cycle1-jaws-a-I, cycle1-pcinfo-025-I
  - side중앙값회귀: cycle1-pcinfo-016-S, cycle1-pcinfo-024-I, cycle1-jaws-a-I, cycle1-pcinfo-025-I
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음
- **fused-collection**
  - paired회귀: cycle1-jaws-a-S, cycle1-jeremy-a-L, cycle1-pcinfo-007-S, cycle1-pcinfo-025-O, cycle1-pcinfo-026-O, cycle1-pcinfo-029-S, cycle1-shoes-a-Z, cycle1-cliff-o-a-I, cycle1-elephant-a-I, cycle1-pcinfo-019-S, cycle1-pcinfo-023-L, cycle1-pcinfo-024-Z, cycle1-pcinfo-025-I, cycle1-shoes-a-I
  - side중앙값회귀: cycle1-jaws-a-S, cycle1-jeremy-a-L, cycle1-pcinfo-007-S, cycle1-pcinfo-025-O, cycle1-pcinfo-026-O, cycle1-pcinfo-029-S, cycle1-shoes-a-Z, cycle1-cliff-o-a-I, cycle1-elephant-a-I, cycle1-pcinfo-019-S, cycle1-pcinfo-023-L, cycle1-pcinfo-024-Z, cycle1-pcinfo-025-I, cycle1-shoes-a-I
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음
- **prepared-root-coverage**
  - paired회귀: cycle1-big-jaws-a-S, cycle1-jeremy-a-L, cycle1-pcinfo-015-Z, cycle1-cliff-o-a-I, cycle1-pcinfo-018-O, cycle1-pcinfo-019-S, cycle1-pcinfo-025-I
  - side중앙값회귀: cycle1-big-jaws-a-S, cycle1-jeremy-a-L, cycle1-pcinfo-015-Z, cycle1-cliff-o-a-I, cycle1-pcinfo-018-O, cycle1-pcinfo-019-S, cycle1-pcinfo-025-I
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음
- **both-refinements**
  - paired회귀: cycle1-alt-shoes-a-O, cycle1-big-jaws-a-S, cycle1-elephant-j-a-O, cycle1-jaws-a-Z, cycle1-pcinfo-018-Z, cycle1-pcinfo-025-O, cycle1-shoes-a-Z, cycle1-alt-shoes-a-S, cycle1-big-jaws-a-O, cycle1-cliff-o-a-I, cycle1-pcinfo-007-J, cycle1-pcinfo-011-S, cycle1-pcinfo-015-S, cycle1-pcinfo-024-Z, cycle1-pcinfo-025-I, cycle1-pcinfo-029-O
  - side중앙값회귀: cycle1-alt-shoes-a-O, cycle1-big-jaws-a-S, cycle1-elephant-j-a-O, cycle1-jaws-a-Z, cycle1-pcinfo-018-Z, cycle1-pcinfo-025-O, cycle1-shoes-a-Z, cycle1-alt-shoes-a-S, cycle1-big-jaws-a-O, cycle1-cliff-o-a-I, cycle1-pcinfo-007-J, cycle1-pcinfo-011-S, cycle1-pcinfo-015-S, cycle1-pcinfo-024-Z, cycle1-pcinfo-025-I, cycle1-pcinfo-029-O
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음
- **refined-root-incremental**
  - paired회귀: cycle1-elephant-j-a-O, cycle1-pcinfo-016-S, cycle1-big-jaws-a-O, cycle1-jaws-a-I, cycle1-pcinfo-013-T, cycle1-pcinfo-023-L
  - side중앙값회귀: cycle1-elephant-j-a-O, cycle1-pcinfo-016-S, cycle1-big-jaws-a-O, cycle1-jaws-a-I, cycle1-pcinfo-013-T, cycle1-pcinfo-023-L
  - EXACT→TIMEOUT: 없음; 오른쪽만완료pair 0
  - 메모리20%경보: 없음

## 입력별 결과와 출처

| 입력 | 출처run | 0→4 | 16→20 | 4→36 | 4→68 | 4→100 | 16→116 |
|---|---|---:|---:|---:|---:|---:|---:|
| cycle1-6p-pco-a-I | 37113754448 | 0.801 | 1.277 | 1.510 | 1.272 | 0.810 | 1.094 |
| cycle1-6p-pco-a-O | 37113754448 | 1.130 | 0.860 | 1.385 | 0.765 | 1.117 | 1.151 |
| cycle1-6p-pco-a-S | 37113754448 | 0.967 | 1.079 | 0.939 | 1.152 | 1.643 | 1.037 |
| cycle1-alt-jaws-a-O | 37118105522 | 1.197 | 1.201 | 1.020 | 1.022 | 0.982 | 1.094 |
| cycle1-alt-jaws-a-S | 37113754448 | 1.034 | 1.125 | 1.021 | 1.045 | 1.006 | 1.010 |
| cycle1-alt-jaws-a-Z | 37113754448 | 1.018 | 1.110 | 1.145 | 1.005 | 1.079 | 1.045 |
| cycle1-alt-shoes-a-O | 37113754448 | 1.060 | 0.979 | 1.009 | 1.022 | 0.895 | 1.050 |
| cycle1-alt-shoes-a-S | 37118105522 | 1.175 | 0.991 | 0.942 | 1.000 | 0.828 | 1.010 |
| cycle1-alt-shoes-a-Z | 37113754448 | 1.035 | 1.091 | 1.053 | 1.042 | 0.968 | 1.013 |
| cycle1-big-jaws-a-O | 37118105522 | 1.304 | 0.911 | 0.959 | 0.919 | 0.816 | 0.889 |
| cycle1-big-jaws-a-S | 37113754448 | 1.005 | 1.542 | 1.231 | 0.876 | 0.861 | 0.954 |
| cycle1-cliff-o-a-I | 37118105522 | 1.095 | 0.974 | 0.803 | 0.894 | 0.848 | 0.916 |
| cycle1-cliff-o-a-S | 37113754448 | 0.892 | 1.176 | 1.072 | 1.023 | 0.953 | 0.996 |
| cycle1-elephant-a-I | 37118105522 | 1.069 | 1.027 | 0.896 | 1.064 | 0.955 | 1.072 |
| cycle1-elephant-a-O | 37113754448 | 1.031 | 1.017 | 1.004 | 1.010 | 0.983 | 1.024 |
| cycle1-elephant-a-S | 37113754448 | 0.961 | 0.921 | 0.925 | 1.013 | 1.024 | 1.031 |
| cycle1-elephant-j-a-O | 37113754448 | 1.118 | 0.958 | 1.174 | 1.053 | 0.901 | 0.875 |
| cycle1-elephant-j-a-Z | 37118105522 | 1.426 | 1.050 | 0.964 | 1.017 | 0.932 | 1.014 |
| cycle1-grace-system-a-O | 37113754448 | 0.931 | 1.185 | 0.662 | 1.085 | 1.302 | 0.849 |
| cycle1-grace-system-a-S | 37113754448 | 1.381 | 0.771 | 0.761 | 1.140 | 1.247 | 1.023 |
| cycle1-grace-system-b-O | 37113754448 | 0.654 | 0.769 | 0.702 | 1.746 | 1.331 | 1.446 |
| cycle1-hills-a-O | 37113754448 | 1.008 | 1.008 | 0.985 | 0.974 | 1.009 | 1.017 |
| cycle1-hills-a-S | 37118105522 | 1.030 | 0.989 | 0.997 | 1.003 | 0.969 | 1.002 |
| cycle1-hills-a-Z | 37113754448 | 1.023 | 1.010 | 1.000 | 0.993 | 0.986 | 1.002 |
| cycle1-jaws-a-I | 37118105522 | 1.163 | 0.832 | 1.009 | 1.045 | 1.033 | 0.889 |
| cycle1-jaws-a-S | 37113754448 | 0.993 | 1.080 | 0.786 | 0.928 | 1.004 | 1.090 |
| cycle1-jaws-a-Z | 37113754448 | 1.049 | 0.989 | 0.977 | 0.943 | 0.878 | 0.980 |
| cycle1-jeremy-a-L | 37113754448 | 1.342 | 1.267 | 0.891 | 0.842 | 1.020 | 1.149 |
| cycle1-jeremy-a-S | 37113754448 | 1.189 | 1.044 | 1.034 | 1.073 | 0.947 | 1.289 |
| cycle1-jeremy-a-Z | 37118105522 | 0.993 | 1.218 | 1.011 | 0.953 | 0.941 | 1.086 |
| cycle1-legs-a-O | 37118105522 | 1.049 | 1.022 | 0.998 | 0.990 | 1.010 | 1.027 |
| cycle1-legs-a-S | 37113754448 | 1.002 | 0.965 | 0.992 | 0.992 | 0.998 | 1.006 |
| cycle1-legs-a-Z | 37113754448 | 1.027 | 1.009 | 0.992 | 0.998 | 0.999 | 0.999 |
| cycle1-pcinfo-007-J | 37118105522 | 1.098 | 0.957 | 1.107 | 1.116 | 0.826 | 1.079 |
| cycle1-pcinfo-007-S | 37113754448 | 0.988 | 1.014 | 0.827 | 1.050 | 1.071 | 1.049 |
| cycle1-pcinfo-011-S | 37118105522 | 1.101 | 1.050 | 0.998 | 1.116 | 0.902 | 1.214 |
| cycle1-pcinfo-011-Z | 37113754448 | 1.130 | 1.024 | 1.008 | 0.977 | 1.029 | 1.049 |
| cycle1-pcinfo-013-S | 37113754448 | 0.968 | 0.997 | 1.359 | 0.932 | 0.962 | 1.076 |
| cycle1-pcinfo-013-T | 37118105522 | 0.827 | 1.160 | 0.948 | 1.133 | 1.075 | 0.881 |
| cycle1-pcinfo-014-L | 37118105522 | 1.095 | 1.072 | 1.029 | 0.924 | 1.148 | 1.028 |
| cycle1-pcinfo-014-O | 37113754448 | 1.249 | 1.024 | 0.999 | 1.029 | 1.052 | 1.111 |
| cycle1-pcinfo-015-S | 37118105522 | 1.098 | 1.388 | 1.180 | 0.971 | 0.891 | 1.193 |
| cycle1-pcinfo-015-Z | 37113754448 | 1.126 | 1.109 | 0.949 | 0.801 | 0.959 | 0.973 |
| cycle1-pcinfo-016-S | 37113754448 | 0.939 | 0.821 | 0.997 | 0.996 | 1.002 | 0.821 |
| cycle1-pcinfo-016-T | 37118105522 | 0.806 | 1.200 | 0.930 | 1.093 | 0.801 | 1.079 |
| cycle1-pcinfo-018-O | 37118105522 | 1.199 | 1.030 | 1.004 | 0.882 | 0.989 | 1.023 |
| cycle1-pcinfo-018-Z | 37113754448 | 1.247 | 1.082 | 1.125 | 0.918 | 0.865 | 1.153 |
| cycle1-pcinfo-019-O | 37113754448 | 0.879 | 1.059 | 1.039 | 1.054 | 0.909 | 1.033 |
| cycle1-pcinfo-019-S | 37118105522 | 1.304 | 1.040 | 0.845 | 0.703 | 1.040 | 1.145 |
| cycle1-pcinfo-020-O | 37113754448 | 1.223 | 1.128 | 0.988 | 1.019 | 0.909 | 1.072 |
| cycle1-pcinfo-021-J | 37118105522 | 1.038 | 0.967 | 1.065 | 0.994 | 1.026 | 1.049 |
| cycle1-pcinfo-021-S | 37113754448 | 1.099 | 1.103 | 0.920 | 0.962 | 0.914 | 1.099 |
| cycle1-pcinfo-022-J | 37113754448 | 1.025 | 0.990 | 1.001 | 1.019 | 1.025 | 1.015 |
| cycle1-pcinfo-022-L | 37118105522 | 1.000 | 1.017 | 0.997 | 1.002 | 0.991 | 1.014 |
| cycle1-pcinfo-022-O | 37113754448 | 1.055 | 1.018 | 1.032 | 1.084 | 1.005 | 1.039 |
| cycle1-pcinfo-023-L | 37118105522 | 1.127 | 1.019 | 0.708 | 1.107 | 1.191 | 0.825 |
| cycle1-pcinfo-023-S | 37113754448 | 1.180 | 1.206 | 0.915 | 1.005 | 0.983 | 1.018 |
| cycle1-pcinfo-024-I | 37113754448 | 1.595 | 0.759 | 1.081 | 1.065 | 1.054 | 1.156 |
| cycle1-pcinfo-024-Z | 37118105522 | 1.107 | 1.342 | 0.810 | 1.096 | 0.850 | 0.952 |
| cycle1-pcinfo-025-I | 37118105522 | 0.972 | 0.888 | 0.852 | 0.823 | 0.855 | 0.969 |
| cycle1-pcinfo-025-O | 37113754448 | 1.407 | 1.058 | 0.904 | 1.124 | 0.878 | 0.951 |
| cycle1-pcinfo-026-O | 37113754448 | 1.265 | 1.177 | 0.825 | 1.110 | 0.980 | 1.111 |
| cycle1-pcinfo-027-O | 37118105522 | 1.312 | 1.020 | 1.286 | 1.135 | 0.919 | 1.006 |
| cycle1-pcinfo-027-S | 37113754448 | 1.295 | 1.052 | 0.933 | 1.069 | 0.926 | 1.000 |
| cycle1-pcinfo-028-S | 37113754448 | 1.045 | 1.052 | 0.996 | 0.969 | 0.966 | 1.104 |
| cycle1-pcinfo-029-O | 37118105522 | 1.309 | 1.263 | 1.173 | 1.054 | 0.829 | 1.193 |
| cycle1-pcinfo-029-S | 37113754448 | 1.600 | 0.991 | 0.887 | 0.920 | 0.969 | 1.018 |
| cycle1-pcinfo-030-I | 37113754448 | 1.008 | 1.014 | 0.997 | 0.999 | 1.009 | 1.016 |
| cycle1-pcinfo-030-O | 37113754448 | 1.006 | 1.001 | 1.005 | 1.000 | 0.997 | 1.005 |
| cycle1-pcinfo-030-Z | 37118105522 | 1.008 | 1.005 | 1.000 | 0.998 | 0.991 | 1.004 |
| cycle1-pcinfo-031-O | 37118105522 | 1.013 | 0.992 | 0.988 | 0.985 | 0.998 | 1.009 |
| cycle1-pcinfo-031-S | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-031-Z | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-032-O | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-032-S | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-032-Z | 37118105522 | TIMEOUT/TIMEOUT | 0.995 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | 0.988 |
| cycle1-pcinfo-033-O | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-033-S | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-033-Z | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-034-S | 37113754448 | 1.018 | 1.025 | 1.008 | 1.014 | 0.995 | 1.011 |
| cycle1-pcinfo-034-Z | 37113754448 | 1.026 | 1.005 | 1.007 | 1.000 | 1.002 | 1.018 |
| cycle1-pcinfo-035-I | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-035-S | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-035-Z | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-036-O | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-036-S | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-036-Z | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-037-S | 37118105522 | 1.010 | 1.005 | 1.003 | 1.000 | 1.006 | 1.017 |
| cycle1-pcinfo-037-T | 37113754448 | 1.030 | 1.015 | 0.988 | 1.001 | 0.993 | 1.015 |
| cycle1-pcinfo-039-I | 37113754448 | 0.997 | 0.993 | 0.996 | 1.018 | 0.997 | 1.001 |
| cycle1-pcinfo-039-S | 37113754448 | 1.001 | 0.987 | 1.013 | 0.995 | 1.000 | 1.004 |
| cycle1-pcinfo-039-Z | 37113754448 | 1.000 | 1.003 | 1.001 | 0.995 | 0.999 | 1.000 |
| cycle1-pcinfo-040-J | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-040-O | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-040-Z | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-041-I | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-041-O | 37118105522 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-pcinfo-041-Z | 37113754448 | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT | TIMEOUT/TIMEOUT |
| cycle1-shoes-a-I | 37118105522 | 1.033 | 0.936 | 0.894 | 0.943 | 0.966 | 1.083 |
| cycle1-shoes-a-Z | 37113754448 | 1.170 | 0.992 | 0.902 | 0.999 | 0.823 | 0.964 |

## 다음판단과보호대상

- 이보고서는요청한기존완료58개+재실행42개의screening종합결과다.후속5회확인·선정입력10회재테스트는별도단계이며완료됐다고주장하지않는다.
- 제품통합·옵션기본값·routing/CP선택정책은변경하지않았다.로컬dev와원격main은보호한다.
- 장기자료: reports/root-screen.json,root-retained.json,root-resumed.json;중단부분자료는root-screen-interrupted.json.
