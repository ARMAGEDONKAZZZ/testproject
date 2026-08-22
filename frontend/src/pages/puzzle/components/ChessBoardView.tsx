import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useBoardPreferences, boardColorsFor, animationDurationFor } from "@/features/profile/boardTheme";

interface ChessBoardViewProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  /**
   * Called with the UCI move string ("e2e4", or "a7a8q" for a promotion —
   * always to queen, there's no promotion-choice UI) and the resulting FEN
   * when a legal move is played. UCI, not SAN: puzzles.solution_line is now
   * UCI for every puzzle (fixtures and the external puzzle API alike), so
   * the backend's move comparison (internal/puzzle/service.go SubmitMove)
   * expects this wire format.
   */
  onMove: (move: string, resultFen: string) => void;
}

/**
 * Interactive board: chess.js validates legality client-side (UX only — the
 * backend independently checks correctness against the puzzle's solution,
 * per Constitution III). On an illegal drop, the piece simply snaps back.
 *
 * A fresh `Chess(fen)` is built on every drop rather than memoized on `fen`:
 * after a wrong move, the parent resets `currentFen` back to the puzzle's
 * starting position — the same *value* as before the wrong move — so a
 * memo keyed on `fen` would keep reusing the same mutated instance (still
 * mid-move, still the wrong side to move) and silently reject every retry.
 */
export function ChessBoardView({ fen, orientation, interactive, onMove }: ChessBoardViewProps) {
  const prefs = useBoardPreferences();
  const colors = boardColorsFor(prefs.theme);

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border-subtle">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareStyle: { backgroundColor: colors.light },
          showNotation: prefs.showCoordinates,
          animationDurationInMs: animationDurationFor(prefs.animationSpeedPct),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            try {
              const game = new Chess(fen);
              const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
              if (!move) return false;
              const uci = move.from + move.to + (move.promotion ?? "");
              onMove(uci, game.fen());
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
