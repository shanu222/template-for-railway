const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthPayload = {
  user: PublicUser;
  accessToken: string;
  expiresIn: string;
  refreshToken?: string;
};

export type StatusPayload = {
  api: { status: string };
  database: { status: string; latencyMs?: number };
  redis: { configured: boolean; status: string; latencyMs?: number };
  timestamp: string;
};

export type DiagnosticsPayload = {
  status: string;
  timestamp: string;
  checks: {
    api: { status: string };
    database: { status: string; latencyMs?: number };
    redis: { status: string; latencyMs?: number; message?: string };
  };
};

type ApiError = {
  error?: {
    message?: string;
  };
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export function getApiBaseUrl(): string {
  return API_URL.replace(/\/$/, "");
}

export async function apiHealth(): Promise<{ status: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/health`, {
    cache: "no-store",
  });
  return parseJson(response);
}

export async function apiDiagnostics(): Promise<DiagnosticsPayload> {
  const response = await fetch(`${getApiBaseUrl()}/api/health/diagnostics`, {
    cache: "no-store",
  });
  return parseJson(response);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function getMe(accessToken: string): Promise<{ user: PublicUser }> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseJson(response);
}

export async function logout(
  accessToken?: string | null,
  refreshToken?: string | null,
): Promise<void> {
  await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
}

export async function getStatus(accessToken: string): Promise<StatusPayload> {
  const response = await fetch(`${getApiBaseUrl()}/api/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseJson(response);
}
