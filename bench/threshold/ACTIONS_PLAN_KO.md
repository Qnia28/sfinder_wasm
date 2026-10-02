# Cycle-1 DB Actions 실행 계획

작업과 push는 `experiment/threshold-engine-20261003`만 대상으로 한다.
로컬 원본 dev와 원격 main은 수정/merge하지 않는다.

1. 최초 commit `9443742`: 기존 correctness/smoke + DB 두 setup capture.
2. capture smoke의 행렬 hash/K 증명 및 correctness 통과 확인.
3. `capture-config.json` suite=all로 45 setup/315 save 필터 생성.
4. 모든 setup의 report를 수집한다. timeout/NO_MINIMAL/오류도 보존한다.
5. `select-capture.mjs`로 개발12/검증8을 구조 지표만으로 고정한다.
   검증8의 보드 그룹은 `selection-policy.json`에 미리 고정한다.
   누락된 검증 그룹은 대체하지 않는다.
6. 생성된 `cycle1/manifest.json`과 압축 행렬을 commit하고 capture=off.
7. ci-run.json fixtureSet=cycle1로 baseline → screen 실행.
8. 효과/회귀를 확인한 뒤 후보 mask 고정 → ablation → confirm 두 차례.
   all-on을 자동 승격하지 않는다.

DB 원본 SHA256:
`58f02fe2e1f7939e127de4c7ea2886bcf45c91a797ffa0d25dc8a0e4fb262388`.

## Capture

- 원본 fumen을 decode하고 4라인/hold=true로 분석한다.
- setup의 pieceSignature에 없는 첫 bag 조각 전체 순열 + 다음 bag 4개.
- 16칸 setup은 7조각 큐, 12칸은 8조각, 24칸은 5조각이다.
- original.wasm으로 compact PC 열거를 수행한 후 7개 정확 save 필터를 분리한다.
- 성공 queue 행만 quality cover universe에 포함하고 성공/전체 case 수를 같이 기록한다.
- primary는 exact cardinality kernel + 필요하면 HiGHS optimal만 인정한다.
- kernel에서 행/후보를 줄여도 secondary 행렬은 원본 rows/keys를 그대로 저장한다.
- seed가 feasible인 것과 K가 optimal인 것을 구분한다.
- 열거 300초, 각 primary 내부90초/외부100초. 초과는 별도 status.
- 입력 생성은 threshold 성능 시간에 포함하지 않는다.

capture와 benchmark는 별도 workflow다. 각 capture/benchmark의 빌드와 artifact는
run ID/attempt로 연결한다. 이 두 workflow 외에 기존 다른 브랜치의 workflow는
변경하지 않는다. 새 workflow가 main에 없어도 실험 브랜치 push로 시작한다.

## 로컬 수집 후 고정

```powershell
gh run download <capture-run-id> --repo Qnia28/sfinder_wasm --pattern 'threshold-capture-cycle1-*' --dir bench/threshold/results/capture-downloads
node bench/threshold/select-capture.mjs bench/threshold/results/capture-downloads
$env:THRESHOLD_FIXTURE_ROOT='bench/threshold/cycle1'
node bench/threshold/fixtures.mjs --verify
```

원본 DB는 읽기만 한다. DB snapshot/selected 행렬만 신규 실험 브랜치에 공개한다.
원격 저장소는 공개이므로 snapshot에 개인 경로/placements 전체는 복사하지 않는다.
기존 20개 입력은 legacy-stress로 구분하여 유지하며 새 DB 주 평가군과 합산하지 않는다.
