# 확대실험의 극단 성능·변동 입력 재테스트

사용자 요청: 기존100행렬을교체하지않고 P90이상개선/악화 및 반복편차10%이상을
10회재측정하여 최종보고서에포함한다. 중복1개는유지한다.

## 확정 대상

초기run [37097238109](https://github.com/Qnia28/sfinder_wasm/actions/runs/37097238109),
candidate `74666a9`, 원본raw1,000개/witness805개검산자료는reports/expanded100.json.

- 양측5쌍완료80행렬의 paired median OFF/ON속도비에서 상위10%/하위10%를선정.
- R7(linear) quantile: P90=1.1862406727, P10=0.9506998750. 각8입력.
- 반복편차: (max-min)/median. OFF nativeMs, ON nativeMs, paired ratio중하나라도10%이상.
  OFF56개,ON48개,paired59개로대상은중복된다. 합집합66개를고정했다.
- timeout은시간으로치환하지않는다. ON-only완료032/Z는위선정조건에해당하지않아
  이번재테스트에포함하지않는다. 최초완료증가결과/한계는보고서에그대로남긴다.
- 초기회귀경보3개모두합집합에포함된다.
- 선정파일retest-selection.json에최초report/hash/cutoff/입력별이유/편차를고정한다.

## 실행

- mask16 currentPropagation만, 같은experimentalWASM의OFF(mask0)/ON(mask16).
- 재빌드한WASM bytes/Rust/제품JS hash는최초run과동일해야만측정한다.
- OFF/ON각각10회=10paired repeats,총66×10×2=1,320호출.
- timeout300초,같은VM에서AB/BA교대직렬실행. 최대20VM병렬.
- 최악job시간100분+15분여유=115분. exact입력은완료즉시다음호출로진행.
- 최초5회와재측정10회는합쳐서더좋은중앙값을선택하지않는다. 분리보고한다.
- 느린VM의절대시간과빠른VM의절대시간을ON/OFF비로만들지않는다.

## 최종보고

전체100의최초결과(57개향상/23개악화/1개ON-only/19개양측timeout),
극단·변동66의재측정결과,회귀재현여부,반복편차를분리해보고한다.
최초100ID는99개의서로다른핵심행렬/41mirror그룹이며중복1개를명시한다.
재측정은성과/편차기반선정이므로전체100의독립확인run이라고부르지않는다.
신규회귀에따라통합권고를보류할수있다. dev/main/제품은수정하지않는다.
