// Diagnostic facade only; do not mutate WebAssembly.Instance.exports or source.
export function profileExports(exports){
  let current=null;
  const facade={...exports};
  for(const [name,fn]of Object.entries(exports)){
    if(typeof fn!=='function')continue;
    const core=/^solver_min_cover_at_count_integrated(_partitioned)?_bounded$/.test(name);
    const alloc=/^wasm_(alloc|dealloc)_u32$/.test(name);
    if(!core&&!alloc)continue;
    facade[name]=(...args)=>{
      if(!current)return fn(...args);
      const t=performance.now();if(core){current.coreEntries++;current.coreEntryMs=t;current.coreExport=name;}
      try{return fn(...args);}finally{const end=performance.now();if(core){current.coreWallMs+=end-t;current.coreReturnMs=end;}else{current.allocationAbiWallMs+=end-t;current.allocationAbiCalls++;}}
    };
  }
  return {facade,start(){current={coreEntries:0,coreWallMs:0,allocationAbiWallMs:0,allocationAbiCalls:0};},finish(start,end){const r=current;current=null;if(r.coreEntries!==1)throw Error('Diagnostic core count mismatch');return {...r,preCoreWallMs:r.coreEntryMs-start,postCoreWallMs:end-r.coreReturnMs,jsAndOtherAbiResidualMs:end-start-r.coreWallMs-r.allocationAbiWallMs,timerHookCalls:2*(r.coreEntries+r.allocationAbiCalls),getterHooks:false};}};
}
