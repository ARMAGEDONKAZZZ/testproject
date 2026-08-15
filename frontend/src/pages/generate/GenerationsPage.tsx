import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { GenerateSidebar } from "@/components/GenerateSidebar";
import { useGenerationHistory, type GenerationSummary } from "@/features/generation/hooks";

const INPUT_MODE_LABEL: Record<GenerationSummary["inputMode"], string> = {
  text: "Текст",
  tag: "Тег",
  image: "Изображение",
  fen_pgn: "PGN/FEN",
};

const STATUS_TONE: Record<GenerationSummary["status"], "green" | "violet" | "danger"> = {
  succeeded: "green",
  pending: "violet",
  failed: "danger",
};

export default function GenerationsPage() {
  const { t } = useTranslation();
  const { data: generations, isLoading } = useGenerationHistory();

  return (
    <div className="flex">
      <GenerateSidebar expandedDefault />
      <div className="mx-auto max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold text-text-primary">Мои генерации</h1>

        {isLoading && <p className="mt-6 text-text-secondary">{t("common.loading")}</p>}

        {!isLoading && (!generations || generations.length === 0) && (
          <Card className="mt-6 text-center">
            <p className="mb-4 text-text-secondary">{t("folders.emptyHistory")}</p>
            <Link to="/generate">
              <Button>{t("generate.generateButton")}</Button>
            </Link>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {generations?.map((g) => (
            <Link key={g.id} to={`/generate?generationId=${g.id}`} className="block">
              <Card className="flex items-center justify-between gap-4 transition-colors hover:border-accent-violet">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Pill tone="violet">{INPUT_MODE_LABEL[g.inputMode]}</Pill>
                    <Pill tone={STATUS_TONE[g.status]}>{g.status}</Pill>
                    <span className="text-xs text-text-muted">{g.requestedCount} шт.</span>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-text-secondary">{g.inputPayload}</p>
                </div>
                <span className="shrink-0 text-xs text-text-muted">
                  {new Date(g.createdAt).toLocaleString("ru-RU")}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
