import { Chessboard } from "react-chessboard";
import { useBoardPreferences, boardColorsFor } from "@/features/profile/boardTheme";

/** Small, non-interactive board preview used on puzzle cards. */
export function MiniBoard({ fen }: { fen: string }) {
  const prefs = useBoardPreferences();
  const colors = boardColorsFor(prefs.theme);
  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg">
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          darkSquareStyle: { backgroundColor: colors.dark },
          lightSquareStyle: { backgroundColor: colors.light },
          showNotation: prefs.showCoordinates,
        }}
      />
    </div>
  );
}
