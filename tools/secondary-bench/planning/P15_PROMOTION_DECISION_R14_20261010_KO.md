# r14 저자 판단: P15 기본값 승격

run38032244199 attempt1, frozen commit `f23e5cefbb9ef5662bd40998d587749acea6ab51`.
원 PACKAGE.json SHA256 `ea51574103bbfb26c598af48923a3aaa0a560b574e18fea0ff4fbfb726c5155e`.
최종 분석: `files/triage-database/triage-experiments/promotion-p15-r14/ANALYSIS_KO.md`.

- 761입력 초기3044 + 선정608입력 확인2432 = 5476호출.
- EXACT5220, TIMEOUT256, paired 완료손실0, witness불일치0.
- 변경ALL18 시간비 초기0.812643/확인0.812150; 변경per-save79 0.777435/0.782837.
- per-save9개의 재현된 손해를 수용: 확인 손해합0.756초 대비 절약8.331초.
- ALL 전체 초기 시간합 개선은8.13ms뿐으로 전체ALL 가속은 미확정. 채택 근거는 변경군의 두 모집단·반복 확인된 순이득이다.
- 긴ALL3입력의12pair 전부peak증가, 최대약58.6MB/+10.47%. 완료손실 없이 수용하고 제품통합 자원검토에 남긴다.
- d15 probe는per-save10입력에서완료한다. “d15/16은전부순수낭비”를 채택 근거로 삼지 않는다.

승격 변경: `DEFAULT_SECONDARY_TRIAGE_POLICY='P15'`. non-hard≤14/hard≤9/unknown fallback. CP60초·제품deadline없음·exact Human·실패생명주기 유지. 원래 dev 대비제품통합검증과main병합은 별도단계다.

## 증거 판정 v3

원 Actions FAIL은 OOMskip이아닌 trivial30입력232호출의 null forcedCount 감사연산오류다. 원FAIL을유지하고 frozen source와원artifact전체를offline재감사한별도PASS(5220witness)를인계한다. 원clock/예산/호출/원감사를변경하지않는다.

버전 `triage-evidence-v3-unknown-route-oom-quarantine`:
1. 제품의정수검사및unknown fallback을감사에반영.
2. 동일worker/input/arm의선행회수된OOM과순서가입증된 `NOT_RUN_AFTER_OOM`은정상검열이다. 기록/분모유지,그것만으로workflow FAIL하지않는다.
3. 원인없는skip,미회수,누락,UNKNOWN,다른NOT_RUN,잘못된witness는계속차단한다.
4. r14에는OOM/skip이없어2번은합성검사로검증한다.

관련검사: Node46PASS/5환경조건SKIP, Python독립감사17PASS, r14후처리2PASS. 로컬population benchmark0. 기본값생략시P15경로를합성제품검사로확인했다.
