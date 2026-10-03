# rootForced 반복 확인 — 사용자 요청에 따른 동결 계획

신규데이터없이기존100ID/99핵심행렬/41mirror그룹을유지한다.
기존rootForced(mask4)만확인하며보완32/64는OFF다.

- 주비교mask16→20: currentPropagation에rootForced를추가하는효과.
- 100개모두5paired repeats,최대1000호출.각side5회,fresh process,같은VM직렬ABBA.
- 호출당300초,동시Actions shard최대8. per-input job100개를대기열에서실행하며
  동시에점유하는benchmark VM은8개를넘지않는다. workflow strategy도hard cap8이다.
- 각입력/비교에서양측2회timeout이며EXACT가없으면남은3쌍은미실행으로별도기록.
  어느쪽이든EXACT가1번이라도관측되면5쌍끝까지수행한다.최악job deadline65분유지.
- 재빌드WASM bytes/Rust/제품JS는screening report와동일해야만실행한다.
- 기존1pair screening과새5pair확인비율은합산하지않는다.회귀경보4개모두추적한다.
- 특이사항없으면5회결과로보고서를완성한다.반복에서확인된회귀/완료차이/
  메모리경보처럼판단에영향을주는특이사항은선정입력만추가10회확인할수있다.
  단순range≥10%만으로자동으로대규모재테스트를시작하지않는다.
- 현재cycle1의재현성만판단한다.독립데이터검증/제품통합/기본값변경은범위밖이다.

보고내용: exact/timeout/미실행분리,완료군paired-median/절대ms/방향일관성,
기존회귀재현여부,새회귀,범위기반편차,메모리,1000-state trace와시간근거구분,
rootForced의B유지/조건부A/C판정과제품전체로일반화할수없는한계.

## 완료 결과

run37133721660/commit304b9a7은success.실제동시측정최대8shard,측정구간99.4분,
workflow104.9분,가장긴job40.7분이었다.실제880호출(EXACT800/TIMEOUT80),
20입력조기종료에따른120호출은미실행으로기록했다.완료80에서65향상/15악화,
1.056배.기존회귀4개미재현,새material회귀/완료차이/메모리경보없음이라추가10회없음.
cycle1기준조건부A로평가하지만독립데이터검증/제품통합은하지않았다.
ROOT_FORCED_REPEAT_REPORT_KO.md와reports/root-repeat-review.json참고.
