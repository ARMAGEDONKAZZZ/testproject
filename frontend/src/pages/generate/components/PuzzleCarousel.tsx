import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pill } from "@/components/Pill";
import { MiniBoard } from "@/components/MiniBoard";
import { ChevronLeft, ChevronRight, Play } from "@/components/icons";
import { PuzzleActionBar } from "./PuzzleActionBar";
import type { Generation } from "@/features/generation/hooks";

type Puzzle = Generation["puzzles"][number];

function SidePreview({ puzzle, side, onClick }: { puzzle?: Puzzle; side: "left" | "right"; onClick: () => void }) {
  if (!puzzle) return <div className="hidden w-24 shrink-0 md:block" />;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hidden w-24 shrink-0 opacity-40 transition-opacity hover:opacity-70 md:block ${
        side === "left" ? "-rotate-6" : "rotate-6"
      }`}
      aria-label={side === "left" ? "Предыдущий пазл" : "Следующий пазл"}
    >
      <MiniBoard fen={puzzle.fen} />
    </button>
  );
}

export function PuzzleCarousel({
  puzzles,
  index,
  onIndexChange,
  onRegenerate,
}: {
  puzzles: Puzzle[];
  index: number;
  onIndexChange: (i: number) => void;
  onRegenerate: (puzzleId: string) => void;
}) {
  const { t } = useTranslation();
  const puzzle = puzzles[index];
  const [hovering, setHovering] = useState(false);

  const canPrev = index > 0;
  const canNext = index < puzzles.length - 1;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-text-secondary">
          {index + 1} / {puzzles.length}
        </span>
        <Pill tone="violet">{puzzle.tag}</Pill>
        <span
          className={`h-2.5 w-2.5 rounded-full border ${
            puzzle.sideToMove === "white" ? "border-text-primary bg-text-primary" : "border-text-primary bg-transparent"
          }`}
          aria-hidden="true"
        />
        <span className="text-sm text-text-secondary">
          {puzzle.sideToMove === "white" ? t("puzzle.whiteToMove") : t("puzzle.blackToMove")}
        </span>
      </div>

      <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
        <SidePreview puzzle={puzzles[index - 1]} side="left" onClick={() => canPrev && onIndexChange(index - 1)} />

        <button
          type="button"
          onClick={() => canPrev && onIndexChange(index - 1)}
          disabled={!canPrev}
          aria-label="Предыдущий пазл"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary transition-colors hover:border-accent-green hover:text-accent-green disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          className="group relative w-72 max-w-full shrink-0"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <MiniBoard fen={puzzle.fen} />
          {hovering && (
            <Link
              to={`/puzzle/${puzzle.id}`}
              className="absolute inset-0 flex items-center justify-center bg-bg-primary/40 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span className="flex items-center gap-2 rounded-full bg-accent-green px-4 py-2 text-sm font-semibold text-bg-primary">
                <Play className="h-4 w-4" /> Играть
              </span>
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => canNext && onIndexChange(index + 1)}
          disabled={!canNext}
          aria-label="Следующий пазл"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary transition-colors hover:border-accent-green hover:text-accent-green disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <SidePreview puzzle={puzzles[index + 1]} side="right" onClick={() => canNext && onIndexChange(index + 1)} />
      </div>

      <div className="mt-5">
        <PuzzleActionBar puzzle={puzzle} onRegenerate={() => onRegenerate(puzzle.id)} />
      </div>

      {puzzle.description && (
        <p className="mt-4 max-w-md text-center text-sm text-text-secondary">{puzzle.description}</p>
      )}
    </div>
  );
}
