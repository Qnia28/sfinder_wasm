# 독립 감사 순서 오류와 예약 단계의 연속 실행

원실행37039906398의 개발512회 모두 PROBE_EXACT/PROBE_CAPPED로 완료됐다. JS집계는 사전정확성/성능/자원게이트를 통과했으나 Python감사의 CI동일성검사가 실패했다. 실패run을그대로보존한다.

원인은 검산캐시를 위해 Python이행렬ID순으로 처리하면서 bootstrap의cluster입력순서도변경한것이다. JS는lexical shard디렉터리순과원장첫등장행렬순으로cluster를구성했다. 같은PRNGseed라도clusterindex순서가다르면finite Monte Carlo CI가byte-level로일치하지않는다.

`audit-resume.py`는원audit.py를수정하지않고고정Gitblob과일치하는지확인한뒤 **두순서만**맞춘다: shard폴더lexical정렬,metric생성은원장첫등장행렬순. witness검산은기존ID정렬을유지한다. 기준값/반복수/seed/metric값/측정원장/제품binary/runtime하네스는바꾸지않는다. 원auditor/실제실행보정코드/보정wrapperhash를같이봉인한다.

로컬독립감사에서512회원weightedquality1024검산,rawjournal1536record/536artifactfile/Gitblob166검증,states/quality회귀0,미검증Aonlyexact0,CI와기존집계일치가확인됐다. 원summary파일SHA256은 f639f168489df2c9c8fdc8d11c9070e600acb125cfd6f56b7f470f06e9e81b3f 이며재작성하지않는다.

후속workflow는원artifact를다운로드해같은감사를hosted에서수행하고동결한뒤 **승인된예약832회만처음실행**한다. 개발512회재실행/선택적성공rerun/게이트수정/후보튜닝은0이다. 원run의빌드와scheduled/inputhash를그대로사용한다. 전체예산기산점도원run생성시각37039906398로유지한다. 원workflowjob상한21h+연속workflow상한13.8333h=34.8333h<64h다.

Dev/main/배포는계속불변이며,원실패를성공으로치환하지않는다. 최종보고서에원실행의감사오류와연속실행의역할을구분한다.
