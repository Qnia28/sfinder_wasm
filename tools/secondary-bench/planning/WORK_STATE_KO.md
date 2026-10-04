# Sol / Build 준비 상태

2026-10-05. 작업 저장소 `D:/AI/sfinder-wasm/sol/secondary-routing-20261005`.
branch `experiment/secondary-routing-20261005`, baseline `7ef62d18e1d155b6479e00d651c851ff3baa7112`.
원본을 `git clone --no-hardlinks`로 독립 복사했으며 원본의 node_modules를 공유하지 않고 `npm.cmd ci`로 설치했다. 새 저장소의 기본 push는 비활성화하고 명시 branch refspec만 설정했다.

## 완료

- 계획·규칙 및 DB byte 복사, geometry 전체 감사·부분 노출 감사, DRAFT 입력·예산 제안.
- direct 3엔진·exact·무state cap, primary-only fixture 추출, OS 프로세스 watchdog·phase deadline·회수.
- source/fixture lock, fsync raw/failure ledger, 직렬 3엔진 schedule, offline audit·정보 수집/A-B retest 선별.
- 작은 합성 입력에서 실제 engine/oracle·collector·weighted/stable-ID 및 timeout/cancellation 회귀 검사.
- branch 전용 계약 preflight workflow 파일. 원격 실행 없음.

## 변경하지 않음

제품 `src`, Rust, WASM, 원본 `dev-branch`, GitHub main. solver cutoff/관측 API/분류 규칙.
merge와 광범위 실측은 수행하지 않았다. 초기 준비 단계에는 commit/push/Actions도 없었으며, 후속 사용자 지시를 반영한 현재 단계에서는 **실험 branch commit/push 및 Linux 계약 preflight만** 수행한다. 전체 실측은 DRAFT manifest로 잠가 둔다.

## 다음 합의

`MEASUREMENT_PROPOSAL_KO.md`의 모집단·pattern/save·반복·timeout·총 예산을 논의한다. 캡처와 최종 측정을 나누어 승인하는 것이 권장안이다.
전체 노출·과거 직접 시간 재사용 감사 → approved source/input lock → Linux cgroup/OOM·Actions 외부 watchdog 및 artifact preflight → 승인한 캡처 → 구조 감사·matrix 선별 → 별도 동결한 측정.

현재 하네스는 **준비판**이다. 후속 사용자 지정으로 두 family·N+1만440 command, timeout60초·기본2/추가2씩최대10·6h admission/8h wall의 wave/chunk 실행기와 수동 Actions workflow를 구현했다. 4-task job·task마다 checkpoint·cgroup OOM ledger를 추가했다. Linux preflight·전체 노출 감사·최종 save-filter sampling/source freeze는 아직 남아 있으며 DRAFT는 실측 시작을 거부한다. runner-hour 상한은 폐기했다. `fresh-process-cold` 자료를 end-to-end 또는 browser/concurrency 증거로 해석하지 않는다.
