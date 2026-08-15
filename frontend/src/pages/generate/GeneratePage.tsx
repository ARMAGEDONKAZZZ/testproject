import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { Plus, Minus, ArrowUp, ChevronDown, Grid, Carousel as CarouselIcon } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { MiniBoard } from "@/components/MiniBoard";
import { GenerateSidebar } from "@/components/GenerateSidebar";
import { RecommendedCard } from "./components/RecommendedCard";
import { PuzzleCarousel } from "./components/PuzzleCarousel";
import {
  useCreateGeneration,
  useGeneration,
  useCancelGeneration,
  useRegeneratePuzzle,
  type Generation,
} from "@/features/generation/hooks";

const RECOMMENDED = [
  { label: "Мат в 2 хода", tag: "mate-in-1" },
  { label: "Вилка конём", tag: "tactics" },
  { label: "Связка слоном", tag: "tactics" },
];

const QUICK_PICKS = [
  { label: "♔ Mate in 1", tag: "mate-in-1" },
  { label: "♔ Mate in 2", tag: "mate-in-1" },
  { label: "♖ Endgames", tag: "endgame" },
  { label: "♗ Tactics", tag: "tactics" },
  { label: "♞ Opening traps", tag: "opening-trap" },
];

export default function GeneratePage() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [view, setView] = useState<"carousel" | "grid">("carousel");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [recommendedCollapsed, setRecommendedCollapsed] = useState(false);

  const createGeneration = useCreateGeneration();
  const cancelGeneration = useCancelGeneration();
  const regenerate = useRegeneratePuzzle();
  const generation = useGeneration(generationId);

  async function handleSubmit() {
    if (!text.trim() && !selectedTag) {
      toast.error(t("generate.emptyContentError"));
      return;
    }
    try {
      const inputMode = selectedTag ? "tag" : "text";
      const payload = selectedTag ?? text.trim();
      const res = await createGeneration.mutateAsync({ inputMode, payload, count });
      setGenerationId(res.generationId);
      setCarouselIndex(0);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("generate.genericError"));
    }
  }

  function pickRecommended(label: string, tag: string) {
    setText(label);
    setSelectedTag(tag);
  }

  function pickQuickTag(label: string, tag: string) {
    setText(label);
    setSelectedTag(tag);
  }

  const isGenerating = generation?.status === "pending";
  const puzzles = generation?.status === "succeeded" ? generation.puzzles : [];

  return (
    <div className="flex">
      <GenerateSidebar />
      <div className="mx-auto max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8 text-center">
          <Mascot className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-3xl font-bold text-text-primary">{t("generate.heroTitle")}</h1>
          <p className="mt-2 text-text-secondary">{t("generate.heroSubtitle")}</p>
        </div>

        {!generationId && (
          <div className="mb-6">
            <button
              onClick={() => setRecommendedCollapsed((v) => !v)}
              className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${recommendedCollapsed ? "-rotate-90" : ""}`} />
              Свернуть
            </button>
            {!recommendedCollapsed && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {RECOMMENDED.map((item) => (
                    <RecommendedCard
                      key={item.label}
                      label={item.label}
                      selected={selectedTag === item.tag && text === item.label}
                      onClick={() => pickRecommended(item.label, item.tag)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-text-muted">Рекомендуемые задачи</p>
              </>
            )}
          </div>
        )}

        {isGenerating && (
        <Card className="mb-6 text-center">
          <p className="mb-3 text-accent-green">{t("generate.generating")}</p>
          <div className="mx-auto h-1.5 w-2/3 overflow-hidden rounded-full bg-bg-elevated">
            <div className="h-full w-2/3 animate-pulse bg-accent-green" />
          </div>
          <div className="mt-3 flex justify-center gap-4 text-xs text-text-muted">
            <span>{t("generate.stepFetching")}</span>
            <span>{t("generate.stepCalibrating")}</span>
            <span>{t("generate.stepGenerating")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              void cancelGeneration.mutateAsync(generationId!);
              setGenerationId(null);
            }}
          >
            {t("generate.cancel")}
          </Button>
        </Card>
      )}

      {generation?.status === "failed" && (
        <Card className="mb-6 border-danger/40 text-center text-danger">
          {generation.errorMessage ?? t("generate.genericError")}
        </Card>
      )}

      {puzzles.length > 0 && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setView("carousel")}
              aria-label="Вид: карусель"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                view === "carousel"
                  ? "border-accent-green text-accent-green"
                  : "border-border-subtle text-text-muted hover:text-text-secondary"
              }`}
            >
              <CarouselIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Вид: сетка"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                view === "grid"
                  ? "border-accent-green text-accent-green"
                  : "border-border-subtle text-text-muted hover:text-text-secondary"
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>

          {view === "carousel" ? (
            <PuzzleCarousel
              puzzles={puzzles}
              index={carouselIndex}
              onIndexChange={setCarouselIndex}
              onRegenerate={(puzzleId) => void regenerate.mutateAsync(puzzleId)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {puzzles.map((p) => (
                <PuzzleCard key={p.id} puzzle={p} />
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border-subtle bg-bg-tertiary px-3 py-2">
            <input
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              placeholder={t("generate.placeholder")}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSelectedTag(null);
              }}
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-tertiary px-2 py-2">
            <button
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="text-text-secondary hover:text-text-primary"
              aria-label="Меньше"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm text-text-primary">{count} шт.</span>
            <button
              onClick={() => setCount((c) => Math.min(4, c + 1))}
              className="text-text-secondary hover:text-text-primary"
              aria-label="Больше"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => void handleSubmit()}
            disabled={createGeneration.isPending || isGenerating}
            title={t("generate.generateButton")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-green text-bg-primary disabled:opacity-50"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_PICKS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => pickQuickTag(qp.label, qp.tag)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedTag === qp.tag
                  ? "border-accent-green text-accent-green"
                  : "border-border-subtle text-text-secondary"
              }`}
            >
              {qp.label}
            </button>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}

function PuzzleCard({ puzzle }: { puzzle: Generation["puzzles"][number] }) {
  const { t } = useTranslation();
  return (
    <Link to={`/puzzle/${puzzle.id}`} className="block rounded-xl border border-border-subtle p-3 hover:border-accent-violet">
      <MiniBoard fen={puzzle.fen} />
      <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
        <Pill tone="violet">{puzzle.tag}</Pill>
        <span>{puzzle.sideToMove === "white" ? t("puzzle.whiteToMove") : t("puzzle.blackToMove")}</span>
      </div>
    </Link>
  );
}
