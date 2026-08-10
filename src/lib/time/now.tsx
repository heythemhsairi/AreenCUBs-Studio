"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Hydration-safe "now".
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * Calling `new Date()` during render makes the output depend on *when* and
 * *where* the render happened. The server renders in UTC on Vercel; the browser
 * hydrates in Africa/Tunis. A greeting derived from `getHours()`, or an overdue
 * count derived from `today`, therefore produces different text on each side and
 * React fails hydration with error #418 — reproduced in the browser on
 * /dashboard and /dashboard/team.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 * The server resolves the instant once and passes it down. Server render and the
 * FIRST client render both use that exact value, so the markup matches and
 * hydration succeeds. Only after mount does the clock start advancing, which is
 * a normal post-hydration state update rather than a mismatch.
 *
 * Behaviour is preserved: the Tunisian greeting and the overdue/priority
 * calculations still reflect Africa/Tunis, because the shared formatter pins
 * that timezone regardless of where the code runs.
 */

const NowContext = createContext<Date | null>(null);

export function NowProvider({
  serverNowIso,
  children,
  /** How often to advance the clock after mount. 60s is enough for
   *  minute-granularity relative times and day-boundary rollovers. */
  refreshMs = 60_000,
}: {
  serverNowIso: string;
  children: ReactNode;
  refreshMs?: number;
}) {
  // Initialised from the server value — identical on both sides of hydration.
  const [now, setNow] = useState<Date>(() => new Date(serverNowIso));

  useEffect(() => {
    // Adopt the real client clock only AFTER mount, then keep it fresh.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

/**
 * Current instant, safe to use during render.
 *
 * Falls back to `new Date()` when no provider is present so components remain
 * usable in isolation (tests, storybook-style rendering). Inside the dashboard
 * the provider is always mounted.
 */
export function useNow(): Date {
  const ctx = useContext(NowContext);
  return ctx ?? new Date();
}

/** Midnight of the current day, for date-only comparisons. */
export function useToday(): Date {
  const now = useNow();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
