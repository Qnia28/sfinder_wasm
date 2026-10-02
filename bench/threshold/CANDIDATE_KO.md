# 동결 조합 검증 후보: mask 18

이 문서는 S1 screen 후, S2/S3의 후보 timing을 보기 전에 작성했다.
성능 채택/제품 옵션 기본값 변경을 뜻하지 않는다.

## 근거

S1: [37038377376](https://github.com/Qnia28/sfinder_wasm/actions/runs/37038377376),
commit `988fa59`, DB 개발12, 5개 단독요소 × 3pairs × 20초/call.
360호출 모두 정상: 180 exact, 180 timeout. Exact witness 180개를 내려받아
원본 행으로 다시 검산했고, 동일 입력의 모든 완료 설정이 일치했다.

| 요소 | mask | 완료6입력 paired median 비율의 기술적 기하평균 | 판단 |
|---|---:|---:|---|
| stagedBounds | 1 | 0.9742 | 뚜렷한 기여 없음; 제외 |
| removePresort | 2 | 1.0214 | 작은 차이이며 잡음 가능; ablation에서 기여 확인 |
| rootForced | 4 | 0.9899 | 뚜렷한 단독 기여 없음; 제외 |
| priorPropagation | 8 | 0.9619 | ALT JAWS/Z 회귀(0.8071배) 있어 제외 |
| currentPropagation | 16 | 1.0408 | pcinfo-022/J 개선(1.6041배)이 뚜렷해 포함 |

비율은 off/on이고 1보다 크면 ON이 빠르다. 기하평균은 완료한6입력만의
기술통계이며 timeout6입력의 효과/통계적 유의성을 나타내지 않는다.
단독 모두에서 exact→timeout 및 20% 메모리 증가 경보는 없었다.
20초 timeout6입력은 모든 설정이 미완료여서 속도 비교는 불가능했다.

currentPropagation의 pcinfo-022/J: off 중앙값 1139.55ms, ON 702.63ms.
ALT JAWS/Z에서는 작은 악화(비율0.9584), 짧은 6p-pco/O에서는 몇 ms 증가가
있으므로 평균만으로 회귀를 숨기지 않는다.

## 동결

- **C*=18**: removePresort(bit1=2) + currentPropagation(bit4=16).
- Rust 구현/seed/K/DB manifest는 변경하지 않는다.
- 검증8입력은 screen/후보선정에 검색하거나 측정하지 않았다.
- S2 개발12에서 off↔18, 16↔18, 2↔18을 각각3pairs/30초로 실행한다.
- removePresort가 조합에서도 의미 있는 개선이 없으면 후속 판단에서16을
  선택할 수 있으나, 그때 결정 이유/새 후보를 다시 commit으로 고정한다.
- S2에서 심각한 회귀/정답 오류가 있으면 S3를 자동 진행하지 않는다.
- S3는 선택된 후보를 original과 개발12+검증8에서5pairs/60초로 비교하고,
  동일 mask/구현으로 두 번째 확인run을 수행한다.
- 개선폭/완료율이 충분하지 않으면 "채택 근거 부족"도 정상 결론이다.
