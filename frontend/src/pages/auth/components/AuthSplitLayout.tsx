import type { ReactNode } from "react";
import { AuthDecoration, NeuratopMark } from "./AuthDecoration";

/**
 * Shared split-screen shell for every auth screen, per docs/design-audit/auth.md
 * "Базовый layout": left brand panel (~45%), right form panel (~55%), with
 * decorative neon chess-piece outlines traced from the Figma source.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-bg-secondary p-10 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, currentColor 1px, transparent 1px), linear-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            color: "var(--color-text-primary)",
          }}
        />
        <div className="pointer-events-none absolute -top-20 right-0 h-80 w-80 rounded-full bg-accent-violet-deep/30 blur-3xl" />
        <AuthDecoration />
        <div className="relative z-10 flex items-center gap-2">
          <NeuratopMark className="h-6 w-6" />
          <span className="text-sm text-text-primary">neuratop</span>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-text-primary">
            AI Chess Puzzle
            <br />
            <span className="bg-gradient-to-r from-text-primary to-accent-violet-light bg-clip-text text-transparent">
              Generator
            </span>
          </h1>
          <p className="mt-4 max-w-sm text-sm text-text-muted">
            Generate custom chess positions and puzzles instantly using AI
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-bg-primary p-6 md:w-[55%]">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
