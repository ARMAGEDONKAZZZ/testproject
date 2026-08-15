import { useState } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  PanelLeft,
  Home,
  Sparkles,
  MessageCircle,
  Heart,
  FolderOpen,
  List,
  ChevronDown,
} from "@/components/icons";

const EXPANDED_ITEMS = [
  { to: "/generate", label: "Home", icon: Home },
  { to: "/generations", label: "My generations", icon: Sparkles },
  { to: "/history", label: "History", icon: List },
  { to: "/favorites", label: "My favorites", icon: Heart },
];

/**
 * Icon rail shared by the "My Puzzles" section screens (generator,
 * self-education), per docs/design-audit/puzzle-generation.md "Экран 1"
 * (collapsed, icon-only) and "Экран 16" (expanded, labeled menu with a
 * "My Puzzles" header). Collapsed by default; the panel button toggles
 * between the two states client-side, no route change involved.
 */
export function GenerateSidebar({ expandedDefault = false }: { expandedDefault?: boolean }) {
  const [expanded, setExpanded] = useState(expandedDefault);

  if (expanded) {
    return (
      <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle py-4">
        <div className="mb-4 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <FolderOpen className="h-4 w-4 text-accent-violet-light" />
            My Puzzles
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            title="Свернуть панель"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {EXPANDED_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                  isActive
                    ? "bg-bg-elevated font-medium text-text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/folders"
            className={({ isActive }) =>
              clsx(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                isActive
                  ? "bg-bg-elevated font-medium text-text-primary"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
              )
            }
          >
            <span className="flex items-center gap-2.5">
              <FolderOpen className="h-4 w-4" />
              My Folders
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </NavLink>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-border-subtle py-4">
      <button
        onClick={() => setExpanded(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
        title="Развернуть панель"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-bg-secondary p-2.5">
          <NavLink
            to="/generate"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary"
            title="Home"
          >
            <Home className="h-5 w-5" />
          </NavLink>
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
