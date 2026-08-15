import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { GenerateSidebar } from "@/components/GenerateSidebar";
import { MiniBoard } from "@/components/MiniBoard";
import { toast } from "@/components/Toast";
import { Sparkles } from "@/components/icons";
import { useMe, useTrainingSummary } from "@/features/profile/hooks";
import { useHistory } from "@/features/folders/hooks";
import { useCreateGeneration, useGeneration } from "@/features/generation/hooks";
import { SkillsPentagon } from "@/pages/profile/components/SkillsPentagon";
import { AccuracyRing } from "./components/AccuracyRing";
import { groupByDate } from "./utils/dateGroups";

/**
 * "Self education with AI" — the AI-coached training dashboard, per
 * docs/design-audit/self-education.md. Not a separate content section:
 * every number here is real (skill profile / training summary / history),
 * and "Начать/Продолжить обучение" reuses the existing puzzle generator,
 * just pre-filled with the tag matching the user's weakest skill axis.
 * Hero card background (#AA9EFF) is the exact fill traced from the Figma
 * frame — the rest of the app is dark-themed, but this one card is not.
 */
export default function SelfEducationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: summary } = useTrainingSummary();
  const { data: recentPuzzles } = useHistory(1, 8);

  const [generationId, setGenerationId] = useState<string | null>(null);
  const createGeneration = useCreateGeneration();
  const generation = useGeneration(generationId);
  const starting = createGeneration.isPending || generation?.status === "pending";

  useEffect(() => {
    if (generation?.status === "succeeded" && generation.puzzles[0]) {
      navigate(`/puzzle/${generation.puzzles[0].id}?mode=training`);
    }
    if (generation?.status === "failed") {
      toast.error(generation.errorMessage ?? t("common.errorGeneric"));
      setGenerationId(null);
    }
  }, [generation, navigate, t]);

  async function handleStartTraining() {
    if (!summary?.nextTopic) return;
    try {
      const res = await createGeneration.mutateAsync({
        inputMode: "tag",
        payload: summary.nextTopic.tag,
        count: 1,
      });
      setGenerationId(res.generationId);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  const hasHistory = (summary?.sessionsCount ?? 0) > 0;
  const groups = groupByDate(recentPuzzles ?? []).slice(0, 2);

  return (
    <div className="flex">
      <GenerateSidebar />
      <div className="mx-auto max-w-5xl flex-1 px-6 py-10">
        <Card className="mb-6 overflow-hidden !border-none p-8" style={{ backgroundColor: "#AA9EFF" }}>
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-[#171717]">
                ✦ {t("selfEducation.badge")}
              </span>
              <h1 className="mt-4 text-3xl font-bold text-[#171717]">
                {t("selfEducation.title")} <span className="text-accent-violet-deep">{t("selfEducation.titleHighlight")}</span>
              </h1>
              <p className="mt-3 text-sm text-[#171717]/70">{t("selfEducation.subtitle")}</p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => void handleStartTraining()}
                  disabled={starting || !summary?.nextTopic}
                  className="flex items-center gap-2 rounded-full bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4 text-accent-green" />
                  {starting ? t("selfEducation.preparing") : hasHistory ? t("selfEducation.continue") : t("selfEducation.start")}
                </button>
                {summary?.nextTopic && (
                  <span className="text-sm text-[#171717]/70">
                    {t("selfEducation.nextTopic")}: {t(`selfEducation.topics.${summary.nextTopic.axis}`)}
                  </span>
                )}
              </div>
            </div>

            {me && (
              <Card className="w-full max-w-xs shrink-0 !bg-bg-secondary">
                <h2 className="mb-3 text-sm font-semibold text-text-primary">{t("selfEducation.profile")}</h2>
                <SkillsPentagon skills={me.skillProfile} />
              </Card>
            )}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{t("selfEducation.history")}</h2>
              <Link to="/self-education/history" className="text-xs text-accent-green">
                {t("selfEducation.historyAll")} ›
              </Link>
            </div>
            <p className="mb-4 text-xs text-text-muted">
              {t("selfEducation.totalSessions", { count: summary?.sessionsCount ?? 0 })}
            </p>

            {groups.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("selfEducation.emptyHistory")}</p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="mb-2 text-xs uppercase text-text-muted">{group.label}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {group.puzzles.map((puzzle) => (
                      <Link
                        key={puzzle.id}
                        to={`/puzzle/${puzzle.id}?mode=training`}
                        className="block rounded-xl border border-border-subtle p-2 hover:border-accent-violet"
                      >
                        <MiniBoard fen={puzzle.fen} />
                        <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                          <Pill tone="violet">{puzzle.tag}</Pill>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t("selfEducation.stats")}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-muted">{t("selfEducation.rating")}</p>
                <p className="text-xl font-bold text-text-primary">
                  {summary?.rating ?? 1000}{" "}
                  {summary && summary.ratingDelta !== 0 && (
                    <span className={summary.ratingDelta > 0 ? "text-accent-green" : "text-danger"}>
                      {summary.ratingDelta > 0 ? "+" : ""}
                      {summary.ratingDelta}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">{t("selfEducation.streak")}</p>
                <p className="text-xl font-bold text-text-primary">
                  {t("selfEducation.streakDays", { count: summary?.streakDays ?? 0 })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <AccuracyRing percent={summary?.accuracyPercent ?? 0} />
                <div>
                  <p className="text-xs text-text-muted">{t("selfEducation.accuracy")}</p>
                  <p className="text-xl font-bold text-text-primary">{summary?.accuracyPercent ?? 0}%</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
