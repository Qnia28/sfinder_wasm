# 제품 ON/OFF 종료 — 입력 변환 오류로 중단

**최신결과:** [실패원인·독립검산·판정](RESULT_KO.md). preflight통과후첫환경OFF(R)요청10개가원captureunused필터와fullbagSaved표현식의잘못된변환에서중단됐다. K31/1,580행→K35/3,668행으로문제가달라짐. M1호출0/완성비교쌍0,성능판정불가. 모든artifact/partial보존·자동재실행없음. 아래는launch당시이력이다.

사용자의명시적「실행하라」승인후고정launch만추가한commit `03ef21d61bb1dcbe2d68e54018ba64c12960b04b`를push했다.

- [Actions37178792683](https://github.com/Qnia28/sfinder_wasm/actions/runs/37178792683),최초origin `2026-10-04T05:03:42Z`.
- Linux빌드/hash·Rust정확성·제품회귀·cgroup/독립watchdog·입력lockpreflight필수.통과후10runner·122입력100쌍·24,480requests.
- 외부watcher실행,최초origin+175분cancel/3h상한. download와실패log/partial모두보존한다.
- 준비/이전봉인증거는불변. Rdefault/Dev/main/배포불변.자동두번째캠페인이나검색예산증액없음.

완료후artifact검산결과는[AUDIT.json](AUDIT.json)에기록했다. 성능/정확성PASS나actual전체호출완료를주장하지않는다. origin및deadline은[LAUNCH.json](LAUNCH.json).
