import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore } from "@/features/auth/session";

/** Redirects to /auth/login when no access token is present (FR: session gating). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/** Redirects an already-authenticated user away from auth pages. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/generate" replace />;
  }
  return <>{children}</>;
}
