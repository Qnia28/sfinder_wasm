import { solveQueuesExistence } from "./pc-enumeration-engine.mjs";
import { expandPattern } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

export function calculateChance({ sourceFumen, pattern, clear = 4, solver, useHold = true }) {
  const { board } = decodeAndValidate(sourceFumen, clear);
  const queues = expandPattern(pattern);
  const solved = solveQueuesExistence({ board, queues, solver, useHold });
  let success = 0;
  const failedQueues = [];
  for (let index = 0; index < queues.length; index += 1) {
    if (solved[index]) success += 1;
    else failedQueues.push(queues[index]);
  }
  return {
    total: queues.length,
    success,
    failed: failedQueues.length,
    failedQueues,
    percent: 100 * success / queues.length,
  };
}
