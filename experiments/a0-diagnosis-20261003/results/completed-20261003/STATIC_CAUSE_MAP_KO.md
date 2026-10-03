# 정적 원인 지도 — 실행 결과 전의 가설

아래는 코드로 확인한 경계와 진단의 반증 조건이며, 실제 원인 확정이 아니다.

## H1: A0 탐색관리 비용

확인된 차이는 `rust/pc-core/src/min_cover.rs`의 sibling_excluded 초기화, branch filter, exclusion_trail push 및 frame 복원이다. baseline에는이작업이없다. states가같아도상태당작업이같다는보장은없다.

반증/제한: F14의짧은탐색에서밀리초차이가관측됐다는사실만으로몇십번의trail조작을주원인으로단정할수없다. WARM상태의coreexportwall에서도반복적으로차이가남아야지속적인native비용가설이강해진다. corewall에는Rust전처리도들어있으므로그것만으로trail만의비용을확정할수없다.

## H2: 최초 실행·컴파일·runtime tiering

`createWasmSolver({legal:false})`는기존loader를통해WASM과legalasset을읽고instantiate한다. 이것은apiMs밖이다. 하지만핵심export최초호출중에발생하는runtime작업은apiMs/corewall안에있을수있다. 전자는initMs,후자는corefirstcall로분리해야한다.

COLD→COMPILED변화는compiledmodule재사용/loader차이등을함께반영하며,COMPILED가순수컴파일원인만을분리한다고주장하지않는다. COMPILED의workerJS는새context이고WARM은JS/instance도재사용한다. WARM에서첫warmup→이후call의core/pre/post변화를보면최초실행효과를직접관측할수있다. 특정V8JIT원인은엔진trace없는한확정하지않는다.

## H3: JS/readback 또는 allocation 경계

`src/pc-wasm-min-cover.mjs:218~288`은공통packing/복사후서로다른coreexport를선택하고공통qualityreadback을수행한다. 품질vector를읽는루프/JSJIT/할당은검색states수와독립적으로비용이발생한다. facade는각getter에timer를넣지않아수천개관측오버헤드를피한다.

core델타가작고pre/post델타가반복적으로크면순수탐색관리만의설명은약하다. post에는WASMgetter/dealloc도포함되므로순수JS비용으로명명하지않는다. 부호가다른component끼리의상쇄와계측오버헤드도기록한다.

## H4: 공통 전처리와 host 변동/선정 편향

Rust ABI는원CSR로Vec행을재구성하고,core는normalize/중복제거/primary case dominance/coverage bitset/seed quality를구성한뒤DFS에진입한다. 탐색27states만으로전체call작업량을추정할수없다. R/A의공통비용이큰상황에서는host/JIT/GC변동이몇십states의추가관리비용보다클수있다.

F14는직전outcome으로선정된양의tail이다. 이것을새독립실행에서똑같이재현한다고전제하지않는다. matched14와baseline/baseline8의X/Y통제가양방향동일규모의tail을보이면oldp95의알고리즘원인단정은약해진다. 다만기존p95gate실패를무효화하지는않는다.

## 대응 결정 원칙

- 안정적인WARM core지연→최소native수정가설검토;내부구간계측이필요하면별도제안.
- cold/firstcall에집중하고warm에서사라짐→runtime경계설명우선. 사전warmup을제품에자동추가하지않음.
- pre/post의공통비용·불안정성이큰경우→해당경계진단우선,partitioned DFS를서둘러수정하지않음.
- AA경보/방향불일치→측정정밀도부족으로보고. 성능gate재시도아님.
- 모든경우제품통합보류/미검증exact1개유지. 새로운성능benchmark로전환하지않음.
