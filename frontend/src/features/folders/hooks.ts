import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { PuzzleView } from "@/features/generation/hooks";

export interface Folder {
  id: string;
  name: string;
  visibility: "private" | "public";
  itemCount: number;
}

export function useHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["history", page, pageSize],
    queryFn: () => api.get<PuzzleView[]>(`/history?page=${page}&pageSize=${pageSize}`),
  });
}

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: () => api.get<{ private: Folder[]; public: Folder[] }>("/folders"),
  });
}

export function useFolderItems(folderId: string | undefined) {
  return useQuery({
    queryKey: ["folder-items", folderId],
    queryFn: () => api.get<PuzzleView[]>(`/folders/${folderId}/items`),
    enabled: !!folderId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    // Wire shape is { folder: {...} } per contracts/rest-api.md.
    mutationFn: async (visibility: "private" | "public") =>
      (await api.post<{ folder: Folder }>("/folders", { visibility })).folder,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, visibility }: { id: string; name?: string; visibility?: string }) =>
      (await api.patch<{ folder: Folder }>(`/folders/${id}`, { name, visibility })).folder,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/folders/${id}?confirm=true`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useAddToFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, puzzleIds }: { folderId: string; puzzleIds: string[] }) =>
      api.post(`/folders/${folderId}/items`, { puzzleIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["folder-items"] }),
  });
}

export function useShareFolder() {
  return useMutation({
    mutationFn: ({ folderId, password }: { folderId: string; password?: string }) =>
      api.post<{ shareUrl: string; slug: string }>(`/folders/${folderId}/share`, { password }),
  });
}

export function useFavorites(tag?: string, sideToMove?: string) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (sideToMove) params.set("sideToMove", sideToMove);
  return useQuery({
    queryKey: ["favorites", tag, sideToMove],
    queryFn: () => api.get<PuzzleView[]>(`/favorites?${params.toString()}`),
  });
}

export function useSharedFolder(slug: string | undefined, password?: string) {
  return useQuery({
    queryKey: ["shared-folder", slug, password],
    // Public endpoint (no authMiddleware, see routes.go) — the password
    // gate is a custom header, not a query param or body, per
    // contracts/rest-api.md ("header X-Share-Password?").
    queryFn: () =>
      api.get<{ folder: Folder; items: PuzzleView[] }>(`/share/${slug}`, {
        skipAuth: true,
        headers: password ? { "X-Share-Password": password } : undefined,
      }),
    enabled: !!slug,
    retry: false,
  });
}

/**
 * Guest move check for the public single-puzzle web view (figma/"Задача
 * веб вью по ссылке.svg"): validates a move against the real solution
 * server-side (POST /share/:slug/puzzles/:puzzleId/check-move) without ever
 * sending the solution to the client — but, unlike the authenticated
 * attempts/moves pipeline, nothing is persisted for a guest, so the caller
 * tracks its own position in the solution line and passes it as moveIndex.
 * opponentMove is set (non-empty) when the move was correct but not the
 * final ply — the caller auto-plays it and advances moveIndex by 2.
 */
export function useCheckGuestMove(slug: string | undefined, password?: string) {
  return useMutation({
    mutationFn: ({ puzzleId, move, moveIndex }: { puzzleId: string; move: string; moveIndex: number }) =>
      api.post<{ correct: boolean; opponentMove?: string }>(
        `/share/${slug}/puzzles/${puzzleId}/check-move`,
        { move, moveIndex },
        { skipAuth: true, headers: password ? { "X-Share-Password": password } : undefined },
      ),
  });
}
