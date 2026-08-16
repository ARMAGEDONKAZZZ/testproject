import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Mascot } from "@/components/Mascot";
import { useMe, useUpdateOnboarding } from "@/features/profile/hooks";

const STEPS = [
  { titleKey: "onboarding.homeTour.step1Title", bodyKey: "onboarding.homeTour.step1Body", position: "bottom-24 left-6" },
  {
    titleKey: "onboarding.homeTour.step2Title",
    bodyKey: "onboarding.homeTour.step2Body",
    position: "bottom-40 left-1/2 -translate-x-1/2",
  },
  { titleKey: "onboarding.homeTour.step3Title", bodyKey: "onboarding.homeTour.step3Body", position: "top-24 left-1/2 -translate-x-1/2" },
] as const;

/**
 * 3-step coach-mark tour over the Home/Generate screen, per
 * figma/онбординг.svg row 2 ("Экран генерации"). Only shows once the
 * registration wizard is done and only until dismissed once — both flags
 * are backend-persisted (onboarding_state), same as the wizard.
 */
export function HomeOnboardingTour() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const updateOnboarding = useUpdateOnboarding();
  const [step, setStep] = useState(0);

  if (!me || !me.onboarding.wizardCompleted || me.onboarding.homeTourCompleted) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    updateOnboarding.mutate({ homeTourCompleted: true });
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
