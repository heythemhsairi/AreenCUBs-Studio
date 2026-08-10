/**
 * Shared display formatting — the single source of truth for dates, times and
 * money strings.
 *
 * ── Why locale AND timezone are always explicit ──────────────────────────────
 * `Date.prototype.toLocaleString(undefined, …)` resolves to the *runtime's*
 * locale and timezone. On Vercel the server runs Node in UTC with an en-US
 * default; the agency's browsers run fr-FR in Africa/Tunis (UTC+1). The two
 * therefore render different text for the same instant, and React fails
 * hydration with error #418.
 *
 * Every formatter below pins both values. Nothing in this file may ever call a
 * `toLocale*` method without an explicit locale and an explicit `timeZone`.
 *
 * Africa/Tunis observes no daylight saving (fixed UTC+1), so a fixed zone is
 * correct year-round for the agency's operating context.
 */

/** Business timezone. All dates are displayed as the agency experiences them. */
export const APP_TIME_ZONE = "Africa/Tunis";

/** Display locale. `fr-FR` is the business default. */
export const DEFAULT_DISPLAY_LOCALE = "fr-FR";

/** Locales the UI language toggle can produce. */
export type DisplayLocale = "fr-FR" | "en-GB";

/**
 * Maps the i18n toggle's short code onto a full BCP-47 display locale.
 *
 * `en-GB` rather than `en-US` on purpose: it keeps day/month/year ordering
 * consistent with the French interface, so switching language changes the
 * language of the month name without silently reordering the date and
 * turning 03/08 into 8 March.
 */
export function displayLocaleFor(locale: string | undefined | null): DisplayLocale {
  return locale === "en" ? "en-GB" : DEFAULT_DISPLAY_LOCALE;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Intl formatter construction is comparatively expensive and these run inside
 * table render loops, so instances are memoised by their option signature.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  locale: DisplayLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIME_ZONE });
    formatterCache.set(key, f);
  }
  return f;
}

function parse(iso: string | Date | null | undefined): Date | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Placeholder rendered for absent or unparseable values. */
export const EMPTY_DATE = "—";

/**
 * Date only — e.g. `10/08/2026`.
 * Deterministic across server and browser regardless of ambient timezone.
 */
export function formatDate(
  iso: string | Date | null | undefined,
  locale: DisplayLocale = DEFAULT_DISPLAY_LOCALE,
): string {
  const d = parse(iso);
  // Preserves the pre-existing contract: an unparseable non-empty string is
  // echoed back rather than replaced by a placeholder.
  if (!d) return typeof iso === "string" && iso !== "" ? iso : EMPTY_DATE;
  return getFormatter(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Date and time, medium form — e.g. `10 août 2026, 14:30`.
 * Replaces the `toLocaleString(undefined, …)` calls that caused hydration
 * error #418 on the Publishing page.
 */
export function formatDateTime(
  iso: string | Date | null | undefined,
  locale: DisplayLocale = DEFAULT_DISPLAY_LOCALE,
): string {
  const d = parse(iso);
  if (!d) return EMPTY_DATE;
  return getFormatter(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Date and time, compact form — e.g. `10/08/2026 14:30`. */
export function formatDateTimeShort(
  iso: string | Date | null | undefined,
  locale: DisplayLocale = DEFAULT_DISPLAY_LOCALE,
): string {
  const d = parse(iso);
  if (!d) return EMPTY_DATE;
  return getFormatter(locale, { dateStyle: "short", timeStyle: "short" }).format(d);
}

/**
 * Unambiguous month label for charts — e.g. `06/26`, `07/26`.
 *
 * Replaces `toLocaleDateString("fr-FR", { month: "short" })`, whose French
 * output (`juin`, `juil.`) collides at narrow widths where both truncate to
 * `jui` — audit finding #15.
 */
export function formatMonthLabel(year: number, monthIndex0: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  const yy = String(year % 100).padStart(2, "0");
  return `${mm}/${yy}`;
}

/**
 * Calendar day key (`YYYY-MM-DD`) for the given instant **in the business
 * timezone**, not in the runtime's zone.
 *
 * `toISOString().slice(0, 10)` is UTC-based and silently reports the previous
 * day for any local time between 00:00 and 01:00 in Africa/Tunis.
 */
export function toBusinessDateKey(iso: string | Date | null | undefined): string | null {
  const d = parse(iso);
  if (!d) return null;
  // en-CA yields ISO-ordered YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ── Non-date formatting (unchanged behaviour) ────────────────────────────────

export function formatDevisNumber(n: number, kind: "devis" | "facture" = "devis"): string {
  const prefix = kind === "facture" ? "FACT" : "EST";
  return `${prefix}-${String(n).padStart(7, "0")}`;
}

export function formatDt(value: number): string {
  // Normalize negative zero and suppress display of -0,00
  const n = Object.is(value, -0) ? 0 : value === 0 ? 0 : value;
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DT`;
}
