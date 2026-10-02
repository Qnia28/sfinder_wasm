function namedError(name,message){const e=new Error(message);e.name=name;return e}
function abortError(message='cancelled'){return namedError('AbortError',message)}
function invalidStateError(message='worker client is disposed'){return namedError('InvalidStateError',message)}
function workerEventError(event,fallback){
  if(event?.error instanceof Error)return event.error;
  const e=new Error(event?.message||fallback);
  e.name=event?.error?.name||'WorkerError';
  return e;
}
function responseError(message){const e=new Error(message?.error?.message??'worker error');e.name=message?.error?.name??'Error';return e}

export class SolverWorkerClient{
  constructor(factory){
    this.factory=factory;
    this.nextId=1;
    this.worker=null;
    this.active=null;
    this.queue=[];
    this.disposed=false;
    this.spawn();
  }
  spawn(){
    if(this.disposed)throw invalidStateError();
    const worker=this.factory();
    this.worker=worker;
    worker.onmessage=e=>this.handleMessage(worker,e);
    worker.onerror=e=>{e?.preventDefault?.();this.handleFatal(worker,workerEventError(e,'worker execution failed'))};
    worker.onmessageerror=e=>this.handleFatal(worker,workerEventError(e,'worker message deserialization failed'));
    return worker;
  }
  ensureWorker(){return this.worker??this.spawn()}
  cleanup(item){if(item?.signal&&item.onAbort)item.signal.removeEventListener('abort',item.onAbort)}
  rejectItem(item,error){if(!item)return;this.cleanup(item);item.reject(error)}
  terminateCurrent(){const worker=this.worker;this.worker=null;if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate()}}
  request(kind,input,options={}){
    if(this.disposed)return Promise.reject(invalidStateError());
    const signal=options?.signal;
    if(signal?.aborted)return Promise.reject(abortError('request aborted'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      const item={id,kind,input,resolve,reject,signal,onAbort:null};
      if(signal){item.onAbort=()=>this.abortItem(item);signal.addEventListener('abort',item.onAbort,{once:true})}
      this.queue.push(item);
      this.pump();
    });
  }
  pump(){
    if(this.disposed||this.active||!this.queue.length)return;
    const item=this.queue.shift();
    if(item.signal?.aborted){this.rejectItem(item,abortError('request aborted'));queueMicrotask(()=>this.pump());return}
    let worker;
    try{worker=this.ensureWorker()}catch(error){this.rejectItem(item,error);queueMicrotask(()=>this.pump());return}
    this.active=item;
    try{worker.postMessage({id:item.id,kind:item.kind,input:item.input})}
    catch(error){this.active=null;this.rejectItem(item,error);queueMicrotask(()=>this.pump())}
  }
  handleMessage(worker,event){
    if(worker!==this.worker)return;
    const message=event?.data,item=this.active;
    if(!item)return;
    if(!message||message.id!==item.id){this.handleFatal(worker,namedError('WorkerProtocolError',`unexpected worker response id ${message?.id??'<missing>'}`));return}
    this.active=null;
    this.cleanup(item);
    if(message.ok)item.resolve(message.value);else item.reject(responseError(message));
    this.pump();
  }
  handleFatal(worker,error){
    if(worker!==this.worker)return;
    this.terminateCurrent();
    const active=this.active;this.active=null;
    this.rejectItem(active,error);
    const queued=this.queue.splice(0);
    for(const item of queued)this.rejectItem(item,error);
  }
  abortItem(item){
    if(this.disposed)return;
    if(this.active===item){
      this.active=null;
      this.terminateCurrent();
      this.rejectItem(item,abortError('request aborted'));
      this.pump();
      return;
    }
    const index=this.queue.indexOf(item);
    if(index>=0){this.queue.splice(index,1);this.rejectItem(item,abortError('request aborted'))}
  }
  cancel(){
    if(this.disposed)return;
    this.terminateCurrent();
    const error=abortError('cancelled'),active=this.active;this.active=null;
    this.rejectItem(active,error);
    for(const item of this.queue.splice(0))this.rejectItem(item,error);
    try{this.spawn()}catch{}
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    this.terminateCurrent();
    const error=abortError('disposed'),active=this.active;this.active=null;
    this.rejectItem(active,error);
    for(const item of this.queue.splice(0))this.rejectItem(item,error);
  }
}

export const viteWorkerFactory=()=>new Worker(new URL('./pc.worker.mjs',import.meta.url),{type:'module'});
