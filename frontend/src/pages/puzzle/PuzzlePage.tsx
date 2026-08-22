import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { Modal } from "@/components/Modal";
import { Mascot } from "@/components/Mascot";
import { toast } from "@/components/Toast";
import { ApiError, api } from "@/api/client";
import { Timer, ChevronLeft, ChevronRight } from "@/components/icons";
import { ChessBoardView } from "./components/ChessBoardView";
import { ToolbarSidebar } from "./components/ToolbarSidebar";
import { BoardThemePicker } from "./components/BoardThemePicker";
import { HintPaywallModal } from "./components/HintPaywallModal";
import { LessonsPanel } from "./components/LessonsPanel";
import { TimerModal } from "./components/TimerModal";
import { ShareModal } from "./components/ShareModal";
import { PuzzleOnboardingTour } from "@/features/onboarding/PuzzleOnboardingTour";
import { materialBalance } from "./utils/material";
import { trainingIntroMessage } from "./utils/trainingMessages";
import { playTimerBeep } from "./utils/beep";
import {
  usePuzzle,
  useStartAttempt,
  useSubmitMove,
  useSimplify,
  useRequestHint,
  useRevealSolution,
  useAnalysis,
  useToggleFavorite,
} from "@/features/puzzle/hooks";
import { useFolders, useAddToFolders } from "@/features/folders/hooks";
import { useMe } from "@/features/profile/hooks";
import { useRegeneratePuzzle, useGeneration } from "@/features/generation/hooks";

// "opponent-moving": a correct move that wasn't the final ply of a
// multi-move solution (see useSubmitMove) — board stays locked while the
// forced opponent reply auto-plays, then flips back to "idle".
type MoveOutcome = "idle" | "correct" | "incorrect" | "opponent-moving";

/** Parses a UCI move like "e7e8q" into {from, to, promotion}. */
function parseUci(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci.slice(4) : undefined };
}

export default function PuzzlePage() {
  const { t } = useTranslation();
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isTraining = searchParams.get("mode") === "training";
  const resumedFromSimplify = searchParams.get("resumed") === "1";
  // Carried via router state from PuzzleCarousel/PuzzleActionBar/PuzzleGrid
  // links — lets the solving screen offer prev/next through the same
  // result set (generation batch, folder, history, favorites) it was
  // opened from, per docs/design-audit/toolboard.md ("‹ ›" pagination).
  const siblingIds = (location.state as { siblingIds?: string[] } | null)?.siblingIds;
  const siblingIndex = siblingIds ? siblingIds.indexOf(puzzleId ?? "") : -1;
  const hasSiblingNav = !!siblingIds && siblingIds.length > 1 && siblingIndex !== -1;

  function goToSibling(newIndex: number) {
    if (!siblingIds) return;
    navigate(`/puzzle/${siblingIds[newIndex]}${location.search}`, { state: { siblingIds } });
  }
  const { data: me } = useMe();
  const { data: puzzle, isLoading } = usePuzzle(puzzleId ?? "");
  const startAttempt = useStartAttempt(puzzleId ?? "");

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentPuzzleId, setCurrentPuzzleId] = useState(puzzleId ?? "");
  const [currentFen, setCurrentFen] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [outcome, setOutcome] = useState<MoveOutcome>("idle");
  const [hintText, setHintText] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerSoundOn, setTimerSoundOn] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [mascotBubble, setMascotBubble] = useState<string | null>(null);
  const [originalPuzzleId, setOriginalPuzzleId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenGenerationId, setRegenGenerationId] = useState<string | null>(null);

  const submitMove = useSubmitMove(attemptId ?? "");
  const simplify = useSimplify(attemptId ?? "");
  const requestHint = useRequestHint(attemptId ?? "");
  const revealSolution = useRevealSolution(attemptId ?? "");
  const toggleFavorite = useToggleFavorite(currentPuzzleId);
  const { data: analysis } = useAnalysis(analysisOpen ? attemptId : null);
  const regeneratePuzzle = useRegeneratePuzzle();
  const regenGeneration = useGeneration(regenGenerationId);

  useEffect(() => {
    if (!puzzleId) return;
    setCurrentPuzzleId(puzzleId);
    // Route param changed (e.g. prev/next sibling navigation) — this
    // component instance is reused by React Router, so per-puzzle UI state
    // from the previous puzzle must be cleared explicitly.
    setOutcome("idle");
    setHintText(null);
    setAttemptId(null);
  }, [puzzleId]);

  useEffect(() => {
    if (puzzle) {
      setCurrentFen(puzzle.fen);
      setOrientation(puzzle.sideToMove);
    }
  }, [puzzle]);

  useEffect(() => {
    if (!currentPuzzleId) return;
    startAttempt
      .mutateAsync()
      .then((res) => setAttemptId(res.attemptId))
      .catch(() => toast.error(t("common.errorGeneric")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPuzzleId]);

  useEffect(() => {
    if (!isTraining || !puzzle) return;
    const onboarded = sessionStorage.getItem("self_education_onboarded");
    if (!onboarded) {
      setMascotBubble(t("selfEducation.onboarding"));
      sessionStorage.setItem("self_education_onboarded", "1");
      const timeout = setTimeout(() => setMascotBubble(trainingIntroMessage(puzzle.objective)), 4000);
      return () => clearTimeout(timeout);
    }
    setMascotBubble(trainingIntroMessage(puzzle.objective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTraining, puzzle?.id]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s === null || s <= 0) return s;
        if (s === 1 && timerSoundOn) playTimerBeep();
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds === null]);

  useEffect(() => {
    if (!regenGenerationId || !regenGeneration) return;
    if (regenGeneration.status === "succeeded") {
      const newPuzzle = regenGeneration.puzzles[0];
      setRegenerating(false);
      setRegenGenerationId(null);
      if (newPuzzle) {
        navigate(`/puzzle/${newPuzzle.id}`);
      } else {
        toast.error(t("generate.genericError"));
      }
    } else if (regenGeneration.status === "failed") {
      setRegenerating(false);
      setRegenGenerationId(null);
      toast.error(regenGeneration.errorMessage ?? t("generate.genericError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenGeneration?.status]);

  async function handleMove(move: string, resultFen: string) {
    if (!attemptId) return;
    try {
      const res = await submitMove.mutateAsync(move);
      if (!res.correct) {
        setOutcome("incorrect");
        // Snap back to the puzzle's starting position — one wrong move ends the attempt line.
        setCurrentFen(puzzle?.fen ?? currentFen);
        return;
      }

      setCurrentFen(resultFen);

      if (res.opponentMove) {
        // Not the final ply — lock the board, auto-play the forced reply
        // after a short pause so the player can register their own move
        // landing first, then unlock for the next one.
        setOutcome("opponent-moving");
        const opponentMove = res.opponentMove;
        setTimeout(() => {
          setCurrentFen((fen) => {
            if (!fen) return fen;
            try {
              const game = new Chess(fen);
              const { from, to, promotion } = parseUci(opponentMove);
              const move = game.move({ from, to, promotion });
              return move ? game.fen() : fen;
            } catch {
              return fen;
            }
          });
          setOutcome("idle");
        }, 600);
        return;
      }

      setOutcome("correct");
      if (isTraining && originalPuzzleId && originalPuzzleId !== currentPuzzleId) {
        setMascotBubble(t("selfEducation.returnMessage"));
      } else if (isTraining && resumedFromSimplify) {
        setMascotBubble(t("selfEducation.finalMessage"));
      }
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  async function handleSimplify() {
    try {
      const res = await simplify.mutateAsync();
      if (isTraining) {
        setOriginalPuzzleId((id) => id ?? currentPuzzleId);
        setMascotBubble(t("selfEducation.simplifiedMessage"));
      }
      setCurrentPuzzleId(res.puzzle.id);
      setCurrentFen(res.puzzle.fen);
      setOutcome("idle");
      setAttemptId(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("puzzle.simplifyLimitReached"));
      } else {
        toast.error(t("common.errorGeneric"));
      }
    }
  }

  async function handleHint() {
    try {
      const res = await requestHint.mutateAsync();
      setHintText(res.hint);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setPaywallOpen(true);
      } else {
        toast.error(t("common.errorGeneric"));
      }
    }
  }

  async function handleReveal() {
    try {
      const res = await revealSolution.mutateAsync();
      toast.show(`${t("puzzle.solutionLabel")}: ${res.solutionLine.join(", ")}`);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await regeneratePuzzle.mutateAsync(currentPuzzleId);
      setRegenGenerationId(res.generationId);
    } catch {
      setRegenerating(false);
      toast.error(t("generate.genericError"));
    }
  }

  if (isLoading || !puzzle || !currentFen) {
    return <div className="p-10 text-center text-text-secondary">{t("common.loading")}</div>;
  }

  const material = materialBalance(currentFen);
  const materialLabel = material === 0 ? null : `${material > 0 ? "+" : ""}${material}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1 text-lg font-semibold text-text-primary">
          {puzzle.objective}
        </h1>
        <div className="flex items-center gap-2">
          <Pill tone="neutral">
            {puzzle.sideToMove === "white" ? t("puzzle.whiteToMove") : t("puzzle.blackToMove")}
          </Pill>
          <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary">
            {puzzle.sideToMove === "white" ? "White to move" : "Black to move"}
          </span>
          <BoardThemePicker />
        </div>
      </div>

      {/* Prominent top-center timer, per figma/example.png — the countdown
          used to be a small pill easy to miss; now it's the dominant
          element in its own row whenever a countdown is running. */}
      {remainingSeconds !== null && (
        <div className="mb-4 flex justify-center">
          <div
            className={`flex items-center gap-2 rounded-2xl border px-6 py-2.5 font-mono text-2xl font-bold tracking-wider ${
              remainingSeconds <= 10
                ? "animate-pulse border-danger/50 bg-danger/10 text-danger"
                : "border-accent-violet/40 bg-accent-violet/10 text-accent-violet-light"
            }`}
          >
            <Timer className="h-6 w-6" />
            {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
            {String(remainingSeconds % 60).padStart(2, "0")}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        <ToolbarSidebar
          puzzleId={currentPuzzleId}
          fen={currentFen}
          orientation={orientation}
          favorite={favorite}
          onToggleFavorite={() => {
            const next = !favorite;
            setFavorite(next);
            toggleFavorite.mutate(next);
          }}
          onList={() => setListOpen((v) => !v)}
          onShare={() => setShareModalOpen(true)}
          onTimer={() => setTimerModalOpen(true)}
          onFlip={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          onRegenerate={() => void handleRegenerate()}
          regenerating={regenerating}
          onAddToFolder={() => setFolderPickerOpen(true)}
          onPlayVsAi={() => toast.show(t("puzzle.playVsAiComingSoon"))}
          onHint={() => void handleHint()}
        />

        <div className="relative flex-1">
          {materialLabel && (
            <div className="mb-2 flex items-center gap-1 text-sm text-text-secondary">
              <span>♟</span> {materialLabel}
            </div>
          )}

          <Card
            className={
              outcome === "correct" || outcome === "opponent-moving"
                ? "border-accent-green"
                : outcome === "incorrect"
                  ? "border-danger"
                  : undefined
            }
          >
            <div className="relative">
              <ChessBoardView
                fen={currentFen}
                orientation={orientation}
                interactive={outcome === "idle" && !regenerating}
                onMove={(move, resultFen) => void handleMove(move, resultFen)}
              />
              {regenerating && <RegenerateOverlay />}
            </div>

            {hasSiblingNav && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goToSibling(siblingIndex - 1)}
                  disabled={siblingIndex <= 0}
                  aria-label={t("selfEducation.previousPuzzle")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary transition-colors hover:border-accent-green hover:text-accent-green disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-text-muted">
                  {siblingIndex + 1} / {siblingIds!.length}
                </span>
                <button
                  type="button"
                  onClick={() => goToSibling(siblingIndex + 1)}
                  disabled={siblingIndex >= siblingIds!.length - 1}
                  aria-label="Следующая задача"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-primary transition-colors hover:border-accent-green hover:text-accent-green disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {outcome === "opponent-moving" && (
              <div className="mt-4 rounded-xl bg-accent-green/10 p-3 text-center text-accent-green">
                <p>{t("puzzle.opponentMoving")}</p>
              </div>
            )}

            {outcome === "correct" && (
              <div className="mt-4 rounded-xl bg-accent-green/10 p-3 text-center text-accent-green">
                <p>{t("puzzle.greatMove")}</p>
                {isTraining && originalPuzzleId && originalPuzzleId !== currentPuzzleId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => navigate(`/puzzle/${originalPuzzleId}?mode=training&resumed=1`)}
                  >
                    {t("selfEducation.previousPuzzle")}
                  </Button>
                )}
              </div>
            )}

            {outcome === "incorrect" && (
              <div className="mt-4 rounded-xl border border-danger/40 bg-bg-elevated p-4 text-center">
                <p className="font-medium text-danger">{t("puzzle.tryDifferently")}</p>
                <p className="mt-1 text-sm text-text-secondary">{t("puzzle.simplifyOffer")}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" onClick={() => void handleSimplify()} loading={simplify.isPending}>
                    {t("puzzle.simplifyButton")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setOutcome("idle")}>
                    {t("puzzle.retry")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleReveal()}>
                    {t("puzzle.viewSolution")}
                  </Button>
                </div>
              </div>
            )}

            {hintText && (
              <p className="mt-3 rounded-xl bg-bg-elevated p-3 text-sm text-text-secondary">💡 {hintText}</p>
            )}
          </Card>

          {materialLabel && (
            <div className="mt-2 flex items-center gap-1 text-sm text-text-secondary">
              <span>♟</span> {materialLabel}
            </div>
          )}

          <div className="mt-4">
            <CollapsiblePanel title="List Overview" open={listOpen} onToggle={() => setListOpen((v) => !v)}>
              <LessonsPanel />
            </CollapsiblePanel>
          </div>

          <div className="mt-4">
            <CollapsiblePanel
              title={t("puzzle.chatTitle")}
              icon={<Mascot className="h-8 w-8" />}
              open={chatOpen}
              onToggle={() => setChatOpen((v) => !v)}
            >
              <AiChatPanel
                puzzleId={currentPuzzleId}
                greetingName={isTraining ? me?.nickname : undefined}
                onAnalyze={() => setAnalysisOpen(true)}
                onSimplify={() => void handleSimplify()}
                onGenerateNew={() => navigate("/self-education")}
              />
            </CollapsiblePanel>
          </div>

          <div className="fixed bottom-6 left-6 flex max-w-xs flex-col items-start gap-2">
            {isTraining && mascotBubble && (
              <div className="rounded-2xl rounded-bl-sm bg-bg-elevated p-3 text-sm text-text-primary shadow-lg">
                {mascotBubble}
              </div>
            )}
            <button
              onClick={() => setChatOpen(true)}
              title={t("puzzle.chatTitle")}
              className="flex items-center gap-2 rounded-full bg-bg-elevated py-1 pl-1 pr-3 shadow-lg hover:bg-bg-elevated-hover"
            >
              <Mascot className="h-10 w-10" />
              <span className="text-sm text-text-secondary">{t("selfEducation.askAi")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right-edge analysis drawer, per figma/example.png: a persistent
          collapsed chevron toggles the engine-analysis panel in from the
          right, instead of it living inline below the board. */}
      <button
        type="button"
        onClick={() => setAnalysisOpen((v) => !v)}
        aria-label={t("puzzle.engineAnalyzing")}
        aria-expanded={analysisOpen}
        className="fixed right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-secondary shadow-lg transition-colors hover:text-text-primary"
      >
        {analysisOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {analysisOpen && (
        <div className="fixed bottom-0 right-0 top-16 z-10 w-80 max-w-[85vw] overflow-y-auto border-l border-border-subtle bg-bg-secondary p-5 shadow-2xl">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">{t("puzzle.engineAnalyzing")}</h3>
          {analysis ? (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>Eval: {analysis.evaluation}</p>
              <p>
                {t("puzzle.bestMove")}: {analysis.bestMove}
              </p>
              <p>
                {t("puzzle.depth")}: {analysis.depth}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("common.loading")}</p>
          )}
        </div>
      )}

      <HintPaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} attemptId={attemptId ?? ""} />

      <TimerModal
        open={timerModalOpen}
        onOpenChange={setTimerModalOpen}
        onApply={(seconds, soundEnabled) => {
          setRemainingSeconds(seconds);
          setTimerSoundOn(soundEnabled);
        }}
      />

      <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} puzzleId={currentPuzzleId} />

      <FolderPickerModal
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        puzzleId={currentPuzzleId}
      />

      <PuzzleOnboardingTour />
    </div>
  );
}

/**
 * Multi-step loader shown over the board while regenerating in place —
 * mirrors GeneratePage's isGenerating card and
 * docs/design-audit/toolboard.md section 8 ("Regenerate"): desaturated
 * board, progress bar, 3 checkpoint labels.
 */
function RegenerateOverlay() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg-primary/85 backdrop-blur-sm">
      <Mascot className="h-12 w-12 animate-bounce" />
      <p className="text-sm font-medium text-accent-green">{t("generate.generating")}</p>
      <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-bg-elevated">
        <div className="h-full w-2/3 animate-pulse bg-accent-green" />
      </div>
      <div className="flex gap-3 text-xs text-text-muted">
        <span>✓ {t("generate.stepFetching")}</span>
        <span>✓ {t("generate.stepCalibrating")}</span>
        <span>{t("generate.stepGenerating")}</span>
      </div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-center justify-between text-sm text-text-primary">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}

function greetingForHour(t: (key: string) => string, hour: number): string {
  if (hour < 5) return t("selfEducation.greetingNight");
  if (hour < 12) return t("selfEducation.greetingMorning");
  if (hour < 18) return t("selfEducation.greetingDay");
  return t("selfEducation.greeting");
}

function AiChatPanel({
  puzzleId,
  greetingName,
  onAnalyze,
  onSimplify,
  onGenerateNew,
}: {
  puzzleId: string;
  /** Set only in training mode — renders the personalized greeting + quick actions. */
  greetingName?: string;
  onAnalyze: () => void;
  onSimplify: () => void;
  onGenerateNew: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const qc = useQueryClient();

  const chat = useMutation({
    mutationFn: (message: string) => api.post<{ reply: string }>(`/puzzles/${puzzleId}/chat`, { message }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["puzzle-chat", puzzleId] }),
  });

  async function send(text?: string) {
    const userMessage = text ?? input;
    if (!userMessage.trim()) return;
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setInput("");
    try {
      const res = await chat.mutateAsync(userMessage);
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t("puzzle.chatError") }]);
    }
  }

  return (
    <div>
      {greetingName && messages.length === 0 && (
        <div className="mb-3">
          <p className="mb-2 text-sm font-medium text-text-primary">
            {greetingForHour(t, new Date().getHours())}, {greetingName}.
          </p>
          <div className="space-y-1.5">
            <QuickAction label={t("selfEducation.quickAnalyze")} onClick={onAnalyze} />
            <QuickAction label={t("selfEducation.quickSimplify")} onClick={onSimplify} />
            <QuickAction label={t("selfEducation.quickGenerate")} onClick={onGenerateNew} />
            <QuickAction label={t("selfEducation.quickBestMove")} onClick={onAnalyze} />
          </div>
        </div>
      )}
      <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-sm">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "user" ? "text-text-primary" : "text-accent-green"}>
            {m.text}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={t("puzzle.chatPlaceholder")}
        />
        <Button size="sm" onClick={() => void send()} loading={chat.isPending}>
          →
        </Button>
      </div>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-lg border border-border-subtle px-3 py-1.5 text-left text-sm text-text-secondary hover:border-accent-violet hover:text-text-primary"
    >
      {label}
    </button>
  );
}

function FolderPickerModal({
  open,
  onOpenChange,
  puzzleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzleId: string;
}) {
  const { t } = useTranslation();
  const { data: folders } = useFolders();
  const addToFolders = useAddToFolders();
  const [selected, setSelected] = useState<string[]>([]);

  const all = [...(folders?.private ?? []), ...(folders?.public ?? [])];

  async function handleSave() {
    try {
      await Promise.all(selected.map((folderId) => addToFolders.mutateAsync({ folderId, puzzleIds: [puzzleId] })));
      toast.success(t("puzzle.addedToFolder"));
      onOpenChange(false);
      setSelected([]);
    } catch {
      toast.error(t("puzzle.addToFolderFailed"));
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("puzzle.addToFolderTitle")}>
      <div className="max-h-60 space-y-1 overflow-y-auto">
        {all.map((folder) => (
          <label key={folder.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-elevated">
            <input
              type="checkbox"
              checked={selected.includes(folder.id)}
              onChange={(e) =>
                setSelected((s) => (e.target.checked ? [...s, folder.id] : s.filter((id) => id !== folder.id)))
              }
            />
            <span className="text-sm text-text-primary">{folder.name}</span>
          </label>
        ))}
      </div>
      <Button className="mt-4 w-full" onClick={() => void handleSave()} loading={addToFolders.isPending}>
        {t("puzzle.add")}
      </Button>
    </Modal>
  );
}
