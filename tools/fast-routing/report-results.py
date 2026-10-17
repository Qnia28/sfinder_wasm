"""Summarize verified offline routing results; never execute a solver."""
import collections
import hashlib
import json
import math
import pathlib
import statistics
import sys

out = pathlib.Path(sys.argv[1])
load = lambda name: json.loads((out / name).read_text(encoding="utf-8"))
s, a = load("SUMMARY.json"), load("AUDIT.json")
budget = load("BUDGET.json")
arms = ["BASE100", "DIRECT", "PREVIEW_ONLY", "I1K", "I10K", "S200_OR_D16", "U192_OR_D16"]


def rows(name):
    with (out / name).open(encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)


def save(name, data):
    with (out / name).open("x", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def dist(values):
    v = sorted(values)
    return {"n": len(v), "sum": sum(v), "mean": statistics.mean(v) if v else None,
            "median": statistics.median(v) if v else None,
            "p95": v[max(0, math.ceil(len(v) * .95) - 1)] if v else None,
            "max": max(v) if v else None}


quality = collections.defaultdict(lambda: {"filterPairs": 0, "relations": collections.Counter(), "commands": set(),
    "worseCommands": set(), "worseCalls": set(), "lowerRows": 0, "higherRows": 0,
    "lowerMagnitude": 0, "higherMagnitude": 0, "originalRowPairs": 0, "proofLost": 0, "worst": []})
feature_pairs = collections.defaultdict(lambda: {"n": 0, "relations": collections.Counter(), "commands": set(),
    "probeDeltaMs": [], "refineDeltaMs": [], "lowerRows": 0})
edges = {"S": [50, 100, 200, 400], "K": [8, 16, 32, 64], "F": [1, 8, 32, 64],
         "u": [64, 128, 192, 384], "d": [1, 4, 8, 16, 32]}
for q in rows("quality-pairs.jsonl"):
    if q["phase"] != "e2e":
        continue
    key = ":".join([q["baseline"], q["population"], q["arm"]])
    g = quality[key]
    g["filterPairs"] += 1
    g["relations"][q["relation"]] += 1
    g["commands"].add(q["commandId"])
    g["originalRowPairs"] += q["features"]["N"]
    for k in ["lowerRows", "higherRows", "lowerMagnitude", "higherMagnitude", "proofLost"]:
        g[k] += q[k]
    if q["relation"] == "WORSE":
        g["worseCommands"].add(q["commandId"])
        g["worseCalls"].add(q["callId"])
        g["worst"].append(q)
        g["worst"].sort(key=lambda r: (r["lowerMagnitude"], r["lowerRows"]), reverse=True)
        g["worst"] = g["worst"][:10]
    for name, cutoffs in edges.items():
        v = q["features"][name]
        band = next((f"<{c}" for c in cutoffs if v < c), f">={cutoffs[-1]}")
        fg = feature_pairs[key + ":" + name + ":" + band]
        fg["n"] += 1
        fg["relations"][q["relation"]] += 1
        fg["commands"].add(q["commandId"])
        fg["lowerRows"] += q["lowerRows"]
        fg["probeDeltaMs"].append(q["probeDeltaMs"])
        fg["refineDeltaMs"].append(q["refineDeltaMs"])
for g in quality.values():
    for k in ["commands", "worseCommands", "worseCalls"]:
        g[k] = sorted(g[k])
for g in feature_pairs.values():
    g["commands"] = len(g["commands"])
    for k in ["probeDeltaMs", "refineDeltaMs"]:
        g[k] = dist(g[k])
save("QUALITY_SUMMARY.json", quality)
save("FEATURE_PAIR_SUMMARY.json", feature_pairs)

selected = list(rows("selected-calls.jsonl"))
long_ids = {r["commandId"] for r in selected if r["phase"] == "long-repeat"}
long = collections.defaultdict(list)
for r in selected:
    if r["commandId"] in long_ids and r["phase"] in ["e2e", "long-repeat"]:
        long[(r["commandId"], r["arm"])].append(r)
long_summary = []
for (command, arm), rs in long.items():
    assert len(rs) == 7
    ms = [r["policyMs"] for r in rs if r["policyMs"] is not None]
    long_summary.append({"commandId": command, "arm": arm, "expected": 7, "returned": len(ms),
        "statuses": dict(collections.Counter(r["status"] for r in rs)), "policyMs": dist(ms),
        "minMs": min(ms) if ms else None, "stdevMs": statistics.stdev(ms) if len(ms) > 1 else None,
        "calls": [{k: r[k] for k in ["callId", "phase", "repeat", "status", "policyMs"]} for r in rs]})
save("LONG_7_REPEAT.json", long_summary)

diagnostics = collections.defaultdict(list)
for r in rows("diagnostic-pairs.jsonl"):
    diagnostics[":".join([r["population"], r["arm"], r["mode"]])].append(r)
save("DIAGNOSTIC_SUMMARY.json", {k: {"expected": len(v), "valid": sum(r["deltaMs"] is not None for r in v),
    "observedDifferenceMs": dist([r["deltaMs"] for r in v if r["deltaMs"] is not None])} for k, v in diagnostics.items()})

lines = ["# Fast routing 대규모 비교 결과", "", "출처 표기: GLM", "",
    "## 완료·검증", "",
    f"- 동결된 **1,113명령·{a['selected']:,}호출**의 선택 결과를 통합했다.",
    "- 주3반복 23,373호출 / 긴13명령 추가4반복 364호출 / OFF·timing·trace 진단 1,344호출.",
    f"- 선택 결과 상태: `{json.dumps(a['statuses'], ensure_ascii=False)}`.",
    f"- 시작·raw·terminal 대조 {a['starts']:,}/{a['raw']:,}/{a['selected']:,}. 최종 witness {a['finalWitnesses']:,}개, trace 단계 witness {a['traceWitnesses']:,}개를 원행으로 재검산했다.",
    "- 최소 K는 capture의 PROVEN primary 결과와 일치하며, 선택 cardinality·원행 coverage·품질 벡터가 일치했다.",
    f"- 이전 시작-only 8호출은 **8/8 재측정 종료 확인**. 이전 UNKNOWN 증거는 attempts에 남아 있다.",
    f"- 원본/실패재개/최종재개의 선택 명령 수: `{a['sourceCommands']}`; 호출 수: `{a['sourceCalls']}`.",
    f"- 제품 `{a['sourceCommit']}`, 원격 Node `{a['runtime']}`, 3GiB/swap0, 원 schedule `{a['scheduleHash']}` 유지.",
    f"- 원 clock {budget['originUtc']} 유지. 모든 시도의 job timestamp 합계 {budget['reportedJobHoursTotal']:.3f}시간(청구시간 아님); 최종재개 입장 시 누적보수예약 {budget['finalContinuationAdmissionConservativeHours']:.3f}시간 / 상한1,200시간.",
    "- 실행 성공·증거 검증 통과는 정책 채택 판정과 별개다.", "",
    "## 시간: 주3반복", "",
    "policyMs는 WASM 초기화부터 공개 API 계산·인코딩까지의 측정값이다. 원행 검산은 이 시간 밖에서 수행했다. API 단독 시간과 wall/메모리는 SUMMARY에 별도 보존했다. 단위는 초이며, 모든 주 호출은 timing 계측을 포함한다."]
for pop in ["ALL", "per-save", "edge", "regression"]:
    lines += ["", f"### {pop}", "", "|조건|반환/예정|평균|중앙값|p95|p99|최대|", "|---|---:|---:|---:|---:|---:|---:|"]
    for arm in arms:
        t = s["timing"].get(f"e2e:{pop}:{arm}")
        if not t:
            continue
        d = t["policyMs"]
        vals = [d["sum"] / d["n"] if d["n"] else None, d["median"], d["p95"], d["p99"], d["max"]]
        formatted = [f"{v / 1000:.3f}" if v is not None else "—" for v in vals]
        lines.append(f"|{arm}|{t['returned']}/{t['expected']}|" + "|".join(formatted) + "|")

lines += ["", "## 입력별 손익·실제 품질 변화", "",
    "시간 변화율은 같은 입력의 3반복 중앙값을 합산한 비율이다. 음수는 후보가 빠름을 뜻한다. 빠름/느림은 입력 수이며 작은 차이의 유의성을 뜻하지 않는다. 품질 악화는 정렬된 원행 품질 벡터의 사전식 비교로 판정한 입력 수·filter-call 수다. 상대 baseline이 전역 최적 품질이라는 가정은 하지 않는다."]
for baseline in ["BASE100", "DIRECT"]:
    for pop in ["ALL", "per-save"]:
        lines += ["", f"### {baseline} 대비 {pop}", "", "|후보|시간 변화|빠름/느림 입력|품질 악화 입력|악화/동일/개선 filter-call|", "|---|---:|---:|---:|---:|"]
        for arm in arms:
            if arm == baseline:
                continue
            c = s["comparisons"][f"{baseline}:e2e:{pop}:{arm}"]
            q = quality[f"{baseline}:{pop}:{arm}"]
            relations = q["relations"]
            lines.append(f"|{arm}|{c['totalMedianChangePercent']:+.2f}%|{c['faster']}/{c['slower']}|{len(q['worseCommands'])}|{relations.get('WORSE',0)}/{relations.get('EQUAL',0)}/{relations.get('BETTER',0)}|")

lines += ["", "### 원행 손실 규모", "",
    "벡터 사전식 동률이어도 서로 다른 원행에서 감소·증가가 상쇄될 수 있으므로 원행 변화도 따로 기록했다. 아래 수는 반복을 포함하며 독립 표본 수가 아니다.", "",
    "|BASE100 대비 후보/모집단|감소 원행/전체 원행쌍|감소량 합|증가 원행|", "|---|---:|---:|---:|"]
for pop in ["ALL", "per-save"]:
    for arm in arms[1:]:
        q = quality[f"BASE100:{pop}:{arm}"]
        lines.append(f"|{arm}/{pop}|{q['lowerRows']:,}/{q['originalRowPairs']:,}|{q['lowerMagnitude']:,}|{q['higherRows']:,}|")
lines += ["", "## Tail·추가 반복·계측", "",
    "- SUMMARY의 `comparisons.*.worst/best`는 입력 중앙값 기준 손실·이득 상위15개다. `timing.*.worst`는 실제 단일 호출 tail이다.",
    "- `pairs.jsonl`은 BASE100·DIRECT 각각에 대한 모든 호출별 시간·상태·품질 변화다. 품질 악화와 시간 이득을 같은 callId로 연결한다.",
    "- `LONG_7_REPEAT.json`은 명시된 긴13명령의 3+4반복을 연결한 91개 arm 블록이며, phase·상태·원값을 보존한다. 주분포에 추가반복을 섞지 않았다.",
    "- `DIAGNOSTIC_SUMMARY.json`/`diagnostic-pairs.jsonl`은 별도2반복의 OFF 대비 관측 차이다. 계측 overhead의 확정 추정값이 아니며 본측정에서 빼지 않는다.", "",
    "## 입력 특징·단계·seed", "",
    "- `features.jsonl`: 원행에서 재계산한 S/K/F/u/d/N/E·밀도·primary proof와 원자료 경로. F는 원 singleton 행의 서로 다른 후보 수다.",
    "- `filter-results.jsonl`: 실제 적용 예산, 제품의 부분 특징 관측, 단계 시간·완료·states, refine pass, 엔진·proof·최종 hash.",
    "- `FEATURE_PAIR_SUMMARY.json`: 고정 구간의 S/K/F/u/d별 품질 변화와 probe/refine 시간 차. 구간별 숫자는 기술통계이며 최적 threshold를 추정하거나 채택하지 않았다.",
    "- per-save는 여러 filter를 포함하므로 filter 단계비용을 공개 API 전체 호출시간과 동일시하지 않는다. ALL과 별도 해석한다.",
    "- `trace-seeds.jsonl`: trace 중간 input/output keys와 품질 hash·원 stage 벡터. 주 timing 호출의 primary seed는 UNOBSERVED이므로 품질 차이를 seed 변화에 직접 귀속하지 않는다.", "",
    "## 자료 인덱스·재현", "",
    "- `AUDIT.json`: 선택·검증 상태, UNKNOWN 재측정 연결, 원run별 상태·환경.",
    "- `SOURCE_INDEX.json`: 회수한 artifact별 run/id/digest/receipt/원자료 경로. `BUDGET.json`: 원 clock·실패 시도를 포함한 자원 원장.",
    "- `attempts.jsonl`: 선택되지 않은 중단 시도까지 포함하는 원기록 인덱스. `selected-calls.jsonl`: 최종 선택 25,081호출과 raw byte offset/hash.",
    "- `quality-pairs.jsonl`/`QUALITY_SUMMARY.json`: 최종 벡터 및 원행 손실 크기·빈도, proof 변화와 최악 사례.",
    "- `MANIFEST.json`: 분석 산출물 해시. `REPORT_MANIFEST.json`: 보고서·추가 집계 해시.",
    "- 코드: `tools/fast-routing/analyze-results.mjs`, `tools/fast-routing/report-results.py`. 로컬 작업은 원자료 읽기·재검산이며 population solver 호출은 0이다.", "",
    "## 해석 범위", "",
    "과거 개발 모집단의 재현 실험이며 fresh holdout이 아니다. 입력 반복·filter·mirrorGroup은 독립 표본이 아니다. 엔진/primary seed 변동은 허용된 관측이며 seed 동일성이나 secondary exact 보존은 채택 필수 조건이 아니다. 이번 결과는 최적화된 2x2 최대16pass에서 probe 비용·품질 손익을 정리한 것이며, 정책 승자·품질 허용치·새 triage 규칙은 확정하지 않았다.", ""]
(out / "RESULTS_KO.md").write_text("\n".join(lines), encoding="utf-8")
names = ["QUALITY_SUMMARY.json", "FEATURE_PAIR_SUMMARY.json", "LONG_7_REPEAT.json", "DIAGNOSTIC_SUMMARY.json", "RESULTS_KO.md"]
save("REPORT_MANIFEST.json", {"scriptSha256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    "files": [{"path": n, "bytes": (out / n).stat().st_size, "sha256": hashlib.sha256((out / n).read_bytes()).hexdigest()} for n in names]})
print("Wrote RESULTS_KO.md and supporting summaries")
