# Sol / Build 준비 상태

> **최신 상태(2026-10-05):** 아래는 초기 준비 단계의 역사 기록이다. 현재는 두 광범위 run과 통합 보고서·raw join까지 완료했고, Astra가 [해석·분류 방향과 누락 작업](ASTRA_ROUTING_DIRECTION_20261005_KO.md)을 결정했다. 다음은 Sol의 S0 데이터/하네스 보완 및 S1 정적 고-d probe 생략 상세안이다. `wave_decisions` export의 engine 누락은 발견됐지만 아직 수정하지 않았다. 새 분류 구현·후속 성능 캠페인은 실행하지 않았다.

2026-10-05. 작업 저장소 `D:/AI/sfinder-wasm/sol/secondary-routing-20261005`.
branch `experiment/secondary-routing-20261005`, baseline `7ef62d18e1d155b6479e00d651c851ff3baa7112`.
원본을 `git clone --no-hardlinks`로 독립 복사했으며 원본의 node_modules를 공유하지 않고 `npm.cmd ci`로 설치했다. 새 저장소의 기본 push는 비활성화하고 명시 branch refspec만 설정했다.

## 완료

- 계획·규칙 및 DB byte 복사, geometry 전체 감사·부분 노출 감사, DRAFT 입력·예산 제안.
- direct 3엔진·exact·무state cap, primary-only fixture 추출, OS 프로세스 watchdog·phase deadline·회수.
- source/fixture lock, fsync raw/failure ledger, 직렬 3엔진 schedule, offline audit·정보 수집/A-B retest 선별.
- 작은 합성 입력에서 실제 engine/oracle·collector·weighted/stable-ID 및 timeout/cancellation 회귀 검사.
- branch 전용 계약 preflight: commit `6288c7aa6253a9c843250061bb77d9e6156194aa`, run `37221479350` success. 일반23/23·실제Linux cgroup24/24 통과. 전체 광범위 실측은 미실행.

## 변경하지 않음

제품 `src`, Rust, WASM, 원본 `dev-branch`, GitHub main. solver cutoff/관측 API/분류 규칙.
merge와 광범위 실측은 수행하지 않았다. 초기 준비 단계에는 commit/push/Actions도 없었으며, 후속 사용자 지시를 반영한 현재 단계에서는 **실험 branch commit/push 및 Linux 계약 preflight만** 수행한다. 전체 실측은 DRAFT manifest로 잠가 둔다.

## 다음 합의

`MEASUREMENT_PROPOSAL_KO.md`의 모집단·pattern/save·반복·timeout·총 예산을 논의한다. 캡처와 최종 측정을 나누어 승인하는 것이 권장안이다.
전체 노출·과거 직접 시간 재사용 감사 → approved source/input lock → Linux cgroup/OOM·Actions 외부 watchdog 및 artifact preflight → 승인한 캡처 → 구조 감사·matrix 선별 → 별도 동결한 측정.

현재 하네스는 **준비판**이다. 후속 사용자 지정으로 두 family·N+1만440 command, timeout60초·기본2/추가2씩최대10·6h admission/8h wall의 wave/chunk 실행기를 구현했다. 4-task job·task마다 checkpoint·cgroup OOM ledger를 추가했다. Linux 계약 preflight는 통과했으며 전체 노출 감사·최종 save-filter sampling/source freeze·전체wave/업로드복구 smoke가 남아 있다. DRAFT는 실측 시작을 거부한다. main을 변경하지 않고 실험 branch의 승인 manifest 명시 push로 실행할 수 있게 준비했다. runner-hour 상한은 폐기했다. `fresh-process-cold` 자료를 end-to-end 또는 browser/concurrency 증거로 해석하지 않는다.
