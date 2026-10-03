# Cycle7 QB independent100 캠페인 (측정 전 고정)

- DB: `cycle-7-2plus2-qb-setups.json`,356 reviewed/runtimeEligible physical rows.
- policy: 동일 디렉터리 `cycle-7-2plus2-qb-policy.json`의 실행 조건/2+2 구성. 원본 두 파일은 읽기만 수행.
- `qb-setups.json`에 원본 SHA256,policy SHA256,seed1900027942,100개 무복원 무작위 setup,각각 무작위 필터7개 우선순위 보존. 미러 그룹87개. 시간/최적화 효과/최적 K/생성 성공 여부로 setup을 교체하지 않음.
- 초기 HOLD T,현재 bag 잔여5개 순열120개,다음 bag 첫1개7종 =840큐. 가상 선행 T+empty HOLD와 실제 HOLD T의6미노 배치 순서 집합(동일 공급의 잔여 save 미노도 동일)이 모든15개 prefix×120순열×7 tail=12,600조건에서 동일함을 독립 공급 시뮬레이터로 검사.
- presampled 필터 중 첫 nonempty 하나만 행렬/K증명. 빈 필터만 건너뛰고,K증명 실패 시 다른 필터를 선택하지 않음. 이는 nonempty 필터 중 균일 랜덤 선택. 생성 실패는100개 중 결측 슬롯으로 보고.
- 원본 pinned baseline WASM에서 열거,HiGHS/kernel로 cardinality K를 증명. 원래stable ID/원본 행/quality/feasible seed 보존. frozen root campaign과 engine WASM/Rust/product JS 소스 동일성 검사.
- 같은 experimental WASM의mask0↔20(합산 효과),mask16↔20(rootForced 증분 효과),각3쌍,호출당300초,동일VM에서fresh process로직렬비교,순서회전/ABBA. 최대동시shard10. 정확성 실패나unexpected error는benchmark에 들어가기 전에 차단.
- 양측각2회solver TIMEOUT이고어느쪽에도EXACT가없는비교만조기종료. 미실행호출은TIMEOUT이아님.
- 최초3쌍에서material회귀(≥10%+≥5ms,side또는paired중앙값),완료/timeout차이,ON메모리>20%,긴입력(OFF≥60초)에서≥100ms증가+≥2/3느림,큰개선(OFF≥1초,ratio≥1.5)인입력을자동선정. range-noise만으로재측정하지않음.
- 선정입력은동일frozen행렬/바이너리로각비교10개새쌍재확인. 최초3쌍과합산하지않음. 재확인material회귀는≥10%+≥5ms와≥8/10느림으로분류하되완료차이/메모리경보는별도보고. 필요하면사후결정에직접영향을주는입력만추가확인.
- 기본deadline80분/shard,10쌍재확인244분/shard로setup/검사/cleanup/전송여유포함. 전체시간상한없음. `.github/workflows/threshold-qb.yml`에서생성→검사→측정→독립witness감사→재확인→보고연결.
- 결과는cycle1과분리. 원본DBphysicalrow100개가독립board100개라는뜻은아님. 제품라우팅/CP선택/기본옵션/통합및main/dev-branch변경없음.
