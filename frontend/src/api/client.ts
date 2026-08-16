/**
 * Typed API client wrapping fetch: parses the shared {data}/{error} envelope
 * (see specs/001-neuratop-mvp/contracts/rest-api.md), injects the Bearer
 * access token, and transparently retries once via /auth/refresh on a 401.
 */

const API_BASE = "/api/v1";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.code = body.error.code;
    this.status = status;
    this.details = body.error.details;
  }
}

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<boolean>;

let getAccessToken: TokenGetter = () => null;
let refreshTokens: TokenRefresher = async () => false;

/** Wires the client to the auth session store. Called once from AuthProvider. */
export function configureApiClient(getToken: TokenGetter, refresher: TokenRefresher) {
  getAccessToken = getToken;
  refreshTokens = refresher;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

async function rawRequest<T>(path: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  const token = getAccessToken();
  if (token && !opts.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, json as ApiErrorBody);
  }
  return (json as { data: T }).data;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts.skipAuth) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return rawRequest<T>(path, opts);
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => apiRequest<T>(path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  delete: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "DELETE", body }),
};
