import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Button } from "@/components/Button";
import { GenerateSidebar } from "@/components/GenerateSidebar";
import { MiniBoard } from "@/components/MiniBoard";
import { useHistory } from "@/features/folders/hooks";
import { useTrainingSummary } from "@/features/profile/hooks";
import { groupByDate } from "./utils/dateGroups";

/** «История изменений» — per docs/design-audit/self-education.md. */
export default function SelfEducationHistoryPage() {
  const { t } = useTranslation();
  const { data: puzzles, isLoading } = useHistory(1, 100);
  const { data: summary } = useTrainingSummary();
  const groups = groupByDate(puzzles ?? []);

  return (
    <div className="flex">
      <GenerateSidebar />
      <div className="mx-auto max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t("selfEducation.historyPageTitle")}</h1>
            <p className="text-sm text-text-muted">{t("selfEducation.puzzleCount", { count: puzzles?.length ?? 0 })}</p>
          </div>
          <Link to="/self-education">
            <Button>{t("selfEducation.continue")}</Button>
          </Link>
        </div>

        {summary && (
          <p className="mb-6 text-sm text-text-secondary">
            {t("selfEducation.rating")} {summary.rating} · {t("selfEducation.streak")}{" "}
            {t("selfEducation.streakDays", { count: summary.streakDays })} · {t("selfEducation.accuracy")}{" "}
            {summary.accuracyPercent}%
          </p>
        )}

        {isLoading ? (
          <p className="text-text-secondary">{t("common.loading")}</p>
        ) : groups.length === 0 ? (
          <Card className="text-center text-text-secondary">{t("selfEducation.emptyHistory")}</Card>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 text-xs uppercase text-text-muted">{group.label}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {group.puzzles.map((puzzle) => (
                  <Link
                    key={puzzle.id}
                    to={`/puzzle/${puzzle.id}?mode=training`}
                    className="block rounded-xl border border-border-subtle p-3 hover:border-accent-violet"
                  >
                    <MiniBoard fen={puzzle.fen} />
                    <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                      <Pill tone="violet">{puzzle.tag}</Pill>
                      <span>{puzzle.sideToMove === "white" ? t("puzzle.whiteToMove") : t("puzzle.blackToMove")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
