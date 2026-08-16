import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSessionStore } from "@/features/auth/session";

export interface ParentLink {
  guardianName: string;
  guardianEmail: string;
  verifiedAt: string | null;
}

export interface SkillProfile {
  tactics: number;
  strategy: number;
  openings: number;
  endgames: number;
  calculation: number;
  overall: number;
  focusAxes: string[];
}

export interface BoardPreferences {
  theme: string;
  pieceSet: string;
  showCoordinates: boolean;
  animationSpeedPct: number;
}

export interface OnboardingState {
  role: "student" | "teacher" | null;
  declaredLevel: "beginner" | "intermediate" | "advanced" | "expert" | null;
  wizardCompleted: boolean;
  homeTourCompleted: boolean;
  puzzleTourCompleted: boolean;
}

export interface Me {
  id: string;
  nickname: string;
  email?: string;
  age: number;
  ageTier: "child" | "teen" | "adult";
  avatarUrl?: string;
  parentLink?: ParentLink;
  skillProfile: SkillProfile;
  boardPreferences: BoardPreferences;
  onboarding: OnboardingState;
}

// Wire shape of GET /me per contracts/rest-api.md: the user's own fields are
// nested under "user", alongside separate "skillProfile"/"boardPreferences"/
// "onboarding"/optional "parentLink" keys — not the flat object the rest of
// the frontend consumes as `Me`. useMe() flattens it once here.
interface MeResponse {
  user: Omit<Me, "skillProfile" | "boardPreferences" | "parentLink" | "onboarding">;
  parentLink?: ParentLink;
  skillProfile: SkillProfile;
  boardPreferences: BoardPreferences;
  onboarding: OnboardingState;
}

export function useMe() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get<MeResponse>("/me");
      const flattened: Me = {
        ...res.user,
        parentLink: res.parentLink,
        skillProfile: res.skillProfile,
        boardPreferences: res.boardPreferences,
        onboarding: res.onboarding,
      };
      return flattened;
    },
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; age?: number; avatarUrl?: string }) =>
      api.patch<{ user: Me }>("/me", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword?: string; newPassword: string }) =>
      api.post<Record<string, never>>("/me/password", input),
  });
}

export function useDeleteAccount() {
  return useMutation({
    // DELETE /me requires a JSON body ({ confirm: true }) per
    // contracts/rest-api.md — a bare DELETE with no body was rejected by the
    // backend with a generic 400 before ever reaching the adult-only check
    // (caught via direct API testing since drag-based UI testing wasn't
    // available for the puzzle board in this environment).
    mutationFn: () => api.delete<Record<string, never>>("/me", { confirm: true }),
  });
}

export function useUpdateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      role?: "student" | "teacher";
      declaredLevel?: "beginner" | "intermediate" | "advanced" | "expert";
      wizardCompleted?: boolean;
      homeTourCompleted?: boolean;
      puzzleTourCompleted?: boolean;
    }) => api.patch<{ onboarding: OnboardingState }>("/me/onboarding", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSetFocusAxes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (axes: string[]) => api.patch<{ skillProfile: SkillProfile }>("/me/skills/focus", { axes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export interface NextTopic {
  axis: string;
  tag: string;
  label: string;
}

export interface TrainingSummary {
  sessionsCount: number;
  streakDays: number;
  accuracyPercent: number;
  rating: number;
  ratingDelta: number;
  nextTopic?: NextTopic;
}

interface TrainingSummaryResponse {
  trainingSummary: TrainingSummary;
}

export function useTrainingSummary() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["training-summary"],
    queryFn: async () => (await api.get<TrainingSummaryResponse>("/me/training/summary")).trainingSummary,
    enabled: !!accessToken,
  });
}

export function useSetBoardPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: BoardPreferences) => api.put<{ boardPreferences: BoardPreferences }>("/me/board-preferences", prefs),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
}
