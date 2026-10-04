# 후속 5분 캠페인 — 사용자 지정

첫run: `37222172267`, originUTC `2026-10-04T17:52:29Z`, source `df8de899edb7eda765a60a0b349bd8f48bc0e334`.
440command캡처에서frozen nontrivial309matrix가선정되어기본1,854call진행.

사용자 후속 지시: 첫run이끝난뒤timeout5분, job반복을두배로하여4→8→12→16→20회. 추가반복시작은5시간미만/전체6시간. 최종보고서는두run의자료를하나로작성.

구현:
- 같은309matrix를hash로검증하여재사용, 재열거·primary재증명없음. 기존raw시간과새raw시간을섞지않음.
- engine×fixture별로초기4회/추가4회씩최대20회. 기존직전두회timeout 제외조건유지.
- block당최대12call×(startup10s+call300s+2×reap5s)=64분.
- job당최대2block, scope70분·step71분·checkpoint3분·jobhard160분<6h.
- basic최대3,708call, 총최대18,540call. 시간/censoring규칙으로실제호출은줄어듦.
- 새origin은첫run완료후후속workflow.created_at부터. 첫run소비시간이후속6h를소모하지않으며후속retry로새clock을만들지않음.
- 두run의independent witness 재검산및cross-run선택·quality hash 일치확인.
- 최종보고서한개/JSON부록한개. 60s/300s 조건별최초·추가반복·timeout/incomplete/OOM/missing을분리하고timeout을완료시간으로처리하지않음.

과거노출확장감사(13,845자료):275그룹중263그룹노출가능,12미확인.55보류중52노출가능/3미확인.이번frozen입력은변경하지않으며보류를fresh검증이라고주장하지않음.
