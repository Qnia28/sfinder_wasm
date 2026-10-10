import test from 'node:test';
import assert from 'node:assert/strict';
import { normalOomSkipIds } from '../tools/secondary-bench/common/triage/analysis.mjs';
test('only a prior same-runner reclaimed OOM explains normal skip',()=>{
  const common={inputId:'f',variant:'P15_OPEN',invocationId:'run',phase:'ALL_INITIAL',runnerId:'runner'};
  const oom={...common,callId:'oom',executionAttemptId:'attempt',status:'OOM',execution:{reaped:true}};
  const skip={...common,callId:'skip',executionAttemptId:null,status:'NOT_RUN_AFTER_OOM',ms:null};
  const expected=[oom,skip];
  assert.deepEqual([...normalOomSkipIds([skip,oom],expected)],['skip']);
  for(const altered of [{...oom,runnerId:'other'},{...oom,variant:'H9_OPEN'},{...oom,execution:{reaped:false}},{...oom,status:'ERROR'}])
    assert.equal(normalOomSkipIds([altered,skip],expected).size,0);
  assert.equal(normalOomSkipIds([oom,skip],expected.toReversed()).size,0);
  assert.equal(normalOomSkipIds([oom,{...skip,status:'NOT_RUN_BUDGET'}],expected).size,0);
  assert.equal(normalOomSkipIds([oom,{...skip,executionAttemptId:'started'}],expected).size,0);
});
