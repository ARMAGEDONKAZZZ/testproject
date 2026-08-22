// Copyright (c) 2026 Neuratop. All rights reserved.

import { describe, expect, it } from "vitest";
import { chebyshevDistance, indexToRenderCell, indexToSquare, squareToIndex } from "../src/core/geometry";

describe("squareToIndex / indexToSquare", () => {
  it("a1 is index 0", () => {
    expect(squareToIndex("a1")).toBe(0);
    expect(indexToSquare(0)).toBe("a1");
  });

  it("h1 is index 7", () => {
    expect(squareToIndex("h1")).toBe(7);
    expect(indexToSquare(7)).toBe("h1");
  });

  it("a8 is index 56", () => {
    expect(squareToIndex("a8")).toBe(56);
    expect(indexToSquare(56)).toBe("a8");
  });

  it("h8 is index 63", () => {
    expect(squareToIndex("h8")).toBe(63);
    expect(indexToSquare(63)).toBe("h8");
  });

  it("every square 0..63 round-trips", () => {
    for (let i = 0; i < 64; i++) {
      expect(squareToIndex(indexToSquare(i))).toBe(i);
    }
  });

  it("rejects malformed squares", () => {
    expect(() => squareToIndex("i1")).toThrow(RangeError);
    expect(() => squareToIndex("a9")).toThrow(RangeError);
    expect(() => squareToIndex("a0")).toThrow(RangeError);
    expect(() => squareToIndex("A1")).toThrow(RangeError); // uppercase file rejected
    expect(() => squareToIndex("e44")).toThrow(RangeError);
    expect(() => squareToIndex("")).toThrow(RangeError);
  });

  it("rejects out-of-range or non-integer indices", () => {
    expect(() => indexToSquare(-1)).toThrow(RangeError);
    expect(() => indexToSquare(64)).toThrow(RangeError);
    expect(() => indexToSquare(1.5)).toThrow(RangeError);
  });
});

describe("indexToRenderCell", () => {
  it("white orientation: a1 renders bottom-left", () => {
    expect(indexToRenderCell(squareToIndex("a1"), "white")).toEqual({ col: 0, row: 7 });
  });

  it("white orientation: h8 renders top-right", () => {
    expect(indexToRenderCell(squareToIndex("h8"), "white")).toEqual({ col: 7, row: 0 });
  });

  it("white orientation: a8 renders top-left", () => {
    expect(indexToRenderCell(squareToIndex("a8"), "white")).toEqual({ col: 0, row: 0 });
  });

  it("white orientation: h1 renders bottom-right", () => {
    expect(indexToRenderCell(squareToIndex("h1"), "white")).toEqual({ col: 7, row: 7 });
  });

  it("black orientation: a1 renders top-right", () => {
    expect(indexToRenderCell(squareToIndex("a1"), "black")).toEqual({ col: 7, row: 0 });
  });

  it("black orientation: h8 renders bottom-left", () => {
    expect(indexToRenderCell(squareToIndex("h8"), "black")).toEqual({ col: 0, row: 7 });
  });

  it("flipping orientation is a point reflection through the board center", () => {
    for (let i = 0; i < 64; i++) {
      const white = indexToRenderCell(i, "white");
      const black = indexToRenderCell(i, "black");
      expect(black.col).toBe(7 - white.col);
      expect(black.row).toBe(7 - white.row);
    }
  });

  it("rejects out-of-range indices", () => {
    expect(() => indexToRenderCell(-1, "white")).toThrow(RangeError);
    expect(() => indexToRenderCell(64, "white")).toThrow(RangeError);
  });
});

describe("chebyshevDistance", () => {
  it("is 0 for the same square", () => {
    expect(chebyshevDistance("e4", "e4")).toBe(0);
  });

  it("is 1 for adjacent squares, including diagonally", () => {
    expect(chebyshevDistance("e4", "e5")).toBe(1);
    expect(chebyshevDistance("e4", "f5")).toBe(1);
    expect(chebyshevDistance("e4", "d3")).toBe(1);
  });

  it("takes the max of file and rank distance, not the sum", () => {
    expect(chebyshevDistance("a1", "h8")).toBe(7); // pure diagonal
    expect(chebyshevDistance("a1", "a8")).toBe(7); // pure file
    expect(chebyshevDistance("a1", "b8")).toBe(7); // dominated by rank distance
  });

  it("is symmetric", () => {
    expect(chebyshevDistance("b2", "g6")).toBe(chebyshevDistance("g6", "b2"));
  });

  it("propagates invalid-square errors from squareToIndex", () => {
    expect(() => chebyshevDistance("z9", "a1")).toThrow(RangeError);
  });
});
