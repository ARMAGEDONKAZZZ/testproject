import { Chessboard } from "react-chessboard";

/** Small, non-interactive board preview used on puzzle cards. */
export function MiniBoard({ fen }: { fen: string }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg">
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          darkSquareStyle: { backgroundColor: "#B38867" },
          lightSquareStyle: { backgroundColor: "#EFD9B8" },
        }}
      />
    </div>
  );
}
