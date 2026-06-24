"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import { markUpdateSeenAction } from "@/lib/update-actions";
import type { AppUpdate } from "@/lib/updates";

function localStorageKey(version: string) {
  return `whats-new-dismissed-${version}`;
}

export function WhatsNewBanner({ update }: { update: AppUpdate }) {
  // null = unknown (pre-mount), true = dismissed, false = visible
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  // On mount, check localStorage before rendering anything
  useEffect(() => {
    try {
      const stored = localStorage.getItem(localStorageKey(update.version));
      setDismissed(stored === "true");
    } catch {
      setDismissed(false);
    }
  }, [update.version]);

  function dismiss() {
    try {
      localStorage.setItem(localStorageKey(update.version), "true");
    } catch {}
    setDismissed(true);
    startTransition(async () => {
      await markUpdateSeenAction(update.id, null);
    });
  }

  function closeModal() {
    setOpen(false);
    dismiss();
  }

  // Don't render until we've checked localStorage (avoids flash)
  if (dismissed === null || dismissed === true) return null;

  return (
    <>
      {/* Banner */}
      <div className="relative flex items-center gap-3 rounded-xl border border-[#22D3EE]/20 bg-[#123A5A] px-4 py-3 border-l-4 border-l-[#22D3EE]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#22D3EE]">
            Nouveautés disponibles — v{update.version}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
            {update.summary ?? update.title}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 text-xs text-[#22D3EE] underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          Voir les détails
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 rounded-md p-1 text-[#64748B] transition-colors hover:text-[#F8FAFC]"
        >
          <svg
            width="14"
            height="14"
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

      {open && <WhatsNewModal update={update} onClose={closeModal} />}
    </>
  );
}

function WhatsNewModal({
  update,
  onClose,
}: {
  update: AppUpdate;
  onClose: () => void;
}) {
  const globalItems = update.items.filter((i) => !i.section);
  const sectionItems = update.items.filter((i) => i.section);
  const sectionGroups = sectionItems.reduce<Record<string, typeof sectionItems>>(
    (acc, item) => {
      const key = item.section!;
      (acc[key] ??= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-[#0D2D47] border border-[#22506F] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="border-b border-[#22506F] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h2 className="text-base font-bold text-[#F8FAFC]">{update.title}</h2>
              </div>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Version {update.version} ·{" "}
                {new Date(update.released_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-white/5 hover:text-[#F8FAFC]"
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
        </div>

        {/* Body */}
        <div
          className="space-y-5 overflow-y-auto p-6"
          style={{ maxHeight: "calc(85vh - 140px)" }}
        >
          {globalItems.length > 0 && (
            <div className="space-y-3">
              {globalItems.map((item) => (
                <UpdateItem key={item.id} item={item} />
              ))}
            </div>
          )}

          {Object.entries(sectionGroups).map(([section, items]) => (
            <div key={section}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                {SECTION_LABELS[section] ?? section}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <UpdateItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#22506F] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#22D3EE] py-2.5 text-sm font-semibold text-[#071B2C] transition-colors hover:bg-[#06B6D4]"
          >
            Compris, merci !
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateItem({
  item,
}: {
  item: { title: string; body: string; role: string | null };
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#22506F] bg-[#123A5A] p-3">
      <span className="mt-0.5 text-base leading-none text-[#22D3EE]">✦</span>
      <div>
        <p className="text-sm font-semibold text-[#F8FAFC]">{item.title}</p>
        <p className="mt-0.5 text-xs text-[#94A3B8]">{item.body}</p>
        {item.role && (
          <span
            className={cn(
              "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
              item.role === "admin"
                ? "bg-[#22D3EE]/10 text-[#22D3EE]"
                : item.role === "worker"
                  ? "bg-[#22C55E]/10 text-[#22C55E]"
                  : "bg-white/5 text-[#94A3B8]",
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
