import{SolverWorkerClient}from'./worker-client.mjs';
export function viteBatchWorkerFactory(){return new Worker(new URL('./batch.worker.mjs',import.meta.url),{type:'module'})}
export function createBatchWorkerClient(factory=viteBatchWorkerFactory){return new SolverWorkerClient(factory)}
