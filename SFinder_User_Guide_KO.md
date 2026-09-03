# sfinder-wasm 사용자 가이드

이 문서는 현재 Release 2.7의 기능을 사용자 관점에서 설명합니다.
과거 Java/Python wrapper의 CLI 사용법이 아니라 현재 sfinder-wasm의 동작을
기준으로 합니다.

## 1. 어떤 기능을 써야 하나

| 원하는 작업 | 기능 |
|---|---|
| 패턴에서 가능한 모든 PC 해법을 coverage 순으로 Fumen 출력 | Path |
| 패턴 전체의 PC 성공률/실패 큐 | Chance |
| PC하면서 특정 Save 조건을 만족할 확률 | Saves |
| 패턴 전체를 커버하는 최소 해법 세트 | Minimals |
| Save T/I/L/...별 최소 해법 세트 | Per-save minimals |
| 한 개의 정확한 큐에서 추천 해법 하나 | Solve one |
| 한 개의 정확한 큐에서 모든 PC 해법 | Solve all |
| 한 개의 P+1 큐에서 Save별 모든 해법 | Per-save all |
| 지정 Fumen 배치의 큐 커버 | Cover |
| 같은 채움 영역의 대체 배치 | Congruent |
| 대체 배치까지 포함한 커버 | Congruent cover |
| 4th/5th 전용 복합 분석 | Fourth / Fifth |

## 2. 공통 입력

### Fumen / 필드

대부분의 PC 분석은 첫 Fumen 페이지의 현재 필드를 사용합니다. `clear` 또는
`Target lines`는 현재 상태에서 PC를 완성할 높이이며 **2~6줄**을 지원합니다.
선택한 높이 위에 블록이 있으면 입력 오류입니다.

Cover/Congruent 계열은 여러 Fumen 페이지를 target으로 사용할 수 있습니다.

### Queue pattern

일반 분석 기능은 SFinder 스타일 패턴을 지원합니다.

```text
TOILJSZ
*p7
[JSZO]!
[LJISZ]p4
[^TIL]!
I[JS]![TO]!,*p2
TI,[JOS]!,*p2;TO,[IJS]!,*p2
```

- `*p7`: 7개 미노의 모든 순열
- `[JSZO]!`: 나열한 미노들의 모든 순열
- `[LJISZ]p4`: 목록에서 4개를 뽑는 패턴
- `[^TIL]!`: 제외 표현
- `,`: 연속 구간
- `;`: 서로 다른 분석 브랜치의 합

세미콜론 브랜치는 같은 concrete queue가 중복되어도 서로 다른 case로 유지됩니다.
잘못된 패턴은 자동 보정하지 않고 오류를 냅니다.

### Hold

`useHold=true`이면 일반적인 Hold를 포함합니다. 특별한 no-Hold 분석이 아니라면
켜 두는 것이 일반적입니다.

## 3. Path

Path는 입력 패턴의 concrete case 중 하나 이상에서 가능한 **모든 서로 다른 PC
해법 geometry**를 구해 Fumen으로 출력합니다. 호출자가 각 queue마다
`enumeratePc()`를 직접 반복할 필요가 없으며, PATH 전용 고성능 계산 경로가
scalar cached enumeration과 packed pattern WASM backend를 자동 선택합니다.

Fumen page 순서는 **coverage가 높은 해법부터**입니다. coverage가 같으면 stable
solution key 오름차순으로 결정하여 결과 순서를 고정합니다. 각 page comment는
다음 형식입니다.

```text
32.86% (1656/5040)
```

분모는 전체 concrete case 수입니다. 서로 다른 세미콜론 브랜치가 같은 queue로
확장되어도 별도 case이므로 분자와 분모에 각각 반영됩니다. 모든 case에서 PC가
불가능하면 `fumen`은 `null`입니다.

## 4. Chance

Chance는 각 queue에서 **PC가 하나라도 가능한지**만 확인합니다.

입력 예:

```js
{
  sourceFumen,
  pattern: '*p7',
  clear: 4,
  useHold: true,
}
```

주요 결과:

```text
total         전체 case 수
success       PC 성공 case 수
failed        실패 case 수
failedQueues  실패 queue 목록
percent       성공률
```

해법 Fumen이나 대표 해법 세트가 필요하면 Minimals를 사용합니다.

## 5. Saves

Saves는 각 queue에서 가능한 **모든 exact Save 결과**를 수집한 뒤 조건식을
queue 단위로 평가합니다. 같은 미노의 중복도 보존합니다.

### 조건 예시

```text
T          T가 들어가는 Save 결과가 하나 이상 존재
TI         한 Save 결과 안에 T와 I가 동시에 존재
T||I       T 또는 I를 Save할 수 있음
T&&I       T Save 방법과 I Save 방법이 각각 존재; 서로 다른 해법이어도 됨
^T         T가 없는 Save 결과가 하나 이상 존재
!T         T가 들어가는 Save 결과가 아예 없음
TT         T가 두 개 들어가는 Save 결과가 존재
/TT/       exact Save 문자열에 정규식 /TT/ 적용
(T||I)&&!O
```

`TI`와 `T&&I`, `^T`와 `!T`는 서로 다른 조건입니다.

Save 분석은 마지막 bag 기준 잔여 미노를 계산하므로 각 패턴 브랜치가 마지막
bag 정보를 가져야 합니다. 그렇지 않으면 오류입니다.

### ALL / 미지정

다음은 모두 모든 Save outcome 출력 모드입니다.

```text
wantedSave 생략
wantedSave = ""
wantedSave = "ALL"
```

각 exact Save 문자열별 `success / total / percent`가 `saveResults`에 나옵니다.
한 queue에서 여러 결과가 가능할 수 있으므로 각 항목의 카운트 합은 total과
같을 필요가 없습니다.

### 여러 조건 한 번에 계산

```text
^T,!T,SZ,S&&Z,TT#T>X
```

또는 JS 배열을 전달할 수 있습니다. PC enumeration은 한 번만 하고 각 식을
독립 평가하므로 여러 번 호출하는 것보다 효율적입니다. 결과는
`wantedSaveResults`에 입력 순서대로 들어갑니다.

`expression#alias`는 Saves에서 표시용 alias로 사용할 수 있습니다.

## 6. Minimals

Minimals는 성공 case를 모두 커버하는 **해법 수 K가 가장 작은 세트**를 찾습니다.
단순히 개별 coverage가 큰 해법 몇 개를 고르는 기능이 아닙니다.

### 기본 입력

```js
{
  sourceFumen,
  pattern: '*p7',
  clear: 4,
  wantedSave: 'ALL',
  useHold: true,
  exactHumanQuality: 'Fast',
  UseHiGHS: 'auto',
}
```

`wantedSave`를 생략하거나 빈 문자열 또는 `ALL`로 지정하면 Save 필터를 사용하지
않습니다.

### Save filter의 중요한 차이

Minimals는 Saves처럼 한 queue의 outcome 전체를 합쳐 평가하지 않습니다.
**각 solution 하나의 exact Save multiset**을 필터링합니다.

따라서 한 solution만 볼 때는:

```text
^X == !X
XY == X&&Y
```

가 됩니다. 이는 Saves와 다른 의도된 semantics입니다.

중복은 정확히 보존되므로 `T`, `TT`, `TTT`가 서로 다르고 `/TT/`도 정상적으로
동작합니다.

### exact K와 Human Quality

`minimalCount` K는 항상 exact입니다.

`UseHiGHS`:

```text
false   Rust/WASM exact primary solver
true    HiGHS exact MIP primary solver
auto    exact kernel을 만든 뒤 hard kernel만 HiGHS로 보냄
```

`exactHumanQuality`:

```text
Fast    secondary exact proof가 예산 안에 끝나면 exact,
        아니면 exact-K incumbent를 deterministic 2↔2 refine
True    secondary까지 끝까지 exact proof
```

`humanQualityExact`가 secondary quality까지 증명됐는지 알려줍니다.
K 자체는 Fast에서도 exact입니다.

### 결과 해석

주요 결과:

```text
saveSuccess       Save filter까지 만족하는 case 수
minimalCount      exact 최소 해법 수 K
coverageCounts    선택된 각 해법의 coverage
fumen             결과 Fumen
cardinalityBackend / qualityBackend
humanQualityExact
```

표시 순서는 선택 이후 coverage가 큰 해법부터 정렬하는 presentation order입니다.

## 7. Legacy minimals

`legacy-minimals`는 이전 synchronous exact K+quality 통합 경로를 reference/
compatibility 용도로 보존한 것입니다. 새로운 일반 호출은 `minimals`를 권장합니다.

Save filter의 solution-level semantics와 exact multiplicity/`ALL` 처리는 현재
Minimals와 동일합니다.

## 8. Per-save minimals

현재 필드에서 PC에 필요한 미노 수를 P라 하면 queue 길이는 정확히 P+1이어야
합니다.

```text
remainingCells      = targetLines * 10 - occupiedCells
piecesNeeded        = remainingCells / 4
expectedQueueLength = piecesNeeded + 1
```

예: 5줄 목표에서 현재 26칸이 차 있다면 남은 24칸 = 6미노이므로 queue는 7개가
필요합니다.

### concrete queue 하나

각 Save piece에 대해 가능한 전체 structural result를 평가하여
`playableOrderCount`가 최대인 정확한 대표 geometry를 고릅니다. 동률은 stable key로
결정합니다. 과거 `candidateLimit=16` 인자는 호환용으로만 남아 있고 결과를 자르지
않습니다.

### pattern 여러 case

PC enumeration을 공유한 뒤 Save T/I/L/J/O/S/Z별 coverage matrix를 만들고 각 Save
그룹에 대해 별도의 exact minimum cover를 계산합니다.

`saveRate`의 분모는 PC 성공 case 수입니다. 따라서 PC 성공 queue 전부에서 T Save가
가능하다면 전체 PC 확률이 100%가 아니어도 T의 `guaranteed`는 true가 될 수 있습니다.

## 9. Exact single-queue solver

이 기능들은 SFinder 패턴이 아니라 **정확한 queue 문자열**만 받습니다.

필요 미노 P:

```text
P = (targetLines * 10 - occupiedCells) / 4
```

### solve-one

queue 길이 = P. 가능한 solution 중 `playableOrderCount`가 가장 큰 하나를 선택하고,
동률은 stable solution key로 결정합니다.

### solve-all

queue 길이 = P. 모든 서로 다른 solution을 출력합니다.

### per-save-all

queue 길이 = P+1. 모든 solution을 실제 저장되는 한 piece 기준으로 그룹화합니다.

## 10. Fourth / Fifth

두 기능은 현재 **clear=4 전용**입니다.

- Fourth: 입력 Hold와 다음 2개 미노로 4th PC Save 분포의 predefined rank를 계산
- Fifth: 5th PC에서 Save piece별 최소 해법과 usage/bestsave 정보를 생성

일반적인 임의 Save expression API는 노출하지 않습니다.

## 11. Cover

Cover는 Fumen에 지정한 target operation들을 입력 queue/Hold로 실제 배치 가능한지
검사합니다. 단순한 최종 모양 비교가 아니라 **배치 순서와 locked reachability**를
검사합니다.

- 2~4L: 전용 Rust/WASM batch engine
- 5~6L: structural DAG + WASM exact lock checks
- Cover physics: Jstris 180

주요 mode:

```text
normal
b2b
any / tsm
tss
tsd
tst
tetris
tetris-end
1l / 2l / 3l / 4l
1l-or-pc / 2l-or-pc / 3l-or-pc / 4l-or-pc
```

`mirror=yes`이면 target의 좌우 반전도 포함합니다.

T-spin mode는 Jstris 180의 exact locked reachability를 사용합니다.

- `any` / `tsm`: line clear가 있는 Mini 또는 Regular T-spin
- `tss`: 1줄 이상 clear한 Regular T-spin
- `tsd`: 2줄 이상 clear한 Regular T-spin
- `tst`: 3줄 이상 clear한 Regular T-spin

`tsd`가 정확히 2줄만을 뜻하는 식의 equality 판정이 아니라, 원본
solution-finder 1.42와 동일한 **최소 clear line threshold**입니다.

여러 Fumen page가 서로 독립이면 기존처럼 각 page를 별도 target으로
분석합니다. 반면 solution-finder `spin --split yes`처럼 `operation -> lock ->
line clear -> 다음 field`가 연속되는 page들은 하나의 placement history로
자동 인식합니다. 이때 line clear 이전 좌표를 복원하여 T-spin/order 판정에
사용합니다. 4L target이 line clear 전에 5~6번째 row를 잠시 사용하면 해당
target의 내부 reachability 높이만 최대 6행까지 확장됩니다.

현재 Jstris-180 T-spin 경로는 solution-finder 1.42 oracle과 one-page 1,280개
판정, 생성 TSS history 30개, 생성 TSD history 4개, 상단 blocker가 실제 회전
경로에 필요한 6행 연속 TST history 및 mirror spot check를 대조해
일치시켰습니다. operation history의 내부 높이는 operation뿐 아니라 모든 page
field의 점유 셀까지 보존하도록 결정합니다. 이는 bundled Jstris-180 규칙에
대한 호환성 검증이며 임의 custom kick table 지원을 의미하지 않습니다.

## 12. Coverpercent

Cover target 각각에 대해:

1. cover pattern에서 실제 커버율
2. 별도의 percent pattern에서 해당 최종 field의 PC solve율

을 함께 계산해 정렬합니다. `coverPattern`과 `percentPattern`을 별도로 줄 수 있으며,
둘 다 없으면 공통 `pattern`을 사용할 수 있습니다.

## 13. Congruent

Congruent에서는 Fumen의 색칠된 칸을 **채워야 할 영역**으로 보고 같은 영역을 다른
미노 조합으로 만들 수 있는 실제 reachable placement를 찾습니다.

- colored cells: fill region
- gray/X: 기본적으로 고정 base
- `blueGarbage=true`: gray/X도 fill region에 포함
- physics: TETRIO 180

## 14. Congruent cover

Congruent로 찾은 대체 배치 전체를 만든 뒤 Cover를 수행합니다. `mirror`, `mode`,
`blueGarbage`, `useHold`를 함께 사용할 수 있습니다.

## 15. 오류가 나는 대표 입력

다음은 의도적으로 오류입니다.

- target lines가 2~6 범위 밖
- target height 위에 블록이 있음
- malformed queue pattern
- exact solver의 queue 길이 불일치
- Saves branch가 final-bag metadata 없이 끝남
- per-save에서 남은 칸이 양의 4의 배수가 아님

## 16. 추가 문서

- `README.md`: 프로젝트 개요/Quick start
- `docs/API_REFERENCE.md`: JS/Worker API
- `docs/SAVE_EXPRESSIONS.md`: Save 문법 상세
- `docs/PER_SAVE_MINIMALS.md`
- `docs/SINGLE_QUEUE_SOLVER.md`
- `docs/BATCH_ENGINE.md`
- `docs/ARCHITECTURE.md`
