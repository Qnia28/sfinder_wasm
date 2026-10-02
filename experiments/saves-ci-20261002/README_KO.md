# saves 독립 후보 실행

기준: `187fbf954ad0749e697b4e7f1252683b318d696e`. 실험 branch 외 main 변경 금지.

첫 wave만 활성화한다. A1/A2/A3/B1/B2/B3/B5/B6/A7 캠페인 및 holdout은 실행하지 않는다.
최소 공개 데이터셋의32 holdout 그룹은 후보 선정 전에 solver 입력으로 사용하지 않는다.
빌드/P/R/M·A4·A6는 서로 다른 source/WASM seal로 분리한다. 과거 Windows 시간은 Linux 결과에 합산하지 않는다.

runner는 공개 저장소 `ubuntu-24.04` standard만 사용한다. 지속 cache·larger runner·유료 fallback 없음.
artifact는1일 보존, 무료 저장/과금 차단 확인 후에만 push한다.

정확성 실패, timeout, worker 회수 및 미실행 기록을 보존한다. 실패한 실험을 임의 재시도하지 않는다.
