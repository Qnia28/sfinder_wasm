# R18: DEV 대 linMax RC2 출시 판단

작성: GPT-6 Astra, 2026-10-13. 자동 통계의 후보 판정이 아닌 저자 검토.

## 근거와 범위

- run `38241601404`, 실행 commit `a1bd0f77c68b28611d9d87c8b00d269a424a95bf`.
- DEV `7ef62d18e1d155b6479e00d651c851ff3baa7112`, RC2 `8b021b465ba91232c3505598add0b697a5b0da96`.
- 승인된 ALL90/per-save40명령, arm당 2회×3바퀴. 총1,560호출/780 동일VM pair.
- 원감사 `triage-independent-RC2_LINMAX_RELEASE_VALIDATION_R18_20261012-FINAL/INDEPENDENT_AUDIT.json`: PASS, EXACT622/TIMEOUT859/OOM79, 오류0.
- `RAW.sqlite` SHA256 `072f990bddcf151857a407ec847d0e2336b0127800df951cfccc0fe05d83da96`.
  원감사 JSON SHA256 `ff5e5cb433a69ab97732fe8e6c82e0fc50bc9c32a94d01a2d42b0e5deb739d69`.
- 상세 수치는 `rc2_facts.py`의 `calls/pairs/inputs`와 `FACTS.json`에 연결한다.
- 5파일 패키지 `benchmark-packages/38241601404-attempt1/PACKAGE.json` SHA256
  `9eefc2ef3ce4b85d4ef8be4e5ddf4752c2d4ec2d48eaa632d78f7f22632131c3`.
  860artifact수집COMPLETE, analysisMaterials AVAILABLE, evidenceValidity PASS,
  executionCompleteness COMPLETE, rawDatabaseParity PASS, 오류0.
  원860artifact복원후 로컬독립재감사도1560call/780pair PASS, 원DB와내용일치PASS.

이 모집단은 CP 영향·장시간·미완료·경계 반례를 강화한 선택집합이다. 전체사용자의 빈도 가중 평균,
전체1,098명령의 재검증, Release3.0 직접 동시대조를 뜻하지 않는다. R17 RC1 비교는 역사적 원인 근거이며
이번 DEV 대조와 합산하지 않는다. R15 원감사FAIL·미완료 재수집은 별도 기록으로 유지한다.

## 완료와 공통완료 시간

| 모집단 | arm별 호출 | EXACT DEV→RC2 | timeout DEV→RC2 | OOM DEV→RC2 | 공통EXACT pair | 공통EXACT 평균초 DEV→RC2 |
|---|---:|---:|---:|---:|---:|---:|
| ALL | 540 | 171→181 | 333→316 | 36→43 | 171 | 177.310→167.110 |
| per-save | 240 | 138→132 | 102→108 | 0→0 | 132 | 331.697→329.151 |

ALL은 DEV가 완료한 모든 pair에서 RC2도 완료했고, 추가10회가 완료됐다. 공통완료 총1,744.141초 절약,
평균5.75% 개선이다. 세 바퀴 각각 공통완료 이득757.777/710.449/275.915초로 방향이 같다.
per-save 공통완료는336.125초 절약(0.77%)이나, QB015의 완료6회를 잃으므로 이것만으로 개선이라고 할 수 없다.
전체 EXACT는309→313으로4회 증가하되 두 모집단의 방향은 다르다.

## 검열을 포함한 손익과 자원비

미완료 `ms=null`을 유지한다. 실제 무기한 완료시간 평균은 식별할 수 없다.
보조 민감도 점수로 EXACT에는 제품시간, timeout/OOM에는 동일600초 실패벌점을 부여한다.
이는 **성공시간 추정치가 아니라 고정 horizon의 실패벌점 점수**다. 특히 빠른 OOM을 이득으로 세지 않는다.

- ALL: 466.148→458.030초, 명령반복당8.118초 개선. 바퀴별8.985/8.196/7.174초 개선.
- per-save: 449.766→451.033초, 1.267초 손해. 바퀴별 이득 -1.560/+0.288/-2.529초.
- 동결된90:40 비율의 참고 합산은5.231초 개선. 모집단별 판정을 대체하지 않는다.
- 명령별6회 평균 점수의 이득/손해/동률은 ALL23/8/59, per-save15/10/15. 양쪽 중앙값0이다.
  이득은 QB041/QB002/QB346 등에 집중되며 보편적인 속도향상으로 표현하지 않는다.
- ALL 평균 CPU는532.973→789.465 CPU초(+48.1%), per-save572.443→711.471(+24.3%).
  ALL 평균 peak는약1082.806→1122.940MiB(+40.13MiB), per-save810.550→813.857MiB.
  동시CP 지속의 자원비를 지불하는 지연시간/완료범위 개선이며 CPU효율 개선은 아니다.

## 구체적 지지 근거와 반례

1. ALL `c7-2plus2-qb-row-002/all/restricted-split`: DEV timeout6/6, RC2 EXACT6/6,
   RC2 330.133–440.400초, 최종 backend 모두 CP. 1바퀴1회 call
   DEV `3dfe1f9396efdd021180b1f93f99bbdae24a60d4bad58f3b662cec9bd924f041`,
   RC2 `17aec731bbb69ebeede3e8f467362c929ad0c3a89705f44e7dc6b0b958c15582`.
2. ALL QB041 restricted-split: DEV EXACT4/timeout2, RC2 EXACT6.
   공통4회에서915.406초 절약. 1바퀴1회444.531→232.959초,
   DEV `5fc21ef8319a1789af369e167bf7331c64e4a24391e564e3e2b0109d77c0d4e5`,
   RC2 `b14745d9eb80067035989218352332067b35556895ba455a49992c115fdef254`.
   DEV 최종Rust→RC2 최종CP 관측은 지속CP 이득과 부합한다. P15·CP기한·복구도 함께 달라
   linMax 한 변경의 단독 인과효과로 귀속하지 않는다.
3. per-save `c7-2plus2-qb-row-015/restricted-split`: DEV EXACT6(401.208–586.537초), RC2 timeout6.
   모든 바퀴·두 arm순서에서 재현되는 강한 반례다. 평균 실패벌점 손해106.705초.
   1바퀴1회 DEV `5aa50a22005654ed36a9060519ba185db173e2cf92bb748a5696c6042ec3a040`,
   RC2 `bba766d4236b0237ed76c2880da999261605e82ceffcee3048c0a7ddd8149286`.
   RC2의 최종response가 없어 어느piece/seed/CP단계가 원인인지 이번 무계측자료로 확정하지 못한다.
4. per-save QB308 restricted-split: 양쪽6회 완료하나 RC2가각회느리며 평균13.583초 손해.
   1바퀴1회485.431→499.072초, DEV `ddab25edbbb303537ac648da55c43cee81a55f39403dae749e870c509bed2fe7`,
   RC2 `77737b66eb046258716428e5bf9a6bfaafe764060b8334a8ff34f40a2dd0d276`.
   최종piece backend가 같아도 수행중CP참여·경합이 같다는 뜻은 아니다.
5. ALL `cycle1-pcinfo-036/all/restricted-split`: DEV timeout6→RC2 OOM6,
   RC2 peak3072MiB. 1바퀴1회 DEV `5e0e6d0d336a5aa1c8124dc717b733bfd8aac517f1a42634051187b3fd75b214`,
   RC2 `5098b7e2823f185385cd022b06ff25df86c717b8cc0966fa1dd8c50e95b7f242`.
   ALL pcinfo033 bag-plus-next-draw도 DEV timeout6→RC2 timeout5/OOM1.
   1바퀴1회 RC2 `06b7a8aca7b1a979afc8ac3cd872150826746c0b3812bb1b967198aaba279fb1`.
   이7회는 명백한 메모리반례다. DEV도600초내미완료였다는 사실이 OOM악화를 무효화하지 않는다.
   r12 종료조사를 재개하거나 이번집계를 그 실험의 추가측정으로 취급하지 않는다.

## 저자 판단

**성능 후보로 RC2를 채택한다.** 사용자의 평균이득 우선 기준, 주모집단ALL에서3바퀴모두의
공통완료시간·완료범위 개선, OOM을600초벌점으로 처리한 뒤에도 남는 순이득을 근거로 한다.
이는 per-save무회귀·OOM개선·CPU절약 판정이 아니다. QB015/QB308/pcinfo036의 반례와 CPU증가를
명시적으로 수용하는 절충이다. 검열뒤의 실제완료시간·실사용입력빈도·장기메모리위험은 미확인이다.

제품은 동결RC2의src/WASM을 그대로 사용하고 exact Human·stable-ID proof, CP무기한,
양방향실패복구를 유지한다. 배포승격은 아래 증거완전성/배포물검증을 마친 뒤 수행한다.
Boolean 대 linMax triage는3.1후 별도질문으로 남긴다. 반례를 없애려는 추가population재실행은 하지 않는다.

## 증거봉인·배포 검증

전체artifact봉인·원장등록 및 로컬독립감사 완료. 별도RC2 추출본에서 Node24.13.0의26검사PASS/5SKIP
(Windows Node JSPI미지원으로CP항목skip), 실제격리Chrome152에서8개의작은CP/WASM brute-force oracle,
65-ID stable tie, adaptive5모드, worker취소·양방향실패복구 PASS를 확인했다.
이는 population benchmark가 아닌 작은제품정확성검사다. `TESTED_RUNTIME.json`의99개src/WASM해시를
최종제품ZIP과대조하는 `tools/package-release.py`로배포물동일성을검사한다.

R18 run 자체예약391시간50분 + 별도contract10분 = 동결392시간이며 실제소비시간과다르다.
이전R16/R17선언93시간을포함한485시간계보를유지한다. 원패키지의실제run별회계는484시간50분으로
별도contract10분을중복합산하지않는다. 호출예약1832는R16/R17/R18계보이며별도R15를포함하지않는다.
