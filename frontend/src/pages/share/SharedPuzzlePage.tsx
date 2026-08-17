import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Pill } from "@/components/Pill";
import { Mascot } from "@/components/Mascot";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { Check, ChevronLeft, ChevronRight, List, Timer, Flip, Lightbulb } from "@/components/icons";
import { ChessBoardView } from "@/pages/puzzle/components/ChessBoardView";
import { LessonsPanel } from "@/pages/puzzle/components/LessonsPanel";
import { materialBalance } from "@/pages/puzzle/utils/material";
import { useSharedFolder, useCheckGuestMove } from "@/features/folders/hooks";

/**
 * Public, unauthenticated single-puzzle solving view for a share link, per
 * figma/"Задача веб вью по ссылке.svg" — replaces the folder-grid fallback
 * for the common case (share an individual puzzle) where the grid's cards
 * used to link to /puzzle/:id, an authenticated route a guest can never
 * actually open.
 */
export default function SharedPuzzlePage() {
  const { slug, puzzleId } = useParams<{ slug: string; puzzleId: string }>();
  const navigate = useNavigate();
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState<string | undefined>(undefined);
  const { data, error, isLoading } = useSharedFolder(slug, password);
  const checkMove = useCheckGuestMove(slug, password);

  const needsPassword = error instanceof ApiError && error.status === 401;
  const notFound = error instanceof ApiError && error.status === 404;

  const items = data?.items ?? [];
  const index = items.findIndex((p) => p.id === puzzleId);
  const puzzle = index >= 0 ? items[index] : undefined;

  const [currentFen, setCurrentFen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"idle" | "correct" | "incorrect">("idle");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [listOpen, setListOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  useEffect(() => {
    if (!puzzle) return;
    setCurrentFen(puzzle.fen);
    setOrientation(puzzle.sideToMove);
    setOutcome("idle");
    setElapsedSec(0);
    setTimerRunning(true);
  }, [puzzle?.id]);

  useEffect(() => {
    if (!timerRunning || outcome === "correct") return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, outcome]);

  async function handleMove(san: string, resultFen: string) {
    if (!puzzle || !slug) return;
    try {
      const res = await checkMove.mutateAsync({ puzzleId: puzzle.id, move: san });
      if (res.correct) {
        setOutcome("correct");
        setCurrentFen(resultFen);
      } else {
        setOutcome("incorrect");
        setCurrentFen(puzzle.fen);
      }
    } catch {
      toast.error("Не удалось проверить ход. Попробуйте ещё раз.");
    }
  }

  function retry() {
    if (!puzzle) return;
    setCurrentFen(puzzle.fen);
    setOutcome("idle");
  }

  function goToSibling(newIndex: number) {
    if (!items[newIndex]) return;
    navigate(`/share/${slug}/${items[newIndex].id}`);
  }

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  const material = currentFen ? materialBalance(currentFen) : 0;
  const materialLabel = material === 0 ? null : `${material > 0 ? "+" : ""}${material}`;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-bold text-accent-green">
            neuratop
          </Link>
          {puzzle && (
            <>
              <span className="text-sm text-text-secondary">{puzzle.objective}</span>
              <Pill tone="violet">Гостевой режим</Pill>
            </>
          )}
        </div>
        <Button size="sm" onClick={() => navigate("/auth/login")}>
          Войти
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {isLoading && <p className="text-center text-text-secondary">Загрузка…</p>}

        {notFound && <Card className="mx-auto max-w-sm text-center text-text-secondary">Задача не найдена или недоступна</Card>}

        {needsPassword && (
          <Card className="mx-auto max-w-sm text-center">
            <p className="mb-1 font-semibold text-text-primary">Введите пароль</p>
            <p className="mb-3 text-sm text-text-secondary">Эта задача защищена паролем</p>
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Пароль задачи"
            />
            <Button className="mt-3 w-full" onClick={() => setPassword(passwordInput)}>
              Открыть задачу
            </Button>
          </Card>
        )}

        {data && !puzzle && items.length > 0 && (
          // No :puzzleId in the URL (or it didn't match) — land on the
          // first item rather than showing a bare folder grid; a guest
          // opening a share link expects a board, not a list.
          <NavigateToFirst slug={slug} firstId={items[0].id} />
        )}

        {puzzle && currentFen && (
          <div className="relative">
            {materialLabel && (
              <div className="mb-2 flex items-center gap-1 text-sm text-text-secondary">
                <span>♟</span> {materialLabel}
              </div>
            )}
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => setTimerRunning((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-accent-violet/40 bg-accent-violet/10 px-6 py-2.5 font-mono text-2xl font-bold tracking-wider text-accent-violet-light"
                title={timerRunning ? "Пауза" : "Продолжить"}
              >
                {mm}:{ss}
              </button>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-3">
                <ToolButton label="Список" onClick={() => setListOpen((v) => !v)}>
                  <List className="h-4 w-4" />
                </ToolButton>
                <ToolButton label={timerRunning ? "Пауза" : "Продолжить"} onClick={() => setTimerRunning((v) => !v)}>
                  <Timer className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Перевернуть доску" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                  <Flip className="h-4 w-4" />
                </ToolButton>
                <ToolButton
                  label="Подсказка"
                  onClick={() => {
                    toast.show("Подсказки доступны после входа в аккаунт");
                    navigate("/auth/login");
                  }}
                >
                  <Lightbulb className="h-4 w-4" />
                </ToolButton>
              </div>

              <div className="flex-1">
                <Card
                  className={
                    outcome === "correct" ? "border-accent-green" : outcome === "incorrect" ? "border-danger" : undefined
                  }
                >
                  <div className="flex items-center justify-center gap-3">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => goToSibling(index - 1)}
                        disabled={index <= 0}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex-1">
                      <ChessBoardView
                        fen={currentFen}
                        orientation={orientation}
                        interactive={outcome === "idle"}
                        onMove={(san, resultFen) => void handleMove(san, resultFen)}
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => goToSibling(index + 1)}
                        disabled={index >= items.length - 1}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-3 text-sm text-text-secondary">
                    <Pill tone="neutral">{puzzle.sideToMove === "white" ? "White to move" : "Black to move"}</Pill>
                    {outcome === "incorrect" && (
                      <Button size="sm" variant="secondary" onClick={retry}>
                        Retry
                      </Button>
                    )}
                  </div>
                </Card>

                {listOpen && (
                  <Card className="mt-4">
                    <p className="mb-3 text-sm font-medium text-text-primary">List Overview</p>
                    <LessonsPanel />
                  </Card>
                )}
              </div>
            </div>

            <div className="fixed bottom-6 left-6 flex max-w-xs flex-col items-start gap-2">
              <div className="rounded-2xl rounded-bl-sm bg-bg-elevated p-3 text-sm text-text-primary shadow-lg">
                {puzzle.description}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-bg-elevated py-1 pl-1 pr-3 shadow-lg">
                <Mascot className="h-10 w-10" />
              </div>
            </div>
          </div>
        )}
      </main>

      {outcome === "correct" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(92vw,380px)] rounded-2xl border border-border-subtle bg-bg-secondary p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/15">
              <Check className="h-7 w-7 text-accent-green" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-text-primary">Задача решена!</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Вы решили задачу за {mm}:{ss}
            </p>
            <p className="mt-4 text-sm text-text-secondary">
              Зарегистрируйтесь, чтобы отслеживать прогресс, повышать рейтинг и решать больше тактических задач ежедневно!
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate("/auth/login")}>
              Войти в аккаунт
            </Button>
            <p className="mt-3 text-sm text-text-secondary">
              У вас ещё нет аккаунта?{" "}
              <Link to="/auth/register" className="text-accent-green">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary"
    >
      {children}
    </button>
  );
}

function NavigateToFirst({ slug, firstId }: { slug: string | undefined; firstId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/share/${slug}/${firstId}`, { replace: true });
  }, [slug, firstId, navigate]);
  return <p className="text-center text-text-secondary">Загрузка…</p>;
}
