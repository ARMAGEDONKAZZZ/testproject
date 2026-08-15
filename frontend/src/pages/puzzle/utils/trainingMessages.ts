import i18n from "@/i18n";

/**
 * Mascot copy for `?mode=training` (Self Education), transcribed from
 * docs/design-audit/self-education.md — see i18n/{ru,en}.json
 * "selfEducation" for the static strings. The intro message is the only
 * dynamic one (the puzzle's own real objective), built here so both
 * locales share one interpolation point.
 */
export function trainingIntroMessage(objective: string): string {
  return i18n.t("selfEducation.taskIntro", { objective: objective.toLowerCase() });
}
