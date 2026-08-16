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
 *
 * `children` is withheld until the first /me fetch resolves — otherwise the
 * page underneath is fully interactive for however long that request takes
 * (visible on a real network, not just localhost), and the wizard pops in
 * late over whatever the user already started doing instead of appearing
 * immediately, blocking everything, right after registration. `isLoading`
 * (TanStack Query v5) is true only for that first fetch — once `me` is
 * cached, navigating between pages never shows this again.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-text-secondary">Загрузка…</div>;
  }

  return (
    <>
      {children}
      {me && !me.onboarding.wizardCompleted && <OnboardingWizard />}
    </>
  );
}
