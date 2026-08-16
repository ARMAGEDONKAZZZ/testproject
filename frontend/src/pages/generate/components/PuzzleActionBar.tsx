import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Regenerate as RegenIcon, Copy, Download, Share, Heart } from "@/components/icons";
import { useToggleFavorite, exportPuzzleUrl } from "@/features/puzzle/hooks";
import type { Generation } from "@/features/generation/hooks";

type Puzzle = Generation["puzzles"][number];

const ACTION_TOOLTIPS: Record<string, string> = {
  eye: "Play solve",
  regenerate: "Try again",
  copy: "Копировать",
  download: "Скачать",
  share: "Поделиться",
  favorite: "Избранное",
};

function ActionButton({
  action,
  onClick,
  children,
  href,
  size,
}: {
  action: keyof typeof ACTION_TOOLTIPS;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  href?: string;
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const cls = `group relative flex ${dim} items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-secondary transition-colors hover:border-accent-violet hover:text-accent-violet-light`;
  const tooltip = (
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-primary px-2 py-1 text-[10px] text-text-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      {ACTION_TOOLTIPS[action]}
    </span>
  );
  if (href) {
    return (
      <a href={href} download className={cls} onClick={(e) => e.stopPropagation()}>
        {tooltip}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {tooltip}
      {children}
    </button>
  );
}

/** 6-icon action panel (view/regenerate/copy/download/share/favorite) shared
 * by the carousel and the grid-view hover state — docs/design-audit/
 * puzzle-generation.md Экран 15/17 (carousel) and Экран 19 (grid). */
export function PuzzleActionBar({
  puzzle,
  onRegenerate,
  size = "md",
  siblingIds,
}: {
  puzzle: Puzzle;
  onRegenerate: () => void;
  size?: "sm" | "md";
  /** Other puzzle IDs from the same result set — carried via router state so the solving screen can offer prev/next navigation. */
  siblingIds?: string[];
}) {
  const toggleFavorite = useToggleFavorite(puzzle.id);
  const [favorited, setFavorited] = useState(false);

  function favorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    toggleFavorite.mutate(next);
  }

  return (
    <div className={`flex ${size === "sm" ? "gap-1.5" : "gap-3"}`}>
      <Link
        to={`/puzzle/${puzzle.id}`}
        state={siblingIds ? { siblingIds } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButton action="eye" size={size}>
          <Eye className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </ActionButton>
      </Link>
      <ActionButton
        action="regenerate"
        size={size}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRegenerate();
        }}
      >
        <RegenIcon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </ActionButton>
      <ActionButton
        action="copy"
        size={size}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void navigator.clipboard.writeText(puzzle.fen);
        }}
      >
        <Copy className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </ActionButton>
      <ActionButton action="download" size={size} href={exportPuzzleUrl(puzzle.id, "fen")}>
        <Download className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </ActionButton>
      <ActionButton
        action="share"
        size={size}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void navigator.clipboard.writeText(window.location.href);
        }}
      >
        <Share className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </ActionButton>
      <ActionButton action="favorite" size={size} onClick={favorite}>
        <Heart
          className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} ${favorited ? "fill-current text-accent-violet-light" : ""}`}
        />
      </ActionButton>
    </div>
  );
}
