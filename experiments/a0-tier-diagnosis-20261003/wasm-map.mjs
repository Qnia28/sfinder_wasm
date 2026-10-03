import assert from 'node:assert/strict';
// Static section parser; never instantiates or calls the product solver.
export function exportMap(bytes){
  const b=new Uint8Array(bytes);assert.deepEqual([...b.slice(0,8)],[0,97,115,109,1,0,0,0]);let p=8;
  const leb=()=>{let n=0,s=0,c;do{assert(p<b.length&&s<35);c=b[p++];n+=(c&127)*2**s;s+=7;}while(c&128);return n;};
  const name=()=>{const n=leb();assert(p+n<=b.length);const v=new TextDecoder().decode(b.slice(p,p+n));p+=n;return v;};
  const exports=[],bodies=[];let definedFunctions=0;
  while(p<b.length){const type=b[p++],len=leb(),end=p+len;assert(end<=b.length);
    if(type===3){definedFunctions=leb();}
    else if(type===7){const n=leb();for(let i=0;i<n;i++){const symbol=name(),kind=b[p++],index=leb();exports.push({symbol,kind,index});}}
    else if(type===10){const n=leb();for(let i=0;i<n;i++){const size=leb();bodies.push({definedIndex:i,bodyBytes:size});p+=size;}}
    p=end;
  }
  assert.equal(bodies.length,definedFunctions);
  return {exports,definedFunctions,bodySizes:bodies,namesUnavailable:true,warning:'Binary has no Rust function-name section; export index is not a pure DFS boundary'};
}
