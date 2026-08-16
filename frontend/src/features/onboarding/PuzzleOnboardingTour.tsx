import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Mascot } from "@/components/Mascot";
import { useMe, useUpdateOnboarding } from "@/features/profile/hooks";

const STEPS = [
  { titleKey: "onboarding.puzzleTour.step1Title", bodyKey: "onboarding.puzzleTour.step1Body", position: "right-16 top-24" },
  { titleKey: "onboarding.puzzleTour.step2Title", bodyKey: "onboarding.puzzleTour.step2Body", position: "right-16 top-24" },
  { titleKey: "onboarding.puzzleTour.step3Title", bodyKey: "onboarding.puzzleTour.step3Body", position: "left-20 top-1/2 -translate-y-1/2" },
  { titleKey: "onboarding.puzzleTour.step4Title", bodyKey: "onboarding.puzzleTour.step4Body", position: "bottom-24 left-6" },
] as const;

/**
 * 4-step coach-mark tour over the puzzle-solving toolboard, per
 * figma/онбординг.svg row 3 ("Экран пазла"). Same gating pattern as
 * HomeOnboardingTour: only after the wizard, only until dismissed once,
 * both backend-persisted on onboarding_state.
 */
export function PuzzleOnboardingTour() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const updateOnboarding = useUpdateOnboarding();
  const [step, setStep] = useState(0);

  if (!me || !me.onboarding.wizardCompleted || me.onboarding.puzzleTourCompleted) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    updateOnboarding.mutate({ puzzleTourCompleted: true });
  }

  return (
    <div className={`fixed z-40 w-[min(88vw,320px)] rounded-2xl border border-border-subtle bg-bg-secondary p-4 shadow-2xl ${current.position}`}>
      <Mascot className="mb-2 h-10 w-11" />
      <h3 className="text-sm font-semibold text-text-primary">{t(current.titleKey)}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t(current.bodyKey)}</p>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={finish} className="text-xs text-text-muted hover:text-text-secondary">
          {t("onboarding.skip")}
        </button>
        <Button size="sm" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
          {isLast ? t("onboarding.startLearning") : t("common.next")}
        </Button>
      </div>
    </div>
  );
}
