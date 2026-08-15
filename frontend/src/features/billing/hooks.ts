import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSessionStore } from "@/features/auth/session";

export interface HintPackage {
  id: string;
  label: string;
  hintCount: number | null;
  priceCredits: number;
  isFeatured: boolean;
}

export function useCreditBalance() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["credits"],
    queryFn: () => api.get<{ balance: number }>("/me/credits"),
    enabled: !!accessToken,
  });
}

export function useHintPackages() {
  return useQuery({
    queryKey: ["hint-packages"],
    queryFn: () => api.get<HintPackage[]>("/hint-packages"),
  });
}

export function usePurchaseHintPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, attemptId }: { packageId: string; attemptId: string }) =>
      api.post<{ balance: number; hintsRemaining: number | null }>(
        `/hint-packages/${packageId}/purchase`,
        { attemptId },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
