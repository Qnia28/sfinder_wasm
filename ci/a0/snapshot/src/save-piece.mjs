import { TETRIS_DISPLAY_ORDER } from "./piece-order.mjs";
import {
  prepareQueuePieceCounts,
  prepareSolutionPieceCounts,
  unusedPiecePrepared,
} from "./saves.mjs";

export const PER_SAVE_DISPLAY_ORDER = TETRIS_DISPLAY_ORDER;

export function unusedPieceForSolution(queue, solution) {
  return unusedPiecePrepared(prepareQueuePieceCounts(queue), prepareSolutionPieceCounts(solution));
}
