import { decoder } from "tetris-fumen";
import { boardFromFumenPage, highestOccupiedRow, popcount } from "./board.mjs";
import { expandPattern } from "./pattern.mjs";

export class UnsupportedClearHeightError extends Error {
  constructor(clear) {
    super(`unsupported clear height ${clear}`);
    this.name = "UnsupportedClearHeightError";
  }
}

export class UnsupportedBoardHeightError extends Error {
  constructor(height) {
    super(`unsupported board height ${height}`);
    this.name = "UnsupportedBoardHeightError";
  }
}

export class BoardExceedsClearHeightError extends Error {
  constructor(height, clear) {
    super(`board height ${height} exceeds clear ${clear}`);
    this.name = "BoardExceedsClearHeightError";
  }
}

export function validateTargetLines(clear = 4) {
  if (!Number.isInteger(clear) || clear < 2 || clear > 6) {
    throw new UnsupportedClearHeightError(clear);
  }
  return clear;
}

export function decodeAndValidate(sourceFumen, clear = 4) {
  validateTargetLines(clear);
  const page = decoder.decode(sourceFumen)[0];
  if (!page) throw new Error("empty fumen");
  const highest = highestOccupiedRow(page);
  if (highest >= 6) throw new UnsupportedBoardHeightError(highest + 1);
  if (highest >= clear) throw new BoardExceedsClearHeightError(highest + 1, clear);
  return { page, board: boardFromFumenPage(page, clear) };
}

export function pcGeometry(sourceFumen, targetLines = 4) {
  const { page, board } = decodeAndValidate(sourceFumen, targetLines);
  const occupiedCells = popcount(board);
  const remainingCells = targetLines * 10 - occupiedCells;
  if (remainingCells <= 0 || remainingCells % 4 !== 0) {
    throw new Error(`current board cannot complete a ${targetLines}-line PC`);
  }
  return {
    page,
    board,
    occupiedCells,
    remainingCells,
    piecesNeeded: remainingCells / 4,
  };
}

export function exactQueue(pattern, expectedLength, requestName = "single-queue solve") {
  const queues = expandPattern(pattern);
  if (queues.length !== 1) throw new Error(`${requestName} requires one exact queue`);
  const queue = queues[0];
  if (queue.length !== expectedLength) {
    throw new Error(
      `queue length is incompatible with this board: expected see${expectedLength}, got ${queue.length}`,
    );
  }
  return queue;
}
