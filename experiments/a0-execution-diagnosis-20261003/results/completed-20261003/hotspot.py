"""Static common-hot-function correlation only; performs no native calls."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

HERE=Path(__file__).resolve().parent
PREVIOUS=HERE.parent/'a0-tier-diagnosis-20261003'
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-execution-diagnosis-20261003')
sha=lambda b:hashlib.sha256(b).hexdigest()
analysis=json.loads((HERE/'ANALYSIS.json').read_text(encoding='utf-8'))
assert analysis['status']=='COMPLETE_INDEPENDENTLY_AUDITED'
old_seal=json.loads((PREVIOUS/'SEAL.json').read_text(encoding='utf-8'))
for name in ['ORIGINAL_WASM.wat','CALLGRAPH.json']:
    f=next(f for f in old_seal['files'] if f['file']==name);b=(PREVIOUS/name).read_bytes();assert sha(b)==f['sha256'] and len(b)==f['bytes']
graph=json.loads((PREVIOUS/'CALLGRAPH.json').read_text(encoding='utf-8'));assert graph['inputWasmSha256']=='73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3'
functions={f['functionIndex']:f for f in graph['functions']}
assert functions[363]['directCallSites']['359']==1 and functions[380]['directCallSites']['359']==1
wat=(PREVIOUS/'ORIGINAL_WASM.wat').read_text(encoding='utf-8');starts=list(re.finditer(r'^  \(func \(;(\d+);\)',wat,re.M))
i=next(i for i,m in enumerate(starts) if int(m.group(1))==359);body=wat[starts[i].start():starts[i+1].start()]
assert '(param i32 i32 i32 i32 i32 i32)' in body and '(result i32)' in body
assert 'i64.popcnt' in body and 'i32.div_u' in body and not re.search(r'\bcall\b',body)
source_path='rust/pc-core/src/min_cover.rs';source=subprocess.check_output(['git','-C',str(REPO),'show',f"{analysis['sourceCommit']}:{source_path}"]).decode()
lines=source.splitlines();source_excerpt='\n'.join(lines[53:88]);assert 'fn lower_bound' in source_excerpt
profiles=[]
for p in analysis['profiles']:
    f=next(f for f in p['functions'] if f['functionIndex']==359)
    recursive=363 if p['variant']=='R' else 380
    rec=next(f for f in p['functions'] if f['functionIndex']==recursive)
    tr=next(t for t in analysis['compilerGenerationTraces'] if t['runId']==p['runId'])
    assert {e['compiler'] for e in tr['events'] if e['functionIndex']==359}=={'Liftoff','TurboFan'}
    profiles.append({'runId':p['runId'],'variant':p['variant'],'common359':f,'recursiveFunction':rec,
        'function359CompilerGeneration':[e for e in tr['events'] if e['functionIndex']==359],
        'executionTierIdentified':False})
result={'status':'COMMON_FUNCTION_HOTSPOT_IDENTIFIED_WITH_STATIC_SOURCE_CORRESPONDENCE','additionalNativeCalls':0,
    'wasmSha256':graph['inputWasmSha256'],'priorWatSha256':sha((PREVIOUS/'ORIGINAL_WASM.wat').read_bytes()),
    'commonFunctionIndex':359,'directStaticParents':[363,380],'watFunctionBodySha256':sha(body.encode()),'watFunctionBody':body,
    'source':{'file':source_path,'sourceCommit':analysis['sourceCommit'],'fileSha256':sha(source.encode()),'lines':'54-88','excerpt':source_excerpt},
    'staticCorrespondence':{'candidateRustSymbol':'lower_bound','confidence':'STRONG_STRUCTURAL_CORRESPONDENCE_NOT_DEBUG_SYMBOL_PROOF',
        'evidence':['Six i32 parameters match three slice fat pointers; result i32',
            'Initial popcount of full & !covered, zero returns0',
            'Nested scan of coverage vectors computing popcount of coverage & (full & !covered)',
            'Maximum candidate gain selection; no recursive/direct calls inside359',
            'Zero maximum gain returns -1; otherwise unsigned division and remainder ceil',
            'Both variant recursive functions directly call359; source BestSetSearch::run calls common lower_bound']},
    'profiles':profiles,
    'conclusion':'Current cost location is a common popcount/max-gain/lower-bound path, not an observed A-only sibling/trail hotspot. This does not explain the old 9V45 R/A discrepancy.',
    'limits':'Compiler optimizations can inline helpers. No Rust debug names; sampling proportion is not exact per-function CPU time; compiled TurboFan code is not every-frame tier evidence.'}
with (HERE/'HOTSPOT.json').open('x',encoding='utf-8') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['watFunctionBody','profiles']},indent=2))
print(json.dumps({'profileHotspots':[{'runId':p['runId'],'self359Percent':p['common359']['selfFraction']*100,'inclusiveRecursivePercent':p['recursiveFunction']['inclusiveFraction']*100} for p in profiles]},indent=2))
