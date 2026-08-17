import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthenticated } from "@/app/routeGuards";
import { Layout } from "@/components/Layout";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";

const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));

const GeneratePage = lazy(() => import("@/pages/generate/GeneratePage"));
const GenerationsPage = lazy(() => import("@/pages/generate/GenerationsPage"));
const PuzzlePage = lazy(() => import("@/pages/puzzle/PuzzlePage"));
const SelfEducationPage = lazy(() => import("@/pages/self-education/SelfEducationPage"));
const SelfEducationHistoryPage = lazy(() => import("@/pages/self-education/SelfEducationHistoryPage"));
const HistoryPage = lazy(() => import("@/pages/history/HistoryPage"));
const FoldersPage = lazy(() => import("@/pages/folders/FoldersPage"));
const FavoritesPage = lazy(() => import("@/pages/favorites/FavoritesPage"));
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage"));
const BoardDesignPage = lazy(() => import("@/pages/profile/BoardDesignPage"));
const SharedFolderPage = lazy(() => import("@/pages/share/SharedFolderPage"));
const SharedPuzzlePage = lazy(() => import("@/pages/share/SharedPuzzlePage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-text-secondary">
      Загрузка…
    </div>
  );
}

function Authenticated({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>
        <OnboardingGate>{children}</OnboardingGate>
      </Layout>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/generate" replace />} />

        {/* Public auth routes */}
        {/*
          RegisterPage is NOT wrapped in RedirectIfAuthenticated: the
          registration flow itself sets an access token after the OTP/
          password step (VerifyRegistration) so the subsequent nickname-
          finalization call can be authenticated, while the user is still on
          this page choosing a nickname. Guarding on "authenticated" would
          bounce them to /generate mid-flow before they ever see that step
          (caught via end-to-end testing) — RegisterPage manages its own
          navigation once nickname selection actually completes.
        */}
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route
          path="/auth/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/auth/forgot-password"
          element={
            <RedirectIfAuthenticated>
              <ForgotPasswordPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* Public share view */}
        <Route path="/share/:slug" element={<SharedFolderPage />} />
        <Route path="/share/:slug/:puzzleId" element={<SharedPuzzlePage />} />

        {/* Authenticated app */}
        <Route path="/generate" element={<Authenticated><GeneratePage /></Authenticated>} />
        <Route path="/generations" element={<Authenticated><GenerationsPage /></Authenticated>} />
        <Route path="/puzzle/:puzzleId" element={<Authenticated><PuzzlePage /></Authenticated>} />
        <Route path="/self-education" element={<Authenticated><SelfEducationPage /></Authenticated>} />
        <Route path="/self-education/history" element={<Authenticated><SelfEducationHistoryPage /></Authenticated>} />
        <Route path="/history" element={<Authenticated><HistoryPage /></Authenticated>} />
        <Route path="/folders" element={<Authenticated><FoldersPage /></Authenticated>} />
        <Route path="/folders/:folderId" element={<Authenticated><FoldersPage /></Authenticated>} />
        <Route path="/favorites" element={<Authenticated><FavoritesPage /></Authenticated>} />
        <Route path="/profile" element={<Authenticated><ProfilePage /></Authenticated>} />
        <Route path="/profile/board-design" element={<Authenticated><BoardDesignPage /></Authenticated>} />

        <Route path="*" element={<Navigate to="/generate" replace />} />
      </Routes>
    </Suspense>
  );
}
