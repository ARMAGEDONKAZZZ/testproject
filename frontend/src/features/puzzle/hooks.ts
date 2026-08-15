import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { PuzzleView } from "@/features/generation/hooks";

export function usePuzzle(puzzleId: string) {
  return useQuery({
    queryKey: ["puzzle", puzzleId],
    // Wire shape is { puzzle: {...} } per contracts/rest-api.md; unwrap to
    // the flat PuzzleView the rest of the frontend uses.
    queryFn: async () => (await api.get<{ puzzle: PuzzleView }>(`/puzzles/${puzzleId}`)).puzzle,
    enabled: !!puzzleId,
  });
}

export function useStartAttempt(puzzleId: string) {
  return useMutation({
    mutationFn: () => api.post<{ attemptId: string }>(`/puzzles/${puzzleId}/attempts`),
  });
}

export function useSubmitMove(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (move: string) =>
      api.post<{ correct: boolean; outcome: string }>(`/attempts/${attemptId}/moves`, { move }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attempt", attemptId] });
    },
  });
}

export function useSimplify(attemptId: string) {
  return useMutation({
    mutationFn: () => api.post<{ puzzle: PuzzleView }>(`/attempts/${attemptId}/simplify`),
  });
}

export function useRequestHint(attemptId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ hint: string; hintsRemaining: number }>(`/attempts/${attemptId}/hints`),
  });
}

export function useRevealSolution(attemptId: string) {
  return useMutation({
    mutationFn: () => api.post<{ solutionLine: string[] }>(`/attempts/${attemptId}/reveal-solution`),
  });
}

export function useAnalysis(attemptId: string | null) {
  return useQuery({
    queryKey: ["analysis", attemptId],
    queryFn: () =>
      api.get<{ evaluation: string; bestMove: string; depth: number }>(
        `/attempts/${attemptId}/analysis`,
      ),
    enabled: !!attemptId,
  });
}

export function useToggleFavorite(puzzleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (add: boolean) => (add ? api.post(`/puzzles/${puzzleId}/favorite`) : api.delete(`/puzzles/${puzzleId}/favorite`)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}

export function exportPuzzleUrl(puzzleId: string, format: "pgn" | "fen" | "image") {
  return `/api/v1/puzzles/${puzzleId}/export?format=${format}`;
}
