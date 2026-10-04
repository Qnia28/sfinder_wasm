"""Read-only offline audit of content-addressed historical evidence packs.

Does not extract/change the sealed archives or execute any solver. References
are conservative exposure evidence, not a claim of completed measurements.
"""
import gzip
import hashlib
import json
import pathlib
import re
import sys
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode_text(raw):
    # PowerShell historical outputs may be UTF-16LE with a BOM.
    return raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")


def mirror(board):
    value = 0
    for y in range(6):
        for x in range(10):
            if board & (1 << (y * 10 + x)):
                value |= 1 << (y * 10 + 9 - x)
    return min(board, value)


catalog = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
known_ids = {entry["id"]: entry["mirrorGroup"] for entry in catalog["entries"]}
id_prefix = re.compile(r"^(" + "|".join(re.escape(name) for name in sorted(known_ids, key=len, reverse=True)) + r")(?=/|--|$)")
known_groups = {entry["mirrorGroup"] for entry in catalog["entries"]}
output = pathlib.Path(sys.argv[2])
assert not output.exists(), "Never overwrite earlier offline evidence"
archives = [pathlib.Path(value) for value in sys.argv[3:]]
references = []
coverage = []
errors = []
fumen_refs = {}
scanned = 0
measurements_metadata = []


def refs_from(data):
    groups = set()
    fumens = set()
    direct_markers = set()

    def walk(value, key=""):
        if isinstance(value, str):
            if key in ("mirrorGroup", "board", "boardHex"):
                if re.fullmatch(r"(?:0x)?[0-9a-fA-F]{1,15}", value):
                    group = format(mirror(int(value.removeprefix("0x"), 16)), "x")
                    if group in known_groups:
                        groups.add(group)
            if key in ("fumen", "sourceFumen") and "115@" in value:
                fumens.add(value)
            if key in ("id", "setupId", "caseId", "inputId"):
                match = id_prefix.match(value)
                if match:
                    groups.add(known_ids[match.group(1)])
            if key in ("engine", "mode", "variant", "backend") and any(
                word in value.lower() for word in ("integrated", "threshold", "cpsat", "cp-sat")
            ):
                direct_markers.add(value)
        elif isinstance(value, list):
            # Packed rows and selected numeric IDs never contain source refs.
            if key not in ("rows", "keys", "seed", "offsets", "qualities", "qualityVector", "selected", "selectedIds", "quality", "ids", "caseIds", "cover", "coverage"):
                for entry in value:
                    walk(entry, key)
        elif isinstance(value, dict):
            for name, child in value.items():
                if name in known_ids:
                    groups.add(known_ids[name])
                walk(child, name)
    walk(data)
    return groups, fumens, direct_markers


for archive in archives:
    manifest_file = archive / "FILES.json"
    manifest_bytes = manifest_file.read_bytes()
    manifest = json.loads(manifest_bytes)
    packed = archive / "evidence-objects.zip"
    pack_hash = sha(packed.read_bytes())
    eligible = []
    for record in manifest["files"]:
        name = record["path"].replace("\\", "/")
        lower = name.lower()
        if not lower.endswith((".json", ".json.gz", ".jsonl")):
            continue
        if not any(part in lower for part in ("/bench/", "/experiments/", "/validation/")):
            continue
        if any(part in lower for part in ("/snapshot/", "/src/", "/rust/", "/node_modules/", "/vendor/", "/third_party/")):
            continue
        stem = pathlib.PurePosixPath(lower).name
        if any(part in stem for part in ("catalog", "setupdata", "setups", "package", "license")) or stem in ("qb.json", "cycle1.json", "cycle2.json"):
            continue  # mere source-database inventory is not exposure
        eligible.append((name, record))
    per_archive = 0
    with zipfile.ZipFile(packed) as objects:
        cache = {}
        for name, record in eligible:
            digest = record["sha256"]
            try:
                if digest not in cache:
                    raw = objects.read("objects/" + digest)
                    assert sha(raw) == digest, "content-addressed object hash mismatch"
                    if name.lower().endswith(".gz"):
                        raw = gzip.decompress(raw)
                    if name.lower().endswith(".jsonl"):
                        data = [json.loads(line) for line in decode_text(raw).splitlines() if line.strip()]
                    else:
                        data = json.loads(decode_text(raw))
                    cache[digest] = refs_from(data)
                groups, fumens, markers = cache[digest]
                source = archive.name + "/" + name
                for group in groups:
                    references.append({"mirrorGroup": group, "source": source, "sha256": digest,
                                       "kind": "CONSERVATIVE_ARCHIVED_REFERENCE"})
                for fumen in fumens:
                    fumen_refs.setdefault(fumen, []).append({"source": source, "sha256": digest})
                if markers:
                    measurements_metadata.append({"source": source, "sha256": digest,
                                                  "engineLabels": sorted(markers), "matchedGroups": sorted(groups)})
                scanned += 1
                per_archive += 1
            except Exception as error:
                errors.append({"source": archive.name + "/" + name, "sha256": digest, "error": str(error)})
    coverage.append({"archive": archive.name, "manifestSha256": sha(manifest_bytes), "packSha256": pack_hash,
                     "eligiblePaths": len(eligible), "scannedPaths": per_archive, "uniqueObjects": len(cache),
                     "catalogsExcluded": True})

result = {"schema": 1, "kind": "OFFLINE_ARCHIVE_REFERENCES_NOT_TIMING_IMPORT", "complete": False,
          "pending": ["Legacy unarchived validation/browser campaigns still need inventory",
                      "Absence of known references does not certify fresh holdout"],
          "scanCoverage": coverage, "scannedPaths": scanned, "errors": errors, "evidence": references,
          "fumenRefs": [{"fumen": fumen, "sources": sources} for fumen, sources in fumen_refs.items()],
          "directEngineMetadataCandidates": measurements_metadata}
with output.open("x", encoding="utf-8", newline="\n") as stream:
    json.dump(result, stream, ensure_ascii=False, indent=2)
    stream.write("\n")
print(json.dumps({"scannedPaths": scanned, "errors": len(errors), "referenceGroups": len({e["mirrorGroup"] for e in references}),
                  "fumenReferences": len(fumen_refs), "directEngineMetadataCandidates": len(measurements_metadata)}))
