# saves 최소 통합 및 실험 종료 — 2026-10-02

## 적용한 것

기준 `187fbf954ad0749e697b4e7f1252683b318d696e`에 A5+A4만 선별 적용했다.
`src/saves.mjs`의 내용은 독립 검증했던 `023950c`와 동일하다.

- **A5:** alias 구분자는 regex 내부와 escaped 문자의 `#`를 무시한다. 구조 오류는 search 전, 잘못된 regex 컴파일은 기존대로 평가 시점이다.
- **A4:** 기존 expression table/exact predicate/bag metadata cache 각각 FIFO512개, predicate memo256개, 보존 문자열 key4096자 제한. 초과 입력은 정확 계산하고 미보존한다. 호출자가 보유한 evicted predicate도 정상 작동한다.
- 내부 `saveCacheSnapshot`은 명시 호출 때만 순회하며 정상 평가에 계측 scan을 추가하지 않는다. WeakMap은 predicate를 강하게 보존하지 않는다.
- A5/F0 regression4개, A4 boundary3개, 실제 기존 WASM과 cache churn 연결 regression1개를 제품 tests에 유지한다.

이는 정확성·자원 관리 개선이다. **속도 향상, 전체 RSS 상한, 최적 FIFO 값**을 주장하지 않는다.

## 적용하지 않은 것

- 현재 B4 direct-mask wrapper/Rust/WASM 묶음: 전체 통합안 기각. generic/소규모 반례, QB088 손해 재현 및 memory 비용이 남았다. 아이디어와 코드·실패 관측은 archive에 보존한다.
- A6: 진단 후보만 archive에 보존, 제품 요청 경로 미적용.
- A1/A2/기존 B1/B2: 일반 wall 이득 근거 부족으로 현 후보 미채택.
- A3/A7/B3/B5/B6: 새 후보·사용 수명·실제 취소 등 착수 조건 미충족으로 보류. 실패했다고 주장하지 않는다.

`src/saves-feature.mjs`, WASM wrapper, Rust, WASM/법적보드 파일은 기준과 동일하다.
`singleSaveMask:true`, `outcomeCache:false`, `filterWorkers:0` 및 기존3체제secondary 정책도 변경하지 않았다.

## 실험과 결정

1. Muse/Luna 기존 증거를 재사용: Luna1,595셀/7,975paired run. Windows 결과를새Linux 관측과합산하지 않음.
2. CI첫시도36975926163: 임시nativefixture누락으로72pass/1file-not-found, 성능측정0. 사용자승인후파일배치만수정.
3. CI36976418775: native73/Node66pass, timed3344/resource16완료, 출력불일치·timeout·회수실패0.
4. broad/deep pairedmedian1.0041/1.0031로중립, large1.0462로약4.4%시간감소경향. 그러나잠정손해39셀로전체B4승격보류.
5. 승인된6반례진단36981493077:동일source/WASM/pack을hash검증후재사용,48/48완료. QB088의전체손해와공통JS조건손해재현, M의WASM memory after+24.0625MiB. 다른5반례미재현이최초관측을무효화하지않음.
6. Astra결정: A5+A4+관련회귀만채택, 기존WASM/기본값/secondary유지. 조합회귀후제품작업본의별도통합branch에고정.

반복2회는잠정screen이며통계적확증이아니다. source가변하지않는정확성증거만재사용했고이전VM시간을새candidate와짝짓지않았다.
fresh32holdout·성능최종browser/concurrency wave는승격할B4후보가없어미실행했다. 이번에메모리·정확성후보를채택했다고B4의일반화를검증한것은아니다.

## 검증과 기록

최소조합의전체Node회귀및환경조건으로스킵된항목의delta검증원표는다음에보존한다.

최종결과: **고유183개검사전체통과, 실패0·미해결skip0**. 첫전체검사는176pass/7skip였고, releasebaseline설정및JSPI가유효한`--test-isolation=none`에서해당7개만실행해전부통과했다. 스킵이있던최초원표와실행옵션미전달로6skip이남았던중간시도도보존했다. 통과한176개를다시성공수에중복합산하지않았다. 실제CP의가중품질/stable-ID증명·worker전송/취소검사도포함한다.

- [아카이브·최종결정·검증인덱스](../../archive/saves-experiments-20261002/README_KO.md)
- `archive/saves-experiments-20261002/integration/`:전체검사및스킵해소검사·source/hash검증.
- `archive/saves-experiments-20261002/records/`:기존계획·결과·감사.
- `archive/saves-experiments-20261002/saves-evidence.zip`:원시결과/실패/후보/runner전체보존용content-deduplicatedarchive.
- `archive/saves-experiments-20261002/history/`:제품통합·실험·Muse이력을복원할Gitbundle.

archive hash·全payload·source비교완료후에만중복experimentworktree/Muse사본/saves전용validation디렉터리를정리한다. 다른3체제실험·sharedsnapshot·toolchain·기존backup은보호한다. archive밖에있던Luna임시원본·Astra계획은복사만하며삭제하지않는다.

실제제품반영은local `integration/saves-minimal-20261002` branch이며local/remote main merge·push·배포는수행하지않는다.
