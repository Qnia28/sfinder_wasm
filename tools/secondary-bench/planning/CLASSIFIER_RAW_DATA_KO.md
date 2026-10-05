# 분류 기준 분석용 개별 raw 데이터

요약 보고서가 아니라 **setup(fumen) × pattern × save × engine × timeout × repeat**별 원측정 결과를 읽기 위한 안내다. CSV/JSONL은 기존 원자료의 오프라인 join이며, 재측정·시간 평균화·새 분류 기준 학습을 하지 않는다.

## 로컬 위치

작업 폴더: `D:\AI\sfinder-wasm\sol\secondary-routing-20261005`

분류용 join 출력: `benchmark-results/classifier-raw-20261005/`

생성 결과: **원 capture save 행렬 2,685개**(측정 선택309개), **개별 호출 기록21,778개**(실제21,542개 + NOT_RUN236개), 명령440개, wave 결정9,270개, alias 연결748개다. 기존 F/d/u가 null이던633개 행렬은 원 singleton offline 계산값을 별도 출처로 제공하며, 선택309개에는 기존 capture 구조값을 사용한 검산이 적용됐다.

| 파일 | 행의 단위 | 용도 |
|---|---|---|
| `calls.csv` / `calls.jsonl` | 실제 원기록 1개 | fumen·pattern·save·n/K/R/E/F/d/u + 개별 엔진 반복 시간/상태/runner. NOT_RUN도 별도 행이며 executed=false |
| `fixtures.csv` / `fixtures.jsonl` | capture한 save 행렬 1개 | **선택되지 않은 save와 trivial도 포함**. selectedForMeasurement로 실제 엔진 측정 대상 구분 |
| `capture_commands.csv` / `capture_commands.jsonl` | setup×pattern 명령 1개 | 빈 결과/각 save filter 상태. 행렬이 없을 때 n/K 등을 가짜 0으로 만들지 않음 |
| `wave_decisions.csv` / `wave_decisions.jsonl` | engine×fixture×wave 결정 1개 | 실제 적격/제외 사유와 반복 구간. 제외된 미래 호출을 측정값으로 만들지 않음 |
| `aliases.csv` / `aliases.jsonl` | 명령의 DB alias 1개 | 원 DB의 별도 fumen과 대표 입력 연결. 별도 엔진 측정이라고 세지 않음 |
| `MANIFEST.json` | 출력 묶음 | 행 수, 모든 출력 SHA256, 원 raw/fixture/plan 경로와 SHA256 |

CSV는 UTF-8, comma-containing pattern은 따옴표로 감싼다. CSV 빈칸은 null/미관측이며 숫자 0이 아니다. JSONL은 null·false를 명시한다. 중첩 필드(filters/CPU model/repeats)는 CSV에서는 JSON 문자열이다.

분류용 CSV 읽기 예:

```python
import pandas as pd

calls = pd.read_csv("benchmark-results/classifier-raw-20261005/calls.csv")
features = ["fumen", "pattern", "save", "n", "K", "R", "E", "F", "d", "u"]
per_attempt = calls[features + ["timeoutMs", "phase", "engine", "repeat", "runnerId", "executed", "status", "ms"]]
# 원 상태를 보존한 뒤 분석 목적에 따라 부분집합을 선택한다.
# status==EXACT만 남기면 timeout/OOM이 표본에서 빠진다는 점에 주의한다.
```

## n/K/R/E/F/d/u의 정확한 정의

값은 **setup만의 상수나 reduced primary kernel의 값이 아니라 해당 pattern 및 save filter의 원 가중치 행렬 값**이다.

| 열 | 정의 |
|---|---|
| `n` | stable candidate universe의 후보 수: `fixture.keys.length` |
| `K` | exact primary가 증명한 최소 커버 후보 수: `fixture.K` |
| `R` | 해당 save의 원 active quality 행 수: `fixture.rows.length`; 중복/중복 커버 행을 제거하지 않음 |
| `E` | 원 행렬의 `[candidateID, quality]` entry 수 합계; 중복 행의 가중치·entry를 그대로 포함 |
| `F` | **원 singleton 행**이 강제하는 서로 다른 후보 ID 수. primary dominance나 reduced kernel에서 생긴 singleton은 사용하지 않음 |
| `d` | 아직 선택해야 하는 unforced slot 수: `K - F` |
| `u` | unforced candidate 수: `n - F` |

`FSource=OFFLINE_ORIGINAL_SINGLETON_SCAN_NOT_PRIMARY_KERNEL`: 원 matrix에서 offline scan으로 계산했다. capture 당시 관측된 값은 `capturedF/capturedD/capturedU`에도 별도로 보존하며, 관측된 경우 서로 일치해야 export가 성공한다. all-candidates trivial shortcut은 원래 singleton을 스캔하지 않아 capture 값이 null일 수 있다. 이 경우 null을 0이나 n으로 치환하지 않고 **원 행렬로 새로 계산한 값과 구분**한다. 실제 측정한 309개 nontrivial 행렬에서는 기존 구조값과의 일치를 검증한다.

`piecesNeeded`는 셋업을 완성하는 데 필요한 테트로미노 수이며 후보 수 `n`과 다르다. `queueLength=piecesNeeded+1`, unused/save piece 1개, clear=4, hold=true 조건도 각 행에 보존한다.

## 시간과 오류 상태

- `ms`: 원 raw의 정확 완료시간 그대로. EXACT만 숫자이며 timeout/OOM/INCOMPLETE/NOT_RUN은 null이다. timeout을 60,000/300,000ms의 완료시간으로 넣지 않는다.
- `timeoutMs`: 해당 run의 whole-call 제한. 60초와 300초를 같은 조건의 반복으로 묶지 않는다.
- `phase`: INITIAL/ADDITIONAL. 최초 run 기본 2회, 후속 run 기본 4회이며 추가 반복과 구분한다.
- `executed`: execution record 존재 여부. OOM도 실행한 호출이며 NOT_RUN은 실행하지 않은 기록이다.
- `stage/repeat/callId/runnerId`: 원 ID를 그대로 보존한다. VM 반복을 독립 setup으로 세지 않는다.
- `initMs/fixtureMs/packingMs/wrapperNativeAndSearchMs/modelAndSearchMs`: 원 child가 관측한 phase 시간만 보존한다. native 준비와 순수 검색을 분리 측정한 값이 아니다.
- `childResponseMs`: 관측된 child 응답 시점으로서 반드시 exact 증명이 완료된 시간이 아니다. exact 분석에는 status 및 ms를 사용한다.
- `maxRssKiB`: 관측된 child process 최대 RSS이지 process-tree peak가 아니다. OOM/timeout에서 관측되지 않았다면 null이다.
- `oomKillsBefore/After`, `memoryMax/swapMax`, `runnerCpuModels`, `scopeStartedUtc/FinishedUtc`로 자원 조건을 연결한다. scope 시간은 solver 한 호출의 완료시간이 아니다.

## 원자료 자체로 돌아가는 방법

`fixtureFile`: `keys/rows/K/seed/caseIds/origin.command.sourceFumen/origin.command.pattern/origin.filter`가 들어 있는 원 JSON. 행렬을 독립 검증하거나 다른 feature를 추출할 수 있다.

`rawFile` + `rawLine`: 원 `raw.jsonl`의 **1-based 줄 번호**다. 여기에는 전체 `execution/result/verified`와 원 엔진 witness가 있다. CSV/JSONL scalar export는 이를 대체하지 않는다.

`eventsFile/stdoutFile/stderrFile/runnerFile`: 호출별 phase 사건·출력·오류·RUN_LOCK의 실제 파일이다. NOT_RUN에는 호출 로그가 없으므로 null이다. 경로는 작업 폴더 기준 상대 경로다.

원 체크포인트:

- `benchmark-results/campaign-37222172267/full-history/secondary-results-*/data/raw.jsonl`
- `benchmark-results/campaign-37226653891/full-history/secondary-results-*/data/raw.jsonl`
- 원 capture matrix: `benchmark-results/campaign-37222172267/full-history/secondary-results-capture-*/data/fixtures/*.json`
- 검증해 다운로드한 원 ZIP: 각 `full-history/_archives/<artifactID>.zip`
- 전체 다운로드 인덱스/검증: 각 `full-history/DOWNLOAD_INDEX.json`, `DOWNLOAD_COMPLETE.json`

GitHub에서도 [60초 run](https://github.com/Qnia28/sfinder_wasm/actions/runs/37222172267) 및 [300초 run](https://github.com/Qnia28/sfinder_wasm/actions/runs/37226653891)의 `secondary-results-*` artifact로 남아 있다(원 retention 30일). 원 ZIP/raw와 큰 분석용 join 파일은 현재 gitignore된 로컬 `benchmark-results`에 있으며 **GitHub source tree의 요약 JSON만으로 raw 전체가 게시된 것은 아니다**.

## alias와 미측정 주의

`aliases`는 원 fumen·mirror 관계를 연결한다. 대표 입력과 다른 alias fumen은 실제 측정한 입력이 아니며, mirror에서 pattern/save 변환을 하지 않은 채 같은 엔진 시간을 새 측정으로 복제하면 안 된다.

nontrivial save는 명령당 사전에 hash로 하나만 골라 측정했다. `selectedForMeasurement=false`인 다른 save는 구조값이 있어도 엔진 runtime 측정은 없다. 보류 그룹도 엔진 측정한 데이터로 만들지 않았다.

## 재생성

```powershell
node tools/secondary-bench/export-classifier-raw.mjs benchmark-results/campaign-37222172267 benchmark-results/campaign-37226653891 benchmark-results/classifier-raw-NEW
```

새 출력 폴더만 허용하며 기존 원자료와 기존 출력 파일을 덮어쓰지 않는다. 원 capture 구조값 불일치·fixture hash 변경·foreign campaign·중복 반복은 export를 중단한다.
