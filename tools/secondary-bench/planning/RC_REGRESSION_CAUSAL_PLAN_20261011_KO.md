# Astra 독립 조사: RC 네 회귀의 원인 분리

상태: 설계만 작성. 실행manifest/예산승인/dispatch 아님. 작성자: Astra.

## 질문과 증거

r15 run38072016117의 DEV `7ef62d18e1d155b6479e00d651c851ff3baa7112`와
RC `2c406b98cadc186bfaf4490f4b8568535a60ea01` 사이 네 회귀를 설명한다.
Release3.0 비교 또는 전수 재실행이 아니다.
자료: files/triage-database/triage-experiments/rc-dev-product-r15/.
인계ZIP SHA256: `732dfa920cd48b2f336a4a36ea8d5444c915a04d20d9dae6b7862408602f831e`.
원감사 receipt 오류 FAIL과 전체증거 재감사 미완료는 보존한다.

| 명령 | 초기6pair 관찰 |
|---|---|
| c7-2plus2-qb-row-068/restricted-split | DEV평균188.286초, RC6/6외부600초timeout |
| c7-2plus2-qb-row-293/restricted-split | DEV평균463.569초, RC6/6외부600초timeout |
| c7-2plus2-qb-row-321/all/restricted-split | RC평균+17.121초/+12.11%, 6/6느림 |
| c7-2plus2-qb-row-318/all/restricted-split | RC평균+11.218초/+8.44%, 6/6느림 |

가설: probe 생략에 따른 seed 변화, 지속 CP의 CPU 경쟁, compact CP 모델의 탐색 변화,
상호작용, 기타 worker/실패처리 변화. 기존 비승격 판단은 P15 원인 확정이 아니다.
다른 AI의 결론을 받기 전에 이 설계를 기록하고 이후 근거 단위로 대조한다.

## 단계0: 저장증거·정적코드 조사 (solver0)

- 네 명령의 원 fumen/pattern/clear4/hold=true/N+1/thread와 fixture/K/seed/hash를 동결한다.
- timeout 로그의 저장조각별 진행 증거를 확인한다. 없으면 미확인으로 남긴다.
- DEV→RC 제품7파일 diff를 probe/CP제한/model/실패처리로 분류한다.
- QB068은 저장fixture에서 T만d14, 나머지d20~39; QB293은d23~45, 모두non-hard다.
  이는 정적 probe생략 근거일 뿐 실제 병목 조각의 증거가 아니다.
- API 한도 회복 후 cache로 누락 artifact만 수집해 receipt 재감사한다.
  한 프로세스로 수행하고 API제한 시 중단한다. 원증거를 새 측정으로 대체하지 않는다.

## 단계1: 제품경로 국소화·계측 확인 (16호출)

4명령×DEV/RC원commit×2반복=16호출. 각 명령의 arm순서를 AB/BA로 반전한다.
원 제품경로/WASM과 별도해시의 최소 진단patch를 사용한다. 계측 epoch를 r15와 분리한다.
이는 사전smoke가 아니라 병목 저장조각을 찾는 본 진단이다.

기록할 사건(매 탐색state 로깅 금지):
- enumeration/primary/저장조각별 시작·완료, candidate universe hash.
- K, primaryHard,d, probe결정·시작·종료·완료flag·상태수.
- primary/probe seed의 키·가중quality vector hash와 ID매핑hash.
  seed 개입에 필요한 원문은 별도 증거파일로 보존한다.
- threshold/CP 시작·종료·승자·오류·회수, 모델과deadline.
- 조각별 wall, 얻을 수 있다면 worker CPU; 전체scope CPU/peak.
  공유process RSS를 worker별로 합산하지 않는다.
- timeout 이전 진행을 durable log로 보존하고 미완료 조각 시간을 확정값으로 만들지 않는다.

느린 조각, 차이가 벌어진 단계, 계측 영향과 재현성을 판단한다.
재현하지 않으면 단계2로 자동 진행하지 않고 환경/계측 영향을 검토한다.

## 단계2: 3요인 완전 factorial (64호출)

동일 RC 기반에서 아래 실험 전용 요인만 바꾼다. 제품default는 변경하지 않는다.

| 요인 | 수준0 | 수준1 |
|---|---|---|
| P: probe | DEV정책(non-hard100K,hard생략) | P15(non-hard d≤14,hard d≤9) |
| C: CP제한 | DEV의실제120초제한계약 | RC무기한 |
| M: CP모델 | DEV기존표현 | RCcompact표현 |

4명령×8조합×2반복=64호출. 실패복구는 RC로 고정한다.
P0C0M0은 DEV 전체 복제본이 아니다. 단계1 DEV anchor와 차이가 남으면
잔여 worker/실패처리 또는 계측 효과를 조사한다.

CP120초는 역사적 동작의 원인분리용 대조다. **생산제품 CP무기한 요구를 철회하는 후보가 아니다.**
P×C/P×M/C×M 상호작용을 확인한다. 앞선4조건 제안이 분리하지 못한 CP지속시간 요인을 보완한다.

명령별8arm을 한 worker block에서 실행하고 두 번째 block은 독립VM에 역순배정한다.
첫 순서는 사전seed로 무작위 동결한다. arm별 fresh process/3GiB/swap0/외부600초.
최대동시8VM, 기존common executor/scope/start/checkpoint/receipt를 재사용한다.
완료여부·조각별구간·paired차이·CPU를 비교하고 censor에서는 정확한 시간비 대신 하한/도달단계를 제시한다.
2반복은 기전 진단이지 모집단 성능확증이 아니다.

## 단계3: 관측가설에 한정한 개입 (별도 최대16호출 제안)

단계1/2 결과가 필요성을 보여줄 때만 대상·hash·일정을 추가 동결한다.
- seed: 동일고정K행렬/solver/model/thread에서 primary seed vs 저장probe seed.
  seed 생성비용과 후속탐색비용을 분리한다.
- CPU경쟁: 동일seed의 threshold단독 vs CP병행. wall/CPU/승자를 비교한다.
- 모델: 동일행렬/seed의 CP단독에서 모델만 바꾼다.

축약 secondary진단을 제품 end-to-end 시간과 섞지 않는다. 그 결과만으로 채택하지 않는다.

## 규모·계약·전송

기본80호출(16+64), 조건부16추가로 최대96호출 제안.
600초만 합산한 호출시간 상한은 기본13시간20분/총16시간이며 runner예약시간은 아니다.
셋업·회수·전송·감사job timeout까지 포함한 예약과 기한은 실행manifest 단계에서 산정·동결한다.
원장에 기존실행과 연결하며 이 계획만으로 실행을 승인하지 않는다.

exact Human/K/원weighted rows/stable IDs 검산, CP실패 시T유지,
Rust실패 시CP유지/시작, unknown/timeout/OOM 구분을 보존한다.
로컬population solver 실행과 subagent 사용은 하지 않는다.
GitHub Releases 사용금지. source는commit, 입력/증거는Actions artifacts로 전달한다.
VM별 봉인bundle과 독립후처리 집계를 사용해 작은call별 REST요청 폭증을 피한다.
기존checkpoint durability는 유지한다. 전송실패를 제품실패로 해석하지 않는다.

## 이후 계획

1. 다른AI 분석과 Astra 독립분석의 일치/불일치를 근거 단위로 비교한다.
2. 위 진단으로 네 회귀를 설명하고 필요한 경우에만 단계3을 수행한다.
3. 확정 원인에 최소수정 후보를 만든다. CPdeadline복원/품질타협으로 해결하지 않는다.
4. 네 회귀＋이득대표＋변경영향군에서 무계측 후보 검증을 수행한다.
5. 전체 이득/손해 재평가가 필요할 때만 새 전수비교를 설계한다.
   최종 릴리스 판단에는 Release3.0 대조 포함 여부를 명시하고 DEV비교로 대신하지 않는다.
6. 채택 후에만 정식packaging과 사용자 지시에 따른 병합·release를 진행한다.

각 단계는 원증거·portable SQL/CSV·저자 인과설명·반례를 남긴다.
도구PASS나 통계threshold만으로 채택을 자동 결정하지 않는다.
