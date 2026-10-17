"""Independent scalar aggregation and sampled original-row quality cross-check."""
import collections
import gzip
import hashlib
import json
import math
import pathlib
import statistics
import sys

out = pathlib.Path(sys.argv[1])
load = lambda n: json.loads((out / n).read_text(encoding="utf-8"))


def rows(name):
    with (out / name).open(encoding="utf-8") as f:
        yield from (json.loads(line) for line in f)


a, s = load("AUDIT.json"), load("SUMMARY.json")
calls = {r["callId"]: r for r in rows("selected-calls.jsonl")}
assert len(calls) == a["selected"] == 25081
assert dict(collections.Counter(r["status"] for r in calls.values())) == a["statuses"]
assert dict(collections.Counter(r["phase"] for r in calls.values())) == a["phases"]
groups = collections.defaultdict(list)
sources = collections.defaultdict(set)
for r in calls.values():
    sources[r["commandId"]].add(r["executionRunId"])
    if r["phase"] == "e2e":
        groups[(r["population"], r["arm"], r["commandId"])].append(r["policyMs"])
assert len(sources) == 1113 and all(len(v) == 1 for v in sources.values())
assert len(a["unknownRemeasured"]) == 8
for r in a["unknownRemeasured"]:
    assert calls[r["callId"]]["executionRunId"] == "39030482572"
    assert calls[r["callId"]]["status"].startswith("RETURNED")
medians = {}
for key, values in groups.items():
    assert len(values) == 3
    medians[key] = statistics.median(values)
for key, c in s["comparisons"].items():
    base, phase, pop, arm = key.split(":")
    if phase != "e2e":
        continue
    b = sum(v for (p, ar, _), v in medians.items() if p == pop and ar == base)
    v = sum(v for (p, ar, _), v in medians.items() if p == pop and ar == arm)
    assert math.isclose(b, c["baseline"]["sum"], abs_tol=1e-5)
    assert math.isclose(v, c["candidate"]["sum"], abs_tol=1e-5)
    assert math.isclose((v / b - 1) * 100, c["totalMedianChangePercent"], abs_tol=1e-8)
for p in rows("pairs.jsonl"):
    b, c = calls[p["baselineCallId"]], calls[p["callId"]]
    assert (b["commandId"], b["repeat"], b["phase"], b["diagnostics"]) == (c["commandId"], c["repeat"], c["phase"], c["diagnostics"])
    assert p["deltaMs"] == c["policyMs"] - b["policyMs"]
features = {(f["commandId"], f["filter"]): f for f in rows("features.jsonl")}


def outcome(call_id, filter_name):
    ref = calls[call_id]["raw"]
    with open(ref["file"], "rb") as f:
        f.seek(ref["offset"])
        b = f.read(ref["length"])
    assert hashlib.sha256(b).hexdigest() == ref["sha256"]
    return json.loads(b)["execution"]["result"]["outcomes"][filter_name]


checked = 0
for key, q in load("QUALITY_SUMMARY.json").items():
    if not q["worst"]:
        continue
    sample = q["worst"][0]
    ref = features[(sample["commandId"], sample["filter"])]
    b = pathlib.Path(ref["source"]).read_bytes()
    assert hashlib.sha256(b).hexdigest() == ref["sha256"]
    fixture = json.loads(gzip.decompress(b))
    vectors = []
    for call_id in [sample["baselineCallId"], sample["callId"]]:
        o = outcome(call_id, sample["filter"])
        ids = set(o["selected"])
        assert len(ids) == len(o["selected"]) == fixture["K"]
        v = [max((q for i, q in row if i in ids), default=0) for row in fixture["rows"]]
        assert all(x > 0 for x in v) and sorted(v) == o["qualityVector"]
        vectors.append(v)
    b, c = vectors
    assert sorted(c) < sorted(b)
    assert sample["lowerRows"] == sum(y < x for x, y in zip(b, c))
    assert sample["higherRows"] == sum(y > x for x, y in zip(b, c))
    assert sample["lowerMagnitude"] == sum(max(0, x - y) for x, y in zip(b, c))
    checked += 1
hashes = 0
for manifest in ["MANIFEST.json", "REPORT_MANIFEST.json"]:
    for ref in load(manifest)["files"]:
        file = out / ref["path"]
        with file.open("rb") as f:
            h = hashlib.file_digest(f, "sha256").hexdigest()
        assert h == ref["sha256"] and file.stat().st_size == ref["bytes"]
        hashes += 1
result = {"status": "PASS", "calls": len(calls), "commands": len(sources), "unknownRemeasured": 8,
    "independentQualityPairs": checked, "verifiedOutputHashes": hashes,
    "scope": "Independent Python aggregation, all pair deltas, one worst quality pair per nonempty population/baseline/arm stratum; full witness audit is in AUDIT.json",
    "scriptSha256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
with (out / "INDEPENDENT_CHECK.json").open("x", encoding="utf-8") as f:
    json.dump(result, f, indent=2)
    f.write("\n")
print(json.dumps(result))
