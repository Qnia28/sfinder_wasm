# 선택 가능한 A0+M1 통합

일반 Exact의 기존100K probe에만 `exactProbe: 'a0-m1'`을 적용한다. 기본값은 `'reference'`(R)이며 다음 요청부터 이 값으로 롤백할 수 있다. 전역 toggle이나 board별 예외 목록은 없다. 사용자 요청 안에서 R과 후보를 둘 다 실행하거나 실패 후 R로 자동 재시도하지 않는다.

```js
await calculateMinimalsFeature({
  ...input,
  exactHumanQuality: 'true',
  exactProbe: 'a0-m1', // OFF/rollback: 'reference'; omitted also means reference
});
```

minimals, per-save minimals, fifth의 비동기 API와 adaptive/secondary/whole-filter Worker 전송에 정책을 연결했다. Fast, tiny/direct/trivial, primaryHard, 명시적 integrated/threshold/cpsat, decomposition on/auto는 기존 구현을 사용한다. sync/Legacy API는 그대로다. 일반100K EXACT는 원weightedrows 검증 후 반환하며 CAPPED는 동일 incumbent와 probe를 기존 threshold로 넘긴다. CP 시작 기준60초와 CP limit120초는 변경하지 않았다. 이미 전달된 probe는 다시 실행/로드하지 않는다.

## 바이너리·빌드

- `wasm/pc_wasm.wasm`과제품 `rust/`는 수정하지 않았다. R은 enumeration/primary/threshold 등 기존 경로도 계속 담당한다.
- `wasm/pc_a0_m1.wasm`은37134463920에서빌드하고37138752420의100쌍재테스트에쓴Linuxbytes(c3c9a884…)를그대로재사용했다.
- 후보는 **ON이고 실제 probe 대상일 때만** 모듈을 로드한다. 요청별 matrix-only solver는 probe/검산 직후 닫아 threshold/CP와 겹쳐 유지하지 않는다. realm별 compiled module만 retry-safe cache에 남는다. R이 PC/primary를담당하므로ON에서잠깐두instance가존재하는비용은비교대상이다. OFF에서후보를항상로드하지않는다.
- `scripts/build-wasm.sh`는 그대로이며,후보재빌드는 `bash scripts/build-a0-m1.sh`로분리했다. Rust1.90.0·고정M1feature만 사용하고원Rusttree를복사한새빌드tree에측정overlay를쓴다. Linux에서원측정hash와다르면실패한다. Windows와Linux의binarylayout이같다고가정하지않는다.
- 기전추가나layout변경을피하기위해측정source를byte그대로보존했다. overlay내M2/diagnostic코드는비활성으로남지만컴파일/실행하는feature는M1뿐이다. 관련test/reference파일은test-only다.

`exactProbeTrace`는후보의선택/EXACT-CAPPED/상태수를기록한다. 기본R동작에는추가시간측정/구조scan을하지않는다. 비교용 `exactProbeTiming: true`는양쪽의probe API/load시간을추가한다. 시간값은기본결과의결정적동등성검사에섞지않는다.

## 검증·다음 단계

Node 전체189tests 중183pass/6조건부skip(보호baseline비교포함),새통합6tests통과. BrowserJSPI+isolation에서OFF후보미fetch/ON동일witness/CAPPED실제threshold Worker/후보secondary Worker전송4checks통과. 로컬Rust는WASM전체target(test포함)compilecheck와release빌드통과. MSVC linker가없어새nativeRusttest실행은Linuxpreflight에서다시필수로확인한다. 동일overlay의과거Linux debug/release 검산은보존돼있다.

제품전체기본값승격은아직없다. [ON/OFF 비교 준비](../../experiments/a0-m1-on-off-20261004/README_KO.md)는별도승인된launch때만실행한다. 이번구현은isolatedbranch이며Dev/mainmerge·배포는하지않았다.
