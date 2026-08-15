import { Chess } from "chess.js";

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material balance from White's perspective (positive = White is ahead). */
export function materialBalance(fen: string): number {
  const board = new Chess(fen).board();
  let balance = 0;
  for (const row of board) {
    for (const square of row) {
      if (!square) continue;
      const value = PIECE_VALUES[square.type] ?? 0;
      balance += square.color === "w" ? value : -value;
    }
  }
  return balance;
}
