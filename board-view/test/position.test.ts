// Copyright (c) 2026 Neuratop. All rights reserved.

import { describe, expect, it } from "vitest";
import {
  diffPositions,
  parseFen,
  serializeFen,
  serializePlacement,
  type PositionMap,
} from "../src/core/position";

const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const START_FEN = `${START_PLACEMENT} w KQkq - 0 1`;

function placement(entries: Array<[string, string]>): PositionMap {
  // entries: [square, pieceChar] using FEN letters, e.g. ['e1', 'K']
  const map: PositionMap = new Map();
  for (const [square, ch] of entries) {
    const color = ch === ch.toUpperCase() ? "w" : "b";
    const kind = ch.toLowerCase() as "p" | "n" | "b" | "r" | "q" | "k";
    map.set(square, { color, kind });
  }
  return map;
}

describe("parseFen", () => {
  it("parses a placement-only string and preserves no rest", () => {
    const result = parseFen(START_PLACEMENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rest).toBe("");
    expect(result.placement.get("e1")).toEqual({ color: "w", kind: "k" });
    expect(result.placement.get("e8")).toEqual({ color: "b", kind: "k" });
    expect(result.placement.size).toBe(32);
  });

  it("parses a full 6-field FEN and preserves the trailing fields verbatim", () => {
    const result = parseFen(START_FEN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rest).toBe("w KQkq - 0 1");
  });

  it("round-trips a full FEN through serializeFen", () => {
    const result = parseFen(START_FEN);
    if (!result.ok) throw new Error("expected valid FEN");
    expect(serializeFen(result.placement, result.rest)).toBe(START_FEN);
  });

  it("round-trips a placement-only FEN (no trailing fields reappear)", () => {
    const result = parseFen(START_PLACEMENT);
    if (!result.ok) throw new Error("expected valid FEN");
    expect(serializeFen(result.placement, result.rest)).toBe(START_PLACEMENT);
  });

  it("normalizes irregular whitespace between fields without altering field values", () => {
    const result = parseFen(`${START_PLACEMENT}   w   KQkq - 0 1`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rest).toBe("w KQkq - 0 1");
  });

  it("rejects an empty string", () => {
    const result = parseFen("");
    expect(result.ok).toBe(false);
  });

  it("rejects a placement with the wrong number of ranks", () => {
    const result = parseFen("8/8/8/8/8/8/8");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/8 ranks/);
  });

  it("rejects a rank with too few squares", () => {
    const result = parseFen("8/8/8/8/8/8/8/7");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/rank 1/);
  });

  it("rejects a rank with too many squares", () => {
    const result = parseFen("8/8/8/8/8/8/8/9");
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid piece character", () => {
    const result = parseFen("8/8/8/8/8/8/8/7x");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/rank 1/);
  });
});

describe("serializePlacement", () => {
  it("serializes the standard starting position", () => {
    const result = parseFen(START_PLACEMENT);
    if (!result.ok) throw new Error("expected valid FEN");
    expect(serializePlacement(result.placement)).toBe(START_PLACEMENT);
  });

  it("serializes a sparse endgame position with run-length empty squares", () => {
    const map = placement([
      ["a7", "P"],
      ["e8", "k"],
      ["e1", "K"],
    ]);
    expect(serializePlacement(map)).toBe("4k3/P7/8/8/8/8/8/4K3");
  });

  it("serializes a fully empty board", () => {
    expect(serializePlacement(new Map())).toBe("8/8/8/8/8/8/8/8");
  });
});

describe("diffPositions", () => {
  it("produces no ops for an identical position", () => {
    const a = placement([["e1", "K"], ["e8", "k"]]);
    const b = placement([["e1", "K"], ["e8", "k"]]);
    expect(diffPositions(a, b)).toEqual([]);
  });

  it("a simple pawn push is a single move op, unrelated pieces untouched", () => {
    const prev = placement([["e2", "P"], ["e8", "k"]]);
    const next = placement([["e4", "P"], ["e8", "k"]]);
    const ops = diffPositions(prev, next);
    expect(ops).toEqual([{ kind: "move", from: "e2", to: "e4", piece: { color: "w", kind: "p" } }]);
  });

  it("a capture is a move (attacker) plus a disappearance (captured piece)", () => {
    // White rook a1 captures a black knight on a8.
    const prev = placement([["a1", "R"], ["a8", "n"], ["e1", "K"]]);
    const next = placement([["a8", "R"], ["e1", "K"]]);
    const ops = diffPositions(prev, next);
    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({ kind: "move", from: "a1", to: "a8", piece: { color: "w", kind: "r" } });
    expect(ops).toContainEqual({ kind: "disappear", square: "a8", piece: { color: "b", kind: "n" } });
  });

  it("kingside castling is two simultaneous moves, the untouched rook is skipped entirely", () => {
    const prev = placement([["e1", "K"], ["h1", "R"], ["a1", "R"]]);
    const next = placement([["g1", "K"], ["f1", "R"], ["a1", "R"]]);
    const ops = diffPositions(prev, next);
    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({ kind: "move", from: "e1", to: "g1", piece: { color: "w", kind: "k" } });
    expect(ops).toContainEqual({ kind: "move", from: "h1", to: "f1", piece: { color: "w", kind: "r" } });
  });

  it("pairs each arrival with its nearest same-kind departure, not a farther one", () => {
    // Two black knights: b8 -> c6 (near) and g8 -> f6 (near); a naive
    // first-match algorithm could wrongly cross-pair them.
    const prev = placement([["b8", "n"], ["g8", "n"]]);
    const next = placement([["c6", "n"], ["f6", "n"]]);
    const ops = diffPositions(prev, next);
    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({ kind: "move", from: "b8", to: "c6", piece: { color: "b", kind: "n" } });
    expect(ops).toContainEqual({ kind: "move", from: "g8", to: "f6", piece: { color: "b", kind: "n" } });
  });

  it("a fully disjoint position is all disappearances and appearances, no moves", () => {
    const prev = placement([["a1", "R"], ["b1", "N"]]);
    const next = placement([["a8", "r"], ["b8", "n"]]);
    const ops = diffPositions(prev, next);
    expect(ops).toHaveLength(4);
    expect(ops.filter((op) => op.kind === "move")).toHaveLength(0);
    expect(ops).toContainEqual({ kind: "disappear", square: "a1", piece: { color: "w", kind: "r" } });
    expect(ops).toContainEqual({ kind: "disappear", square: "b1", piece: { color: "w", kind: "n" } });
    expect(ops).toContainEqual({ kind: "appear", square: "a8", piece: { color: "b", kind: "r" } });
    expect(ops).toContainEqual({ kind: "appear", square: "b8", piece: { color: "b", kind: "n" } });
  });
});
