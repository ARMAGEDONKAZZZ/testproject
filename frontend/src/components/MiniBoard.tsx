import { useEffect, useRef } from "react";
import { BoardView } from "board-view/core/BoardView";
import "board-view/styles/board.css";
import { useBoardPreferences, boardColorsFor } from "@/features/profile/boardTheme";

/**
 * Small, non-interactive board preview used on puzzle cards. Backed by our
 * own board-view package (see /board-view) instead of react-chessboard —
 * safe here specifically because this view is always read-only: board-view
 * doesn't have drag/click input yet (that lands in later phases), which
 * MiniBoard never needed anyway.
 */
export function MiniBoard({ fen }: { fen: string }) {
  const prefs = useBoardPreferences();
  const colors = boardColorsFor(prefs.theme);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<BoardView | null>(null);
  const fenRef = useRef(fen);
  fenRef.current = fen;

  useEffect(() => {
    if (!rootRef.current) return;
    const board = new BoardView(rootRef.current, {
      position: fenRef.current,
      showCoordinates: prefs.showCoordinates,
      interaction: { mode: "none", movableFor: "all", allowOverlayDrawing: false },
    });
    boardRef.current = board;
    return () => {
      board.destroy();
      boardRef.current = null;
    };
    // showCoordinates has no setter in board-view's current API (by design,
    // per its spec — it's construction-only), so a change re-mounts the
    // instance instead. fen is intentionally excluded: it's applied
    // incrementally below via setPosition, not by recreating the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.showCoordinates]);

  useEffect(() => {
    boardRef.current?.setPosition(fen);
  }, [fen]);

  useEffect(() => {
    rootRef.current?.style.setProperty("--bv-square-light", colors.light);
    rootRef.current?.style.setProperty("--bv-square-dark", colors.dark);
  }, [colors.light, colors.dark]);

  return <div ref={rootRef} className="aspect-square w-full overflow-hidden rounded-lg" />;
}
