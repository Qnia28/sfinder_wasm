# Fast Actions 준비 검사 실행 기록

## 승인과 실행 범위

사용자의 별도 `sfinder_wasm` 실험 브랜치·최대16VM 및 Actions 실행 지시에 따라 진행했다.
현재 브랜치는 `experiment/fast-budget-20261015`이다. 준비 검사는 동시 측정1VM만 필요하며,16VM은 본 측정 상한으로 유지한다.

이번 Actions는 **Fast 실행 어댑터 계약과 실제 artifact 전송 준비 검사**다.
548입력의 capture·행렬 비교·e2e 전체 캠페인 완료를 의미하지 않는다.
본 실행에는 실제 capture 기반 표본 manifest, 전체 schedule, e2e 연결, delta checkpoint·누적 budget admission이 여전히 필요하다.

## 실행1: solver 계약 PASS, artifact 전달 FAIL

- run: https://github.com/Qnia28/sfinder_wasm/actions/runs/38755030086
- source: `7c32d1e0deda6f387eab054494d61c6ee019bdad`
- 전체 Actions 결과: **failure**. 과거 결과를 성공으로 덮어쓰지 않는다.
- 원격30단위: RETURNED_EXACT22, RETURNED_APPROX2, 제품경로 PARITY_PASS5, 의도한 동기 무응답 TIMEOUT_CALL1.
- 30개 모두 process-tree 회수 확인. 3GiB/swap0 systemd scope. 관측 peak 최대43,462,656bytes.
- 12군×ON/OFF의 keys/가중 quality/states/proof/decision 일치. 이 입력의 실행시간 차이는 성능 결론에 사용하지 않는다.
- 고정K synthetic triangle은 원행 중복을 포함한다. 실제 카탈로그 coverage/성능 검증의 대체물이 아니다.
- 실패 원인: 일반 shell에서 SDK를 호출하여 `ACTIONS_RUNTIME_TOKEN`이 없었다. 세 payload 모두 업로드 실패 receipt를 남겼고, 기본 upload-artifact 단계가 전체 원자료를 보존했다.
- 로컬 보존: `../../fast2nd/20261015/actions-38755030086/` (Git 외부).

## 전송 수정

SDK 업로드를 `tools/fast-bench/action` JavaScript Action으로 이동했다.
이미 통과한30개 solver 호출은 반복하지 않는다. 원 run의 evidence를 받아 seal/member hash를 검증하고 같은 payload에 전송 attempt만 추가한다.
후속 download job은 새 backend ID3개만 받으며 원 payload의 source-run identity를 그대로 검증한다.
전송 복구 run의 source와 원 측정 source를 같다고 주장하지 않는다.

로컬 계약 검사7개 PASS. 로컬 population/solver benchmark는 실행하지 않았다.

## 실행2: 전송 복구 및 왕복 PASS

- run: https://github.com/Qnia28/sfinder_wasm/actions/runs/38755431827
- source: `91997156b084367528af0d7ab546981ece2b6a19`
- Actions **success**: contracts25초, round-trip12초(job별 시간, 큐 대기 제외).
- 추가 solver 호출0. 원30개 검사 결과·원 source/lock·실패 receipt를 그대로 보존했다.
- 3개 업로드 각각1,170.614 / 1,183.124 / 1,132.806ms. 병렬 전송이므로 합을 wall-time이라고 부르지 않는다.
- artifact IDs: `11982164713`, `11983371387`, `11983296596`.
- 다운로드 대상은 위 ID3개뿐. 전체 member 크기·SHA256·source-run/shard identity 검증 PASS.
- 로컬 보존: `../../fast2nd/20261015/actions-38755431827/` (Git 외부).
- 이는 전송 방식의 작동 확인이다. 대형 fixture 전체의 개선율이나 본 벤치 결과를 뜻하지 않는다.

## 자원 산정

원격 solver 실행 단위30개는 첫 캠페인의 preflight64개 예약에 포함한다.
전송 복구는 solver0회이며 별도의 Actions runner 시간은 준비/전송/제어 예산에 포함한다.
본 캠페인 동결 시 이 두 run의 실제 시간을 누적 원장에 연결해야 하며, 준비 검사의 시작시각을 본측정 origin으로 위장하거나 비용을 누락하지 않는다.
