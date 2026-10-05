export type ApiInfo = {
  name: string;
  version: string;
  description: string;
  docs: string;
};

export type HealthStatus = {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
};

export type ServiceCheck = {
  status: "up" | "down" | "skipped";
  latencyMs?: number;
  message?: string;
};

export type DiagnosticsResponse = {
  status: "ok" | "degraded";
  timestamp: string;
  checks: {
    api: ServiceCheck;
    database: ServiceCheck;
    redis: ServiceCheck;
  };
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  expiresIn: string;
};

export type ApiErrorBody = {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(normalizeEmail(email));
}
