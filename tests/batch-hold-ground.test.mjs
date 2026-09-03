import test from 'node:test';
import assert from 'node:assert/strict';
import {canQueueBuildOrder} from '../src/batch-orders.mjs';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';

test('finite queue may consume the final held piece after queue exhaustion',()=>{
  // Hold I, place L from next, then consume the held I after there is no next.
  assert.equal(canQueueBuildOrder('IL','LI',true),true);
  assert.equal(canQueueBuildOrder('IL','LI',false),false);
});

test('batch exact placement rejects an airborne target even when reverse-reachable',async()=>{
  const reach=new BatchReachability(await loadBatchWasm(),4,'jstris');
  try{
    // Horizontal I at row 1 on an empty board is airborne. It is reachable,
    // but SFinder cover does not consider it a locked operation.
    const airborne=0b1111n << 10n;
    assert.equal(reach.placeExact(0n,'I',airborne),null);
    // The same I on row 0 is grounded and valid.
    assert.notEqual(reach.placeExact(0n,'I',0b1111n),null);
  }finally{}
});
