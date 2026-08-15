import { useMe } from "./hooks";
import type { BoardPreferences } from "./hooks";

export interface BoardColors {
  light: string;
  dark: string;
}

/** Per docs/design-audit/profile.md "Board design" — Экран 3 swatch grid (Default/Green/Blue/Purple/Ice/Wood). */
export const BOARD_THEMES: Record<string, BoardColors> = {
  default: { light: "#EFD9B8", dark: "#B38867" },
  green: { light: "#E9F7EF", dark: "#4CAF6D" },
  blue: { light: "#E4EFFC", dark: "#4E7FC4" },
  purple: { light: "#ECE7FC", dark: "#7B61FF" },
  ice: { light: "#F1FBFE", dark: "#8FD3E8" },
  wood: { light: "#EED9AE", dark: "#8B5E3C" },
};

export const DEFAULT_BOARD_PREFERENCES: BoardPreferences = {
  theme: "default",
  pieceSet: "Классика",
  showCoordinates: true,
  animationSpeedPct: 72,
};

export function boardColorsFor(theme: string | undefined): BoardColors {
  return BOARD_THEMES[theme ?? "default"] ?? BOARD_THEMES.default;
}

/** Maps the saved 0-100% animation-speed preference to react-chessboard's animationDurationInMs. */
export function animationDurationFor(speedPct: number): number {
  return Math.round(600 - (speedPct / 100) * 500);
}

/** Reads the signed-in user's saved board preferences, falling back to sane defaults before /me loads (or for logged-out preview contexts). */
export function useBoardPreferences(): BoardPreferences {
  const { data: me } = useMe();
  return me?.boardPreferences ?? DEFAULT_BOARD_PREFERENCES;
}
