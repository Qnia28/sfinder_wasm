# 다음 secondary 정책 비교: 제품 입력·정확성 계약

상태: **추출 감사 완료, 입력 범위 확정, runner/측정 조건은 미동결·미실행**. 이 문서는 Astra가 정의하는 제품 검증 요구사항이다. Sol의 테스트/벤치 스크립트 설계를 대신하거나 실행을 위임하는 문서가 아니다.

후속 사용자 지시로 하네스 준비가 끝나 위임을 재개한다. 최신 [Astra 비교 대상 설계](SECONDARY_POLICY_COMPARISON_DESIGN_20260926.md)가 95입력/5조건과 Sol의 runner·실행 계획 준비 범위를 확정한다. 아래 마지막 절의 위임 보류는 감사 직후의 기록이며 이 후속 지시로 해제됐다. 벤치 실행은 여전히 준비·검토·최종 동결 뒤 별도 단계다.

근거: [신규 추출 감사](../../tools/validation/secondary-newboards-audit-20260926/ASTRA_AUDIT_KO.md), [기계 감사](../../tools/validation/secondary-newboards-audit-20260926/ASTRA_AUDIT.json).

## 입력 범위: 기존 76 + 신규 19 = 95

### 기존 개발·회귀 76개

`tools/validation/secondary-partition-policy-20260923/manifest.json`의 **cases 전체를 기존 순서 그대로** 사용한다. 행렬은 그 manifest의 matrixPath와 files SHA-256으로 식별한다. 이번 읽기 검사에서 76개 행렬 해시가 모두 일치했다.

manifest SHA-256: `33e3cee215c29e64a3a2d5d6c49216987bbc42c360fea6f23b0de5bc7a725a77`.

- ordinary: 16
- per-save: 54
- 과거 heldout: 6 — 이미 여러 측정에 사용했으므로 이제는 회귀군이다.

최근 portfolio의 15개 입력이 모두 이 76개에 포함되는 것을 확인했다. batch 진단에 사용한 7개만 남겨 쉬운 사례나 과거 미완료 입력을 누락시키지 않는다. ordinary ALT JAWS T, ELEPHANT J, 빠른 BIG JAWS, 전체 독립 split 등 기존 회귀군을 보존한다.

기존 행렬 JSON은 keys/K/seed/rows만 있고 primaryHard 필드가 없다. 기존 manifest의 policy와 child.mjs는 이 corpus를 primaryHard=false로 실행한다. 후속 입력 메타데이터에는 이를 **기존 계약에서 가져온 false**라고 기록하며, 신규 capture에서 직접 관측한 false와 근거를 구분한다. 필드 누락을 일반적으로 false로 간주하는 adapter는 금지한다.

### 신규 ordinary 19개

`tools/validation/secondary-newboards-20260926/run-luna/matrices.json`의 **전체 19개를 저장 순서 그대로** 추가한다. 각 matrixPath/sha256은 Astra 감사에서 대조했다. 기존 76개의 caseId와 겹치지 않는다.

6개 새 보드의 5개 bag/12개 제한 split/2개 fullsplit 행렬이다. `NO_MINIMAL` 7개와 열거 timeout 미추출 4개 필터는 secondary 입력으로 만들지 않고 누락 목록에 남긴다. 새 보드·대체 입력·시간 확대 재추출로 30개를 채우지 않는다.

단순 원본 singleton 증명으로 유일한 최소 조합이 정해지는 5개도 포함한다. 새 군 전체를 어려운 secondary 사례라고 부르지 않는다. 신규 19개의 실행 결과를 보고 임계값을 다시 맞추면 이후에는 개발 자료가 되며, 같은 결과를 새 heldout 검증이라고 보고하지 않는다.

## 제품 정확성·구현 경계

- 정확성은 최소 K, **원본 중복 행 가중 품질 벡터**, stable-ID tie까지다. CP FEASIBLE이나 품질만 증명한 결과를 exact로 승격하지 않는다.
- 각 조건에 동일한 원본 keys/rows/K/seed를 전달한다. primary kernel의 forced/dominance를 secondary 후보 제거 근거로 사용하지 않는다.
- 신규 자료의 79,174 반복 행을 삭제하여 품질 가중치를 바꾸지 않는다. ID 정렬·행렬별 seed 및 reference provenance를 보존한다.
- ordinary saves의 last-bag 의미와 per-save 실제 잔여 1미노 의미는 별도 계층으로 집계한다.
- 신규 자료는 전부 primaryHard=false다. primaryHard=true의 threshold 직행 경로에 대한 제품 판단은 이 비교로 하지 않는다.
- `*p3,*p4`는 독립 구간이며 176,400큐다. 저장 행 수는 필터 성공 행 수이므로 이 큐 수와 같을 필요가 없다.
- capture hook이 붙은 snapshot을 정책 runner로 그대로 호출하지 않는다. 저장 행렬을 읽는 별도 adapter에서 실제 정책 API와 결과 검증을 연결한다. 이미 동결된 snapshot 자체를 고쳐 hook을 제거하지 않는다.
- 제품 WASM과 실험 WASM을 구분하고, 정책 대조에서 공통 solver artifact/옵션을 명시한다. 최신 saves 표현식 캐시 변경은 행렬 고정 secondary 비교의 새 변수로 섞지 않는다.

## 기준 정책과 후보 검토 범위

고정 기준은 제품의 **trivial → integrated100000 → threshold**, decomposition off이다. 모든 후보에도 동일한 trivial proof 기회를 주어 쉬운 입력의 비용을 공정하게 비교한다.

Sol이 설계안을 작성할 때 검토할 후보는 다음과 같다. 아래 목록은 실행 매트릭스 확정이나 제품 기본 승격이 아니다.

1. 기존 근거가 있는 integrated200000 → CP 1-worker.
2. 기존 근거가 있는 integrated200000 → threshold20000 → CP 1-worker.
3. batch-aligned 증명 재사용은 선택적 별도 축으로 유지. 평가한다면 integrated/threshold 예산·CP batch 크기·hint·seed를 동일하게 맞춘 **off 대 batch-aligned** 비교가 필요하다. 기존 100000/20000 batch 진단과 200000 후보의 성능 차이를 재사용 효과로 해석하지 않는다.

individual proof locks와 `--no-liftoff`는 기존 제외 결정을 유지한다. integrated/threshold/CP의 단독 대조가 필요한지와 정책 비교 단계 구성은 Sol 설계에서 제안하되, 새 결과를 본 뒤 임계값·입력 집합을 바꾸어 같은 검증으로 인정하지 않는다.

## Sol 설계 전에 확정·기록해야 할 항목

1. 위 95개 입력의 소스 해시·K/seed·군/필터/pattern/primaryHard 근거를 담은 별도 manifest. 원본 파일은 읽기 전용.
2. 후보 수와 비교 단계, 상태 예산, CP batch 및 증명 재사용 옵션. batch-on 비교에는 같은 조건의 off 대조를 둔다.
3. fresh process, WASM/runtime 준비, CP lazy loading/model 생성 비용을 포함하는 측정 경계. 단독 CP의 warm 수치와 portfolio의 cold 수치를 섞지 않는다.
4. 반복 수·정책 실행 순서·wall-clock 상한·외부 supervisor grace·취소/cleanup. 상태 예산을 시간 상한으로 간주하지 않는다.
5. COMPLETE/INCOMPLETE/TIMEOUT/ERROR/EXACT_LATE 분류와 동률 증명 상태. timeout은 timeout으로 보존하고 완료 표본 전체 평균으로 가속률을 계산하지 않는다.
6. 입력별 대응쌍, 완료율, 중앙값/분포 및 쉬운 입력 회귀를 함께 보고하는 기준. 짝수 중앙값은 가운데 두 값의 평균이다. 신규/기존/ordinary/per-save/trivial/fullsplit 군을 분리한다.
7. 기존 reference가 없는 신규 입력의 exact 결과 대조 방식. Astra 감사의 seed 품질 해시는 feasible 기준일 뿐 정답 oracle가 아니다. 여러 엔진이 같은 값을 냈다는 이유만으로 미완료 상태를 exact로 바꾸지 않는다.
8. 동일 호스트 측정 자원 직렬 점유, lock 및 existing-output 거부, 실패 보존, 자동 재시도 금지, 동결 전/후 hash 확인과 소유권.

## 역할과 현재 중단점

Astra가 입력·정확성 계약 및 최종 감사를 담당하고 Sol이 후속 테스트/벤치 설계를 맡는다. 향후 승인된 실행은 Sol만 Luna 루트 `ses_f241db2cfffeu0PIj1gjPSm9gt`에 prompt로 한 번 전달한다. Sol은 Astra에게 직접 메시지하지 않으며 Astra가 보고서를 읽는다.

현재는 이전 사용자 지시의 위임 보류를 유지하여 새 작업을 전송하지 않았다. runner 준비/동결/실행은 아직 수행하지 않았다. 다음 단계는 **이 입력 계약을 기반으로 한 Sol 설계 재개**이며, 결과 검토 후에만 엔진 정책 및 브라우저 통합으로 넘어간다.
