"""Static WAT callgraph versus existing traces; performs zero solver calls."""
from pathlib import Path
import collections
import hashlib
import json
import re

HERE=Path(__file__).resolve().parent
REPO=Path('C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-tier-diagnosis-20261003')
sha=lambda b:hashlib.sha256(b).hexdigest()
text=(HERE/'ORIGINAL_WASM.wat').read_text(encoding='utf-8')
starts=list(re.finditer(r'^  \(func \(;(\d+);\)',text,re.M));functions={}
for i,m in enumerate(starts):
    body=text[m.start():starts[i+1].start() if i+1<len(starts) else len(text)]
    idx=int(m.group(1));calls=collections.Counter(map(int,re.findall(r'^\s+call (\d+)\b',body,re.M)))
    functions[idx]={'functionIndex':idx,'directCallSites':dict(calls),'selfRecursive':idx in calls,'indirectCallSites':len(re.findall(r'^\s+call_indirect\b',body,re.M))}
assert len(functions)==455
assert functions[114]['directCallSites']=={112:1} and functions[116]['directCallSites']=={112:1}
assert 113 in functions[112]['directCallSites']
assert 363 in functions[113]['directCallSites'] and 380 in functions[113]['directCallSites']
assert functions[363]['selfRecursive'] and functions[380]['selfRecursive']
analysis=json.loads((HERE/'ANALYSIS_CONTINUATION.json').read_text(encoding='utf-8'))
traces={t['variant']:t for t in analysis['traces'] if t['mode']=='DEFAULT'}
turbo={v:{e['functionIndex'] for e in t['events'] if e['compiler']=='TurboFan'} for v,t in traces.items()}
assert {112,113,363}<=turbo['R'] and {112,113,380}<=turbo['A']
assert 380 not in turbo['R'] and 363 not in turbo['A']
package=REPO/'.a0/disassembly/package-lock.json';lock=json.loads(package.read_text(encoding='utf-8'))
wabt=lock['packages']['node_modules/wabt'];assert wabt['version']=='1.0.39'
record={'status':'STATIC_CALLGRAPH_AND_EXISTING_TRACE_CORRELATION_COMPLETE','nativeCalls':0,
    'inputWasmSha256':sha((REPO/'wasm/pc_wasm.wasm').read_bytes()),'watSha256':sha((HERE/'ORIGINAL_WASM.wat').read_bytes()),
    'tool':{'package':'wabt','version':wabt['version'],'registryIntegrity':wabt['integrity'],'packageLockSha256':sha(package.read_bytes()),'entrySha256':sha((REPO/'.a0/disassembly/node_modules/wabt/index.js').read_bytes())},
    'functions':[functions[i] for i in sorted(functions)],'confirmedPaths':{'R':'export114 -> shared112 -> shared113 -> self-recursive363','A':'export116 -> shared112 -> shared113 -> self-recursive380'},
    'defaultTraceTurboFanShared':sorted(turbo['R']&turbo['A']),'defaultTraceTurboFanROnly':sorted(turbo['R']-turbo['A']),'defaultTraceTurboFanAOnly':sorted(turbo['A']-turbo['R']),
    'interpretation':'Default can have a Liftoff export wrapper while shared and variant-specific recursive paths have TurboFan-generated code. Export compiler label alone does not identify the expensive path tier.',
    'limits':'Direct static call sites are not dynamic call counts. No Rust debug names exist; self-recursive index is not a proven source-level symbol. Compiler generation is not every-frame execution or function CPU attribution.'}
with (HERE/'CALLGRAPH.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in record.items() if k!='functions'},indent=2))
