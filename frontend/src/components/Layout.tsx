import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { ChevronDown, LogOut, Settings, Globe } from "@/components/icons";
import { NeuratopMark } from "@/components/Logo";
import { useSessionStore } from "@/features/auth/session";
import { useMe } from "@/features/profile/hooks";
import { useCreditBalance } from "@/features/billing/hooks";

const LANGUAGES: { code: "ru" | "en"; label: string }[] = [
  { code: "ru", label: "RU Русский" },
  { code: "en", label: "EN English" },
];

/**
 * Shared authenticated app shell: top header (logo, nav, language, credits,
 * avatar menu) matching every audited screen's header
 * (docs/design-audit/*.md). Nav items beyond "My Puzzles" have no designed
 * screens in this iteration (spec.md Assumptions) and render disabled.
 */
// "My Puzzles" covers the whole generate → solve → organize flow — per
// docs/design-audit/puzzle-generation.md the generator screen itself shows
// "My Puzzles" (not "Home") as the active nav pill.
const MY_PUZZLES_SECTION = ["/generate", "/history", "/puzzle", "/folders", "/favorites"];

const NAV_ITEMS = [
  { to: "/generate", label: "Home", enabled: true },
  { to: "/history", label: "My Puzzles", enabled: true },
  { to: "/self-education", label: "Self Education", enabled: true },
  { to: "#", label: "My Class", enabled: false },
  { to: "#", label: "Library", enabled: false },
  { to: "#", label: "Tournaments", enabled: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const clear = useSessionStore((s) => s.clear);
  const { data: me } = useMe();
  const { data: credits } = useCreditBalance();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <div className="flex items-center gap-8">
          <NavLink to="/generate" className="flex items-center gap-2">
            <NeuratopMark className="h-6 w-6" />
            <span className="text-lg font-bold text-text-primary">neuratop</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              if (!item.enabled) {
                return (
                  <span
                    key={item.label}
                    aria-disabled="true"
                    title="Скоро"
                    className="cursor-not-allowed rounded-full px-3 py-1.5 text-sm text-text-muted"
                  >
                    {item.label}
                  </span>
                );
              }
              const inTrainingPuzzle =
                location.pathname.startsWith("/puzzle") && new URLSearchParams(location.search).get("mode") === "training";
              const isActive =
                item.label === "Self Education"
                  ? location.pathname.startsWith("/self-education") || inTrainingPuzzle
                  : item.label === "My Puzzles"
                    ? MY_PUZZLES_SECTION.some((p) => location.pathname.startsWith(p)) && !inTrainingPuzzle
                    : false;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent-green/15 text-accent-green"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none">
                <Globe className="h-3.5 w-3.5" />
                {i18n.language.toUpperCase()}
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="min-w-[160px] rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl"
              >
                {LANGUAGES.map((lang) => (
                  <DropdownMenu.Item
                    key={lang.code}
                    onSelect={() => void i18n.changeLanguage(lang.code)}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-bg-elevated-hover",
                      i18n.language === lang.code ? "text-accent-green" : "text-text-primary",
                    )}
                  >
                    {lang.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <span className="rounded-full bg-bg-elevated px-3 py-1.5 text-sm text-accent-violet-light">
            ⚡ {credits?.balance ?? "…"} {t("billing.credits")}
          </span>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 rounded-full bg-bg-elevated px-2 py-1.5 text-sm focus-visible:outline-none">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-violet text-xs font-semibold text-white">
                  {(me?.nickname ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span>{me?.nickname ?? "…"}</span>
                <ChevronDown className="h-4 w-4 text-text-muted" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="min-w-[180px] rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl"
              >
                <DropdownMenu.Item asChild>
                  <NavLink
                    to="/profile"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
                  >
                    <Settings className="h-4 w-4" /> Account settings
                  </NavLink>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => clear()}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger outline-none hover:bg-bg-elevated-hover"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
