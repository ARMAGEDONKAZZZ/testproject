// Copyright (c) 2026 Neuratop. All rights reserved.
//
// Pure, DOM-free geometry helpers: Square <-> index conversions and the
// index -> visual render-cell mapping consumed by transform: translate().
//
// Index convention: 0..63, index = rank*8 + file (a1=0, h1=7, a8=56, h8=63) —
// the common "Little-Endian Rank-File" layout. This is an internal detail;
// nothing outside geometry.ts should depend on the numeric value of an
// index, only on squareToIndex/indexToSquare round-tripping correctly.

import type { Side, Square } from "./types";

const SQUARE_PATTERN = /^[a-h][1-8]$/;

export function squareToIndex(square: Square): number {
  if (!SQUARE_PATTERN.test(square)) {
    throw new RangeError(`Invalid square: "${square}"`);
  }
  const file = square.charCodeAt(0) - 97; // 'a' -> 0 .. 'h' -> 7
  const rank = Number(square[1]) - 1; // '1' -> 0 .. '8' -> 7
  return rank * 8 + file;
}

export function indexToSquare(index: number): Square {
  assertValidIndex(index);
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return String.fromCharCode(97 + file) + String(rank + 1);
}

/** Visual column/row (0..7, 0 = top-left of the rendered board) for a square index. */
export interface RenderCell {
  col: number;
  row: number;
}

/**
 * Maps a square index to where it renders on screen, given board
 * orientation. This is the only place orientation has any effect —
 * position and all other logic are orientation-independent (per spec).
 */
export function indexToRenderCell(index: number, orientation: Side): RenderCell {
  assertValidIndex(index);
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return orientation === "white"
    ? { col: file, row: 7 - rank }
    : { col: 7 - file, row: rank };
}

function assertValidIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 63) {
    throw new RangeError(`Invalid square index: ${index}`);
  }
}

/** Chebyshev (chessboard) distance between two squares — used by the diffing algorithm. */
export function chebyshevDistance(a: Square, b: Square): number {
  const ai = squareToIndex(a);
  const bi = squareToIndex(b);
  const aFile = ai % 8;
  const aRank = Math.floor(ai / 8);
  const bFile = bi % 8;
  const bRank = Math.floor(bi / 8);
  return Math.max(Math.abs(aFile - bFile), Math.abs(aRank - bRank));
}
