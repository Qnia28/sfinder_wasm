import { PIECE_CODE } from "./piece-order.mjs";

export const DEFAULT_SOLUTION_WORD_STRIDE = 9;
export const U32_MAX = 0xffffffff;

export function wasmU32(value) {
  return Number(value) >>> 0;
}

export function queueBits(queue) {
  if (queue.length > 21) throw new Error(`queue length ${queue.length} exceeds 21`);
  let bits = 0n;
  for (let index = 0; index < queue.length; index += 1) {
    const value = PIECE_CODE[queue[index]];
    if (value === undefined) throw new Error(`bad piece ${queue[index]}`);
    bits |= BigInt(value) << BigInt(index * 3);
  }
  return bits;
}

export function solutionKey(masks) {
  return masks.map((mask) => mask.toString(16)).join(":");
}
