# 동결 후보: S2 mask18 → S3 mask16

최종 상태: S3 두 차례 성공. currentPropagation만 후속 통합 검토 대상으로 권장하며,
제품 승격은 하지 않았다. 결과와 timeout 한계는 [FINAL_REPORT_KO.md](FINAL_REPORT_KO.md).

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

## S2 후 최종 확인 후보: mask16

S2: [37042810532](https://github.com/Qnia28/sfinder_wasm/actions/runs/37042810532),
commit `96ee4b1`, 12개 개발입력 × 비교3개 × 3pairs × 30초/call.
216호출:108 exact,108 timeout; 정확성/누락 오류 없음. 108 exact witness를
다운로드하여 원본 rows로 재검산했고 동일 입력의 모든 완료 설정은 일치했다.

| 비교 | 완료6입력의 paired ratio 기하평균 | pcinfo-022/J |
|---|---:|---:|
| off→18 | 1.0885 | 1.6544 |
| 16→18 (presort제거 기여) | 1.0149 | 1.0132 |
| 2→18 (current전파 기여) | 1.0862 | 1.6479 |

새 exact 완료 증가는 없었다. 세 비교 모두10%/5ms회귀, exact→timeout,
20%메모리증가 경보가 없었다. timeout6개는30초에서도 모든설정이 미완료다.

removePresort는 조합 내 약1.5%로 작고 입력별 방향도 섞여 있어 채택 근거가
부족하다. 핵심개선은 currentPropagation으로 확인된다. 따라서 **S3 후보는16**,
즉 currentPropagation만ON으로 단순화한다. stagedBounds/removePresort/rootForced/
priorPropagation은OFF다. 이것은 통합 결정이 아니라 original과 비교할 최종 확인
후보의 고정이다.

- S3 제1회와 제2회는 동일mask16/동일Rust구현/동일20개입력으로 실행한다.
- 각 입력 original↔16을5pairs/60초 제한으로 측정한다.
- 개발12와 검증8 결과를 분리한다. 검증군 결과를 보고 mask를 튜닝하지 않는다.
- 심각한 회귀, exact→timeout, 정답/증명불일치는 보고하고 통합을 보류한다.
- S2 기술통계8.85%는전체입력10%목표달성의 증명이 아니다. 목표입력의
  개선은분명하나 검증군/timeout완료율/비회귀는 S3에서 판단해야 한다.
