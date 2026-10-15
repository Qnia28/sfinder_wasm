# Fast 벤치 계획 외부 검토 — Gemini / DeepSeek

2026-10-15 · 코드/명세 대조 및 계획 v2 반영. solver 호출0, 벤치/위임/push0.

## 자료와 결론

- 원문: `../../fast2nd/20261015/Gemini-4argon.md`
- 원문: `../../fast2nd/20261015/deepseek-4.1flash.md`
- 입력 원문 SHA256은 `tools/fast-bench/SCOPE_20261015_v2.json`에 기록한다. 원문은 수정하지 않는다.
- 두 보고서는 **벤치 결과가 아니라 v1 설계 검토**다. 비용 절감 추정과 새 정책의 실제 성능을 구분한다.

Gemini의 GRACE 패턴 누락과 E2E 확장 명세 지적은 타당하다. B1 부가 예산 분리와 10K seed→2x2 대조도 첫 분석의 정보를 늘린다.
DeepSeek의 DIRECT 기준 분석, e2e/matrix 연결, 품질 정합 검사와 계측 영향 보강을 차용한다.
반면 양쪽의 대규모 중복 제거 수치는 일부 잘못된 경로 가정/미확정 모집단에 의존한다. Gemini의 품질 공식·OOM 집계·IPW·최악 예산 축소는 그대로 사용할 수 없다.

## 주장별 대조

| 제안/주장 | 판정과 근거 | 계획 반영 |
|---|---|---|
| GRACE 회귀 누락 | 확인. v1의 같은 보드는 `*p5`/`[ILJ]p3,*p2`, 필요 조합은 일반 minimals `*p7` | 실제 역사 입력1개를 capture/matrix/e2e에 추가 |
| GRACE4개 추가(ALL2/per-save2) | 부분 거부. N=4에7큐는 잔여3개. `src/saves.mjs:84-91`의 per-save는 잔여1개를 요구한다. restricted N+3는 이 역사 테스트의 직접 근거도 아님 | 일반 `*p7`만 별도 회귀 층으로 추가, 주 N+1 모집단과 분리 |
| E2E128 ID를 두 모드로 확장하는 JSON 필드 부족 | 확인. 문서에는 있었지만 JSON은 암묵적 | `endToEndModes`, 고유 ID 규칙, 확정273명령 수 추가 |
| I1_FIXED_AUX 필요 | 채택. B1(50/100)과 I1+기본보조의 차이는 기존9군에서 직접 관찰 불가 | 구조별96개에 추가 |
| I10_NO_GRACE / P_ONLY_2x2 | 채택. grace 이후 seed만 보는 공백과 preview-only 후보의 정보 가치 있음 | 같은96개에 추가. preview exact 층은 pure seed 효과에서 분리 |
| hard/preview 부적격 정적 동치 | 코드상 해당 실행 경로 동치 타당. 독립 호출 wall까지 동일한 관측은 아님 | 첫8행렬 음성대조 후 정적 생략 허용; timing 복제 금지 |
| per-save384의 hard 절반이 반드시 낭비 | 과장. v1의192는 초기 quota 상한이며 빈 칸은 재분배한다. 실제 hard 수는 미확정 | probe 표본을 non-hard로 한정하고 층화 축을 previewEligible로 변경 |
| trivial99개 모두 early return/무정보 | 틀림. exact의 original-row trivial proof는 Fast 본체에서 호출하지 않는다. 일반 minimals tiny도 우회 안 함 | 원 singleton trivial/tiny만 보고 9군 생략 금지 |
| per-save tiny/direct 때문에 matrix9군 중복 | 계층 혼동. matrix는 frozen K/seed에서 Fast 본체를 비교, e2e만 tiny/direct를 사용 | 계층 계약 명시, e2e 반복은 유지 |
| preview 미완료 후 다른 seed 경로 없음 | 코드상 맞음(미완료 preview 폐기). 그러나 preview 실행은 시간·메모리·JIT 상태에 영향을 줄 수 있음 | 결과 기반 군 생략/시간 합성 금지. 상태/품질 인과와 runtime 인과 구분 |
| matrix 상한45초면 충분, startup 예약20초 | 근거 없음. 기존 watchdog30+reap10을 유지하면20은 최악 예약이 아님 | 기존60/180/300초+40초 유지 |
| 정확한 품질 anchor120개 필수 | 절대 optimum 비교에는 유용하나 현재 질문의 필수 선행은 아님. quality는 CP도 기동할 수 있고 scope 확대 | 현재군의 exact 결과/동일 입력의 기존 proof를 reference로 연결. 새 exact/CP 캠페인 보류 |
| 130K 상향 / hard 가드 해제 | 별도의 질문. 100K의 전역 최적 예산을 이번에 주장하지 않으면 필수 아님 | 후속 유지. 보고서의 130K 추가와 제외 동시 기재도 그대로 승계 안 함 |
| DIRECT 기준 paired 분석 | 채택. BASE100 대비뿐 아니라 원 질문에 직접 대응 | Δtime/quality 대 DIRECT, proof 종료/seed 개선 채널 분리 |
| e2e=matrix 시간합 | 목적은 채택, 등식은 거부. 독립 프로세스와 연속 save 처리/primary seed/표현이 다를 수 있음 | 동일 e2e 내부 phase와 잔차 기록, 외부 matrix는 identity match 후 진단 비교 |
| JS/native/refine 준비 비용 구분 | 채택 가능한 경계만. WASM 함수 전체는 Rust 준비도 포함 | `wasmCallMs` 명칭, 내부 준비/DFS 분리는 UNOBSERVED |
| trace zero-perturbation, 복사<1µs | 입증 안 됨. 추가 복사·GC도 영향 | 추가 검산/직렬화는 타이머 밖. 원 제품 작업은 안에 유지. screen에 DIRECT 추가 |
| E2E도 모두100% 결정적, 변동이면 버그 | 과장. primary auto의 ORTools2-worker 및 환경을 무시 | matrix 고정 seed 변동은 조사. e2e primary seed/백엔드 변화 별도 기록 |

## 분석을 잘못되게 만들 수 있는 오류

### 1. Gemini의 품질 공식은 실제 목표와 다르다

보고서 §3.4는 한 행을 덮는 **선택 후보의 수**를 품질로 사용한다.
실제 `src/min-cover-quality-refine.mjs:19-45`는 edge별 quality의 최대값을 쓰고 원 행 가중치를 유지한다.

`q_i(S) = max quality(i,s), s ∈ S∩row_i`.
이 값들을 가중 정렬한 벡터를 사전식 최대화하며, 동률에서는 stable ID를 비교한다.
예컨대 한 행에서 quality9 후보1개와 quality1 후보1개는 coverage 개수가 같아도 품질은 다르다.
따라서 Gemini의 W_m/중복도 기반 판정·CSV 필드·원 행렬에서 edge quality가 빠진 보존 명세를 사용하지 않는다.

### 2. OOM 미실행을 추가 관측으로 만들 수 없다

Gemini §3.3의 첫 OOM 뒤 미실행 두 회를 모두 OOM(+∞)으로 처리하는 방식은 거부한다.
OOM1회와 NOT_RUN_AFTER_OOM2회는 다른 사실이다. TIMEOUT도 상한 시점의 우측 검열이지 무한 완료시간이 아니다.
완료쌍 시간, 완료/검열/자원 실패 전이, 계획 대비 실행 누락을 함께 남긴다.

### 3. 층 크기의 역수를 곧바로 IPW로 사용할 수 없다

고정 hash 표집, group cap, pinning, 층간 재분배가 있는 표본에 `N_h/n_h`만 적용해 Horvitz–Thompson 불편 추정량이라고 부를 수 없다.
실제 inclusion probability 계산이 없으므로 층별 N/n은 기술 정보로만 남긴다. per-save384 평균의 모집단 대표성은 주장하지 않는다.
또한 Linkage Core16그룹의 모든 save를 pin하면서 group당4개 cap을 유지한다는 제안은 동시에 충족되지 않을 수 있어 그대로 채택하지 않는다.

### 4. 비용/표본 숫자의 한계

- DeepSeek §3 screen: 40행렬×3정책×ON/OFF×2회는 **480**이며 표의320과 다르다. 나머지 표를 유지하면 합계21,258이지21,098이 아니다.
- DeepSeek의 ALL451/per-save384와932 상한 혼용, Gemini의 non-hard ALL440/preview220 등의 숫자는 현재 capture로 확정된 수가 아니다.
- 단순 B1 대 B100 시간차 또는 budget1 호출만으로 prep-only를 분리할 수 없다. bounded search/refine/경로가 함께 바뀐다.
- Gemini의830h는 timeout 축소와 불충분한 startup 예약에 크게 의존한다. 중복 제거만으로 달성된 안전한 최악 비용이라고 채택하지 않는다.

## v2 채택 범위

넓은 최초 비교라는 사용자 목적에 맞춰 **주9군 전범위의 상한을 유지**한다. 모든 축소군을450개로 줄이는 DeepSeek안은 미채택이다.
대신 안전하게 확인 가능한 정적 동치만 schedule에서 생략 가능하게 하고, 추가3군은96개 구조 패널로 제한한다.

- 주 모집단 ALL548 / per-save capture548 유지.
- per-save 비교384는 non-hard 내 d/u/family/previewEligible 층화.
- GRACE 일반 `*p7`1개 추가: 행렬 최대933, e2e273.
- 추가96개×3군×3회=864단위.
- screen32개×3정책×ON/OFF×2회=384단위.
- 전체 최대31,711단위, 최악 호출1,095.828h+제어/전송100h=1,195.828h.
- 전체1,200h/96h/16VM 및 기존 watchdog 유지. 기존 여유30h를 추가 정보 수집에 재배정했고 추정 startup으로 예약을 낮추지 않았다.

원 v1 JSON은 그대로 보존하고 v2에 predecessor hash와 두 검토 원문 hash를 남긴다.
이번 변경은 계획·오프라인 명세 생성기뿐이며 실행 adapter/제품 코드/실제 벤치 변경은 아직 없다.
