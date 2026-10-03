# 로그 해석 근거와 제한

Node24.13.0의 V8 source에서 확인한 로그 형식을 사용한다.

- https://github.com/nodejs/node/blob/v24.13.0/deps/v8/src/wasm/baseline/liftoff-compiler.cc
  - `Compiled function <module pointer>#<function index> using Liftoff, took <integer> ms ...`
- https://github.com/nodejs/node/blob/v24.13.0/deps/v8/src/compiler/pipeline.cc
  - `Compiled function <module pointer>#<function index> using TurboFan, took <integer> ms ...`
  - 내부 pipeline이Turboshaft를사용하더라도해당로그compiler명은TurboFan이다. 로그명대로보고한다.
- https://github.com/nodejs/node/blob/v24.13.0/deps/v8/src/wasm/module-compiler.cc
  - lazy경로는`Compiling wasm-function#<index>.`를출력한다.
  - lazy컴파일은첫사용에서baseline을기다리고상위tier는가능하면background로시작한다. 이것만으로현재프레임의실행tier전환을증명하지않는다.

컴파일로그는코드생성완료의증거이지해당tier가모든instruction에사용됐다는실행trace가아니다. 특히DEFAULT는생성된tier가혼합될수있다. LIFTOFF_ONLY/OPTIMIZED_FIRST는생성된compiler종류와실제process/WorkerexecArgv를함께확인한다.

기존WASM에는Rust함수이름customsection이없다. 정적exportindex와로그index는대응할수있지만exportwrapper가순수DFS함수인것은아니다. compilems는정수절삭/반올림표현이고병렬compile가포함돼합계를callwalltime에서빼는것은부적절하다.

WorkerJSmarker는NodeWorkerstdout전달경로를,엔진nativecompile로그는native출력경로를거칠수있다. 두출력의buffering차이때문에경계근처순서만으로컴파일이API시작전후어디서발생했는지확정하지않는다. OPTIMIZED_FIRST의eager정책과READY/API경계,전체compiler로그를함께보며제한을명시한다.

이문서는원native결과를대체하지않으며원로그는수정하지않는다. parser수정이필요해도native실행을재시도하지않는다.
