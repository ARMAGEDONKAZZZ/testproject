import { useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

interface ChessBoardViewProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  /** Called with the resulting SAN move string when a legal move is played. */
  onMove: (san: string) => void;
}

/**
 * Interactive board: chess.js validates legality client-side (UX only — the
 * backend independently checks correctness against the puzzle's solution,
 * per Constitution III). On an illegal drop, the piece simply snaps back.
 */
export function ChessBoardView({ fen, orientation, interactive, onMove }: ChessBoardViewProps) {
  const game = useMemo(() => new Chess(fen), [fen]);

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border-subtle">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          darkSquareStyle: { backgroundColor: "#B38867" },
          lightSquareStyle: { backgroundColor: "#EFD9B8" },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            try {
              const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
              if (!move) return false;
              onMove(move.san);
              return true;
            } catch {
              return false;
            }
          },
        }}
      />
    </div>
  );
}
