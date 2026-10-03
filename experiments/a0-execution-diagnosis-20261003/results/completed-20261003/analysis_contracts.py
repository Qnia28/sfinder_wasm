"""Test the independent aggregator's API clipping and recursion deduplication."""
from pathlib import Path
import ast
import collections
import json
import statistics
import re

HERE=Path(__file__).resolve().parent
tree=ast.parse((HERE/'analyze.py').read_text(encoding='utf-8'))
parts=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='aggregate' or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='frameindex' for t in n.targets)]
assert len(parts)==2
namespace={'collections':collections,'statistics':statistics,'re':re};exec(compile(ast.Module(body=parts,type_ignores=[]),'isolated_aggregator','exec'),namespace)
frame=lambda name:{'functionName':name,'url':'wasm://wasm/fixture'}
nodes=[{'id':1,'callFrame':frame('(root)'),'children':[2]},
    {'id':2,'callFrame':frame('wasm-function[363]'),'children':[3]},
    {'id':3,'callFrame':frame('wasm-function[363]'),'children':[4]},
    {'id':4,'callFrame':frame('wasm-function[359]')}]
profile={'profile':{'startTime':0,'endTime':10000,'nodes':nodes,'samples':[4],'timeDeltas':[10000]}}
r=namespace['aggregate'](profile,2000,8000);f={f['functionIndex']:f for f in r['functions']}
assert r['coveredSampleUs']==6000 and f[359]['selfSampleUs']==6000 and f[363]['inclusiveSampleUs']==6000
assert f[363]['selfSampleUs']==0 and f[363]['inclusiveFraction']==1
profile['profile'].update({'endTime':30000,'samples':[4,3,4],'timeDeltas':[10000,10000,10000]})
r=namespace['aggregate'](profile,12000,18000);f={f['functionIndex']:f for f in r['functions']}
assert r['coveredSampleUs']==6000 and f[363]['selfSampleUs']==6000 and f[363]['inclusiveSampleUs']==6000 and f.get(359) is None
record={'status':'PASS','tests':2,'nativeCalls':0,'checks':['API interval clipping','self versus inclusive separation','recursion deduplicated per function index','out-of-window samples excluded']}
with (HERE/'ANALYSIS_CONTRACTS.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2);f.write('\n')
print(json.dumps(record))
