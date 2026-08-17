import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Mascot } from "@/components/Mascot";
import { Pill } from "@/components/Pill";
import { GraduationCap, Presentation } from "@/components/icons";
import { SkillsPentagon } from "@/pages/profile/components/SkillsPentagon";
import { ChessBoardView } from "@/pages/puzzle/components/ChessBoardView";
import { useMe, useUpdateOnboarding } from "@/features/profile/hooks";
import { useCreateGeneration, useGeneration } from "@/features/generation/hooks";
import { useStartAttempt, useSubmitMove } from "@/features/puzzle/hooks";

type Role = "student" | "teacher";
type Level = "beginner" | "intermediate" | "advanced" | "expert";
type Step = "welcome" | "role" | "levelChoice" | "levelTest" | "levelTestResult" | "levelManual" | "levelManualResult";

// POST /generations caps count at 4 per request (FR-015) — the Figma mock's
// "5 задач" doesn't fit the real generation endpoint's hard limit.
const TEST_PUZZLE_COUNT = 4;
const LEVELS: Level[] = ["beginner", "intermediate", "advanced", "expert"];

/**
 * Post-registration onboarding wizard, per figma/онбординг.svg row 1.
 * Rendered by OnboardingGate as a full-screen overlay over whatever page is
 * mounted underneath (matches the Figma mock's dimmed Home background).
 * Any "Пропустить" immediately marks the wizard done — there's no partial
 * "resume where I left off" state to preserve.
 */
export function OnboardingWizard() {
  const { t } = useTranslation();
  const updateOnboarding = useUpdateOnboarding();
  const [step, setStep] = useState<Step>("welcome");
  const [role, setRole] = useState<Role | null>(null);
  const [declaredLevel, setDeclaredLevel] = useState<Level | null>(null);

  function finish(level?: Level) {
    updateOnboarding.mutate({
      wizardCompleted: true,
      ...(role ? { role } : {}),
      ...(level ? { declaredLevel: level } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-[min(92vw,440px)] rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl">
        {step === "welcome" && (
          <OnboardingCard
            title={t("onboarding.wizard.welcomeTitle")}
            body={t("onboarding.wizard.welcomeBody")}
            onSkip={() => finish()}
            onNext={() => setStep("role")}
          />
        )}

        {step === "role" && (
          <div>
            <Mascot className="mx-auto mb-3 h-14 w-16" />
            <h2 className="text-center text-lg font-semibold text-text-primary">{t("onboarding.wizard.roleTitle")}</h2>
            <p className="mt-1 text-center text-sm text-text-secondary">{t("onboarding.wizard.roleBody")}</p>
            <div className="mt-4 flex gap-3">
              {(["student", "teacher"] as Role[]).map((r) => {
                const RoleIcon = r === "student" ? GraduationCap : Presentation;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm ${
                      role === r
                        ? "border-accent-green bg-accent-green/10 text-accent-green"
                        : "border-border-subtle text-text-secondary"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full ${
                        role === r ? "bg-accent-green/20" : "bg-bg-elevated"
                      }`}
                    >
                      <RoleIcon className="h-6 w-6" />
                    </span>
                    {t(r === "student" ? "onboarding.wizard.roleStudent" : "onboarding.wizard.roleTeacher")}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => finish()} className="text-sm text-text-muted hover:text-text-secondary">
                {t("onboarding.skip")}
              </button>
              <Button disabled={!role} onClick={() => setStep("levelChoice")}>
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "levelChoice" && (
          <div>
            <Mascot className="mx-auto mb-3 h-14 w-16" />
            <h2 className="text-center text-lg font-semibold text-text-primary">{t("onboarding.wizard.levelChoiceTitle")}</h2>
            <p className="mt-1 text-center text-sm text-text-secondary">{t("onboarding.wizard.levelChoiceBody")}</p>
            <Button className="mt-4 w-full" onClick={() => setStep("levelTest")}>
              {t("onboarding.wizard.levelChoiceStart")}
            </Button>
            <button
              onClick={() => setStep("levelManual")}
              className="mt-2 w-full rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary"
            >
              {t("onboarding.wizard.levelChoiceManual")}
            </button>
            <button onClick={() => finish()} className="mt-3 w-full text-center text-sm text-text-muted hover:text-text-secondary">
              {t("onboarding.skip")}
            </button>
          </div>
        )}

        {step === "levelTest" && <LevelTestStep onDone={() => setStep("levelTestResult")} onSkip={() => finish()} />}

        {step === "levelTestResult" && <LevelTestResultStep onFinish={() => finish()} />}

        {step === "levelManual" && (
          <LevelManualStep
            selected={declaredLevel}
            onSelect={setDeclaredLevel}
            onSkip={() => finish()}
            onNext={() => setStep("levelManualResult")}
          />
        )}

        {step === "levelManualResult" && declaredLevel && (
          <div>
            <Mascot className="mx-auto mb-3 h-14 w-16" />
            <h2 className="text-center text-lg font-semibold text-text-primary">{t("onboarding.wizard.levelManualDoneTitle")}</h2>
            <p className="mt-1 text-center text-sm text-text-secondary">{t("onboarding.wizard.levelManualDoneBody")}</p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-text-secondary">{t("onboarding.yourLevel")}</span>
              <Pill tone="violet">{t(`onboarding.wizard.level${capitalize(declaredLevel)}`)}</Pill>
            </div>
            <Button className="mt-4 w-full" onClick={() => finish(declaredLevel)}>
              {t("onboarding.startLearning")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingCard({
  title,
  body,
  onNext,
  onSkip,
}: {
  title: string;
  body: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Mascot className="mx-auto mb-3 h-14 w-16" />
      <h2 className="text-center text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-center text-sm text-text-secondary">{body}</p>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={onSkip} className="text-sm text-text-muted hover:text-text-secondary">
          {t("onboarding.skip")}
        </button>
        <Button onClick={onNext}>{t("common.next")}</Button>
      </div>
    </div>
  );
}

function LevelManualStep({
  selected,
  onSelect,
  onNext,
  onSkip,
}: {
  selected: Level | null;
  onSelect: (l: Level) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">{t("onboarding.wizard.levelManualTitle")}</h2>
      <p className="mt-1 text-sm text-text-secondary">{t("onboarding.wizard.levelManualBody")}</p>
      <div className="mt-4 space-y-2">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            className={`block w-full rounded-xl border p-3 text-left ${
              selected === l ? "border-accent-green bg-accent-green/10" : "border-border-subtle"
            }`}
          >
            <p className="text-sm font-medium text-text-primary">{t(`onboarding.wizard.level${capitalize(l)}`)}</p>
            <p className="text-xs text-text-muted">{t(`onboarding.wizard.level${capitalize(l)}Desc`)}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={onSkip} className="text-sm text-text-muted hover:text-text-secondary">
          {t("onboarding.skip")}
        </button>
        <Button disabled={!selected} onClick={onNext}>
          {t("onboarding.startLearning")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Real 5-puzzle level assessment: generates puzzles via the same pipeline
 * as the Home page, then drives each through the same start-attempt/
 * submit-move endpoints PuzzlePage uses — every move is a genuine
 * solve_attempts row and bumps the real skill_profiles axis on a correct
 * solve (backend/internal/puzzle/service.go SubmitMove). No mock scoring:
 * the "result" is just whatever the real skill profile looks like after 5
 * real attempts.
 */
function LevelTestStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const createGeneration = useCreateGeneration();
  const [generationId, setGenerationId] = useState<string | null>(null);
  const generation = useGeneration(generationId);
  const [index, setIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [failed, setFailed] = useState(false);

  const puzzle = generation?.puzzles[index];
  const startAttempt = useStartAttempt(puzzle?.id ?? "");
  const submitMove = useSubmitMove(attemptId ?? "");

  useEffect(() => {
    createGeneration
      .mutateAsync({ inputMode: "text", payload: "level assessment", count: TEST_PUZZLE_COUNT })
      .then((res) => setGenerationId(res.generationId))
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (generation?.status === "failed") setFailed(true);
  }, [generation?.status]);

  useEffect(() => {
    if (!puzzle || attemptId) return;
    startAttempt
      .mutateAsync()
      .then((res) => setAttemptId(res.attemptId))
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle?.id]);

  async function handleMove(san: string) {
    if (!attemptId || feedback) return;
    try {
      const res = await submitMove.mutateAsync(san);
      setFeedback(res.correct ? "correct" : "incorrect");
    } catch {
      setFeedback("incorrect");
    }
    setTimeout(() => {
      if (index + 1 >= TEST_PUZZLE_COUNT) {
        onDone();
        return;
      }
      setIndex((i) => i + 1);
      setAttemptId(null);
      setFeedback(null);
    }, 900);
  }

  if (failed) {
    return (
      <div className="text-center">
        <p className="text-sm text-text-secondary">{t("common.errorGeneric")}</p>
        <Button className="mt-4 w-full" onClick={onSkip}>
          {t("onboarding.skip")}
        </Button>
      </div>
    );
  }

  if (!puzzle) {
    return <p className="py-10 text-center text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">{t("onboarding.wizard.levelTestTaskLabel", { n: index + 1 })}</p>
        <p className="text-xs text-text-muted">{t("onboarding.wizard.levelTestSolved", { solved: index, total: TEST_PUZZLE_COUNT })}</p>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-accent-green transition-all"
          style={{ width: `${(index / TEST_PUZZLE_COUNT) * 100}%` }}
        />
      </div>
      <ChessBoardView
        fen={puzzle.fen}
        orientation={puzzle.sideToMove}
        interactive={!feedback}
        onMove={(san) => void handleMove(san)}
      />
      {feedback && (
        <p className={`mt-3 text-center text-sm font-medium ${feedback === "correct" ? "text-accent-green" : "text-danger"}`}>
          {feedback === "correct" ? t("puzzle.greatMove") : t("puzzle.tryDifferently")}
        </p>
      )}
    </div>
  );
}

function LevelTestResultStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useMe();

  // SubmitMove bumps skill_profiles server-side but nothing in the test
  // flow invalidated the cached ["me"] query — force a fresh read so the
  // pentagon reflects the just-finished attempts.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ["me"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Mascot className="mx-auto mb-3 h-14 w-16" />
      <h2 className="text-center text-lg font-semibold text-text-primary">{t("onboarding.wizard.levelTestDoneTitle")}</h2>
      <p className="mt-1 text-center text-sm text-text-secondary">{t("onboarding.wizard.levelTestDoneBody")}</p>
      {me && (
        <div className="mt-4 rounded-xl bg-bg-tertiary p-4">
          <SkillsPentagon skills={me.skillProfile} hideEdit />
        </div>
      )}
      <Button className="mt-4 w-full" onClick={onFinish}>
        {t("onboarding.startLearning")}
      </Button>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
