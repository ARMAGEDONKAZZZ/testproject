// Copyright (c) 2026 Neuratop. All rights reserved.
//
// The ONLY place in this package with Unicode piece glyphs. Development
// fallback only — real piece graphics are supplied by the consumer later
// via CSS targeting .bv-piece.bv-{color}{kind}, per spec rule 4. Kept as
// literal Unicode text (not baked into markup elsewhere) so a consumer can
// even replace it outright with a custom @font-face mapped to the same
// code points, a well-established technique for chess piece fonts.

import type { Piece } from "./types";

const GLYPHS: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

export function pieceFallbackGlyph(piece: Piece): string {
  return GLYPHS[`${piece.color}${piece.kind}`] ?? "?";
}
