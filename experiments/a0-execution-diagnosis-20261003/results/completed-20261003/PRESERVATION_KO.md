# 원바이트 보존

최종 Git whitespace QA에서 원본 `/proc/cpuinfo` 마지막 빈 줄이 지적됐다. 이 환경 원문은 수정하지 않는다. 원artifact는 `artifacts/** -text -diff`로 보존하고 whitespace QA는 작성한 source/report에 적용한다. 별도로 result28파일의 Git staged blob bytes/length/SHA256를 원FILES와 대조한다.

이것은 원자료 공백 보존 방식의 조정이지 native 하네스 실패나 실험 재시도가 아니다. 실제 호출16회와 모든 원결과는 그대로다. 최초 분석 및 강화 재검산 결과도 각각 보존했다.
