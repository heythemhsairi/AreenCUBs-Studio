"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { markUpdateSeenAction } from "@/lib/update-actions";
import type { AppUpdate } from "@/lib/updates";

export function WhatsNewBanner({ update }: { update: AppUpdate }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      await markUpdateSeenAction(update.id, null);
    });
  }

  function openModal() {
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    dismiss();
  }

  if (dismissed) return null;

  return (
    <>
      {/* Banner strip */}
      <div className="flex items-center gap-3 rounded-xl border border-brand/25 bg-brand/8 px-4 py-2.5">
        <span className="text-lg">🚀</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">
            Nouveautés — v{update.version}
          </p>
          <p className="truncate text-[11px] text-ink/55">
            {update.summary ?? update.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openModal}
            className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Voir les nouveautés
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="rounded-md p-1 text-ink/40 transition-colors hover:bg-white/50 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* What's New modal */}
      {open && (
        <WhatsNewModal update={update} onClose={closeModal} />
      )}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-ink/10 shadow-lift">
        {/* Header */}
        <div className="border-b border-ink/8 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h2 className="text-base font-bold text-ink">{update.title}</h2>
              </div>
              <p className="mt-0.5 text-xs text-ink/45">
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
              className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-white/50 hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5" style={{ maxHeight: "calc(85vh - 140px)" }}>
          {/* Global items */}
          {globalItems.length > 0 && (
            <div className="space-y-3">
              {globalItems.map((item) => (
                <UpdateItem key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Section-specific items */}
          {Object.entries(sectionGroups).map(([section, items]) => (
            <div key={section}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink/40">
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
        <div className="border-t border-ink/8 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
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
    <div className="flex gap-3 rounded-xl border border-ink/8 bg-white/40 p-3">
      <span className="mt-0.5 text-base leading-none">✦</span>
      <div>
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        <p className="mt-0.5 text-xs text-ink/60">{item.body}</p>
        {item.role && (
          <span
            className={cn(
              "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
              item.role === "admin"
                ? "bg-brand/10 text-brand-dark"
                : item.role === "worker"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-ink/8 text-ink/55",
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
