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
비계측 동일WASM/fresh process/같은VM 직렬ABBA/최대20VM/300초.
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

## 최종 등급

A: 추가개선이반복재현되고회귀/비용수용가능.
B: 탐색감소가능성이있지만시간효과/timeout효과불확실.
C: 적용기회가있어도추가효과가비용/잡음수준.
X: 보완후에도반복순손해이며유용한영역미확인.
10%회귀는ON시간≥10%증가+paired시간차중앙값≥5ms를함께점검하며
side별시간중앙값기준경보도별도표기한다. 실제통합은추가승인사항이다.
