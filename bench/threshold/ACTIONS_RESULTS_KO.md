# Actions 실행 기록

실험 branch: `experiment/threshold-engine-20261003`.
로컬 dev와 GitHub main에는 변경/push/merge하지 않는다.

## 완료

| 단계 | Commit | Run | 결과 |
|---|---|---|---|
| correctness + legacy smoke | 9443742 | [37035292838](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035292838) | 모든 job 성공 |
| DB 2-setup capture smoke | 9443742 | [37035292830](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035292830) | 14/14 K 증명 완료 |
| DB 전체 capture | aa74d5b | [37035704246](https://github.com/Qnia28/sfinder_wasm/actions/runs/37035704246) | 45 setups / 315 필터 모두 PROVED |
| DB 개발12 baseline | 98bfff9 | [37037039327](https://github.com/Qnia28/sfinder_wasm/actions/runs/37037039327) | 실행 중 |

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

DB 개발12의 original↔off baseline을 실행 중이다. 완료 후 개발12 × 단독5요소
screen(3pairs, 20초/call)을 실행하도록 다음 설정을 준비한다.
그 다음 후보 mask 동결 → ablation → confirm 두 번이다.
정확성/증명 불일치는 즉시 중단한다. all-on은 자동 승격하지 않는다.

초기 legacy smoke는 1pair뿐이며 성능 판단용이 아니다. original↔off의
관측 overhead 및 all-on의 입력별 개선/회귀가 있으므로 충분한 반복과
단독 screen 없이 성능 개선을 주장하지 않는다.

DB 개발12 × 32 masks × budget 0/1/20의 실제 WASM bounded witness/prefix 검사도
로컬에서 통과했다. 이후 CI의 correctness gate에 포함한다. 이 검사는 검증8을
검색하지 않으며 성능 측정으로 사용하지 않는다.

## 보호 확인

작업 전/첫 push 후:
- 로컬 dev: `integration/saves-minimal-20261002`, HEAD `c0cb2a048e7275bfea587d176b1954efff0a8a08`, clean.
- 원격 main: `03b637730c5b541f4f2934be613498fbe65327fd`.
- 모든 push refspec: `HEAD:refs/heads/experiment/threshold-engine-20261003`만 사용.
- default branch 변경, PR merge, 원본 dev의 source/WASM/Git metadata 수정 없음.
