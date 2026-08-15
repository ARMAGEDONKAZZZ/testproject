import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSessionStore } from "@/features/auth/session";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function useRegisterStart() {
  return useMutation({
    mutationFn: (input: {
      age: number;
      email?: string;
      parent?: { name: string; email: string };
    }) => api.post<{ registrationId: string; ageTier: string }>("/auth/register/start", input, { skipAuth: true }),
  });
}

export function useRegisterCode() {
  return useMutation({
    mutationFn: (registrationId: string) =>
      api.post<Record<string, never>>("/auth/register/code", { registrationId }, { skipAuth: true }),
  });
}

export function useRegisterVerify() {
  const setTokens = useSessionStore((s) => s.setTokens);
  return useMutation({
    // No password field: for an adult account, the verified code doubles
    // as the account password (set server-side) — see
    // internal/auth/service.go VerifyRegistration.
    mutationFn: (input: { registrationId: string; code: string }) =>
      api.post<{ userId: string; nickname: string } & TokenPair>("/auth/register/verify", input, {
        skipAuth: true,
      }),
    // A token pair is issued here already (account exists, nickname is still
    // a placeholder) so the subsequent nickname-finalization call — an
    // authenticated endpoint — has something to authenticate with.
    onSuccess: (data) => setTokens(data.accessToken, data.refreshToken),
  });
}

export function useRegisterNickname() {
  const setTokens = useSessionStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (nickname: string) => api.post<TokenPair>("/auth/register/nickname", { nickname }),
    onSuccess: (data) => setTokens(data.accessToken, data.refreshToken),
  });
}

export function useLogin() {
  const setTokens = useSessionStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<TokenPair>("/auth/login", input, { skipAuth: true }),
    onSuccess: (data) => setTokens(data.accessToken, data.refreshToken),
  });
}

export function usePasswordResetStart() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<Record<string, never>>("/auth/password-reset/start", { email }, { skipAuth: true }),
  });
}

export function usePasswordResetComplete() {
  return useMutation({
    mutationFn: (input: { email: string; code: string; newPassword: string }) =>
      api.post<Record<string, never>>("/auth/password-reset/complete", input, { skipAuth: true }),
  });
}
