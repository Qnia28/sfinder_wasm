# Per-save 추가128 — 공통 하네스 /4VM

사용자 승인: Astra가 선별한128행렬을 별도workflow에서4VM으로 추가 측정. A run `37280034634`·legacy workflow·원clock·제품은 수정하지 않는다.

- `INPUT_PROVENANCE.json`: 선별hash/방법·원capture 경로/hash128개. 원fixture bytes는 `fixtures.zip`으로 보존.
- `MANIFEST.json`: common exact-cold-v1, I/T/CP,60초·기본2회, 해당엔진초기모두EXACT/max:min≥1.10이면추가2회.
- 예정기본768호출, 최대1536호출. 대기·전송·최대추가단계의보수적비용을포함해원activation부터36h. profile/CP primary2·secondary1/3GiB per-call/swap0 변경없음.
- `.github/workflows/secondary-bench-common-persave128.yml`: marker-only push로 독립실행. prepare1VM→공통reusable stage 최대4VM. A12VM을읽기전용예약해합산16≤20.
- `.github/secondary-common/PERSAVE128_START.json`: 새실행에한해 manifest/source hash+확인값봉인. 기존SMOKE/F/A marker는수정하지않음.

새명세 revision 또는 marker를 발행하기 전 계약검사·원fixture SHA128개·offline initial128task/768call/43chunk·preflight완료를 확인한다. 실행후 raw/NOT_RUN/timeout/OOM·receipt·witness를 common AUDIT와 독립archive감사로 확인한다. 전송회수만을위한 solver재실행금지. 개발보강이며 fresh/performance PASS 아님.
