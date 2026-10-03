# 실행 경로 진단 완료 — 공통 하한 계산 경로에 비용 집중

## 최종 결론

**계획한 16호출을 재시도 없이 완료하고 독립 감사를 통과했다. 이번 환경에서는 큰 R/A 차이가 재현되지 않았다. 새로 확보한 근거는 네 프로파일 모두 실행 샘플의 약 97%가 R/A 공통 함수359에 집중됐다는 점이다.**

함수359의 정적 WASM 구조는 Rust `lower_bound`의 미충족 행 popcount → 후보별 gain 최대값 → 하한 계산과 강하게 대응한다. 따라서 다음에 비용 자체를 조사한다면 **공통 lower-bound/gain/popcount 경로가 우선**이다. 현재 자료로 A 전용 sibling/trail을 수정할 근거는 없다.

다만 과거9V45에서 Cold R3.82초/A5.73초가 된 정확한 기전은 여전히 미해결이다. Inspector는 실제 실행 함수는 식별했지만 실행 tier는 직접 식별하지 못했다. 기존 p95 실패를 무효화하거나 A0 통합을 승인하는 결과가 아니다.

## 1. 실행과 계측 능력

- 실행: [GitHub Actions37104315714](https://github.com/Qnia28/sfinder_wasm/actions/runs/37104315714)
- source: `fede5036e786f2779b650700f5e2b39cd3341318`
- 기준 증거: `da27c892595e5755dbc8a939add7cd8d5c1dca8a`
- 입력: `board-028--restricted-split--ordinary`, 원K/seed/weighted rows/stable IDs/hash 불변
- WASM: `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`
- 엔진: DEFAULT, Node24.13.0 / V8 13.6.233.17-node.37
- 호스트: Intel Xeon Platinum8573C, 허용 CPU0–3, 호출 Worker의 OS thread CPU0 고정
- 호출마다 fresh process/Worker, Worker당 native integrated100K 호출1회

실제 입력 실행 전에 합성 WASM의 두 계산 함수·공유 함수·재귀 경로를 DEFAULT/Liftoff 전용/최적화 전용 설정에서 검사했다. 함수0/1과 구간을 식별했고 hrtime/profile 시간축 정합성을 확인했다. 명시적 실행-tier field가 없어 **FUNCTION_ONLY**로 고정했다. 컴파일 생성 로그로 실행 frame의 tier를 대신 판정하지 않았다.

로컬·hosted 하네스 검사4개가 모두 통과했다. 비동기 초기화의 port 유지, 비정상 Worker 종료 전달, 정상 저장과 negative timeout의 독립 제한, profile 저장 실패·중복·ACK 순서를 검사했다. 독립 분석기의 경계 절삭·재귀 중복 제거 검사2개도 통과했다.

## 2. 고정 일정과 비계측 결과

block1: 비계측 RR → RA → AR, 계측 RA.

block2: 비계측 AA → AR → RA, 계측 AR.

총16회 = 비계측12회 + 별도계측4회. warmup/선행 export 실행/compiled module transfer/호스트선별/실제 호출 재시도는 없었다.

| 비계측 인접 쌍 | R | A | A/R | A−R |
|---|---:|---:|---:|---:|
| block1 RA | 5.990초 | 6.007초 | 1.00275 | +16.5ms |
| block1 AR | 5.789초 | 5.775초 | 0.99772 | −13.2ms |
| block2 AR | 5.802초 | 5.780초 | 0.99622 | −21.9ms |
| block2 RA | 5.753초 | 5.693초 | 0.98959 | −59.9ms |

환경 대조 RR의 max/min은1.03139, AA는1.00926이었다. 사전 기준1.10을 넘는 환경 경보는 없었다. 단, 대조2쌍만으로 잡음 분포를 충분히 추정했다고 주장하지 않는다.

큰 차이 기준은 R/A4쌍 중3쌍 이상에서 같은 방향으로20% 이상 및500ms 이상이었다. 해당하는 쌍은0이다. 판정은 **NO_REPEATED_LARGE_DIFFERENCE**다.

비계측 각variant6회 median은R5.795초/A5.734초다. 이는 시간 위치가 다른 대조 호출까지 포함한 기술통계이므로, 인과 비교의 주자료는 위 교차 쌍이다. 약1% 차이에 효과 유의성이나 제품 성능 향상을 부여하지 않는다.

## 3. 주요 실행 비용은 공통 함수359

프로파일은 API 실행 구간으로만 절삭했다. API당5,383–5,450샘플, 실제 샘플 간격 median약1.056ms다. 시간축 구간 가중치가 API 경계를 덮었으며 식별 가능한 WASM self sample은99.94% 이상이었다. 이 시간축 coverage는 샘플 사이의 모든 instruction을 관측했다는 뜻이 아니다.

| 계측 호출 | 함수359 self 비중 | variant 재귀 함수 | 재귀 함수 inclusive 비중 |
|---|---:|---|---:|
| block1 R | 97.240% | 363 | 97.588% |
| block1 A | 97.068% | 380 | 97.512% |
| block2 A | 97.090% | 380 | 97.536% |
| block2 R | 97.222% | 363 | 97.648% |

재귀 경로는 R363/A380으로 달랐지만, 두 경로 모두 공통359를 직접 호출한다. 공통113의 self 비중은약1.87–2.03%이고 재귀 함수 자체의 self는약0.29–0.33%였다. **inclusive와 self를 합산하지 않았으며, 재귀 stack에서 같은 함수 번호가 반복돼도 inclusive에 중복 가산하지 않았다.**

계측 호출에서 core export 외 API 구간은약4–5ms였다. 비용 집중이 JS packing/readback에 있지는 않았다. profiler·컴파일 trace·기존 core facade를 켠 호출이므로, 이 계측 시간을 비계측 시간과 합치거나 계측 overhead의 크기를 추정하는 데 사용하지 않았다.

프로파일의 구간 가중 샘플 비중은 실행 위치 추정이다. 이를 정확한 함수별 CPU 초 또는 향후 최적화로 회수 가능한97% 비용이라고 해석하면 안 된다.

## 4. 함수359의 역할: 정적 소스 대응

추가 solver 호출 없이, 이전 봉인에 포함된 WAT/호출 그래프와 고정 Rust 소스를 대조했다.

함수359는:

1. 세 slice fat pointer와 맞는6개 i32 인자를 받는다.
2. `full & !covered`의 popcount를 합산한다.
3. 후보 coverage vector를 순회하며 `coverage & (full & !covered)`의 popcount를 계산한다.
4. 최대 gain을 취한다.
5. remaining이0이면0, max_gain이0이면−1, 아니면 unsigned 나눗셈과 나머지로 ceil을 계산한다.

이는 `rust/pc-core/src/min_cover.rs:73–88`의 `lower_bound`와 강하게 구조적으로 대응하며, 그 안에 inline된 `uncovered_count`/`gain` 동작과도 일치한다. `BestSetSearch::run`은 이 공통 하한 함수를 호출한다.

바이너리에 Rust debug name이 없으므로 **정적 구조 대응이지 debug-symbol로 증명한 소스 이름은 아니다.** compiler의 inlining도 함수 단위 비용 해석에 포함된다. 대응 근거와 WAT 원문·소스 hash는 `HOTSPOT.json`에 보존했다.

별도 컴파일 로그에서는 네 호출 모두359의 Liftoff와 TurboFan 코드 생성이 있었다. 공통112/113 및 R363/A380에도 양 compiler 생성 기록이 있었다. 이는 코드 생성의 관측이며, 함수359가 API의 어느 순간 어떤 tier로 실행됐는지는 직접 식별하지 못했다.

## 5. 다섯 질문에 대한 답

1. **현재 환경에서 큰 R/A 차이가 재현됐는가?** 아니오. 교차4쌍 모두 사전 큰 차이 기준에 미달했다.
2. **실제 실행 함수와 tier 중 무엇까지 관측했는가?** 함수와 API 구간의 비용 위치까지. 실행 tier는 미확인이다.
3. **비용 집중 경로가 있는가?** 네. 양variant 모두 공통359에약97%의 self sample이 집중됐다. 공통 lower-bound/gain/popcount 경로와 구조적으로 대응한다.
4. **다음 대응은?** 이번 일정은 종료한다. A 전용 trail을 무작정 수정하지 않는다. 별도 승인으로 비용 자체를 더 조사한다면 공통 하한 계산과 코드 생성/CPU 실행 특성을 우선 대상으로 삼는다.
5. **과거 이상치의 미해결 부분은?** 9V45의 빠른R/느린A가 된 실제 tier·CPU·프로세스 상태, 짧은F14 지연의 기전과 비중, 실제 브라우저 수명의 영향이다.

새 Intel 호스트의 결과를 이전 AMD cohort와 합치지 않았다. affinity 또는 CPU 모델이 과거 이상치를 없앴다고 주장하지 않는다. “전부 잡음”이나 “JIT만 원인”이라는 결론도 내리지 않는다.

## 6. 대응 결정과 남은 차단조건

**A0 후보와 제품은 그대로 유지하고 통합 보류를 계속한다.**

- Rust sibling/trail 수정0
- 제품 warmup/eager compilation 추가0
- ID/CPU 예외·state budget 변경·gate 완화0
- 공식232/675 확인 campaign0
- actual primary/PC/native threshold 호출0
- Dev/main/default branch/배포 변경0

기존 reserved p95 실패는 유효하다. `board-111--restricted-split--ordinary`의 독립 optimal-quality/stable-ID exact 증명 공백도 별도 통합 차단조건이다.

추가 Rust 내부 timer, 브라우저 수명, 독립 exact 증명 또는 새 native 실험은 이번 결과로 자동 시작하지 않는다.

## 7. 독립 검산·실패·예산

- 16/16 native 결과를 저장하고 검산했다. 모두 CAPPED100K. timeout/OOM/error/missing/새 하네스 실패0.
- 결정성·seed·weighted quality·coverage·stable-ID·primary proof identity 검산 통과. R/A6쌍 states/quality 회귀0.
- source blob203개, result file28개, raw journal48record, quality+seed32회 독립 재계산.
- native raw append/fsync/ACK 이후 profiler stop/export를 시작하고, profile append/fsync/ACK 이후 결과 검산. 다음 호출은 그 뒤에 시작했다.
- 최초 감사 `ANALYSIS.json`은 유지했다. 이후 합성 구간의 함수 식별·샘플 간격 및 행 상태 일치를 강화 검산한 `ANALYSIS_RECHECK.json`도 같은 판정을 냈다. 분석기 검사2개는 `ANALYSIS_CONTRACTS.json`에 있다. 원로그·native 호출은 수정/재실행하지 않았다.
- 실제 호출은 child3GiB/swap0, calling thread CPU0. 주파수/SMT 경쟁/배경 compiler는 완전 통제하지 않았다.
- 기존04:18:25Z 캠페인 시계 불변. job완료06:51:42Z, 경과153.283분으로 compute160분/전체180분 이내.
- 이번 실행은queue포함2.083분, runner0.03417h. 이전 원인·순서·tier 진단까지 합계0.51222runner-hours로64h 이내.
- 다운로드한 compressed artifact116,865bytes. 원증거와 새 증거를 보존하고 최종 봉인한다.

완료한 것은 진단 일정과 독립 감사다. 원인 전체 해결 또는 제품 성능 gate PASS를 의미하지 않는다.
