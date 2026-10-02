# A0 integrated 전용 확대 검증: 실행 완료, 통합 보류

## 1. 결론

승인한 개발64개와 예약104개, R/A×4 **1,344개 integrated100K 호출을 모두 실행·보존·독립 감사했다.** 정상capped까지 전수 비교했고 timeout/누락/OOM/품질회귀/states회귀/전달계약회귀는0이다. 지난 긴threshold timeout에 의한 측정공백은 이번 주검증에는 없다.

그러나 **예약의 p95 API slowdown=1.197846 > 사전기준1.10**으로 성능gate가 실패했다. A0만exact인 예약입력1개는 기존 독립exact참조가 없어 별도확인도 필요하다. 따라서 **Dev 통합을 보류한다.** 실행완료를 검증통과/제품승인이라고 부르지 않는다. 새결과에맞춰gate나적용대상을바꾸지않았다.

## 2. 실행 이력과 감사 보정

- 제품후보: e5f2f3d1a9885085e11cde7457aad2b338ca8130, 제품기준: c0cb2a048e7275bfea587d176b1954efff0a8a08.
- 최초확대실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/37039906398
  - source/harness commit13b274ef91a2debe07121f7b4a0e670ed39e034f.
  - build/전체회귀/개발512호출은완료했으나Python감사의bootstrap입력순서가JS와달라CI동일성검사가실패했다. 해당run은failure로보존한다.
- 연속실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/37041073063
  - audit-only continuation commit8b2dcc1419518023ba95d5d660dc7f190a479d58.
  - 원개발summary와원측정512회를그대로재감사하고,감사순서만맞춰동결한뒤예약832회를처음실행했다. **개발측정재실행0**.
  - 마지막집계gate실패로failure. 예약16개job은전부완료했고독립감사와tiny115검사도완료했다.

보정은lexical shard폴더순과원장첫등장행렬순의clusterindex를맞춘것뿐이다. witness검산의ID정렬,PRNGseed20261003/10,000반복/CI정의/판정값은불변이다. 원audit.py/집계/측정source는그대로보존하고 `audit-resume.py`의보정내용·원blobhash·실행코드hash를따로봉인했다. 개발CI는기존summary와roundoff범위에서완전히일치했다. 원실패를성공rerun으로치환하지않았다.

## 3. 측정 결과

| 항목 | 개발64 | 예약104 |
|---|---:|---:|
| 예정/관측probe호출 | 512/512 | 832/832 |
| PROBE_EXACT | 152 | 580 |
| PROBE_CAPPED | 360 | 252 |
| timeout/error/OOM/누락 | 0 | 0 |
| 입력별exact완료 R/A | 19/19 | 72/73 |
| 전수API median합계 A/R | **0.990401** | **0.981214** |
| 행렬별API비율 p95 | **1.078825** | **1.197846** |
| 합계ratio cluster95%CI | [0.976778,0.997754] | [0.922574,1.005581] |
| cgrouppeak증가비율 p95 | 1.036645 | 1.025016 |
| cgrouppeak증가 p95 | 4,278,272 bytes | 1,710,080 bytes |
| 정확성gate(독립exact자료포함) | PASS | 신규exact1개확인대기 |
| 성능gate | PASS | **FAIL: p95초과** |
| 자원gate | PASS | PASS |

예약전체합계는1.88%줄었지만느려진개별입력의tail기준을충족하지못했다. CI상한은1.05기준을충족하며,CI가1.0을넘으므로개선이확정됐다고도하지않는다. 기존675개효과campaign과5%재입증은반복하지않았다.

### 쉬운군을 숨기지 않은 결과

- 개발commonexact19개 합계ratio0.781196/p951.178522,commoncapped45개0.995179/p951.055987.
- 예약commonexact72개 합계ratio0.855036/p951.260694,commoncapped31개1.007248/p951.041865.
- 예약smallE≤10,000 59개 합계ratio0.965854/**p951.284462**,mediumE43개0.972611/p951.053050,largeE2개1.004981/p951.009071.

즉aggregate속도이득만으로쉬운입력overhead를무시할수없다. 예: board-105--restricted-split--ordinary는R7.792ms/A9.324ms,board-111--restricted-split--J는R5.133ms/A6.148ms다. 절대차이가작아도승인된비율gate의예외를사후에추가하지않는다.

### 신규 exact 확인 공백

`board-111--restricted-split--ordinary`: R4회모두capped/A4회모두exact. K/모든원weighted행coverage/rawquality/incomingseed/stableIDs/반복결정성은검산통과했고states/quality하한회귀는없다. 다만R과공통exact비교가불가능하고기존129개독립threshold참조에도없는예약입력이다. 최적quality/stable-ID최종증명을독립확인했다고주장하지않는다. 장부의proof오류4개는동일입력의4반복이며서로다른4입력결함이아니다.

## 4. 정확성·원장·연결·자원

- 실제 제품 `solveExactSecondary`+기존`deferThreshold`경계로probe를측정했다. 저수준호출만측정한것이아니다. 정확히100K integrated한번,새primary/PC/실제입력native threshold는0이다.
- K/proof/원seed/원weighted중복행/keys/stableIDs/aliases/hash를보존했다. 선택283개압축segment와전체population1721개+기존legacyindex12개를원source와대조했다. 선택은사전에고정했고reserved결과로재튜닝하지않았다.
- 모든capped612회는정상100Kstates결과다. 직접/기존defercontext전달각1회씩 **1,224개threshold진입계약**을검사하고validation sentinel로멈췄다. seed=검산한incumbent,threshold옵션불변,새probe재실행0. contractspy를native threshold완료라고기록하지않았다.
- start1344개,rawresult1344개와검산기록을fsync-before-ACK원장에서확인했다. phasejournal4,032records/artifact원파일1,416개를독립검증했다. 원weightedquality/seed하한2,688회재계산,states/quality회귀0,공통exact의fullquality/stableID불일치0,반복불일치0.
- childfreshcgroup3GiB/swap0/독립API10초/process30초/검산별도deadline을유지했다. 최대APIwall은개발7,799.60ms/예약1,715.30ms. 최대cgrouppeak166,969,344/129,400,832 bytes,최대RSS211,369,984/175,042,560 bytes,최대WASM38,141,952/37,879,808 bytes다. RSS와cgroup은공유page계측경계가달라동일한값으로취급하지않는다.
- 기존thresholdtimeout때잃었던중간probe기록문제는raw우선저장/ACK로보강했다. 강제hang/검산오류/잘못된JSON/저장오류/독립phase예산사전검사가통과했다. mock uploader실패/압축checksum손상주입에서도원bytes를보존했다. 실제GitHub장애를재현했다고하지않는다.
- tiny metadata dispatch는개발806+예약115=921개,primaryHard18/trivial3은metadata/fixturespy로범위밖A0호출0을확인했다. 실제tiny native품질/전체시간전수측정은아니다.

## 5. 빌드·회귀

Linux baseline-source 재빌드WASM은 `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`로이전검증binary와동일하다. partitionexport존재,benchmark전용export부재,main/pool같은binary를확인했다. 제품JS는일반100K호출의partitioned선택한줄뿐이며Rust/Fast/CP/분해/명시엔진/기본옵션은변경하지않았다.

- hosted제품회귀 **193pass/skip0/fail0**,local동일193pass/skip0.
- 고정synthetic32개×R/A=64variantRuns: realintegrated64+real threshold64,독립작은fixed-Koracle와일치. local/hosted각각별도보존했으며실제input1,344호출에합산하지않았다. cappedmarker는연결검사용강제표시이지자연100Kcap이아니다.
- 새hostedsynthetic O/R/A parity27calls pass. 기존Rustmin-cover debug26/release26와브라우저direct/pool/ownership/cancel결과는제품source/binary불변조건하에재사용한다.

## 6. 시간·보존·적용 경계

원실행생성시각을유지한합산경과12.57분,관측job합계0.3717runner-hours,두실행압축artifact합계5,071,304 bytes다. 원+연속workflow보수job상한34.8333h<64h,전체3h/160분신규중단/175분취소정책을유지했다. publicstandard만사용하고paidservice/과금변경/subagent는없다.

두실행원로그/원장/원summary/정정감사/독립local감사/통계/자원/sourcebundle을함께보존한다. **Dev는clean/c0cb2a0,localmain187fbf9/remotemain03b6377/defaultmain불변. 적용/merge/배포0.** 제품전용대기patch는read-only `git apply --check`만확인했고실제로적용하지않았다.

후속연구/검증은별도계획이필요하다. 독립exact1개확인만추가해도p95실패는해결되지않는다. reserved결과를보고특정ID예외·범위선별·gate완화·후보재튜닝을이번실행에추가하지않는다. 새로운일반적가설을시험한다면이번고정결과와노출된예약군을보존하고새계획에서구분해야한다.
