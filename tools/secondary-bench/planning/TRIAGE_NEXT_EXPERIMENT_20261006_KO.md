# 다음 실험 인계 — Astra 설계 r1

2026-10-06 · 완료자료 분석 및 Gemini/Muse/Grok 검토 후 · **설계 완료, 구현·실행 전**

권위 문서와 대상 장부:

- `D:/AI/sfinder-wasm/triage-analysis/Astra/NEXT_EXPERIMENT_PLAN_KO.md`
- `D:/AI/sfinder-wasm/triage-analysis/Astra/next-experiment/PLAN.json`
- 같은 폴더의 `TARGETS.jsonl`, `TASKS.jsonl`, `INDEX.json`, `VERIFICATION.json`

## 목적과 두 후보

현행 Auto의 Integrated100K probe/seed 가치를 실제 정책 비용으로 검증한다.

- **A:** non-primaryHard 및 유효 d≥17에서 기존 probe 생략(ALL93개 변경).
- **B:** A + primaryHard 및 유효 d≤16에서 bounded probe 허용(추가5개 변경).
- CP 보조 지연60초/자체limit120초, secondary elapsed 기준, probe seed의T/CP공유, CP실패시Rust지속과회수는 현행대로 유지.

## 실행 준비 순서

1. 제품·pool/defer 경로와 source/WASM/runtime/원fixture·primary seed lock.
2. 제품 동일진입점의 후보 구현과 common M5 triage-fixture/performance/pair 계약 확장.
3. synthetic 계약, 원격canary8개, 계측off/on24개 통과.
4. ALL451 전수 인접paired A/B, per-save32 회귀, trivial97 검산, 변경98개 seed진단.
5. 사전규칙에 따른 추가2pair와 개발단계후보 판정.
6. 이후 T/CP 동적관측 및 명령e2e/browser/동시요청/fresh 검증.

초기·진단4743호출, 추가최대3736호출, 합계최대8479. **사용자 지정16VM**/120시간/1400 runner시간. 이는 최악경우를 포함한 상한이지 예상소비나 이미 실행된 캠페인이 아니다. 후속준비결과는 `TRIAGE_PREPARED_16VM_20261006_KO.md`를참조한다.

common v1은 정보수집용 secondary-fixture만 지원하므로 위JSON을 그대로 activate하지 않는다. 기능·계측 canary를 통과한 구현revision에서 정식 실행manifest를 컴파일하고 조건·pair·예산을 다시 봉인한다.

제품·기존DB·이전캠페인clock 변경 없이 설계 장부만 작성했다. solver 추가호출0, 새워크플로 실행0. 로드맵의 최대2후보/ALL우선/원exact계약/개발자료와fresh분리를 따른다.
