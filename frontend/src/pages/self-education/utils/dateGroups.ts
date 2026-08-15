import i18n from "@/i18n";
import type { PuzzleView } from "@/features/generation/hooks";

/** "Today" / "Yesterday" / a localized date — per docs/design-audit/self-education.md "История обучения". */
export function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return i18n.t("common.today");
  if (sameDay(date, yesterday)) return i18n.t("common.yesterday");
  return date.toLocaleDateString(i18n.language === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "long" });
}

export interface DateGroup {
  label: string;
  puzzles: PuzzleView[];
}

export function groupByDate(puzzles: PuzzleView[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const puzzle of puzzles) {
    const label = dateGroupLabel(puzzle.createdAt);
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.puzzles.push(puzzle);
    } else {
      groups.push({ label, puzzles: [puzzle] });
    }
  }
  return groups;
}
