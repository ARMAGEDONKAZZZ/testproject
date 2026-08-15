import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, FolderPlus } from "@/components/icons";
import { Pill } from "@/components/Pill";
import { MiniBoard } from "@/components/MiniBoard";
import { useToggleFavorite } from "@/features/puzzle/hooks";
import type { PuzzleView } from "@/features/generation/hooks";

export function PuzzleGrid({
  puzzles,
  onAddToFolder,
}: {
  puzzles: PuzzleView[];
  onAddToFolder?: (puzzleId: string) => void;
}) {
  if (puzzles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {puzzles.map((p) => (
        <PuzzleGridCard key={p.id} puzzle={p} onAddToFolder={onAddToFolder} />
      ))}
    </div>
  );
}

function PuzzleGridCard({
  puzzle,
  onAddToFolder,
}: {
  puzzle: PuzzleView;
  onAddToFolder?: (puzzleId: string) => void;
}) {
  const { t } = useTranslation();
  const toggleFavorite = useToggleFavorite(puzzle.id);

  return (
    <div className="rounded-xl border border-border-subtle p-3">
      <Link to={`/puzzle/${puzzle.id}`}>
        <MiniBoard fen={puzzle.fen} />
      </Link>
      <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
        <Pill tone="violet">{puzzle.tag}</Pill>
        <span>{puzzle.sideToMove === "white" ? t("puzzle.whiteToMove") : t("puzzle.blackToMove")}</span>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {onAddToFolder && (
          <button
            onClick={() => onAddToFolder(puzzle.id)}
            className="text-text-muted hover:text-accent-violet-light"
            aria-label="Добавить в папку"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => toggleFavorite.mutate(true)}
          className="text-text-muted hover:text-danger"
          aria-label={t("puzzle.favorite")}
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
