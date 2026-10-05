"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  getStatus,
  logout,
  type PublicUser,
  type StatusPayload,
} from "@/lib/api";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
} from "@/lib/auth-storage";

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "up" || normalized === "ok"
      ? "badge badge-up"
      : normalized === "skipped"
        ? "badge badge-skipped"
        : "badge badge-down";

  return <span className={className}>{status}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = getAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const stored = getStoredUser();
        if (stored) {
          setUser(stored);
        }

        const me = await getMe(token);
        setUser(me.user);

        const connectionStatus = await getStatus(token);
        setStatus(connectionStatus);
      } catch (err) {
        clearSession();
        setError(err instanceof Error ? err.message : "Session expired");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  async function onLogout() {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    try {
      await logout(accessToken, refreshToken);
    } finally {
      clearSession();
      router.push("/");
    }
  }

  if (loading) {
    return (
      <main className="shell dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Loading your session...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Authenticated starter overview for your full-stack template.</p>
        </div>
        <div className="nav-actions">
          <Link className="btn btn-ghost" href="/">
            Home
          </Link>
          <button className="btn btn-primary" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      {error && <div className="panel error">{error}</div>}

      <div className="grid">
        <section className="panel span-7">
          <h2>Authenticated user</h2>
          {user ? (
            <ul className="meta-list">
              <li>
                <span>Name</span>
                <strong>{user.name}</strong>
              </li>
              <li>
                <span>Email</span>
                <strong>{user.email}</strong>
              </li>
              <li>
                <span>User ID</span>
                <strong>{user.id}</strong>
              </li>
              <li>
                <span>Created</span>
                <strong>{new Date(user.createdAt).toLocaleString()}</strong>
              </li>
            </ul>
          ) : (
            <p>No user loaded.</p>
          )}
        </section>

        <section className="panel span-5">
          <h2>Connection status</h2>
          <div className="status-list">
            <div className="status-item">
              <span>API</span>
              <StatusBadge status={status?.api.status || "unknown"} />
            </div>
            <div className="status-item">
              <span>Database</span>
              <StatusBadge status={status?.database.status || "unknown"} />
            </div>
            <div className="status-item">
              <span>Redis</span>
              <StatusBadge status={status?.redis.status || "unknown"} />
            </div>
          </div>
          {status?.database.latencyMs != null && (
            <p style={{ marginTop: "1rem", color: "var(--ink-soft)" }}>
              Database latency: {status.database.latencyMs}ms
              {status.redis.latencyMs != null
                ? ` · Redis latency: ${status.redis.latencyMs}ms`
                : ""}
            </p>
          )}
        </section>

        <section className="panel span-12">
          <h2>What to build next</h2>
          <p style={{ margin: 0, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            This template is intentionally generic. Replace the dashboard with
            your product UI, extend the Prisma schema, and add domain routes to
            the Express API. Keep Railway reference variables for PostgreSQL and
            Redis so services stay portable across environments.
          </p>
        </section>
      </div>
    </main>
  );
}
