# Actions 실행 기록

실험 branch: `experiment/threshold-engine-20261003`.
로컬 dev와 GitHub main에는 변경/push/merge하지 않는다.

## 완료

| 단계 | Commit | Run | 결과 |
|---|---|---|---|
| correctness + legacy smoke | 9443742 | [37035292838](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035292838) | 모든 job 성공 |
| DB 2-setup capture smoke | 9443742 | [37035292830](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035292830) | 14/14 K 증명 완료 |
| DB 전체 capture | aa74d5b | [37035704246](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035704246) | 45 setups / 315 필터 모두 PROVED |
| DB 개발12 baseline | 98bfff9 | [37037039327](https://github.com/Qnia28/sfinder_wasm/actions/runs/37037039327) | 모든 job 성공; 6입력 양측3회 exact, 6입력 양측3회 timeout |
| DB 개발12 five-single screen | 988fa59 | [37038377376](https://github.com/Qnia28/sfinder_wasm/actions/runs/37038377376) | 모든 job 성공; 180 exact / 180 timeout; 완료 witness 일치 |
| DB 개발12 mask18 ablation | 96ee4b1 | [37042810532](https://github.com/Qnia28/sfinder_wasm/actions/runs/37042810532) | 모든 job 성공; 108 exact / 108 timeout; 완료 witness 일치 |
| DB 전체20 mask16 confirm 제1회 | ac54ba6 | [37046842107 attempt1](https://github.com/Qnia28/sfinder_wasm/actions/runs/37046842107/attempts/1) | 모든 job 성공; 110 exact / 90 timeout; 완료 witness 일치 |
| DB 전체20 mask16 confirm 제2회 | ac54ba6 | [37046842107 attempt2](https://github.com/Qnia28/sfinder_wasm/actions/runs/37046842107/attempts/2) | 모든 job 성공; 110 exact / 90 timeout; 실행 간 witness 일치 |

원본 DB SHA256:
`58f02fe2e1f7939e127de4c7ea2886bcf45c91a797ffa0d25dc8a0e4fb262388`.

전체 capture artifact를 내려받아 원본/압축 SHA256, K/seed, fumen/패턴,
capture run/attempt/build 일치를 검산했다. 전부 증명 완료하여 input-censoring은 없었다.
원시 생성자료는 해당 capture run artifact(30일)에 있으며, 대표20개는
`cycle1/inputs/`와 `cycle1/manifest.json`에 고정했다.

## 입력 선택

- 검증8 보드 그룹은 aa74d5b의 selection-policy에 후보 timing 전에 고정.
- 8개 모두 기존 historical capture groups에 없음.
- 개발12는 검증그룹을 제외하고 24/12/16칸 유형을 순회하여 선정.
- 각 보드 그룹에서 structural rank: K-F, 품질 단계 수, 후보 수, 행 수, ID 순.
- 개발/검증 보드·좌우반전 중복 없음. 20개 입력 모두 hash/seed 검산 통과.
- 검증8에는 16칸4개, 12칸3개, 24칸1개; 개발12에는 24칸1개, 12칸6개, 16칸5개.
- 기존 legacy20은 별도 stress 군이며 cycle1군과 합산하지 않는다.

## 진행

baseline → screen → ablation → confirm 두 차례의 캠페인을 완료했다.
두 확인 실행은 동일 commit ac54ba6, mask16, 입력20, 5pairs, 60초 제한이다.
검증군 결과에 맞춘 튜닝은 없었다. 최종 결과와 한계는
[FINAL_REPORT_KO.md](FINAL_REPORT_KO.md)에 기록했다. 제품 통합은 수행하지 않는다.
정확성/증명 불일치는 즉시 중단한다. all-on은 자동 승격하지 않는다.

초기 legacy smoke는 1pair뿐이며 성능 판단용이 아니다. original↔off의
관측 overhead 및 all-on의 입력별 개선/회귀가 있으므로 충분한 반복과
단독 screen 없이 성능 개선을 주장하지 않는다.

DB 개발12 × 32 masks × budget 0/1/20의 실제 WASM bounded witness/prefix 검사도
로컬에서 통과했다. 이후 CI의 correctness gate에 포함한다. 이 검사는 검증8을
검색하지 않으며 성능 측정으로 사용하지 않는다.

### S0 baseline 결과

- 72호출: 36 EXACT, 36 TIMEOUT. 오류/정답불일치/누락 없음.
- EXACT 양측: 6p-pco-a/O, alt-jaws-a/Z, alt-shoes-a/Z, hills-a/O, pcinfo-015/Z, pcinfo-022/J.
- TIMEOUT 양측: pcinfo-030/O, 035/Z, 036/O, 039/S, 040/Z, 041/Z.
- 완료6입력의 paired median ratio 기하평균(original/off): 1.0415.
- 각 입력 original→off ratio: 0.9111, 1.0322, 1.2218, 0.9885, 1.1317, 0.9930.
- 10%이면서5ms 이상 악화, exact→timeout, 20% 이상 메모리 증가 경보 없음.
- 이것은 baseline 비용 비교다. 실험 요소의 개선 근거가 아니며, timeout 입력의
  속도는 관측하지 못했다. 짧은 호출의 잡음과 컴파일/code-layout 차이도 고려해야 한다.
- full summary/evaluation/raw/witness/build artifact는 run 37037039327에 보존된다.

### S1 screen 결과

360호출: 180 EXACT, 180 TIMEOUT. 원시samples 개수와 witness를 로컬에서 재검산했다.
각 단독요소 모두 완료6입력/미완료6입력이며 새로운 exact 완료 증가는 없었다.
currentPropagation은 pcinfo-022/J에서1.6041배, priorPropagation은 ALT JAWS/Z에서
0.8071배다. 후보판정/한계와 S2 비교는 [CANDIDATE_KO.md](CANDIDATE_KO.md)에 고정했다.

### S2 ablation 결과

216호출:108 EXACT,108 TIMEOUT. 세비교 모두완료6입력/미완료6입력.
off→18=1.0885, 16→18=1.0149, 2→18=1.0862 (완료입력 paired ratio 기술통계).
pcinfo-022/J에서 off→18=1.6544, 2→18=1.6479로 current전파의 기여를 확인.
presort제거의 조합내기여는작아 최종확인 후보를mask16으로단순화했다.
정답오류, exact→timeout, 회귀/메모리경보는없었다. 최종채택은미정이다.

### S3 confirm 제1회 결과

200호출:110 EXACT,90 TIMEOUT. Raw/witness를다운로드해완료110개원본검산통과.
완료입력11개는양쪽모두5/5exact, 미완료9개는양쪽모두5/5timeout이다.

| 군 | 입력수 | 양측완료입력 | 완료입력 paired ratio 기하평균 |
|---|---:|---:|---:|
| 개발 | 12 | 6 | 1.151 |
| 검증 | 8 | 5 | 1.195 |

pcinfo-022/J(original→16)=1.6384, elephant/O=1.2447, grace-system/O=1.5981.
10%/5ms회귀, exact→timeout, 20%메모리증가경보없음. 후보only완료없음.
20초/30초때보다시간한도를60초로늘려도개발timeout6개는미완료다.
검증pcinfo031/Z,032/O,033/O도양쪽timeout이어서이9입력의성능비는알수없다.
완료입력기하평균은전체20입력의속도개선을증명하지않으며, 짧은grace/O의
큰비율은절대시간과잡음도같이봐야한다. 제2회로효과재현성을확인한다.

### S3 confirm 제2회 및 최종 감사

200호출:110 EXACT/90 TIMEOUT으로 제1회와 동일하다.
완료군 paired ratio 기하평균: 개발1.168배, 검증1.112배.
pcinfo022/J=1.6291, ELEPHANT/O=1.2773으로 핵심 개선이 재현됐다.
회귀/완료율악화/메모리증가 경보는 없으나 9개 양측timeout 입력은 여전히 미확인이다.
두 실행 source/WASM/manifest hash가 동일하며, 400sample/220exact witness 검산 통과.
감사 스크립트와 장기 보존용 축약 raw/요약은 archive-confirmation.mjs 및
reports/confirmation.json에 저장했다. currentPropagation만 후속 통합 검토 대상으로
권장하되 main/dev 통합이나 제품 기본값 변경은 하지 않았다.

## 보호 확인

작업 전/첫 push 후:
- 로컬 dev: `integration/saves-minimal-20261002`, HEAD `c0cb2a048e7275bfea587d176b1954efff0a8a08`, clean.
- 원격 main: `03b637730c5b541f4f2934be613498fbe65327fd`.
- 모든 push refspec: `HEAD:refs/heads/experiment/threshold-engine-20261003`만 사용.
- default branch 변경, PR merge, 원본 dev의 source/WASM/Git metadata 수정 없음.
