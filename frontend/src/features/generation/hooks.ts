import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";

export interface PuzzleView {
  id: string;
  fen: string;
  sideToMove: "white" | "black";
  objective: string;
  tag: string;
  description: string;
  difficulty: number;
  createdAt: string;
}

export interface Generation {
  id: string;
  status: "pending" | "succeeded" | "failed";
  inputMode: "text" | "tag" | "image" | "fen_pgn";
  errorMessage?: string;
  puzzles: PuzzleView[];
}

export function useCreateGeneration() {
  return useMutation({
    mutationFn: (input: { inputMode: Generation["inputMode"]; payload: string; count: number }) =>
      api.post<{ generationId: string; status: string }>("/generations", input),
  });
}

// The backend's GET /generations/:id nests the generation row and its
// puzzles separately (see specs/001-neuratop-mvp/contracts/rest-api.md) —
// this is the raw wire shape; useGeneration below flattens it into the
// `Generation` type the rest of the frontend uses.
interface GenerationDetailResponse {
  generation: {
    id: string;
    status: "pending" | "succeeded" | "failed";
    inputMode: Generation["inputMode"];
    errorMessage?: string;
  };
  puzzles: PuzzleView[];
}

/** Polls GET /generations/:id every 1s until status leaves "pending". */
export function useGeneration(generationId: string | null) {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!generationId) return;
    setGeneration(null);

    const poll = async () => {
      const res = await api.get<GenerationDetailResponse>(`/generations/${generationId}`);
      const flattened: Generation = {
        id: res.generation.id,
        status: res.generation.status,
        inputMode: res.generation.inputMode,
        errorMessage: res.generation.errorMessage,
        puzzles: res.puzzles,
      };
      setGeneration(flattened);
      if (flattened.status !== "pending" && timer.current) {
        clearInterval(timer.current);
      }
    };

    void poll();
    timer.current = setInterval(() => void poll(), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [generationId]);

  return generation;
}

export function useCancelGeneration() {
  return useMutation({
    mutationFn: (generationId: string) => api.post(`/generations/${generationId}/cancel`),
  });
}

// Shape of a row in the GET /generations list — distinct from `Generation`
// above (the flattened detail view with `puzzles`): the list endpoint never
// nests puzzles, see internal/generation/handlers_extra.go ListGenerations.
export interface GenerationSummary {
  id: string;
  inputMode: Generation["inputMode"];
  inputPayload: string;
  requestedCount: number;
  status: Generation["status"];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export function useGenerationHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["generations", page, pageSize],
    queryFn: () => api.get<GenerationSummary[]>(`/generations?page=${page}&pageSize=${pageSize}`),
  });
}

export function useRegeneratePuzzle() {
  return useMutation({
    mutationFn: (puzzleId: string) =>
      api.post<{ generationId: string }>(`/puzzles/${puzzleId}/regenerate`),
  });
}

export function useGenerateFromFEN() {
  return useMutation({
    mutationFn: (input: { fen: string; count: number }) =>
      api.post<{ generationId: string }>("/generations/fen", input),
  });
}

export function usePuzzleChat(puzzleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      api.post<{ reply: string }>(`/puzzles/${puzzleId}/chat`, { message }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["puzzle-chat", puzzleId] });
    },
  });
}
