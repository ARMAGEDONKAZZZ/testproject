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

/**
 * opponentMove is set (non-empty) whenever the move was correct but not the
 * last ply of a multi-move solution — solution_line can now be a full
 * sequence (solver move, forced opponent reply, solver move, ...), not just
 * one move, since puzzles can come from the external puzzle API. The caller
 * is responsible for auto-playing it and then unlocking the board again.
 */
export function useSubmitMove(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (move: string) =>
      api.post<{ correct: boolean; outcome: string; opponentMove?: string }>(
        `/attempts/${attemptId}/moves`,
        { move },
      ),
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
