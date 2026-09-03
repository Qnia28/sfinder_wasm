import{buildVariants,createQueueOrderProjector,mirrorOperations,normalizeCoverMode,variantSatisfiesMode}from'./batch-orders.mjs';

function normalizeCases(queues){
 return queues.map((entry,index)=>typeof entry==='string'?{caseId:`legacy:${index}`,queue:entry}:entry);
}

function evaluateTarget(target,{cases,height,reachability,useHold,mode,projector,isMirror=false}){
 const{_batchHeight,...publicTarget}=target;
 const accelerated=reachability?.coverTarget?.({base:target.base,operations:target.operations,cases,mode,useHold});
 let variants,coveredCases;
 if(accelerated){variants=accelerated.variants;coveredCases=cases.filter((_,i)=>accelerated.covered[i]);}
 else{
  if(!isMirror&&mode==='normal'&&Array.isArray(target.variants)&&Array.isArray(target.orders)){
   variants=target.variants;coveredCases=projector.coveredIndices(target.orders,useHold).map(i=>cases[i]);
  }else{
   variants=buildVariants({base:target.base,operations:target.operations,height,reachability,mode}).filter(v=>variantSatisfiesMode(v,mode));
   const orders=[...new Set(variants.map(v=>v.order))];coveredCases=projector.coveredIndices(orders,useHold).map(i=>cases[i]);
  }
 }
 const orders=[...new Set(variants.map(v=>v.order))];
 return{
  ...publicTarget,
  mirror:isMirror,
  mode,
  variants,
  orders,
  coveredCaseIds:coveredCases.map(entry=>entry.caseId),
  covered:coveredCases.map(entry=>entry.queue),
  coverage:coveredCases.length,
 };
}

export function coverTargets({targets,queues,height=4,reachability,reachabilityForHeight=null,useHold=true,mirror=false,mode='normal'}){
 mode=normalizeCoverMode(mode);
 const cases=normalizeCases(queues),targetResults=[],coveredUnion=new Set(),projector=createQueueOrderProjector(cases);
 for(const target of targets){
  const targetHeight=target._batchHeight??height;
  const targetReachability=reachabilityForHeight?reachabilityForHeight(targetHeight):reachability;
  if(!targetReachability)throw new Error(`missing batch reachability for height ${targetHeight}`);
  const original=evaluateTarget(target,{cases,height:targetHeight,reachability:targetReachability,useHold,mode,projector});
  for(const caseId of original.coveredCaseIds)coveredUnion.add(caseId);
  const {coveredCaseIds:originalIds,...publicOriginal}=original;
  targetResults.push(publicOriginal);
  if(mirror){
   const mt=mirrorOperations(target.base,target.operations,targetHeight);
   const mirrored=evaluateTarget({...target,base:mt.base,operations:mt.operations},{cases,height:targetHeight,reachability:targetReachability,useHold,mode,projector,isMirror:true});
   for(const caseId of mirrored.coveredCaseIds)coveredUnion.add(caseId);
   const {coveredCaseIds:mirroredIds,...publicMirrored}=mirrored;
   targetResults.push(publicMirrored);
  }
 }
 const failedCases=cases.filter(entry=>!coveredUnion.has(entry.caseId));
 return{
  mode,
  targets:targetResults,
  covered:coveredUnion.size,
  total:cases.length,
  failed:failedCases.map(entry=>entry.queue),
 };
}
