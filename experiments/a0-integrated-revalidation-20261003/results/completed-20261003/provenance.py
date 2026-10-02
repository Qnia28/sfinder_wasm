"""Validate original segment/alias/metadata provenance without reserved decode."""
from pathlib import Path
import hashlib
import json
import subprocess

here=Path(__file__).resolve().parent
repo=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-revalidation-20261003')
experiment=repo/'experiments/a0-integrated-revalidation-20261003'
source=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-integrated-bench-20261002/experiments/integrated-bench-20261002')
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(v):return json.dumps(v,separators=(',',':'),ensure_ascii=False).encode()
new=load(experiment/'INPUTS.json');old=load(source/'INPUTS.json');old_index={e['id']:e for e in old['entries']}
assert new['sourceIndexSha256']==sha(canonical(old))
assert load(experiment/'POPULATION.json')==old
for p in new['packs']:
    b=(experiment/p['file']).read_bytes();assert len(b)==p['bytes'] and sha(b)==p['sha256']
for e in new['entries']:
    original=old_index[e['id']]
    assert {k:v for k,v in e.items() if k not in ['pack','offset','sourcePack','sourceOffset']}=={k:v for k,v in original.items() if k not in ['pack','offset']}
    assert e['sourcePack']==original['pack'] and e['sourceOffset']==original['offset']
    with (source/original['pack']).open('rb') as f:f.seek(original['offset']);before=f.read(original['length'])
    with (experiment/e['pack']).open('rb') as f:f.seek(e['offset']);after=f.read(e['length'])
    assert before==after and sha(after)==e['sha256']
baseline='c0cb2a048e7275bfea587d176b1954efff0a8a08';product='e5f2f3d1a9885085e11cde7457aad2b338ca8130';head='13b274ef91a2debe07121f7b4a0e670ed39e034f'
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args])
assert git('diff','--name-only',product,head,'--','src','rust','wasm','package.json','package-lock.json')==b''
patch=git('diff','--binary',baseline,product,'--','src/min-cover-exact-secondary.mjs','wasm/pc_wasm.wasm')
(here/'PRODUCT_ONLY_PENDING_APPROVAL.patch').write_bytes(patch)
ref_source=Path('D:/AI/sfinder-wasm/tools/validation/integrated-bench-20261002/github-run-37018994637')
references=load(experiment/'EXACT_REFERENCES.json')['references']
for ref in references:
    b=(ref_source/ref['sourceFile']).read_bytes();assert sha(b)==ref['sourceFileSha256']
    raw=next(l for l in b.splitlines() if json.loads(l)['matrixId']==ref['matrixId'])
    assert sha(raw)==ref['sourceRowSha256'];r=json.loads(raw)
    assert r['verdict']=='VERIFIED_EXACT' and r['selectedIDs']==ref['selectedIDs'] and r['qualitySha256']==ref['qualitySha256']
population_entries=[e for e in old['entries'] if e['partition'] in ['development','reserved-validation']]
assert len(population_entries)==1721
report={'status':'PROVENANCE_VERIFIED_NO_SOLVER_CALLS','candidateCommit':head,'productCandidateUnchanged':True,
        'selectedEntriesBytePreserved':len(new['entries']),'indexedEntriesMetadataPreserved':len(old['entries']),
        'campaignPopulationEntriesMetadataPreserved':len(population_entries),'previousLegacyRegressionIndexEntriesAlsoPreserved':len(old['entries'])-len(population_entries),
        'priorIndependentThresholdProofsImported':len(references),'reservedDecodedByProvenance':0,
        'primaryPcSolverCalls':0,'nativeSolverCalls':0,'devApplied':False,'productOnlyPatchSha256':sha(patch)}
(here/'PROVENANCE.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
