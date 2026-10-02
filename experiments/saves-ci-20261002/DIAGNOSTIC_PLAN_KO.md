# 6개 반례만 대상으로 하는 원인 분리

사용자는 첫 wave 결과를 보고 이 추가 진단을 승인했다. 첫 wave 성공run36976418775/commitfceaad1의3344개 관측과16자원 session은 그대로 보존한다.

## 변경 없는 후보

baseline187fbf9, A5 681b096, A4 023950c, A6 111c9d2, B4 fc377e7 그대로. 새 source/WASM 최적화를 만들지 않는다. 같은 원본 Linux R/M WASM bytes를 prior artifact와 SHA256 대조한 뒤 재사용한다.

기존 native73/Node66 correctness 성공도 동일 source tree/WASM/pack 및 pinned prior GATE_SEAL일 때만 재사용한다. 새 runner는 child supervision3 tests와 immutable subset/design gate를 통과해야 하고, 각 실제 관측은REF/P/R/M full ordered output signature가 동일해야 한다. 후보나 테스트 의미가 바뀌면 재사용을 거부한다.

이전 절대시간을 새 runner candidate와 조합하지 않는다. 새6셀은 단일 무료Ubuntu VM에서4조건을serial 측정한다.

## 입력과 질문

`inputs/diagnostic.json`은 원래inputs/cells.json에서6셀을 정확히 선택한다. fumen/pattern/wanted/clear/Hold/cache/mask/coldWarm 모두 원래 값 그대로다.

| 셀 | 질문 |
|---|---|
| QB241 fixed1 | 작은 입력의 큰relative 손해가 wrapper/build/direct 중 어디에 있는가? |
| QB020 fixed1 | 양 관측12〜13ms 손실이 같은 비용 분리에서도 나타나는가? |
| QB088 prefix210 | warmed direct 대상의15〜17ms 손실을 분리할 수 있는가? |
| pcinfo033 q10 | direct가 호출되지 않는generic 경로의 큰 손실이 재빌드/packed Rust와 관련되는가? |
| 6p-PCO q10 | required4 generic fallback의 반례도 같은 구성요소에 있는가? |
| ELEPHANT bag | 같은board에서대규모 ALL은 개선했지만bag은 손실인 차이가 무엇인가? |

REF/P=JS wrapper 비용, P/R=원Rust rebuild, R/M=packed/materialization/direct Rust 차이, REF/M=전체 제품 차이. 마지막ratio만으로원인을 귀속하지 않는다. 각 쌍2관측 모두 남기며 상반되면불명으로 유지한다.

## 중복 배제·상한

-6셀×4조건×2회=48 requests. 새 질문은 원인 분리이며 전체 DB의 일반 효과 재측정이 아니다.
- prior large anchor B407/B409는새로 돌리지 않고 기존 positive factor 증거로 재사용한다.
- native73/Node66 반복 없음. 새로운 cache/resource/telemetry 대량 검사 없음.
- 기존32holdout, 동시요청/browser, A1/A2/B1/B2/B3/B6 미실행.
- workflow campaign=diagnostic으로screen anchor/matrix를건너뛴다. 단일진단job8분, internal budget5분, request15초, startup/warmup30초.
- build/gate는기존 artifact 검증·재사용뿐. artifact4개 raw합<=16MiB, retention1일, cache/larger/유료 fallback 없음.
- prior artifact가만료되거나hash/source mismatch이면중단하고질문한다. 임의 재빌드/새candidate로대체하지 않는다.
- 결과는새run으로보존하고실패/timeout/중단을지우지 않는다. main 변경/승격 없음.
