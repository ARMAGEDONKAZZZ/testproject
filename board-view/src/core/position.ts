// Copyright (c) 2026 Neuratop. All rights reserved.
//
// FEN parsing/serialization and the position-diffing algorithm. Pure, no
// DOM. Only the first FEN field (piece placement) is interpreted; the
// remaining five fields are preserved verbatim so a host can round-trip
// arbitrary FEN metadata through getPosition() untouched.

import { chebyshevDistance, indexToSquare } from "./geometry";
import type { Piece, PieceColor, PieceKind, Square } from "./types";

export type PositionMap = Map<Square, Piece>;

export type FenParseResult =
  | { ok: true; placement: PositionMap; rest: string }
  | { ok: false; error: string };

const PIECE_CHARS = new Set(["p", "n", "b", "r", "q", "k", "P", "N", "B", "R", "Q", "K"]);

/**
 * Parses a FEN string. Accepts either a full 6-field FEN or just the
 * placement field. Never throws — the caller (BoardView, later phase)
 * decides what "invalid FEN" means for its own error handling per spec
 * ("не бросай исключение в конструкторе").
 */
export function parseFen(fen: string): FenParseResult {
  const trimmed = fen.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "empty FEN string" };
  }

  const firstSpace = trimmed.search(/\s/);
  const placementField = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const rest = firstSpace === -1 ? "" : trimmed.slice(firstSpace).trim().replace(/\s+/g, " ");

  const placementResult = parsePlacement(placementField);
  if (!placementResult.ok) {
    return placementResult;
  }

  return { ok: true, placement: placementResult.placement, rest };
}

function parsePlacement(field: string): { ok: true; placement: PositionMap } | { ok: false; error: string } {
  const ranks = field.split("/");
  if (ranks.length !== 8) {
    return { ok: false, error: `expected 8 ranks separated by '/', got ${ranks.length}` };
  }

  const placement: PositionMap = new Map();

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rankNumber = 8 - rankIdx; // ranks[0] is rank 8 (FEN order), ranks[7] is rank 1
    const rankStr = ranks[rankIdx] ?? "";
    let file = 0;

    for (const ch of rankStr) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
      } else if (PIECE_CHARS.has(ch)) {
        if (file > 7) {
          return { ok: false, error: `rank ${rankNumber} has more than 8 squares` };
        }
        const square = indexToSquare((rankNumber - 1) * 8 + file);
        placement.set(square, charToPiece(ch));
        file += 1;
      } else {
        return { ok: false, error: `rank ${rankNumber}: unexpected character '${ch}'` };
      }
    }

    if (file !== 8) {
      return { ok: false, error: `rank ${rankNumber} has ${file} squares, expected 8` };
    }
  }

  return { ok: true, placement };
}

function charToPiece(ch: string): Piece {
  const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
  const kind = ch.toLowerCase() as PieceKind;
  return { color, kind };
}

function pieceToChar(piece: Piece): string {
  return piece.color === "w" ? piece.kind.toUpperCase() : piece.kind;
}

/** Serializes only the placement field (no trailing FEN metadata). */
export function serializePlacement(placement: PositionMap): string {
  const ranks: string[] = [];

  for (let rankNumber = 8; rankNumber >= 1; rankNumber--) {
    let rankStr = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const square = indexToSquare((rankNumber - 1) * 8 + file);
      const piece = placement.get(square);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        rankStr += String(empty);
        empty = 0;
      }
      rankStr += pieceToChar(piece);
    }

    if (empty > 0) {
      rankStr += String(empty);
    }
    ranks.push(rankStr);
  }

  return ranks.join("/");
}

/** Serializes placement + preserved trailing fields back into a full FEN string. */
export function serializeFen(placement: PositionMap, rest: string): string {
  const placementField = serializePlacement(placement);
  return rest.length > 0 ? `${placementField} ${rest}` : placementField;
}

export type PositionDiffOp =
  | { kind: "move"; from: Square; to: Square; piece: Piece }
  | { kind: "appear"; square: Square; piece: Piece }
  | { kind: "disappear"; square: Square; piece: Piece };

function samePiece(a: Piece, b: Piece): boolean {
  return a.color === b.color && a.kind === b.kind;
}

/**
 * Computes the minimal set of moves/appearances/disappearances turning
 * `prev` into `next`, per spec:
 *  1. Squares whose piece is unchanged (same color+kind) are skipped
 *     entirely — never touched, never considered a move candidate.
 *  2. Every remaining "arrived" piece is paired with the nearest (Chebyshev
 *     distance) remaining "departed" piece of the same color+kind — this is
 *     a move. Ties break toward the departed square with the lower board
 *     index, for a fully deterministic result (unspecified by the source
 *     spec, decided here since *some* deterministic tie-break is required).
 *  3. Departed pieces left unpaired are disappearances; arrived pieces left
 *     unpaired are appearances.
 * Castling naturally falls out of this as two independent single-candidate
 * moves (king + the one rook that actually moved) with no special-casing.
 */
export function diffPositions(prev: PositionMap, next: PositionMap): PositionDiffOp[] {
  const departed: Array<{ square: Square; piece: Piece }> = [];
  const arrived: Array<{ square: Square; piece: Piece }> = [];

  for (const [square, piece] of prev) {
    const nextPiece = next.get(square);
    if (nextPiece && samePiece(nextPiece, piece)) continue;
    departed.push({ square, piece });
  }

  for (const [square, piece] of next) {
    const prevPiece = prev.get(square);
    if (prevPiece && samePiece(prevPiece, piece)) continue;
    arrived.push({ square, piece });
  }

  arrived.sort((a, b) => a.square.localeCompare(b.square) || 0);

  const ops: PositionDiffOp[] = [];
  const consumed = new Set<number>();

  for (const arrival of arrived) {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < departed.length; i++) {
      if (consumed.has(i)) continue;
      const departure = departed[i]!;
      if (!samePiece(departure.piece, arrival.piece)) continue;

      const distance = chebyshevDistance(departure.square, arrival.square);
      const better =
        distance < bestDistance ||
        (distance === bestDistance && bestIndex !== -1 && departure.square < departed[bestIndex]!.square);
      if (bestIndex === -1 || better) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      ops.push({ kind: "appear", square: arrival.square, piece: arrival.piece });
    } else {
      consumed.add(bestIndex);
      const departure = departed[bestIndex]!;
      ops.push({ kind: "move", from: departure.square, to: arrival.square, piece: arrival.piece });
    }
  }

  for (let i = 0; i < departed.length; i++) {
    if (!consumed.has(i)) {
      const departure = departed[i]!;
      ops.push({ kind: "disappear", square: departure.square, piece: departure.piece });
    }
  }

  return ops;
}
