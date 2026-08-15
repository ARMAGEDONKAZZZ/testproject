import { create } from "zustand";
import { persist } from "zustand/middleware";
import { configureApiClient, api } from "@/api/client";

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  ageTier: "child" | "teen" | "adult" | null;
  setTokens: (accessToken: string, refreshToken: string, ageTier?: SessionState["ageTier"]) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      ageTier: null,
      setTokens: (accessToken, refreshToken, ageTier) =>
        set((s) => ({ accessToken, refreshToken, ageTier: ageTier ?? s.ageTier })),
      clear: () => set({ accessToken: null, refreshToken: null, ageTier: null }),
    }),
    { name: "neuratop-session" },
  ),
);

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Wires the API client to this store. Call once at app startup. */
export function initSessionWiring() {
  configureApiClient(
    () => useSessionStore.getState().accessToken,
    async () => {
      const refreshToken = useSessionStore.getState().refreshToken;
      if (!refreshToken) return false;
      try {
        const res = await api.post<RefreshResponse>("/auth/refresh", { refreshToken }, { skipAuth: true });
        useSessionStore.getState().setTokens(res.accessToken, res.refreshToken);
        return true;
      } catch {
        useSessionStore.getState().clear();
        return false;
      }
    },
  );
}

export function isAuthenticated(): boolean {
  return useSessionStore.getState().accessToken !== null;
}
