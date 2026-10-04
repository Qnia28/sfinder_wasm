# ON/OFF 중단: 벤치 입력 변환 오류, 성능 판정 불가

[Actions37178792683](https://github.com/Qnia28/sfinder_wasm/actions/runs/37178792683)는2026-10-04T05:03:42Z에시작해05:06:31Z에실패완료했다. wall169초/0.102778runner-hours. watcher·child모두종료했고11개artifact를다운로드/검산했다. 자동재실행하지않았다.

## 확인된 원인

**준비한하네스의제가작성한필터변환이잘못됐다.** 원capture는`unusedPiecePrepared(queueCounts,usage)`로queue에서실제사용하지않은한조각을분류한다. 그런데`prepare.py`는이를`calculateSaveMinimals(wantedSave:'T')`로옮겼다. 이API의`savedMultiplicityCodePrepared`는마지막bag에서**아직뽑지않은조각도save에포함**한다. 합법적서로다른제품기능이며제품버그나M1오류로단정할수없다.

첫환경입력`board-075--restricted-split--T`가모든runner에서원자료 **K31/weighted1,580행**과달리 **K35/3,668행**으로재생성됐다. 원정규hash bcf29023…/재생성3e056953…도다르다. 단순caseID/hash정규화문제가아니다. 검산gate가다른문제의타이밍을동일입력으로집계하지않도록정상차단했다.

작은합성예시queue`IJLIJLS`에서실제unused는L이지만마지막bag미인출분을포함한save는TLZO라서`wantedSave:T`도매칭한다. [native호출0의증명](SYNTHETIC_FILTER_DIAGNOSTIC.json)과[source진단snapshot](SOURCE_DIAGNOSTIC/)을보존했다.

## 실행 및 독립 검산

- LinuxR/M1원bytehash,기존R/batchsource비교,새Rustdebug29/release29tests,제품회귀,하네스durability/watchdog,cgroup,source/inputinventory **preflight통과**.
- sourceblob607개와10runner의동일lock,실제artifactbinaryhash,각runner파일inventory전체hash검산통과. [독립AUDIT](AUDIT.json).
- 실제제품요청 **10개**,모두첫환경대조 **OFF(R)**. PC열거/primary10requests,R100K probe10calls,CAPPED후실제threshold10calls. **후보M1probe0/선택입력비교0/완성ON/OFF인접쌍0**.
- 원입력검산VERIFIED0,ERROR_CHILD10. 각요청의phase-start/probe-start/probe-result/phase-result원기록총40개보존. 실패한raw를삭제하거나유리한host로대체하지않았다.
- OOM/timeout0,3GiB/swap0강제확인,모든실패childdescendant2초이내수거.
- 준비봉인182파일재검증불변. 원capture/과거봉인/원K·seed·timing교체없음. Dev/main/Rdefault/배포불변.

## 판정·후속

**성능PASS/FAIL모두판정불가**다. M1은한번도실행되지않아후보회귀나효과를판정할증거가없다. 첫OFF요청의11초수준값도원K31문제의측정치로전용하면안된다.

준비단계의「특이사항없음·실행준비완료」평가는이제이결과로대체된다. offline검사는queue포함/보드동등성만확인하고unused-versus-bag-save필터의완전동등성은확인하지못했다. 합성fullrequestfixture의ON/OFF동등성도원capture동등성까지증명하지못했다.

다음에는**원capture의실제unused필터와동등한제품경로를먼저명시하고검증**해야한다. fullbagSaved와queueUnused를같다고보거나Kproof/matrixgate를끄고실행을계속하는것은금지한다. per-save제품API는기본적으로여러filter를푸므로한filter일정에그대로치환해추가검색을숨길수도없다. 제품Worker입력경계부터비교할지,원입력전체제품요청대상/일정을다시설계할지범위를정한뒤별도명시승인으로진행한다. 현재는**중단**,자동두번째캠페인/검색예산확대/default승격/merge/배포없음. 원campaignorigin/소모budget는[LAUNCH.json](LAUNCH.json)과[AUDIT](AUDIT.json)에그대로남긴다.
