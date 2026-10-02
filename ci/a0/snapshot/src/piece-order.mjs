export const RUST_PIECE_ORDER = "IJLOSTZ";
export const TETRIS_DISPLAY_ORDER = "TILJSZO";
export const PIECE_CODE = Object.freeze(
  Object.fromEntries([...RUST_PIECE_ORDER].map((piece, index) => [piece, index])),
);

export function pieceFromRustCode(code) {
  return Number.isInteger(code) && code >= 0 && code < RUST_PIECE_ORDER.length
    ? RUST_PIECE_ORDER[code]
    : null;
}
