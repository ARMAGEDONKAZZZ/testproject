import { Chess } from "chess.js";
import type { BoardColors } from "@/features/profile/boardTheme";

const WHITE_GLYPHS: Record<string, string> = { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" };
const BLACK_GLYPHS: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

const SQUARE_PX = 64;
const BOARD_PX = SQUARE_PX * 8;

/**
 * Renders the position onto an off-screen canvas and triggers a PNG
 * download — a client-side stand-in for FR-031's "download as image" since
 * no board-rendering service exists on the backend (puzzle/service.go's
 * Export returns 501 for format=image).
 */
export function downloadPuzzleImage(
  fen: string,
  orientation: "white" | "black",
  colors: BoardColors,
  filename = "puzzle.png",
) {
  const canvas = document.createElement("canvas");
  canvas.width = BOARD_PX;
  canvas.height = BOARD_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const board = new Chess(fen).board();
  const rows = orientation === "white" ? board : [...board].reverse().map((row) => [...row].reverse());

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${SQUARE_PX * 0.72}px serif`;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      ctx.fillStyle = isLight ? colors.light : colors.dark;
      ctx.fillRect(c * SQUARE_PX, r * SQUARE_PX, SQUARE_PX, SQUARE_PX);

      const square = rows[r][c];
      if (!square) continue;
      const glyph = (square.color === "w" ? WHITE_GLYPHS : BLACK_GLYPHS)[square.type];
      const x = c * SQUARE_PX + SQUARE_PX / 2;
      const y = r * SQUARE_PX + SQUARE_PX / 2 + 2;
      if (square.color === "w") {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#1a1a1a";
        ctx.fillStyle = "#ffffff";
        ctx.strokeText(glyph, x, y);
        ctx.fillText(glyph, x, y);
      } else {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillText(glyph, x, y);
      }
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
