"use client";

import { useState, useEffect, useRef, useTransition, useId } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { markUpdateSeenAction } from "@/lib/update-actions";
import type { AppUpdate } from "@/lib/updates";

/**
 * The release announcement.
 *
 * ── Why this is no longer a banner ───────────────────────────────────────────
 *
 * It used to render inside the content column, in the layout, immediately
 * BEFORE `{children}`. Every route therefore opened with a product
 * announcement rather than with its own identity: the screenshot matrix caught
 * the same full-width strip sitting above the page title on all twenty-five
 * admin routes, pushing "Clients", "Finance OS" and "Journal d'audit" below the
 * fold-line of attention.
 *
 * A changelog is the least urgent thing on an operations screen. It is not
 * about the route, it does not change what the operator is doing, and it is
 * read once. That is a top-bar affordance, next to notifications — which is
 * also where a user already looks for "something new happened".
 *
 * The interaction is unchanged: the same modal, the same per-version
 * localStorage dismissal, the same `markUpdateSeenAction` server call. What
 * changed is that it no longer costs every page its first impression.
 */

function localStorageKey(version: string) {
  return `whats-new-dismissed-${version}`;
}

export function WhatsNewButton({ update }: { update: AppUpdate }) {
  // null = unknown (pre-mount), true = dismissed, false = unseen.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(localStorageKey(update.version)) === "true");
    } catch {
      setDismissed(false);
    }
  }, [update.version]);

  function dismiss() {
    try {
      localStorage.setItem(localStorageKey(update.version), "true");
    } catch {
      /* private mode; the server call below still records it */
    }
    setDismissed(true);
    startTransition(async () => {
      await markUpdateSeenAction(update.id, null);
    });
  }

  // Once dismissed the entry point goes away entirely, matching the previous
  // behaviour. Nothing is rendered before localStorage has been read, so the
  // indicator never flashes for someone who already dismissed it.
  if (dismissed === null || dismissed === true) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Nouveautés — version ${update.version}`}
        className="relative inline-flex h-9 min-h-[44px] w-9 min-w-[44px] items-center justify-center rounded-lg text-content-3 transition-colors duration-2 ease-ac hover:bg-surface-2 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:h-9 sm:w-9"
      >
        <Sparkles size={17} />
        {/*
          The unseen marker. `aria-hidden` because the button's own label
          already says what this is — announcing "new" twice is noise on a
          screen reader, and the dot carries no information the label lacks.
        */}
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent2 ring-2 ring-surface"
        />
      </button>

      {open && (
        <WhatsNewModal
          update={update}
          onClose={() => {
            setOpen(false);
            dismiss();
          }}
        />
      )}
    </>
  );
}

function WhatsNewModal({ update, onClose }: { update: AppUpdate; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  /**
   * Dialog behaviour the previous version did not have at all: it was a plain
   * `<div>` overlay with no role, no Escape key, and no focus management, so a
   * keyboard user opened it and had to tab through the entire page behind it.
   */
  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus?.();
    };
  }, [onClose]);

  const globalItems = update.items.filter((i) => !i.section);
  const sectionItems = update.items.filter((i) => i.section);
  const sectionGroups = sectionItems.reduce<Record<string, typeof sectionItems>>((acc, item) => {
    (acc[item.section!] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-3">
              Version {update.version}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-content">
              {update.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-content-3 transition-colors duration-2 ease-ac hover:bg-surface-2 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6" style={{ maxHeight: "calc(85vh - 152px)" }}>
          {globalItems.length > 0 && (
            <div className="space-y-2">
              {globalItems.map((item) => (
                <UpdateItem key={item.id} item={item} />
              ))}
            </div>
          )}

          {Object.entries(sectionGroups).map(([section, items]) => (
            <div key={section}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-content-3">
                {SECTION_LABELS[section] ?? section}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <UpdateItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-accent2 text-sm font-semibold text-accent2-fg transition-colors duration-2 ease-ac hover:bg-accent2-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Compris, merci
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateItem({ item }: { item: { title: string; body: string; role: string | null } }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <Sparkles size={14} className="mt-0.5 shrink-0 text-accent2" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-content">{item.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-content-2">{item.body}</p>
        {item.role && (
          <span
            className={cn(
              "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
              item.role === "admin"
                ? "bg-accent2-weak text-accent2"
                : item.role === "worker"
                  ? "bg-success-weak text-success"
                  : "bg-surface-3 text-content-2",
            )}
          >
            {ROLE_LABELS[item.role] ?? item.role}
          </span>
        )}
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  tasks: "Tâches",
  finance: "Finances",
  team: "Équipe",
  planning: "Planning",
  projects: "Projets",
  clients: "Clients",
  devis: "Devis",
  factures: "Factures",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  worker: "Équipe",
  freelancer: "Freelancer",
};
