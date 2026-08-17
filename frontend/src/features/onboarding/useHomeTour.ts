import { useState } from "react";
import { useMe, useUpdateOnboarding } from "@/features/profile/hooks";

/**
 * Home-tour step state, owned here instead of inside HomeOnboardingTour, so
 * GeneratePage can highlight the exact element each step refers to (the
 * generation input on step 2, the recommended-puzzle cards on step 3) —
 * per figma/онбординг.svg, the tour is meant to point at real UI, not just
 * float text near it.
 */
export function useHomeTour() {
  const { data: me } = useMe();
  const updateOnboarding = useUpdateOnboarding();
  const [step, setStep] = useState(0);

  const active = !!me && me.onboarding.wizardCompleted && !me.onboarding.homeTourCompleted;

  return {
    active,
    step,
    next: () => setStep((s) => s + 1),
    finish: () => updateOnboarding.mutate({ homeTourCompleted: true }),
  };
}
