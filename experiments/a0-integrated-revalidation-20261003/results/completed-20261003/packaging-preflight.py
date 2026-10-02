"""Synthetic upload/archive fault injection: native calls0, real uploads0."""
from pathlib import Path
import hashlib
import json

here=Path(__file__).resolve().parent
repo=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-revalidation-20261003')
source=next((repo/'.a0').glob('preflight-*/post-result-hang.jsonl'))
before=source.read_bytes();rows=[json.loads(l) for l in before.splitlines()]
raw=next(r for r in rows if r.get('type')=='phase-result')
assert raw['raw']['qualityVector']==[1] and raw['raw']['keys']==['000'] and raw['raw']['completed'] is False
def mock_upload(_):raise ConnectionError('Injected artifact uploader failure, no HTTP request')
try:mock_upload(before);raise AssertionError('Fault not injected')
except ConnectionError:pass
assert source.read_bytes()==before
checksum=hashlib.sha256(before).hexdigest()
corrupt=before+b'corrupt archive tail'
assert hashlib.sha256(corrupt).hexdigest()!=checksum
assert source.read_bytes()==before
report={'status':'PASS_SYNTHETIC_PACKAGING_FAULT_INJECTION','rawFixtureSha256':checksum,
        'injectedUploadFailureRetainedSourceBytes':True,'injectedArchiveCorruptionDetected':True,
        'rawCappedWitnessStillReadable':True,'nativeSolverCalls':0,'realHttpOrUploadCalls':0,
        'limitation':'Mock uploader and checksum guard; not an actual GitHub outage test','devApplied':False}
(here/'PACKAGING_PREFLIGHT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
