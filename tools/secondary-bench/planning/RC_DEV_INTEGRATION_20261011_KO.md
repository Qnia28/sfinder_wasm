# P15 RC / 원래 dev 제품 통합 비교

## 질문과 승인

정책 개선 턴의 최종 제품 RC가 원래 dev보다 실제 명령 전체의 시간·완료범위·자원에서 유리하고 exact Human 품질을 보존하는가?

- RC 제품 commit: `2c406b98cadc186bfaf4490f4b8568535a60ea01`.
- 원래 dev: `7ef62d18e1d155b6479e00d651c851ff3baa7112`.
- 사용자 승인: 전수, 16VM, 2회×3바퀴 기본 + 재검증 2회×2바퀴. 너무 오래 걸리면 반복 도중 중단 가능. 최소 첫 바퀴 전수 우선.
- 사전 smoke/canary/calibration/CP synthetic 추가 없음. 원증거·입력·해시·호출·격리·weighted witness·일정의 정식 감사는 수행한다.

## 모집단과 분모

기초 DB의 minimals ALL548명령, per-save550명령 전수. per-save548명령에는3348개 비어있지 않은 저장 조각 fixture가 있고 2명령은 전부 빈 결과다. 기존 per-save fixture 개수와 제품 명령 개수를 혼동하지 않는다.

원 fumen/family/pattern/hold=true/clear4/N+1 유지. minimals는 ALL 저장식, per-save는 전체 저장 조각을 반환하는 제품 명령이다. 원래 fixture의 secondary부터 시작하는 측정과 구분한다. primary·enumeration·WASM 초기화·worker 전달·제품 결과 생성이 측정범위다. 브라우저 UI 렌더링/네트워크는 포함하지 않는다.

## 반복·중단·선정

각 바퀴에서 전입력 각버전2회, 인접 paired AB/BA 순서반전. 첫 바퀴 전수 완료 후 다음 바퀴로 진행한다. 초기3바퀴=각버전6회. 반복/바퀴/runner identity를 각각 보존한다.

기본3바퀴 종료시 한 번만 선정: ALL/per-save 각각 입력별 공통exact 시간차 및 상대비율 상하위ceil(10%), arm 시간 또는 paired ratio 반복 max/min>1.1, 상태변동/양arm완료차이의 합집합. 기존 P15 반례와 긴ALL 메모리증가 입력의 명령도 필수확인 집합에 포함한다. 선정대상 추가2바퀴=각버전4회, 재귀선정 없음.

사용자 중단 시 완료된 바퀴 및 불완전 바퀴 원증거를 함께 수집한다. 기본3바퀴 미완료를 완료로 표시하지 않으며 선정확인으로 혼합하지 않는다. 정상 회수 OOM 뒤 동일worker/input/arm skip은 검열로 기록하고 그 자체로 workflow실패 처리하지 않는다.

## 자원과 예산

16VM 동시상한. 각 명령 외부600초, 3GiB/swap0. 제품 내부CP deadline은각버전원설정이며외부제한과구별한다. secondary각1thread,primary는원제품backend설정. 버전별원소스/wasm을분리하고동일입력/실행환경으로비교한다.

첫바퀴4,392호출, 기본13,176호출, 전원선정시21,960호출. 사전solver호출0. 신규21일 실행기한은 이번 제품 통합 비교 승인 범위이며 기존 턴 origin/end/caps를 소급 수정하지 않는다. 기존 누적 원장과 새 승인 사건을 연결한다. runner-hour 상한은 공통packTasks 편성의 job timeout예약과 제어job예약을 합해 동결한다. 측정기한 및 예약상한을 초과하면 신규입장을 중지한다.

## 판정·인계

정확성/증거 유효성,실행완전성,제품성능 판단은 분리한다. 공통exact 시간,전체완료율,검열,절대·상대손해,CPU/peak를 함께 해석한다. 초기전수와선정확인 별도분모. 입력/command/mirror군집과family층화 유지. 개별반례는자동거부가아니며평균순이득과손해규모를저자가판정한다.

RC 소스·실행자산·변경목록·license·해시·복원/서빙안내를봉인한다. 실행manifest/source/입력및launch를원장등록하고원5파일증거·분석DB/표·저자분석을portable인계한다. 정식출시/main병합은이비교의판단후결정한다.
