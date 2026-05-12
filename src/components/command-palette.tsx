"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { searchAction, type SearchHit } from "@/app/dashboard/search-actions";

const kindIcon: Record<SearchHit["kind"], string> = {
  client: "👥",
  project: "📁",
  devis: "📄",
  facture: "🧾",
  task: "✅",
  member: "🧑",
};

const kindLabel: Record<SearchHit["kind"], string> = {
  client: "Client",
  project: "Projet",
  devis: "Devis",
  facture: "Facture",
  task: "Tâche",
  member: "Membre",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      } else if (open && !inField && e.key === "/" && document.activeElement !== inputRef.current) {
        // also "/" to open when nothing is focused
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(query);
        if (res.ok) {
          setHits(res.hits);
          setActiveIdx(0);
        }
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [query, open]);

  function pick(hit: SearchHit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && hits[activeIdx]) {
      e.preventDefault();
      pick(hits[activeIdx]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/40 px-4 pt-20 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink/95">
        <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3 dark:border-white/10">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink/40 dark:text-cream/40"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Rechercher un client, projet, tâche, devis, membre…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none dark:text-cream dark:placeholder:text-cream/40"
            autoFocus
          />
          <kbd className="hidden rounded border border-ink/15 bg-cream-dark/50 px-1.5 py-0.5 text-[10px] font-semibold text-ink/55 sm:inline dark:border-white/15 dark:bg-ink/40 dark:text-cream/55">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {pending && hits.length === 0 && query.length >= 2 && (
            <p className="px-4 py-8 text-center text-sm text-ink/45">
              Recherche…
            </p>
          )}
          {!pending && query.length >= 2 && hits.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink/45">
              Aucun résultat pour « {query} »
            </p>
          )}
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-xs text-ink/45">
              Tapez au moins 2 lettres.
              <div className="mt-3 flex justify-center gap-1.5">
                <Tip k="↑↓" v="naviguer" />
                <Tip k="↵" v="ouvrir" />
                <Tip k="Esc" v="fermer" />
              </div>
            </div>
          )}
          <ul>
            {hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === activeIdx
                      ? "bg-brand/10"
                      : "hover:bg-cream-dark/40 dark:hover:bg-white/5",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-base dark:bg-white/5">
                    {kindIcon[hit.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink dark:text-cream">
                      {hit.label}
                    </p>
                    {hit.sublabel && (
                      <p className="truncate text-xs text-ink/50 dark:text-cream/50">
                        {hit.sublabel}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/55 dark:bg-white/10 dark:text-cream/60">
                    {kindLabel[hit.kind]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Tip({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink/45">
      <kbd className="rounded border border-ink/15 bg-cream-dark/50 px-1.5 py-0.5 text-[10px] font-semibold text-ink/55">
        {k}
      </kbd>
      {v}
    </span>
  );
}
