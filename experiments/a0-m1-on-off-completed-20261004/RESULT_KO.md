# ON/OFF 한정 실행 종료: timeout 후 계속, 시간 예산 내 부분 결과

[Actions37181392879](https://github.com/Qnia28/sfinder_wasm/actions/runs/37181392879)의preflight와10jobs가모두success로종료했다. 이는timeout으로job을실패시키지않았다는뜻이며**100쌍계획완료/성능PASS는아니다**. 모든job은`PAIR_ADMISSION_DEADLINE`에서`BUDGET_EXHAUSTED_WITH_PARTIAL_RESULTS`로정상정지했다.

## 결과

|항목|결과|
|---|---:|
|시도한정상일정요청|4,774|
|원입력·K·weightedquality·stableID검산통과|4,538|
|timeout(API210초)|236|
|미시도요청|19,706|
|도달한입력|122/122|
|완성된정상ON/OFF인접쌍|2,229|
|timeout을포함한censored쌍|118|
|100쌍을채운입력|0|

R과ON각각**검증2,269·timeout118**이다. timeout입력을제외/재시도/EXACT로승격하지않고그다음고정요청을계속했다. 130개기처리요청(검증120+timeout10)을원값그대로재사용했고새로실행한것은4,644개다. 교정전잘못된10환경요청까지포함한실제총요청은4,784개다. OOM·정확성·입력hash·프로토콜등무결성실패0.

최초origin05:03:42Z부터마지막job07:38:45Z까지**155.05분**,세번의Actionsattempt누적**17.112778runner-hours**. 최초clock/100K/210초/3GiB-swap0/Nodeflags를늘리거나리셋하지않았다. 정상캠페인계획24,480요청중19,706개는시간상한의보수적pair입장guard때문에미실행이다. 더실행하지않는다.

## 관측과 판정

양쪽이정상완료한finitepair가있는116입력중**ON이빠른중앙값17개·느린99개**. 입력별paired전체요청비율의중앙값은**1.015447470660908**(ON약1.54%느림)이다. 완료조건부부분표본의기술통계이며,timeout236건/미시도19,706건을유한시간으로바꾸거나전체사용빈도가중응답시간으로해석하지않는다. 개별10%악화자동veto나새5%gate는없다.

재개VM은새physicalepisode이므로같은logicalrunnerID를지속host로주장하지않았다. episode를가로지르는타이밍인접쌍은합성하지않았고,이전환경controls를새VM환경의증거로전용하지않았다(114입력missingEnvironment). Node기본flags에서는ORTools/JSPI지원false,CPlatehelper실행이아닌기존fallback이다. 단일unusedfilter의제품열거/primary/선택probe/threshold/출력경로를측정했으며GUI/warmWorker/seven-filter UI/브라우저CP성능증거가아니다.

**판정: 선택가능한A0+M1구현은유지하고기본값R을유지한다.** 이번부분/censored증거만으로기본값승격을권하지않으며,전체성능PASS나후보의확정적실패도선언하지않는다. Dev/mainmerge·배포·추가자동캠페인없음.

## 검산·상태

원결과파일inventory·source/runtime/inputlock·원weightedrows/K/stableIDs·기처리prefix·timeoutchild수거/cgroup·23,398rawrecords검산통과. 검산nativecalls0. [요약](SUMMARY.json),[입력별표](BY_INPUT.csv),[전체독립audit](github-run-37181392879/AUDIT.json).

외부watcher는시작됐지만이번확인시활성process/최종closure영수증이없어완료후artifact를수동으로다운로드했다. 외부cancel이실제로작동했다고주장하지않는다. 실제모든job이07:38:45Z이전에종료하고원origin을적용한runner입장guard로멈췄음은GitHubAPI와artifact에서별도검산했다. 현재실행job/watcher0. 이전실패기록을추가봉인/출판하지않고완료된부분결과만정리했다.
