import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card } from "@/components/Card";
import { useMe, useSetBoardPreferences } from "@/features/profile/hooks";
import { boardColorsFor, animationDurationFor } from "@/features/profile/boardTheme";
import { ProfileSidebar } from "./components/ProfileSidebar";

const THEMES = [
  { id: "default", label: "Default", color: "#7B61FF" },
  { id: "green", label: "Green", color: "#0AFF89" },
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "purple", label: "Purple", color: "#9747FF" },
  { id: "ice", label: "Ice", color: "#BFFFFC" },
  { id: "wood", label: "Wood", color: "#B38867" },
];

const PIECE_SETS = ["Классика", "Турнир", "Дерево", "Неон"];

export default function BoardDesignPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const setBoardPreferences = useSetBoardPreferences();

  const [theme, setTheme] = useState("default");
  const [pieceSet, setPieceSet] = useState("Классика");
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(72);

  useEffect(() => {
    if (me?.boardPreferences) {
      setTheme(me.boardPreferences.theme);
      setPieceSet(me.boardPreferences.pieceSet);
      setShowCoordinates(me.boardPreferences.showCoordinates);
      setAnimationSpeed(me.boardPreferences.animationSpeedPct);
    }
  }, [me]);

  function persist(next: Partial<{ theme: string; pieceSet: string; showCoordinates: boolean; animationSpeedPct: number }>) {
    setBoardPreferences.mutate({
      theme,
      pieceSet,
      showCoordinates,
      animationSpeedPct: animationSpeed,
      ...next,
    });
  }

  return (
    <ProfileSidebar>
      <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">{t("profile.boardDesign")}</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Preview</h2>
        <div className="mx-auto w-64">
          <Chessboard
            options={{
              position: new Chess().fen(),
              allowDragging: false,
              darkSquareStyle: { backgroundColor: boardColorsFor(theme).dark },
              lightSquareStyle: { backgroundColor: boardColorsFor(theme).light },
              showNotation: showCoordinates,
              animationDurationInMs: animationDurationFor(animationSpeed),
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Board theme</h2>
        <div className="grid grid-cols-6 gap-2">
          {THEMES.map((th) => (
            <button
              key={th.id}
              onClick={() => {
                setTheme(th.id);
                persist({ theme: th.id });
              }}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                theme === th.id ? "border-accent-violet" : "border-border-subtle"
              }`}
            >
              <span className="h-6 w-6 rounded-full" style={{ backgroundColor: th.color }} />
              <span className="text-[10px] text-text-secondary">{th.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Piece set</h2>
        <div className="grid grid-cols-4 gap-2">
          {PIECE_SETS.map((set) => (
            <button
              key={set}
              onClick={() => {
                setPieceSet(set);
                persist({ pieceSet: set });
              }}
              className={`rounded-lg border p-3 text-sm ${
                pieceSet === set ? "border-accent-violet text-text-primary" : "border-border-subtle text-text-secondary"
              }`}
            >
              {set}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Options</h2>
        <label className="mb-4 flex items-center justify-between text-sm text-text-secondary">
          Show coordinates
          <input
            type="checkbox"
            checked={showCoordinates}
            onChange={(e) => {
              setShowCoordinates(e.target.checked);
              persist({ showCoordinates: e.target.checked });
            }}
          />
        </label>
        <div>
          <div className="mb-1 flex justify-between text-sm text-text-secondary">
            <span>Animation speed</span>
            <span>{animationSpeed}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
            onMouseUp={() => persist({ animationSpeedPct: animationSpeed })}
            className="w-full"
          />
        </div>
      </Card>
      </div>
    </ProfileSidebar>
  );
}
