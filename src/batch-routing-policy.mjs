export const BATCH_ROUTING = Object.freeze({
  congruentRustMaxPieces: 15,
});

export function shouldUseRustCongruent({ pieceCount, reachability }) {
  return pieceCount <= BATCH_ROUTING.congruentRustMaxPieces
    && typeof reachability?.congruent === "function";
}
