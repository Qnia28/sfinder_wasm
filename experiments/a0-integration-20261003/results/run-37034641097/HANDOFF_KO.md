# 적용 직전 인계: HOLD

후보 구현은 보존됐으나 smoke 동결 게이트가 실패했으므로 **Dev에 적용하지 않는다.** 예약 검증도 미실행이다. 결과는 `RESULT_KO.md`를 먼저 읽는다.

## 대기 산출물

- 원제품 기준: `c0cb2a048e7275bfea587d176b1954efff0a8a08`
- 검증 후보: `e5f2f3d1a9885085e11cde7457aad2b338ca8130`
- 브랜치: `integration/a0-minimal-20261003`
- `PRODUCT_ONLY_DO_NOT_APPLY.patch`: `src/min-cover-exact-secondary.mjs` 한 줄 + `wasm/pc_wasm.wasm`만 포함한다. `.github`, experiments, test/검증 산출물을 제품에 전부 연결하는 패치가 아니다.
- binary SHA256: `73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3`
- 적용/merge/배포 모두0. 앞으로도 별도 승인 전에는 수행하지 않는다.

## 보호 범위와 rollback 경계

Fast/명시엔진/분해/primary 경로/Rust source는 변경하지 않았다. A0 JS 옵션과 pc-wasm 교체는 같은 후보 단위로 취급해야 한다. 새옵션만 오래된 export 없는 binary에 연결하지 않는다.

현재 rollback할 Dev 변경은 없다. 향후 별도 승인으로 적용했다면 그 적용에서 만들어진 자기 변경만 별도 revert로 되돌려 JS와 binary를 함께 복구한다. 현재 c0cb2a0 snapshot은 복구 기준 자료일 뿐, 사용자의 이후 작업을 reset/overwrite하는 권한이 아니다.

## 완료/미완료

- 구현·빌드 hash·회귀·브라우저·128개 smoke 실행·원결과 독립 감사: 완료.
- 전체 실제 route 품질/완료시간, reserved104/tiny115 검증: 미완료/미실행.
- threshold timeout56행의 완료 probe witness와 per-call peak resource: 이번 원결과에 없음.
- 기존675개 효과 재검증, 증액 rerun, gate bypass: 수행하지 않음.

후속 검증 방식 변경은 이번 시도를 그대로 보존한 별도 계획으로 다룬다. 이 브랜치나 보고서를 제품 적용 승인으로 해석하지 않는다.
