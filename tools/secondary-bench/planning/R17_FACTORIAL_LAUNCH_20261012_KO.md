# R17 factorial 실행 동결

사용자 승인: 원인분리 실험 계속 및 원인 확인 후 최소수정 후보 제작.
최대동시12VM, 실제8 independent blocks. 기존 설계의 최대8VM 표기는
사용자의12VM 지시로 대체하되 4입력×2반복 block수는8이다.

RC2c406b98 공통기반, 4명령×8 P/C/M arm×2회=64호출.
P0 DEV baseline / P1 P15; C0 120초 / C1 무기한; M0 DEV linMax / M1 compact.
C120은 역사적 대조. production CP무기한 및 RC실패복구 유지.
동일VM8arm hash순서, 독립VM 두번째 block 역순. 외부600초/3GiB/swap0.
입력SHA256 f207e5aa859a07470032d0a39a98de452b1e506e28d7ce28073c7fdfef96a2c7.
8개 실험제품 전체 파일hash 및 patch목록SHA256:
f70a07b28fd4193ad580519e019a825f88ff43c431b0fe47aaab15a0f164a941.

각 호출 공통executeTask/scope 사용, durable start/result/trace 봉인,
native Actions SDK로 호출별checkpoint 전송. 첫 전송실패/invalid시 후속측정중지.
OOM은 기존 input/arm quarantine 유지. independent 감사는 계획/역순/원weighted
witness/64호출/회수/원격checkpoint와receipt를 검증한다. 결과후저자분석필수.

worker150분×8 + plan15분 + audit30분 + 자동contract10분=1255분,
신규예약21runner-hours. parent r16예약9h/16호출 포함 누적30h/80호출.
parent origin2026-10-11T14:48:20.214Z 및 end2026-10-13T14:48:20.214Z 유지.
run16의 실제call/FAIL/PASS를 새실행으로 다시 세지 않는다.

로컬은8제품정적패치/JSsyntax/동결plan 검증 및공통합성검사28개PASS.
로컬population solver0. 체크point용Actions artifacts만 사용.
실행중 후처리개선은독립postprocess에 두고 실행source는 동결한다.
