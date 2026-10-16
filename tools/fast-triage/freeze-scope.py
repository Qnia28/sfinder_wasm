"""Offline, read-only historical selection. No solver or network calls."""
import argparse
import hashlib
import json
import pathlib
import sqlite3

p = argparse.ArgumentParser()
p.add_argument('database', type=pathlib.Path)
p.add_argument('--output', type=pathlib.Path, default=pathlib.Path('tools/fast-triage/SCOPE_20261017.json'))
a = p.parse_args()
expected = '98441a87c73449e38c97a4cec31a7f30634f2bc3a03dfff488ec77365a5369a0'
assert hashlib.file_digest(a.database.open('rb'), 'sha256').hexdigest() == expected
c = sqlite3.connect(a.database.resolve().as_uri() + '?mode=ro', uri=True)
fixtures = [json.loads(r[0]) for r in c.execute('select metadata_json from fixtures order by fixture_id')]
boundary = [f for f in fixtures if not f['primaryHard'] and (
    168 <= f['features']['u'] <= 228 or 14 <= f['features']['d'] <= 17)]
scope = {
    'schema': 1, 'study': 'fast-triage-e2e-20261017', 'status': 'PREPARED_NOT_EXECUTION_AUTHORIZATION',
    'branch': 'experiment/fast-triage-20261017', 'repository': 'Qnia28/sfinder_wasm',
    'sourceScope': 'tools/fast-bench/SCOPE_20261015_v2.json',
    'sourceScopeHashEncoding': 'UTF-8 with CRLF normalized to LF (Git blob bytes)',
    'sourceScopeSha256': hashlib.sha256(pathlib.Path('tools/fast-bench/SCOPE_20261015_v2.json').read_bytes().replace(b'\r\n', b'\n')).hexdigest(),
    'historicalDatabaseSha256': expected, 'developmentNotFresh': True,
    'selection': 'Prior 273 E2E commands UNION all observed nonhard u168..228 or d14..17 commands UNION named regressions',
    'boundaryCommandIds': sorted({f['command']['id'] for f in boundary}),
    'boundaryEvidence': [{'id': f['id'], 'features': f['features'], 'K': f['K']} for f in boundary],
    'requiredCommandIds': [
        'c7-2plus2-qb-row-076/all/bag',
        'c7-2plus2-qb-row-140/all/restricted-split/per-save',
        'cycle1-pcinfo-030/all/restricted-split',
        'cycle1-pcinfo-039/all/restricted-split/per-save',
    ],
    'arms': ['BASE100', 'I10_FIXED_AUX', 'U192', 'U228_OR_D16', 'U192_OR_D16', 'S200_OR_D16'],
    'repeats': 3, 'traceCommands': 12, 'traceRepeats': 2,
    'captureShards': 32, 'maxParallel': 16,
    'resourceCaps': {'captureSeconds': 340, 'callSeconds': 220, 'memoryBytes': 3221225472,
                     'maxRunnerHours': 1200, 'deadlineHours': 96},
    'clock': 'New campaign origin; historical analysis is selection evidence, not resumed execution',
    'release': False,
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'boundaryFixtures': len(boundary), 'boundaryCommands': len(scope['boundaryCommandIds']), 'output': str(a.output)}))
