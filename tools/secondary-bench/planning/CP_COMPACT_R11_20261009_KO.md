# CP compact Boolean OR 후속 r11

## 질문·근거·승인

사용자의 “이어서 작업”은 직전 진단에서 식별한 CP 모델 메모리 개선을 구현·검증하는 지시로 해석한다. r10 run37886233804의 대표4입력/8호출은 OOM5/timeout2/exact1, 증거감사PASS다. source PACKAGE SHA256은 `7b9e20ae0019273f53b94416cce7f9abf3b9d1239437064c704fd6d6fb19e29d`다.

pcinfo033은 첫 native 진입 전 CP heapUsed 약1.2GiB, 전체scope2.14~2.34GiB였다. 첫 품질batch에서 linMax 입력표현2,179,372개가생긴다. 이번 질문은 **이표현을Boolean제약으로바꾸면JSheap/전체peak/OOM이줄어드는가,exact완료와native시간이악화되지않는가**다.

## 유일한 제품 변경

`src/cpsat-secondary-model.mjs`의 logicalOr만 변경한다. y=max(x₁,…,xₙ), x/y∈{0,1}을 다음으로 바꾼다.

- y=1 ⇒ OR(x₁,…,xₙ)
- y=0 ⇒ AND(¬x₁,…,¬xₙ)

따라서 y는 정확히 OR와 같다. 한 방향만 넣으면 나중에 잠긴 품질목표나 stable-ID 최적화에서 허위 y가 허용될 수 있어 두 방향 모두 필요하다. 빈집합0,단일항x,같은집합OR캐시/weighted row multiplicity/품질batch/목표잠금/tie30개batch/검증/CP파라미터는유지한다.

추가적인 Map.clear,packed입력개편,GC강제호출은섞지않는다. 이번에확인할효과는OR표현변경이다. 음수literal의Protobuf부호화나nativeSAT/LP전개때문에encoded bytes/시간까지줄것이라고선언하지않는다. sourceFiles.product의변경경로는위1개여야한다.

## 정확성 확인

- Node/browser 각각의실제vendor CpModel로만든protobuf를독립적인작은전수열거기로해석한다. 원weighted row의직접최적해,기존linMax모델,candidate의전체quality/tie결과를비교한다. 중복행/중복id/강제singleton/같은품질tie/다중품질batch/부분커버리지를포함한15개합성입력이다. 로컬population실행0/nativeCP실행0.
- objective와무관하게보조Boolean의양방향제약을모든진리값에서검사한다.
- 기존scoped synthetic1회를다중품질batch+중복행+false보조OR+stabletie인작은4key입력으로강화한다. 기대결과keys=['b'],quality=[2,5,6,6],품질stage2개. 별도추가solver호출없이실제native지원과proof를확인한다. 이조건검사는약30초watchdog이며실자료측정이아니다.

## 동결 측정

- phase CP_COMPACT_R11,revision11,campaign TRIAGE_CP_COMPACT_20261009_R11.
- r10과동일4fixture:pcinfo033 restricted,pcinfo030 restricted,pcinfo031 bag-plus-next-draw,pcinfo040 restricted.
- CP_OPEN/H9_OPEN 각1회,총8호출/4chunk/최대4VM. sourcefixture/hash/원행/K/seed/패턴/N+1/clear4/hold=true유지.
- 600초외부watchdog,3GiB/swap0,CP1thread/max_lp/seed1,CP내부deadline null,Auto CP60초합류/T유지. 동일memory marker와부모250ms/fsync를유지한다.
- 같은공통executor/scope/quarantine/checkpoint/회수/전송/독립감사를사용한다. 변경모델의새측정이며r10결과를덮어쓰거나동일population표본에풀링하지않는다.
- r10은시간적으로떨어진1회대조이므로정밀speedup/nonregression을주장하지않는다. 모델단계별heap/encoded bytes/native구간/전체peak/CPU/완료·검열을함께검토한다. 생존대조040과CP를쓰지않는H9pcinfo031도보존한다.

## 예산·인계

원clock 2026-10-06T11:51:03Z~2026-10-11T11:51:03Z,cap20,000calls/5,000runner-hours 유지. 누적population13,063+synthetic12+신규8+1=13,084. 누적runner2,567.6666666666665h+4×350분+control6h=2,597h예약. 과거r9실패8슬롯과synthetic/control예약도상속한다.

동결소스/JS-Python schedule/입력독립감사후원장에등록하고원격실행한다. 종료후기존5파일패키지수집,과거r10과구간별비교,명시적저자분석과통합ZIP인계를수행한다. workflow성공이나heap감소만으로OOM해결/제품전체승격을선언하지않는다.
