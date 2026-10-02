# Campaign A — primary-only matrix capture (2026-10-02)

## 승인된 범위

사용자 승인: cycle1 전수, QB 무작위 개발64/예약16 반전 그룹. GitHub Actions의 표준 무료 public Linux runner를 최대16개 병렬 사용한다. 캠페인 A를 먼저 완료하며 성능 비교 계획은 실제 저장 행렬의 규모를 확인한 뒤 별도로 세운다.

별도 clone/branch `experiment/integrated-capture-20261002`만 사용한다. 제품 기준은 `c0cb2a048e7275bfea587d176b1954efff0a8a08`이다. main/default branch 수정, merge, 배포는 금지한다. 제품 source/WASM 변경은 없고 실험 runner와 CI 내부의 재빌드 산출물만 작성한다.

## 데이터/표본

- `inputs/cycle1.json`: 사용자가 지정한 cycle1 DB 원bytes. 45개 레코드,42 geometry,41반전그룹.
- `inputs/qb.json`: QB DB 원bytes.356레코드,269geometry,238반전그룹.
- seed=`integrated-20261002-v1`. 그룹을SHA256으로무작위순열화하여첫64개를development로선택한다. 나머지에서cycle1반전그룹과겹치지않는첫16개를reserved-validation으로선택한다. 대표레코드도독립hash로선택한다. 개발64는전체그룹균등표본,예약16은development/cycle1비중복모집단의표본이다. 성능결과로선택하지않는다.
- cycle1은모든45레코드를포함하되동일geometry의준비계산은재사용하고aliases를보존한다. partition 경계는합치지않는다.
- 예약16개는secondary를실행하지않는다. 과거노출감사는아직미완료이므로**freshholdout으로인증하지않는다**. cycle1과반전그룹이겹치는지도selection에표시한다.
- 준비초안은예약2그룹이cycle1과반전중복인것을확인하여solver실행전에위제약을명시하고다시선정했다. 최초selection/inventory도attempt01파일로보존한다. 로컬npm.ps1은ExecutionPolicy로실패하여npm.cmd를사용했으며시스템정책변경은없다.

## 큐/행렬

hold=true,targetLines=4. 길이7:bag `*!`,split `[IJL]p3,*p4`;길이8:bag `*p7,T`,split `[IJL]p3,*p5`;길이5:bag `*p5`,split `[IJL]p3,*p2`.
BOX2개의bag는제외하고split은처리한다. 제한split을fullindependent로주장하지않는다. literalbank·176,400큐fullsplit은이번범위밖이다.
각board의familyqueues를한번에열거하고family별ordinary+7savedpiece행렬을각자primary문제로처리한다. 중복원행·큐순서·quality보존,고유candidatekey를codepoint정렬한다. 품질값을평가하거나coverage행을secondary용으로kernel축소하지않는다.

## 계산/증명

PC후보열거→원행렬구성→primarykernel→최소K/feasibleseed증명→행렬저장. **secondary탐색0회,성능측정0회**. JSquality API와WASMqualityexports를runtimeguard로차단한다. Cardinality-only export와kernel은허용한다.
primary=auto,Node24.13.0의JSPI옵션없는환경을고정하여ortoolsAvailable=false다. 제품selector가kernel/Rust/HiGHS를선택한다. 기존A0capture환경과같은availability이며제품정책을바꾸지않는다. HiGHS는standardproof,mip_rel_gap0,random_seed0,threads1,time_limit60초. Optimal만받는다.
primarybackend/proof/kernelstats/primaryHard/seed와원행coverage독립검산을저장한다. tiny/trivial도active+proven이면행렬보존. 미완료primary의raw행렬도보존하되K증명으로인정하지않는다.

## 병렬/실패

16shards를동일buildartifact로실행한다. 서로다른board작업을분배하여VM내에서는child를순차종료/회수한다. enum180초,primary90초(HiGHS내부60초),kill/reap5초. setup별난이도가달라분할시간은균일하지않을수있다.
TIMEOUT/UNPROVEN/ERROR는그대로보존하며자동재추출/쉬운입력대체없음. Hardkill된primaryincumbent는null이다. secondary를돌린것처럼기록하지않는다. 준비시간은운영로그용이며엔진성능결론에쓰지않는다.
build25분+16capture각30분+aggregate10분이job상한이다. 실제완료보장은아니며미완료/회수실패를숨기지않는다.

## 보존

1일retention의artifact18개(build+16shards+summary)를완료직후로컬에다운로드한다. 모든파일hash·原row/seed·classification·입력누락·고유matrixidentity를독립재검사한다. payload size는실제확인하고보존예산초과가발생하면추가공개upload없이로컬보관범위를확인한다. 유일한실패를삭제하지않는다.
raw와provenmatrix는동일rows/key순서를유지하고전자는primary재개증거다. 원DB·selectedaliases·source/build/runnerhash·stdout/stderr·enum/primaryoutcome보존.

다음캠페인의N은선별결과에서확정한다. 95개기존입력이나2280회측정을이번에자동실행하지않는다.

## 실행 복구 이력

첫run36997921803/commit470ad28은16개VM의계산이끝났으나artifactglob이숨김`.capture`디렉터리를제외하여모든shardpayload업로드에실패했다. 빌드artifact/summary/전체Actions로그는로컬보존했다. VM의행렬파일은회수할수없어완료로인정하지않는다. `include-hidden-files:true`만추가하여새attempt로복구한다. 표본·큐·source·solver·budget·capture하네스는동일하며재생성필요성은보존실패이다. 최초관측을지우거나성공으로대체하지않는다.
