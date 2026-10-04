# Sol / Build 인계 — 벤치 하네스와 데이터 선별

작성: 2026-10-05 / 상태: 구현·선별 준비 계획. 실측 횟수·예산은 협의 전.

**Astra/Plan에서 Sol/Build로 이 세션을 전환해 이어간다. 서브에이전트를 생성하지 않는다.**

## 1. 첫 목표와 작업 경계

- 기존 cutoff에 편중되지 않은 **광범위 3엔진 성능 정보**를 확보할 공통 하네스와 입력 장부를 만든다.
- 원본 `dev-branch`의 `7ef62d18e1d155b6479e00d651c851ff3baa7112`에서 독립 복사 저장소·새 실험 branch를 만든다. 원본 dev와 GitHub main은 변경하지 않는다.
- 기존 측정자료는 유효한 범위를 재사용하되, 전체 DB 대비 분포·노출·측정 조건을 감사한다. Threshold 명칭을 사용한다.
- 경량 검사·분석은 로컬, fixture 추출·primary 증명 등 무거운 계산과 벤치마크는 `Qnia28/sfinder_wasm` Actions의 새 branch에서 수행한다. 동시 VM은 workflow 합산 최대 16개다.
- 초기 측정은 **정보 수집**이다. 정책 후보의 **A/B 성능 비교**는 후속 단계로 구분한다.

### 필수: Human quality exact와 timeout

- 이번 3엔진 연구 대상은 **Human quality가 exact로 해석되어 실행되는 secondary**다. fixture 생성 후 실제 명령·정책 측정에서도 exact를 명시한다. 일반 minimals의 기본 Fast에 맡기지 않는다.
- 현재 API에서는 feature 호출에 `exactHumanQuality: 'true'`, minimum-cover 호출에 `exactQuality: 'true'`를 전달한다. `secondary: 'auto'`는 엔진 선택 옵션이며 Human quality 옵션과 다르다.
- 현재 `normalizeExactHumanQuality('auto')`는 Fast로 정규화된다. 벤치에서 quality에 문자열 `'auto'`를 넣어 exact라고 가정하지 않는다. 상위 Auto 경로를 검증할 때도 실제 resolved quality가 exact인 경로인지 확인한다.
- 요청 옵션·정규화된 품질 모드·실제 실행 경로를 raw에 기록하고, 하네스 계약 검사에서 exact 경로 진입을 확인한다. 여기서 보호할 '빠른 경로'는 trivial/direct/tiny 등 exact 완료 단축 경로를 뜻한다.
- 직접 Integrated/Threshold/CP 비교는 wall timeout 안에서 exact 완료를 시도한다. 직접 Integrated에 현행 Auto의 100K probe cap을 잘못 상속하지 않는다. Auto 정책 내부의 정상 bounded probe는 별도 단계로 기록한다.
- **세 엔진 모두 유한 timeout이 필수다.** 시간 단위로 걸리는 셋업을 무제한 실행하지 않는다. timeout 미설정/무한대/0을 허용하지 않는 하네스 검사를 둔다.
- 최소한 `startup`, `전체 secondary 호출`, `회수(reap)` 제한을 분리한다. 신규 fixture의 열거·primary, 명령 전체, job·캠페인에도 유한 상한을 둔다. CP 내부 제한은 외부 호출 상한과 별도로 기록한다.
- 동기 WASM과 같은 event loop의 timer에 의존하지 않고 외부 parent/프로세스 watchdog으로 deadline을 감시한다. 초과 시 자식 Worker까지 종료·회수하고 raw를 저장한 뒤 다음 호출로 진행한다. 회수 실패는 정상 timeout과 구분한다.
- `TIMEOUT_*`는 미완료다. feasible seed나 부분 proof를 exact로 반환하거나 상한값을 완료시간으로 집계하지 않는다. timeout 입력을 단순 변동 재테스트로 자동 재실행하거나 상한을 자동 증액하지 않는다.
- Sol은 반복 횟수와 함께 구체적인 timeout 값·측정 경계·최악 호출 비용을 제안한다. 값은 실측 전에 협의·동결한다. timeout·취소·자식 Worker 회수는 경량 모의 검사로 먼저 확인한다.

## 2. 사용할 세 DB

루트: `D:/AI/sfinder-wasm/files/setupdata/`

| 파일 | 레코드 수 | 파일 안의 서로 다른 Fumen 문자열 수 |
|---|---:|---:|
| `cycle-1-id-fumen.json` | 45 | 45 |
| `cycle-2-id-fumen.json` | 48 | 48 |
| `cycle-7-2plus2-qb-id-fumen.json` | 356 | 338 |
| 전체 | **449** | **411 (DB 사이 중복도 합침)** |

읽기 전용 JSON 검사에서는 모든 항목이 `id/fumen` 문자열을 갖고 ID 449개가 서로 다르다. 411은 문자열 기준이며 독립 보드·mirror group·secondary 행렬 수가 아니다. DB에는 pattern·save·최소 K 정보가 없으므로 별도 생성 계약이 필요하다.

입력 파일 SHA-256:

```text
cycle-1-id-fumen.json
e4e649693f61b26cbd9888ec578bf367af3fedf885981889dddc5375b4838db0
cycle-2-id-fumen.json
ca58eef5d3e717c06bc5704f8b827a7b4700f7f5a897f87dd6c8930a38ac6fc2
cycle-7-2plus2-qb-id-fumen.json
4a0308159b5b3b3736e318a449638317049c53056683a7a154d9605cfa231b83
```

## 3. 데이터 선별

1. **전체 449개를 장부에 등록**하고 Fumen을 디코딩한다. 여러 page, field/operation, 대상 높이, 남은 셀과 필요한 미노 수를 확인한다. 문자열 일치·실제 보드 일치·mirror 관계를 구분하고 원본 DB·ID·aliases를 남긴다.
2. DB 이름만으로 pattern이나 잔여 bag을 추정하지 않는다. 기존 검증된 fixture 생성 규칙을 참고하여 일반 minimals/per-save, bag·제한 split·독립 split의 적용 조건, hold·save 조건·clear를 명시한다. mirror 시 J/L·S/Z 등 queue/save 대응도 확인한다.
3. board→command→save 행렬의 identity를 연결한다. 기존 측정과 후속 연구의 노출 이력을 대조하고 개발군과 미노출 검증군을 **mirror group 단위**로 먼저 나눈다. 미노출 검증군의 성능은 초기 성능 지도에서 측정·열람하지 않는다.
4. 옛 winner/cutoff 대신 DB 출처·pattern 유형·geometry·규모 범위를 기준으로 넓게 선택한다. 가능하면 적격 개발군을 폭넓게 포함하고, 예산상 추출이 필요하면 고정 seed의 층화 추출을 사용한다. 추출 비율·개수는 비용 산출 후 협의한다.
5. 기존 K 증명 fixture를 재사용한다. 신규 입력은 열거·primary를 한 번 수행해 원본 quality 행렬·K 증명·primary seed·stable IDs·중복행 가중치를 저장한다. n/K/R/E/F/d/u와 행렬 hash를 붙인다. 수치 특징이 필요한 선별은 이 준비 이후 수행하고 추출 비용도 예산에 포함한다.
6. 빈 결과·실패·trivial/direct/tiny·비자명 행렬·primary 미완료를 별도 집계한다. 중복 측정 생략은 행렬뿐 아니라 K·seed·stable-ID·실행 계약까지 같은지 확인하고 원본 command·save 대응을 보존한다. 실제 명령 경로의 빠른 완료 비율·비용도 별도 표본에서 확인한다.
7. 독립 group 수, pattern 적합성, 비자명 bag, 큰 행렬, 미노출 검증군이 부족하면 **부족한 유형과 필요한 규모를 정리해 사용자에게 추가 DB를 요청**한다. 임의로 범위를 극단적으로 좁히거나 외부 DB를 추가하지 않는다.

## 4. 하네스 구성

| 부분 | 구현 내용 |
|---|---|
| 입력·fixture | DB/schema/hash 검사, 정규화 identity, pattern 생성, 기존 fixture 대조, 신규 matrix/K/seed 추출 |
| 공통 runner | 같은 원본 quality 행렬·K·primary seed를 Integrated/Threshold/CP-SAT에 전달하고 각각 독립 실행. CP 현행 설정 기록·사용 |
| scheduler | 초기 행렬별 세 엔진을 같은 VM에서 순차 실행하고 반복별 순서를 균형 배치. 독립 행렬 block을 최대 16 VM으로 분배. 후속 A/B용 명시적 pair schedule 지원 |
| lifecycle·timer | 실제 제품의 Worker 경로를 대표하는 계약을 고정하고 init/packing/native 준비/search/IPC/cleanup 및 직접 측정한 총시간 저장. cold/reuse/warm 구분 |
| 외부 감시·writer | solver event loop와 별도 watchdog, 상한·취소·자식 Worker 회수, raw append/fsync/ACK, 실패 원장·artifact 회수 |
| 검산 | K·원행 coverage·weighted quality·stable-ID/proof 상태 확인. 작은 oracle·기존 exact 참조, 원본 buffer 보존, 취소·재시작 |
| 분석·재테스트 선별 | 정보 수집과 A/B 규칙 전환. 원결과를 보존하면서 변동·상태·비교 집계, 대상 ID·모든 선정 이유 출력 |

기존 runner와 검증된 실험 하네스를 조사해 재사용한다. 옛 WASM·절대경로·예산·policy를 그대로 이어받지 않는다. 초기 단계에서 live 관측 ABI나 새 cutoff를 먼저 구현하지 않는다.

## 5. 측정 계약과 재테스트

- **초기 3엔진 정보 수집:** 같은 조건의 max/min ≥ 1.10인 input×engine이 재테스트 대상이다. 개선·악화 상위 10%는 적용하지 않는다.
- **후속 A/B 비교:** 개선 폭 상위 10% ∪ 악화 폭 상위 10% ∪ 같은 조건 max/min ≥ 1.10 ∪ 기존 gate에 영향을 주는 입력. 상세 정의는 공통 지침 v2.0을 따른다.
- 최초·재테스트 횟수, VM별 반복 배치, warmup·대조 호출 수는 **목적과 비용을 제시해 협의 후 확정**한다. 과거 4쌍/10쌍 규칙은 자동 적용하지 않는다.
- 정보 수집 재테스트는 변동 엔진만 실행할지 해당 입력의 전체 엔진 block을 실행할지 사전에 정한다. A/B는 선정 입력의 양쪽 variant를 재측정한다.
- timeout은 미완료로 남기고 상한을 완료시간으로 쓰지 않는다. 세 엔진이 모두 완료하지 않은 입력에 확정 winner를 붙이지 않는다. 초기 자료만으로 새 정책의 실제 개선을 주장하지 않는다.

## 6. Sol의 첫 반환물

1. 독립 작업본·branch와 baseline/source lock, 경량 계약 검사 결과.
2. 전체 DB 장부, 적격/제외/중복/mirror/노출 현황, command 생성 규칙, 개발/검증 분할안.
3. 초기 3엔진 측정 manifest안: 입력 수, 재사용 기록, 신규 fixture 수, exact 옵션, 반복 제안, 단계별 timeout·회수 상한, 최대 16 VM 배치, 총 호출 수·runner-hours, 미정 사항.
4. 하네스 구성과 raw/schema 예시, 재테스트 선별의 경량 검사 결과.

무거운 fixture 추출도 단계별 범위·예산을 고정한다. 우선 하네스와 입력 계획을 준비하고, 실측 횟수·전체 예산을 협의한 뒤 본 측정으로 진행한다.

참조: [로드맵](THREE_ENGINE_ROADMAP_KO.md) / [공통 지침 v2.0](tools/validation/TESTING_RULES_KO.md).
