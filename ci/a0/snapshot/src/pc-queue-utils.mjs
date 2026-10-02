export function dedupeQueues(queues) {
  const uniqueQueues = [];
  const indexByQueue = new Map();
  const remap = new Uint32Array(queues.length);
  let hasDuplicates = false;

  for (let index = 0; index < queues.length; index += 1) {
    const queue = queues[index];
    let id = indexByQueue.get(queue);
    if (id === undefined) {
      id = uniqueQueues.length;
      indexByQueue.set(queue, id);
      uniqueQueues.push(queue);
    } else {
      hasDuplicates = true;
    }
    remap[index] = id;
  }

  return { uniqueQueues, remap, hasDuplicates };
}

export function remapQueueResults(remap, uniqueResults) {
  return Array.from(remap, (id) => uniqueResults[id]);
}

export function mapQueuesCached(queues, calculate) {
  const cache = new Map();
  return queues.map((queue) => {
    if (!cache.has(queue)) cache.set(queue, calculate(queue));
    return cache.get(queue);
  });
}
