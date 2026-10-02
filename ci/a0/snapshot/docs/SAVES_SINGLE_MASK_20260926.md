# Saves 1미노 잔여 mask 집계 및 표현식 평가

## 범위와 구조

현재 `calculateSaves`의 **기본 `singleSaveMask:true`**로 적용했다. `false`로 기존 경로를 명시할 수 있다. S21-4의 **JS 집계 특화**와 S21-6의 **고정 outcome 사전 비트 연산**이다. Rust의 탐색/DAG/순서 공유와 WASM packed 사용개수-coverage 전송은 기존 그대로 사용한다.

`single_queue.rs::reachable_save_mask`는 단일 큐 구조적 DAG의 terminal saved 정보를 OR하는 미사용 함수다. 현재 넓은 패턴 API는 multiset root별 OrderLanguage/QueueTrie coverage를 공유하므로 이 함수를 직접 호출하는 것은 해당 공통 탐색의 대체가 아니다. 새로운 Rust API는 이번 변경에 포함되지 않는다.

## 입력 및 정확성 계약

1. 원래 보드의 빈 칸 수 `(clear*10-popcount(board))/4`가 양의 정수이고 **모든 큐 길이가 필요한 배치 수+1**일 때만 특화한다. 초기 완성 줄을 제거한 보드로 필요 배치 수를 재계산하지 않는다. Rust도 원래 빈 칸으로 req를 구한 뒤 탐색 보드만 정규화한다.
2. 각 완성 coverage의 사용개수를 큐의 개수에서 빼서 실제 잔여 미노를 검증한다. 음수나 잔여 합1이 아닌 결과는 기존 helper가 오류로 거부한다. 물리 큐에서 미노를 임의 제거해 PC를 재판정하지 않는다.
3. 큐별 `Uint8Array` 값은 **가능한 실제 잔여 미노들의 집합**이다. 전체 packed coverage 또는 기하 fallback 방문이 끝난 뒤에만 소비한다.
4. 각 분기의 마지막 bag 미추출 집합 `baseSavedMask`에 실제 잔여 미노를 하나 더해 표시순서의 정확한 문자열7종을 만든다. 예: base에T가 있고 실제T가 남으면 `TT`다. 7개 문자열은 서로 다르며 비트는 이 **문자열의 ID**다.
5. 마지막 bag base는 최대128종, 각 사전은 문자열7개다. 사전/AST 평가기는 요청 수명에 묶이고 원본 큐 순서로 실패 목록을 생성한다. 분기/중복 큐는 합치지 않는다.
6. AST는 기존 queue-level parser를 공유한다. atom은 사전에서 일치하는 문자열의 비트 집합이고, complement는 현재 완성 universe에 한정한다. `!`는 부재 테스트, `&&`는 양쪽 비어 있지 않을 때 합집합, 혼합 연산은 기존 왼쪽 결합이다. scalar minimals의 우선순위를 재사용하지 않는다.
7. RegExp 생성은 첫 평가까지 지연한다. 빈 universe나 OR도 잘못된 regex를 숨기지 않는다. 사전 준비를 위해 열거보다 먼저 regex를 평가하지 않는다.
8. ALL의 각 save 빈도와 성공 큐 수도 완성 mask에서 집계한다. 일반 긴 큐, 0-placement, 특화 조건 불충족은 기존 exact code/Set 경로로 간다. 두 옵션이 함께 true이면 특화 가능한 요청에서 mask가 우선하고, 그 외에는 기존 bounded outcomeCache를 사용한다.

## 메모리와 성능 주장 범위

특화 경로의 큐별 outcome 저장은 case당 Set 대신1byte이며176,400큐에서176,400bytes다. case 메타데이터, packed 전송, 결과 실패문자열 목록, AST와 사전, WASM 메모리는 별도로 남는다. 전체 peak memory가1byte/case라는 뜻이 아니다.

## 정확성 검증

- Node20/20 통과. 신규5개 및 이전15개 회귀.
- base128종×reachable128종×표현식17종=278,528개 조합에서 **결과 Set 전체**를 기존 evaluator와 대조했다.
- 빈 결과/빈 문자열,31번째 비트,긴 문자열,사전 입력 변경 격리,regex 오류시점,alias/실패중복/분기bag,Hold양쪽,ALL,실제WASM·geometry fallback,2~6높이의초기완성줄 및0-placement를 검증했다.
- 최초 preflight001의 실패1개는 금지된 서로 다른 길이의 패턴 분기를 만든 테스트 오류였다. 이를 길이 불일치 거부 회귀로 고쳤으며 product 수정 없이 preflight002에서20/20통과했다. 양쪽 기록을 보존했다.

## 제한 pilot

task011: 작은단일식,ALT JAWS 독립fullsplit 단일식/8개식/ALL,ALT SHOES fullsplit 단일식의5입력×off/on×2회=20jobs,3분상한. ALL과두번째보드는집계표현자체가변경되기때문에포함했다. 전체응답hash와두반복을보존한다. 실행 중 기본값은false다. 결과감사 후 적용판정을 기록한다.

## 완료 및 기본 적용

20/20 COMPLETE,16.4초,오류/timeout0. 동결133파일,전체응답20개,실패큐3,644,056항목과task010의3개변경전응답까지독립대조했다. Chrome154의8개완전응답대조도통과했다.

| 입력 | feature on−off 두 관측(ms) | JS 나머지 on−off(ms) |
|---|---:|---:|
| 작은 단일식 | −0.30 / +2.76 | +0.19 / +0.94 |
| JAWS 넓은 단일식 | −52.54 / −121.15 | −82.14 / −92.02 |
| JAWS 넓은 8개식 | −333.93 / −346.84 | −357.98 / −340.77 |
| JAWS 넓은 ALL | −111.89 / −93.93 | −53.81 / −86.67 |
| SHOES 넓은 단일식 | −86.71 / −94.85 | −76.91 / −77.61 |

작은 입력의 준비비용 증가를 수용하고, 수학적으로 정확한1미노잔여조건에서기본활성화했다. 보드명/표현식수/큐수의추정임계값을넣지않았다. 적용후기본값과명시적false의결과회귀20/20통과. 일반outcomeCache는false를유지한다. 두보드의2회측정이므로다른하드웨어/모든입력의속도보장은아니다.

[감사 및 기본적용기록](../../tools/validation/saves-single-mask-audit-20260926/ASTRA_AUDIT_KO.md). frozen manifest는승격전상태이며,승격전파일과후속변경해시를별도보존한다.
