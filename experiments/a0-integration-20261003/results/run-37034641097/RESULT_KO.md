# A0 최소 제품 연결 검증 결과: 적용 보류

## 결론

별도 브랜치의 최소 구현, WASM 재빌드, 회귀, 브라우저/Worker 연결 검사와 smoke 실행·독립 감사를 완료했다. **smoke 동결 게이트 실패로 예약 검증은 실행하지 않았으며 제품 적용 가능성은 보류한다.** 검증 전체가 통과했다고 주장하지 않는다. Dev/main/default branch/배포는 변경하지 않았다.

- 브랜치: `integration/a0-minimal-20261003`
- 검증 대상: `e5f2f3d1a9885085e11cde7457aad2b338ca8130`
- 기준 제품: `c0cb2a048e7275bfea587d176b1954efff0a8a08`
- 실행: https://github.com/Qnia28/sfinder_wasm/actions/runs/37034641097
- 전체 결론: failure. build-test 및 smoke 8개 job은 성공적으로 결과를 보존했고, freeze 집계 게이트가 실패했다. reserved/aggregate-reserved는 skipped다.
- 비용 범위: 실행 경과 11.12분, 관측 job 합계 0.682 runner-hours, 압축 artifact 합계 509,463 bytes. public standard runner만 사용했다.

## 제품 변경과 빌드

제품 JS 변경은 `solveInspectedSecondary`의 기존 일반 True integrated100K 호출에 `partitioned: decomposition === 'off'`를 추가한 한 줄이다. 저수준 기본값, Fast, tiny/trivial/primaryHard, 전달된 probe 재사용, 명시 엔진, CP 지연, 분해 옵션과 Rust 소스는 바꾸지 않았다. 실제 경로 검증은 직렬 Rust secondary다. Auto/CP의 실제 입력 성능 개선을 주장하지 않는다.

기존 Rust 소스/Rust 1.90.0으로 Linux에서 pc-wasm만 다시 빌드했다. SHA256은 기존 hosted baseline `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`와 완전히 일치한다. partition export 존재 및 benchmark 전용 export 부재를 확인했다. R/A는 같은 재빌드 WASM을 사용했다. 소스/harness Git blob 151개를 독립 검증했으며, 제품 소스 변경은 위 JS 한 파일뿐이다.

Windows 사전 재빌드 `aac18952...`는 byte hash가 달랐으므로 채택하지 않았다. Linux 재현 및 동일 hash 확인으로 검증·후보 binary를 확정했다. Windows/Linux byte 차이의 세부 compiler 원인을 규명했다고 주장하지 않는다. B10/B6 후보 binary나 tuned ABI는 가져오지 않았다. 작은 synthetic O/R/A parity 27회가 통과했고 기존675개 효과 campaign은 반복하지 않았다.

## 회귀 및 연결 검사

| 검사 | 결과 |
|---|---|
| 제품 전체 일반 Node invocation | 186 pass / 7 skip / 0 fail |
| hosted CP 지원 invocation | 13 pass / 0 skip / 0 fail, 앞선 skip 중 5개 보완 |
| 로컬 남은 baseline 계약/nested primary abort | 2 pass / 0 skip / 0 fail |
| 중복을 제외한 제품 테스트 | **193 pass**, hosted191 + local2 |
| Rust min-cover | 고유26개, debug26/release26 pass |
| schedule/watchdog harness | 2 pass |
| synthetic 원제품/재빌드/A0 parity | 27 calls pass |
| 실제 브라우저 synthetic direct/Worker | scope, 중복가중행, stable witness, 버퍼 보존, dispose/cancel pass |

로컬 보완은 Node24.13.0 및 동일 후보 binary를 사용했다. actual primary/PC 금지는 실제 campaign 입력에 대한 조건이다. 기존 regression의 작은 synthetic fixture 검사는 별도이며 campaign primary 증명 재실행이 아니다.

## 실제 경로 smoke

metadata E 최대4개와 독립 hash순위 fill로 선택한16개, R/A×4=128 tuples를 빠짐없이 실행했다. 선택·원압축 bytes·seed/K/행·aliases 및 기존 증명 context를 독립 확인했다. 실제 primary/PC 호출은0이다.

| 상태 | R | A | 합계 | 입력 수 |
|---|---:|---:|---:|---:|
| EXACT | 28 | 28 | 56 | 7 |
| INCONCLUSIVE (threshold2M state cap) | 8 | 8 | 16 | 2 |
| TIMEOUT_API (threshold30초) | 28 | 28 | 56 | 7 |

각 입력에서 R/A 및4회 반복 상태가 동일했다. integrated100K/API10초 구간의 timeout은0이며 56회 모두 threshold에서 발생했다. 독립 phase 예산과 실제 timeout 경과를 확인했다. timeout56개 모두 SIGKILL 후2초 내 회수됐고, 관측 kill→close 최대19.89ms다. OOM/ERROR/미실행 tuple은0이다. 단, 이 수치가 제품의 unlimited threshold 완료시간을 의미하지는 않는다.

완료된 native call104개 trace의 원 weighted quality를208번 독립 재계산해 K, coverage, incoming seed, stable ID, exact 결과 및 반복 결정성을 확인했다. 보존된 trace 범위에서 A0 probe states/quality 회귀0이다. 처음 integrated probe 자체의 exact 입력은 R5/A5, 최종 threshold 포함 exact 입력은 R7/A7이다.

최종 exact가 양쪽4회 확인된 **7개 입력만** 비교하면 median route 합계 A/R=0.996742, p95 개별 slowdown=1.076274다. mirror group clustered fixed-seed bootstrap 합계 ratio95% CI=[0.943895,1.008954]. 이는 결측 경로를 제외한 조건부 기술 통계이며 전체 입력 성능 gate의 통과나 기존5%효과 재입증이 아니다. 9개 입력의 최종 route 비교가 미해결이다.

## 중요한 한계

1. threshold validation cap2M/API30초는 제품 timeout 정책을 변경한 것이 아니다. 상한 이후 완료 결과를 추정하거나 unlimited/증액 재실행하지 않았다.
2. threshold에서 kill된56개 행은 status/phase start-done/deadline/회수 기록을 보존했으나, 그 전에 완료한 integrated probe의 witness는 결과 전송 전이어서 저장되지 않았다. 이를 복원했다고 주장하지 않는다. 해당56개 probe의 quality/states를 독립 검산했다고도 주장하지 않는다.
3. child3GiB/swap0 cgroup 및 OOM/회수 guard는 작동했지만 호출별 RSS/peak cgroup bytes는 보존하지 않았다. 정확한 peak resource 개선을 주장할 수 없다.
4. routeWall은 입력 decode, WASM 초기화, coverage 준비 이후 제품 secondary 함수 호출시간에서 외부 witness 검산시간만 뺀 값이다. gross/검산/API phase wall을 함께 보존했다. PC/primary 포함 end-to-end 측정이 아니다.
5. smoke 통과를 전제로 했던 reserved eligible104개(832 tuples) 및 tiny115 metadata dispatch는 **0회** 실행했다. 동결 파일은 생성하지 않았다. reserved bytes/metadata hash만 확인했고 원행 decode/solver 노출은 없다. fresh holdout 증명도 없다.

## 인계

`STATUS.json`, `OFFLINE_AUDIT.json`, `SMOKE_CONFIDENCE.json`, `BROWSER_RESULT.json`, hosted 원본 결과/로그 및 source bundle을 함께 보존한다. `PRODUCT_ONLY_DO_NOT_APPLY.patch`는 JS 한 줄과 baseline-source WASM 교체만 포함한 대기 산출물이며 적용하지 않았다.

현재 Dev는 clean/c0cb2a0, local main은187fbf9, remote main은03b6377, default branch는main으로 확인했다. **적용 승인 요청이나 merge/deploy는 하지 않는다.** 후속 작업이 필요하면 이 실패·한계와 원시 결과를 기준으로 별도 검증 계획을 결정해야 하며, 이번 결과를 성공으로 바꾸거나 예약 게이트를 우회해서는 안 된다.
