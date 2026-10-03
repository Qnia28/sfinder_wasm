# A0 원인 진단 완료 — 탐색 수정 대신 runtime/측정 경계를 우선 조사

## 결론과 대응 결정

**원인 진단2560회/32개가모두완료됐고독립감사도통과했다. 제품은그대로유지하고공식재벤치마크·통합으로진행하지않는다.**

이번에는다음두사실을확인했다.
1. **같은baseline끼리도기존10%tail기준을초과했다.** 현재cold4반복측정으로작은R/A지연을A0특유비용이라고귀속하기어렵다.
2. **초기호출상태의영향이매우크고warm에서기존ms단위차이가대폭작아졌다.** 기존F14의일관된양의회귀는두host에서재현되지않았다.

따라서 “siblingtrail비용때문에항상1~2ms느리다”는가설로지금Rust를수정하지않는다. 다만아래큰coldCPU이상치가남아있어 **전부noise/성능회귀없음**이라고도판정하지않는다. 원인분류는 “초기실행/runtime상태및host변동이우선,정확한엔진내기전은미확정”이다.

대응: **A0제품후보불변 / 사전warmup자동추가없음 / 특정ID·size예외없음 / 기존p95gate완화없음 / 232개재벤치마크없음 / Dev적용없음.**

## 1. 범위와 검증

- 실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/37096100399 (success)
- sourcecommit `9455ece132a3a82833e966790a827d173314ca68`.
- 기존느린14개(F14)+metadata대조14개(M14)+capped4개(C4).
- 주진단Cold/Compiled/Warm2048회,baseline/baseline통제128회,세부계측384회. 총2560회중warmup640회도별도저장/검산했다.
- EXACT2304/CAPPED256,누락/timeout/OOM/오류0. seed/K/원weighted행/quality/stableIDs/반복결정성감사통과. states/quality회귀0.
- 독립감사: Gitblob152개/artifact2656파일/phasejournal7680record/rawwitness2560개/weightedquality+seed5120재계산.
- 제품JS/Rust/WASM불변. binarySHA256 `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`.
- 실제inputprimary/PC/native threshold0,신규64decode0,공식232개확인0. 남아있는독립exact1개는이번진단대상밖이며미해결그대로다.

진단모집단은노출결과로선정한집합이다. 이결과의ratio를제품승격/모집단개선수치로쓰지않는다. API시간은coverage생성후wrapper진입~readback종료,init/decode/coverage/IPC/fsync/검산은분리했다. raw결과는별도writer가fsync한후ACK하고그뒤검산했다.

## 2. 확인된 측정 정밀도 문제

동일한baselineR을labelX/Y만다르게실행했다.

| baseline/baseline | block0 | block1 |
|---|---:|---:|
| X/Y시간합계비율(Y/X) | 1.0741 | 0.9768 |
| 양방향행렬ratio p95 | **1.1596** | **1.2293** |
| 양의median차이최대 | 3.198ms | 2.715ms |
| 사전환경경보 | 발생 | 발생 |

알고리즘이동일한경우에도15.96%/22.93%tail이발생했다. 이것은기존예약p951.1978의 **A0알고리즘단독원인이라는해석을약화**한다. 하지만기존gate실패를삭제하거나PASS로바꾸는근거는아니다.

기존F14의직전원장에서도14개중13개가동일variant4회내의시간변동폭>R/Amedian차이였다. F14는양의tail로선정됐으므로선정편향/평균회귀도고려해야한다. 4회통제를완벽한noise분포추정으로취급하지않는다.

## 3. 초기 실행 상태의 영향

F14주진단의입력별median을다시14개에서median한값:

| mode | block0 R/A | block1 R/A |
|---|---:|---:|
| Cold | 10.368 / 10.046ms | 9.035 / 8.821ms |
| Compiled Module재사용·freshWorker | 3.116 / 2.956ms | 2.635 / 2.953ms |
| Warm instance | 1.320 / 1.305ms | 1.254 / 1.220ms |

- 기존F14중새Cold에서10%넘게느린입력은block0에3개/block1에0개. **양쪽block에서동일하게10%넘는입력0**.
- Warm에서도양쪽block동시에10%넘는F14입력0이다. 양의/음의방향은섞여있으므로느린입력이전혀없다는뜻은아니다.
- profile8개의동일variant첫warmup→후속warm측정입력별비율median은R5.53/A2.85배(block0),R2.75/A6.62배(block1)다. 최초호출효과는A에만일관되게큰것이아니다.
- profile의F14부분4개에서coldAPImedian차이의median은block0+0.714ms/block1+0.541ms였으나warm은+0.0078/+0.0015ms다.
- 해당warmcorewall차이의median은-0.0017/+0.0276ms다. 원ms단위차이를지속적인sibling관리비용으로설명할근거는약하다.

중요한한계: Cold→Compiled는compiledmodule/loader/Workerlifecycle을,Compiled→Warm은JS/instance/allocator/cache/runtime상태를함께바꾼다. 그래서 **'V8JIT만이원인'은아직증명하지않았다.** profilecore에는Rust전처리+DFS+런타임작업이함께들어가며,pre/post에는JS와ABI호출이혼합돼있다. 각구간median을더해전체median이나비용비중을계산하지않는다.

## 4. 무시하면 안 되는 큰 Cold CPU 이상치

`board-028--restricted-split--ordinary`,양쪽100Kcapped이며witness/states결정성통과:

| 조건 | block0 R/A | block1 R/A |
|---|---:|---:|
| Cold median | **3818.5 / 5731.6ms** | 5984.1 / 5996.7ms |
| Compiled median | 5536.5 / 5541.7ms | 5936.4 / 5950.5ms |
| Warm median | 3774.9 / 3785.5ms | 5931.7 / 5932.3ms |

block0Cold의R약3.8초/A약5.7초는4반복에서일관됐고CPUuser시간도그에대응해증가했다. 단순IPC대기나우연한wallclock정지로기각할수없다. 반면Compiled는R도약5.5초였고,Warm은양쪽약3.8초,block1은양쪽약5.9초였다.

따라서fixedA0추가비용만으로설명되지않는 **runtime/lifecycle에의존하는실CPU시간차** 가있다. CPU가동일family라도논리core/주파수/SMT/v8code-tier/layout을고정하거나trace하지않았으므로기전을확정할수없다. block0이상치때문에32개Cold시간합계비율1.331이됐지만이를전체성능회귀율로내세우지않는다. 큰사례도진단의미해결항목으로그대로보존한다.

block은동일물리CPU를보장하지않는hostjob집합이다. 실제AMD9V74/9V45/7763및Intel8573C등이섞였고각행렬R/A쌍만같은VM이다. CPU정보는원SHARD에있다.

## 5. 원인 판정과 다음 대응

| 항목 | 판단 | 대응 |
|---|---|---|
| cold4회프로토콜의정밀도 | 동일baseline통제로문제확인 | 이번진단으로승격하지않음 |
| first-call/lifecycle비용 | 두variant에서강하게관측 | runtime경계를우선조사 |
| 지속적인ms단위sibling비용 | 현재자료로지지되지않음 | Rust탐색blind수정금지 |
| 작은native추가비용 | 배제하지못함 | trail만원인이라고단정금지 |
| 큰ColdCPU이상치 | 관측명확,기전미확정 | 한입력의엔진/CPU통제진단제안 |

다음필요작업이있다면 **동일board-028한입력**으로한정한다. 동일logicalCPU에고정한실행에서기존WASM/seed를유지하고default/liftoff-only/optimized-first같은진단용V8tier조건및compilationtrace를비교하는별도설계를제안한다. flags는제품정책이나성능승격값에쓰지않는다. 추가실험은아직실행하지않았다. 232개/675개성능benchmark를다시돌릴이유는없다.

원인기전확정전에는제품warmup자동추가/특정ID선별/sizeguard/상태예산변경/게이트완화를하지않는다. 현판정은 `STOP_MEASUREMENT_UNRELIABLE_NO_CONFIRMATION`,대응은 `KEEP_PRODUCT_UNCHANGED`다.

## 6. 보존과 한계

전체경과8.10분,관측runnerjob합계0.3458h,압축artifact5175216bytes. publicstandard/maxparallel16만사용했다. 원원장/타이밍/profile/warmup/compileevent/CPU/자원/독립감사/sourcebundle를보존한다.

Devclean/HEADc0cb2a0,localmain187fbf9/remotemain03b6377/defaultmain불변,제품변경/Dev적용/mainmerge/배포0. 이전gate실패run37034641097/37039906398/37041073063과원seal은불변이다. 신규exact1개의독립proof는미완료그대로이며이진단을proof완료로전용하지않는다.
