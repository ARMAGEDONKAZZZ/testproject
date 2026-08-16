import type { ReactNode } from "react";
import { useMe } from "@/features/profile/hooks";
import { OnboardingWizard } from "./OnboardingWizard";

/**
 * Renders the post-registration wizard as an overlay on top of whatever
 * page is mounted underneath (per figma/онбординг.svg: the wizard sits over
 * a dimmed Home screen) the first time a user is authenticated and hasn't
 * completed it yet. Once `wizardCompleted` flips true server-side, this
 * renders nothing — the flag lives in onboarding_state (backend-persisted),
 * so it stays completed across logout/device changes, not just this tab.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: me } = useMe();

  return (
    <>
      {children}
      {me && !me.onboarding.wizardCompleted && <OnboardingWizard />}
    </>
  );
}
