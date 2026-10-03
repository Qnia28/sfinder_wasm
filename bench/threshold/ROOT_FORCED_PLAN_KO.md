# rootForced 보완 및 재평가 — 사전 고정 계획

기존 B는 개발12 중 완료6/3pairs/20초에서0.9899배라는 제한된 근거다.
제품통합 없이 experiment/threshold-engine-20261003에서만 진행한다.

## 구현과 대조군

기존 mask0..31의 의미는 유지한다. 실험 ABI v2에서 rootForced(mask4)에만
추가 bit32(rootCollectDuringNormalize), bit64(rootCoverageDuringKernel)를 허용한다.
32/64만 켠 잘못된 mask는 거부한다. 제품 진입점은 EXPERIMENT=false다.

- 32: 정규화가 완료된 각 행의singleton을 수집해 별도 행 순회 제거.
- 64: kernel 작성 중 primary root coverage를 준비해 start에서필수후보별OR 제거.
  quality 행/그룹은 제거하지 않는다. 필수 선택은 기존 순서/budget charge/undo 유지.
  kernel은 임계값별로 다르므로 전역 bitset을 임의로 재사용하지 않는다.
- no-forced에서는 추가 root bitset allocation/copy를 하지 않는다.

## 1차 진단 및 선별

기존100ID/hash/seed/중복1개 유지. 모든 입력에필수후보12~59개가 있다.
필수후보없는대조군은 DB100에 없으므로oracle 합성경계검사에 포함한다.

각 VM에서 timing과 별도trace WASM으로 mask0/4/16/20/36/68/100/116을
state budget1000으로 진단한다. completed=false는완료증명이아니다.
임계값/DFS/필수선택/quality갱신/원본covered행/추가행스캔/ORword/copyword 계측.
searchedStates에는강제선택budget charge도포함되므로DFS count와분리해해석한다.
trace용 구조검사는비용을추가하므로진단실행nativeMs는성능근거로사용하지않는다.
WASM에clockimport를추가하지않는다. 단계별wall time은추정하지않으며 작업량과
비계측전체nativeMs로 비용/효과를분리해검토한다.

100입력×6비교×1pair×2=1200호출로 screening(확증아님):
0→4,16→20,4→36,4→68,4→100,16→116.
비계측 동일WASM/fresh process/같은VM 직렬ABBA/최대16VM/300초.
최악job시간60분+별도diagnostic5분+setup여유15분=80분.

선별은 품질·traversal 일치 통과 후 추가효과와작업량을함께본다.
1pair의작은개선을근거로최선mask를주장하지않는다.
보완비용이효과를상쇄하면기존mask4도후보로유지한다.

## 후속 확인

후보mask4/36/68/100 중하나를동결한후100개에mask16→(후보|16)5pairs/300초.
후보선정과무관하게새로운회귀를보고한다. 최초screen과확인결과는별도보고.
완료군paired median ratio 상위/하위10%(R7), OFF/ON/paired
(max-min)/median≥10%, 회귀경보의합집합은각10pairs 재측정한다.
필수후보수/covered비율별구조대조군도성능에무관하게고정해포함한다.
screen 결과를다운로드하기전에root-structural-controls.json에18개를고정했다.
F/covered비율의R7 삼분위9셀마다서로다른mirror그룹에서lexical2개를선택했다.
F 경계22/29,covered비율경계0.7372093023/0.8479099343이며timing/완료자료는읽지않았다.
timeout을시간으로치환하지않는다. mask16 대비추가가치가주판단이다.

### 사용자 추가 조건: timeout 조기종료

입력/비교조합별로양측2회씩solver TIMEOUT이며관측된EXACT가전혀없으면
2paired repeats(4실제호출)후남은반복을생략한다. 어느쪽이든EXACT가1번이라도
관측되면끝까지반복한다. ERROR/setup/validation timeout은조기종료근거가아니다.
같은입력의다른비교조합에는전파하지않는다. 미실행호출은TIMEOUT으로위조하지않고
requested/executed/skipped pairs와사유를별도기록한다.10회요청의완전실패군은
100분대신약20분의solver시간으로종료할수있지만성공관측군의100분deadline은유지한다.
향후5/10회실행에적용하며이미시작한1pair screening은변경하지않는다.

### 현재 screening 중단 및 자원 상한 변경

사용자요청으로run37113754448을취소했다. 서버확인상completed/cancelled,
in_progress job0개다. 성공53job(빌드/정확성포함),취소49job,실패1job이며
취소에따른전체미완료는정상성공campaign으로취급하지않는다.
완료artifact/부분자료는보존하고새run과혼합하지않는다.
이screening은6개의서로다른비교를각1회하므로동일비교각2회timeout규칙으로
긴입력의6비교(최대60분)를차단할수없었다. 후속반복확인은조기종료규칙을적용한다.
병렬상한은planner validation와workflow strategy에서16으로제한한다.
과거20VM실행기록은수정하지않는다. 재개계획에서장기입력을다시무제한screening하지않는다.

회수한artifact70개입력의실측816호출(EXACT621/TIMEOUT195)을검산해
reports/root-screen-interrupted.json에보존했다.58개는12호출모두기록됐고,
12개는취소에따른부분자료,30개는artifact없음이다.기록없는384호출은
TIMEOUT으로집계하지않는다.18개는관측된timeout만있으며pcinfo032/Z는
부분자료에도EXACT9회/TIMEOUT0회다.완료witness621개는원본행/기존최적hash로검산했다.
성능하위10%는완료한입력의상대비율순위이며timeout입력군과동일하지않다.

### 사용자 지정 재개: 미완료42개만12 VM

12호출모두기록된58개(완료TIMEOUT도포함)를재사용한다.부분자료12개와artifact없는
30개=42개를동일6비교/1pair/300초/ABBA조건으로처음부터재실행한다.
병렬은최대12VM,job deadline80분을유지한다.기존Rust/제품JS/실험WASM hash
일치gate를통과해야시작한다.이1pair screening에서는조기종료를기대하지않는다.
root-resume-selection.json에입력합집합/재사용58개/재실행42개를동결한다.
종합보고는old58+new42,총100ID/1200실측호출이원칙이며old partial120호출은
중복합산하거나더빠른결과를고르지않는다.입력별ON/OFF는반드시한run/한VM에속한다.
두run의환경/출처를남기며서로다른VM의절대시간을비율로만들지않는다.

재개run37118105522은성공완료했다.실제동시측정최대12VM,측정구간120.5분,
workflow126.0분.42개504호출은EXACT352/TIMEOUT152이고보존58개696호출은
EXACT612/TIMEOUT84다.종합100개1200호출은EXACT964/TIMEOUT236이며모든
완료witness와바이너리/소스/입력identity검산통과했다.
종합보고서는ROOT_FORCED_SCREEN_REPORT_KO.md다.1회screening이라rootForced는
B유지,보완32/64는C보류다.후속5/10회확인은아직실행하지않았다.

## 최종 등급

A: 추가개선이반복재현되고회귀/비용수용가능.
B: 탐색감소가능성이있지만시간효과/timeout효과불확실.
C: 적용기회가있어도추가효과가비용/잡음수준.
X: 보완후에도반복순손해이며유용한영역미확인.
10%회귀는ON시간≥10%증가+paired시간차중앙값≥5ms를함께점검하며
side별시간중앙값기준경보도별도표기한다. 실제통합은추가승인사항이다.
