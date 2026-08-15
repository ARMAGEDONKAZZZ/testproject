import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { useFavorites } from "@/features/folders/hooks";
import { PuzzleGrid } from "@/pages/folders/components/PuzzleGrid";

const TABS: { label: string; tag?: string }[] = [
  { label: "Все" },
  { label: "Тактика", tag: "tactics" },
  { label: "Маты", tag: "mate-in-1" },
  { label: "Эндшпили", tag: "endgame" },
  { label: "Дебютные ловушки", tag: "opening-trap" },
];

export default function FavoritesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [side, setSide] = useState<string | undefined>(undefined);
  const { data: puzzles, isLoading } = useFavorites(TABS[tab].tag, side);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold text-text-primary">{t("folders.favorites")}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {TABS.map((tabItem, i) => (
            <button
              key={tabItem.label}
              onClick={() => setTab(i)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                tab === i ? "border-accent-green text-accent-green" : "border-border-subtle text-text-secondary"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setSide(undefined)} className={!side ? "text-accent-green" : "text-text-secondary"}>
            Все
          </button>
          <button onClick={() => setSide("white")} className={side === "white" ? "text-accent-green" : "text-text-secondary"}>
            Ход белыми
          </button>
          <button onClick={() => setSide("black")} className={side === "black" ? "text-accent-green" : "text-text-secondary"}>
            Ход чёрными
          </button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-text-secondary">{t("common.loading")}</p>
        ) : puzzles && puzzles.length > 0 ? (
          <PuzzleGrid puzzles={puzzles} />
        ) : (
          <Card className="text-center text-text-secondary">Нет избранных задач</Card>
        )}
      </div>
    </div>
  );
}
