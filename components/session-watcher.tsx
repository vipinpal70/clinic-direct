"use client";

import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // keep the 15-min access token alive well before it expires

async function hardLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // best-effort — clear client state regardless of network failure
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "/login";
}

/**
 * Mounted once in the admin layout. Proactively refreshes the access token
 * every 5 minutes so an active user is never bounced mid-session, and
 * enforces the 8h absolute session cap client-side: once past it (or if the
 * server rejects the refresh — revoked/expired session), it logs out, wipes
 * localStorage/sessionStorage, and redirects to /login.
 */
export function SessionWatcher() {
  const expiresAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        if (!cancelled) await hardLogout();
        return;
      }
      const body = await res.json();
      expiresAtRef.current = body.data?.sessionExpiresAt ?? null;
    }

    async function tick() {
      if (cancelled) return;

      if (expiresAtRef.current && Date.now() >= expiresAtRef.current) {
        await hardLogout();
        return;
      }

      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) {
        if (!cancelled) await hardLogout();
        return;
      }
      const body = await res.json();
      expiresAtRef.current = body.data?.sessionExpiresAt ?? expiresAtRef.current;
    }

    hydrate();
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
