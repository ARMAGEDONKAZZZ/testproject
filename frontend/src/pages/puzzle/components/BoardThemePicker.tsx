import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Palette, Check } from "@/components/icons";
import { BOARD_THEMES, useBoardPreferences } from "@/features/profile/boardTheme";
import { useSetBoardPreferences } from "@/features/profile/hooks";

const THEME_LABELS: Record<string, string> = {
  default: "Default",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  ice: "Ice",
  wood: "Wood",
};

/**
 * FR-029: change board color theme "on the fly" from the solving screen's
 * own tool panel (docs/design-audit/toolboard.md section 11, "Цвет фона") —
 * distinct from (but backed by the same preference as) Profile → Board
 * design, which stays the full settings page.
 */
export function BoardThemePicker() {
  const prefs = useBoardPreferences();
  const setBoardPreferences = useSetBoardPreferences();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Тема доски"
          aria-label="Тема доски"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary"
        >
          <Palette className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-48 rounded-xl border border-border-subtle bg-bg-elevated p-2 shadow-xl"
        >
          <p className="mb-2 px-1 text-xs uppercase text-text-muted">Тема доски</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(BOARD_THEMES).map(([id, colors]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBoardPreferences.mutate({ ...prefs, theme: id })}
                title={THEME_LABELS[id]}
                className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border ${
                  prefs.theme === id ? "border-accent-violet" : "border-border-subtle"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${colors.light} 50%, ${colors.dark} 50%)`,
                }}
              >
                {prefs.theme === id && (
                  <Check className="h-4 w-4 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                )}
              </button>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
