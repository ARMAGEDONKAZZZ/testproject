import { NavLink } from "react-router-dom";
import { PanelLeft, Home, Sparkles, MessageCircle, Heart, FolderOpen } from "@/components/icons";

/**
 * Narrow icon rail shared by the "My Puzzles" section screens (generator,
 * self-education), per docs/design-audit/puzzle-generation.md "Экран 1" and
 * docs/design-audit/self-education.md: collapse toggle near the top, then
 * the icon group (home, generator active/green, chat, favorites,
 * profile/folders) inside its own rounded panel, "вертикально по центру
 * экрана" — vertically centered in the remaining height, not top-aligned.
 */
export function GenerateSidebar() {
  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-border-subtle py-4">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
        title="Свернуть панель"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-bg-secondary p-2.5">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary"
            title="Home"
          >
            <Home className="h-5 w-5" />
          </button>
          <NavLink
            to="/generate"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-green text-bg-primary"
            title="Генератор задач"
          >
            <Sparkles className="h-5 w-5" />
          </NavLink>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-violet/20 text-accent-violet-light hover:text-text-primary"
            title="Чат"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <NavLink
            to="/favorites"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/15 text-danger hover:opacity-80"
            title="Избранное"
          >
            <Heart className="h-5 w-5" />
          </NavLink>
          <NavLink
            to="/folders"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-violet/80 text-white hover:opacity-90"
            title="Профиль / папки"
          >
            <FolderOpen className="h-5 w-5" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
