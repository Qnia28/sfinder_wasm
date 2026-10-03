# Threshold 엔진 실험 최종 보고

## 결론

**후속 통합 검토 대상으로 currentPropagation만 권장한다(mask16).**
5요소 전부 켜기는 권장하지 않는다. 제품에 통합하거나 기본값을 바꾸지는 않았다.

동일 commit/WASM으로 두 차례 확인한 완료 입력에서 개선이 재현되었다.
정확성·증명·undo 검사와 실제 CP/worker 회귀도 통과했다.
다만 **20개 중 9개는 양측 60초 timeout**으로 성능 효과가 미확인이다.
완료율 증가는 없으므로 전체 입력 개선이나 hard-case 해결로 해석하면 안 된다.

## 보호 범위

- 신규원격branch: [`experiment/threshold-engine-20261003`](https://github.com/Qnia28/sfinder_wasm/tree/experiment/threshold-engine-20261003).
- 제품 routing/CP 선택/timing 정책은 수정하지 않았다.
- 로컬 원본 dev와 원격 main은 수정하지 않았다. merge/제품 WASM 교체 없음.
- 코드는 별도 clone에만 구현했다. 모든 push는 신규 실험 branch만 대상이다.

## 재현 자료

- DB: 지정된cycle-1-setups.json, SHA256 `58f02fe2e1f7939e127de4c7ea2886bcf45c91a797ffa0d25dc8a0e4fb262388`.
- 45setup/41보드·반전그룹. 315save행렬모두exactK증명완료.
- 개발12/검증8: structural rank로고정, 개발/검증mirror그룹중복없음.
- 검증8보드그룹은candidate측정전에고정했고, 검증결과로후보를재튜닝하지않았다.
- S3commit: `ac54ba6961064fa149f7e8ff348b51867e720dcb`.
- [제1회](https://github.com/Qnia28/sfinder_wasm/actions/runs/37046842107/attempts/1), [제2회](https://github.com/Qnia28/sfinder_wasm/actions/runs/37046842107/attempts/2).
- 두실행의sourceDigest/모든WASM SHA256/manifest SHA256일치확인.
- 각실행20입력×5pairs×2설정=200호출. 110EXACT/90TIMEOUT으로동일.
- 2회완료witness총220개를다운로드해원본row로재계산, stableID/품질hash일치.
- [reports/confirmation.json](reports/confirmation.json)에400개sample/환경/입력별요약/hash를압축없이보존했다.
- 원시witness·전체환경·capture로그·빌드artifact는해당Actions에서30일간보존한다.

측정은 같은 runner의 fresh Node/WASM으로 AB/BA를 교대한다. 주 지표 nativeMs는
Rust 전처리/탐색을 포함하고, 입력 IO/hash/반환 witness 검증은 제외한다.
timeout은 시간비 계산에서 제외한다. 단독/조합 비교는 동일 experimental WASM,
최종 확인은 original과 비교한다.

## 5요소 판단

| 요소 | 최종확인선택 | 이유 |
|---|---|---|
| stagedBounds | OFF | 개발군에서뚜렷한단독효과없음 |
| removePresort | OFF | mask16에추가한조합기여약1.5%; 작고불확실하여제외 |
| rootForced | OFF | 단독에서뚜렷한효과없음 |
| priorPropagation | OFF | ALT JAWS/Z에서회귀관측 |
| currentPropagation | ON | pcinfo022/J에서단독·ablation·확인2회에걸친개선재현 |

초기조합mask18의ablation은off→18,16→18,2→18로검사했다.
주효과가currentPropagation임을확인하고, 더단순한mask16을최종확인전에동결했다.

## 확인2회 결과

아래 값은 입력별 paired ratio 중앙값을 같은 군의 완료 입력들에서 기하평균한
기술통계다. 1보다 크면 후보가 빠르다. 서로 다른 runner의 절대시간은 합산하지 않았다.

| 군 | 양측완료입력/전체 | 1회 | 2회 |
|---|---:|---:|---:|
| 개발 | 6/12 | 1.151배 | 1.168배 |
| 검증 | 5/8 | 1.195배 | 1.112배 |

| 입력 | 군 | 1회속도비 | 2회속도비 |
|---|---|---:|---:|
| 6p-pco/O | 개발 | 1.054 | 1.230 |
| ALT JAWS/Z | 개발 | 1.014 | 1.057 |
| ALT SHOES/Z | 개발 | 1.173 | 1.054 |
| HILLS/O | 개발 | 1.002 | 0.996 |
| pcinfo015/Z | 개발 | 1.128 | 1.140 |
| pcinfo022/J | 개발 | 1.638 | 1.629 |
| ELEPHANT/O | 검증 | 1.245 | 1.277 |
| grace-system/O | 검증 | 1.598 | 1.177 |
| JAWS/Z | 검증 | 1.048 | 1.005 |
| JEREMY/L | 검증 | 1.071 | 1.048 |
| LEGS/Z | 검증 | 1.091 | 1.076 |

pcinfo022/J의 2회차 중앙값은 original 1063.92ms → 후보 654.99ms,
ELEPHANT/O는 1047.46 → 828.05ms로 절대시간 개선도 있다.
HILLS/O는 2회차에서 약 4.75ms/0.4% 악화하여 거의 중립이다.
6p-pco/O와 grace/O는 짧은 호출이므로 큰 비율을 일반화하지 않는다.

## 회귀·한계

- 10%이면서5ms이상입력별회귀경보: 두회모두없음.
- originalEXACT→후보TIMEOUT: 두회모두없음.
- 20%이상RSS/WASMmemory증가경보: 두회모두없음.
- 완료입력의WASMcommittedmemory는양측동일. Nativepeakheap계측은아니다.
- 완료율: 두 회차 모두 original 55/100호출, 후보 55/100호출로 차이 없음.
- 미완료9입력: 개발pcinfo030/O,035/Z,036/O,039/S,040/Z,041/Z;
  검증pcinfo031/Z,032/O,033/O. 모두양측5회씩60초timeout이다.
- timeout입력의메모리peak/전체완료시간/최적witness는확인하지못했다.
- 모든315행렬을성능평가한것이아니라,사전규칙으로선정한20행렬을평가했다.
- 5pairs/2runs는효과재현성확인이지통계적유의성/모든입력비회귀의증명은아니다.
- original과experimental간code-layout/feature기초비용이있다. current전파의
  직접기여는same-binary단독/ablation으로별도확인했다.
- trace는별도빌드의카운터뿐이며, 순수tie시간/단계별WASM시간은미계측이다.

## 다음 단계

이 실험의 원격 검사·벤치마크 캠페인은 완료했다. **main/dev에 통합하지 않는다.**
승인된다면 currentPropagation만 별도 통합 후보로 검토하고 제품 전체 회귀·브라우저
검증을 추가한다. timeout 9개는 이 개선으로 해결되지 않았으므로 kernel 재사용·새 pivot·
정확 tail 처리 같은 후속 요소는 별도 실험으로 검토한다. routing 정책 변경의 근거로
사용하지 않는다.
