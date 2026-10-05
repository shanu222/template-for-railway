const ACCESS_KEY = "saas_starter_access_token";
const REFRESH_KEY = "saas_starter_refresh_token";
const USER_KEY = "saas_starter_user";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export function saveSession(input: {
  accessToken: string;
  refreshToken?: string;
  user: StoredUser;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, input.accessToken);
  if (input.refreshToken) {
    localStorage.setItem(REFRESH_KEY, input.refreshToken);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
