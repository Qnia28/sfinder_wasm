import { TETRIS_DISPLAY_ORDER, RUST_PIECE_ORDER } from './piece-order.mjs';

function popcount32(n) {
  n -= (n >>> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return Math.imul((n + (n >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}
const pieceIndices = [...TETRIS_DISPLAY_ORDER].map(piece => RUST_PIECE_ORDER.indexOf(piece));

// The compact buffers belong to this request, independently of later WASM calls.
export function compactGeometry(compact) {
  const { count, geometry, stride } = compact;
  const keys = new Array(count);
  for (let si = 0; si < count; si++) {
    const masks = [];
    for (let pi = 0; pi < 7; pi++) {
      const lo = geometry[si * stride + pi * 2], hi = geometry[si * stride + pi * 2 + 1];
      masks.push(hi ? hi.toString(16) + lo.toString(16).padStart(8, '0') : lo.toString(16));
    }
    keys[si] = masks.join(':');
  }
  const index = new Map(keys.map((key, id) => [key, id])), materialized = new Map();
  return {
    keys,
    usage(si) {
      const start = si * stride;
      return Uint8Array.from(pieceIndices, pi =>
        (popcount32(geometry[start + pi * 2]) + popcount32(geometry[start + pi * 2 + 1])) / 4);
    },
    byKey: { get(key) {
      if (materialized.has(key)) return materialized.get(key);
      const si = index.get(key);
      if (si === undefined) return undefined;
      const start = si * stride, masks = [];
      for (let pi = 0; pi < 7; pi++) masks.push(BigInt(geometry[start + pi * 2]) | (BigInt(geometry[start + pi * 2 + 1]) << 32n));
      const solution = { key, masks, orderCount: geometry[start + 14], saved: geometry[start + 16] };
      materialized.set(key, solution);
      return solution;
    } },
  };
}
