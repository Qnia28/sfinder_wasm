import {
  enumerateQueues,
  enumerateQueuesCached,
  solveQueuesExistence,
} from "./pc-enumeration-engine.mjs";

// Historical convenience methods. New production code should route through
// pc-enumeration-engine.mjs and use the raw enumeration ABI primitives.
export const compatibilityMethods = {
  canPcMany(board, queues, useHold = true) {
    return solveQueuesExistence({ board, queues, solver: this, useHold });
  },

  enumeratePcManyScalar(board, queues, useHold = true) {
    return enumerateQueuesCached({ board, queues, solver: this, useHold });
  },

  enumeratePcMany(board, queues, useHold = true) {
    return enumerateQueues({ board, queues, solver: this, useHold });
  },
};
