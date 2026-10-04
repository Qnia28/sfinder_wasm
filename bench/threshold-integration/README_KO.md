# 제품 threshold 후보 검증

준비 branch와Dev/main은별개다. 기본feature는OFF이며기존제품JS/ABI/라우팅은변경하지않는다.
설계·계약 차이는 `docs/THRESHOLD_INTEGRATION_KO.md`에기록한다.

## 구성

- S: 기존Dev의추적된WASM. 기존Rust에이미존재하는progress/partitioned export4개는없음.
- D: 고정Dev소스재빌드, C: 후보코드feature OFF.
- A: currentPropagation만, B: A+rootForced. rejected32/64와priorPropagation은없음.
- reference: 고정실험소스ABI의mask16/20,정확성동등성만검사하며제품성능과합치지않음.

## 재현

Rust1.90.0의wasm32-unknown-unknown, Node24.13.0, Chromium/Playwright1.62.1을사용한다.
`npm ci` 이후순서대로실행한다.

```sh
node bench/threshold-integration/build.mjs
node bench/threshold-integration/correctness.mjs
node bench/threshold-integration/product-regression.mjs
node --test bench/threshold-integration/harness.test.mjs bench/threshold-integration/timeout-policy.test.mjs
```

Browser는 `build/browser-tools/node_modules/playwright`를기본사용한다.
기존설치를사용하려면 `PLAYWRIGHT_MODULE`과필요시 `PLAYWRIGHT_BROWSERS_PATH`를설정한다.
브라우저취소검사는실제로작업을시작한긴worker를중단하고회수·다음요청완료를확인한다.
S에서없는progress export를통과했다고계산하지않는다.

성능은 `run.json`의32고정입력에서D/A·A/B각5쌍,재확인새10쌍,호출당300초다.
별도6개bridge에서S/D·D/C각5쌍을실행한다.
한샘플은기존제품 `minimumCoverAtCount`와기존locked ABI를정확히1회호출한다.
제품메타데이터준비는측정밖이며,productMs=solverMs는제품JS packing/검증/결과회수를포함한다.
nativeMs는Rust ABI변환/준비/검색시간이고outerMs는process설정·회수까지포함한다.
실제Worker왕복은browser.json의분리된정확성설명수치이며paired성능과합치지않는다.

자동실행은 `.github/workflows/threshold-integration.yml`이다. 원본Dev와main에는push하지않는다.
paired sample은같은VM의직렬fresh process다. 단계별최대10shard이며전체캠페인deadline은없다.
각비교양측2solver TIMEOUT·관측EXACT0일때만조기종료하고미실행호출은TIMEOUT과분리한다.
frozen200은기존cycle1/QB각100원본선정·중복·행가중치를그대로보존하고재추출하지않는다.

## 감사·보존

- `review.mjs`: 모든rawwitness/knownoptimum/input·build·source identity와paired회계감사.
- `source-audit.mjs`: 실행build의모든source표를immutableGitblob과대조하고Actionsjob동시성확인.
- `archive.mjs`: sample은전부남기고반복fullbuildmetadata만제거해한개의build.json으로대체.
- generatedreports는`wx`로새파일만생성하며기존frozen선정/측정은덮어쓰지않는다.

소비앱UI는이저장소에없으므로실제Chromium검사도엔진라이브러리제품API/Worker범위다.
Dev통합/기본ON/배포는검증결과검토후별도승인대상이다.
