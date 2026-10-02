# C6 — compact CP 초기 진입 + Rust 지속

개발 후보 하나를 동결해 비교한다. 제품 미채택.

**최종상태:**개발80/새mirror50/비용진단24시도감사완료,C6승격보류.
새QB157독립S에서C3보다평균3.859초단축했지만빠른QB266제한I는단독대비최악
4.172배/+8.780ms회귀했다. 비용진단은upfrontprofile과worker회수양쪽추가비용을확인했다.
profile-only는의도적CP생성억제ablation이며정책후보가아니다.
세새그룹5비자명행렬만검증했고비자명bag/새큰모델근거는없다.
[캠페인 최종결과](../../tools/validation/secondary-upfront-20260928/CAMPAIGN_RESULT_KO.md).

개발 비교 완료:80시도76EXACT/2TIMEOUT/2INCOMPLETE,C6자체20/20EXACT.
QB235 C3대비평균4.159초개선했지만빠른pcinfo018은단독threshold대비3.472배/+0.212초.
394파일/76해답/26관측/18CPdispatch감사. 조건변경없이새QB266/277/157그룹검증을진행한다.
[개발 결과](../../tools/validation/secondary-upfront-20260928/RESULT_KO.md).

- trivial proof 우선.
- 후보변수 자체가4,096 초과면 upfront profile 없이 C3.
- 그 이하는 기존 CP 모델 추정으로≤4,096일 때 CP1을 primary seed/빈 prefix로 먼저 시작.
- Rust integrated100K/F1연장→threshold는 유지한다. 늦은 CP 중복 시작은 막는다.
- 큰 모델은 기존 C2 상태 gate를 유지하며, CP 실패 시 Rust가 계속한다.
- upfront profile/동시실행 비용과 빠른 Rust 경로의 손실도 포함해 비교한다.

8개 노출 개발입력의 무제한2회와 QB2입력 P코어 진단2회, 총80jobs.
새 cutoff 학습 없이 기존4,096을 재사용한다. 두 관측·미완료·최악 지연을 보존한다.
한시간 캠페인(21:06~22:06KST) 안에서 감사 후 다음 독립 검증 여부를 판단한다.

[설계](../../tools/validation/secondary-upfront-20260928/DESIGN_KO.md)
[현재 상태](../../tools/validation/secondary-upfront-20260928/CURRENT.md)
