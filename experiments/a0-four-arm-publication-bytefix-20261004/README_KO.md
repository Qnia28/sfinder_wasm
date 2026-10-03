# 출판 증거의 byte 검증 보완

원 증거 commit의 JSON/CSV 10개는 Git CRLF→LF 정규화가 적용된 읽기용 사본이다. 로컬 원 봉인과 결과는 변경하지 않았다. `EXACT_SEALED_TEXT.zip`은 이 10개와 정확한 SEAL.json byte를 복원하는 추가 거울이다.

원 출판의 PACKED ZIP을 풀고 이 ZIP을 덧씌우면 원 봉인의 6,952파일 모두 SHA256/크기 일치한다. 검산 보고서는 `PUBLICATION_BYTE_AUDIT.json`. source/실험/Actions launch는 바꾸지 않았고 추가 native는 0이다.
