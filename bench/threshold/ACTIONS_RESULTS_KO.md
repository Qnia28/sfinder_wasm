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

DB 개발12의 baseline/screen/ablation이 완료되었다. 최종 확인 후보mask16을
동결하고 개발12+검증8의 confirm(5pairs, 60초/call)을 다음 실행으로 지정한다.
그 다음 동일후보 confirm 제2회 → 최종보고다.
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

## 보호 확인

작업 전/첫 push 후:
- 로컬 dev: `integration/saves-minimal-20261002`, HEAD `c0cb2a048e7275bfea587d176b1954efff0a8a08`, clean.
- 원격 main: `03b637730c5b541f4f2934be613498fbe65327fd`.
- 모든 push refspec: `HEAD:refs/heads/experiment/threshold-engine-20261003`만 사용.
- default branch 변경, PR merge, 원본 dev의 source/WASM/Git metadata 수정 없음.
