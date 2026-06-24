"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { searchAction, type SearchHit } from "@/app/dashboard/search-actions";

type IconKey = SearchHit["kind"];

function KindIcon({ kind }: { kind: IconKey }) {
  const paths: Record<IconKey, React.ReactNode> = {
    client: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      </>
    ),
    project: (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    ),
    devis: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 2v6h6" />
      </>
    ),
    facture: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 2v6h6" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    task: <path d="M3 6h2l1 2h13M3 12h18M3 18h18" />,
    member: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </>
    ),
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind]}
    </svg>
  );
}

export function CommandPalette() {
  const { t, locale } = useI18n();
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
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[#071B2C]/60 px-4 pt-20 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#22506F] bg-[#0D2D47] shadow-lift backdrop-blur">
        <div className="flex items-center gap-3 border-b border-[#22506F] px-4 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#86A8C2]"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t.common.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-[#F4FAFF] placeholder:text-[#86A8C2] focus:outline-none"
            autoFocus
          />
          <kbd className="hidden rounded border border-[#22506F] bg-[#071B2C] px-1.5 py-0.5 text-[10px] font-semibold text-[#86A8C2] sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {pending && hits.length === 0 && query.length >= 2 && (
            <p className="px-4 py-8 text-center text-sm text-[#86A8C2]">
              {t.commandPalette.searching}
            </p>
          )}
          {!pending && query.length >= 2 && hits.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[#86A8C2]">
              {t.commandPalette.noResults(query)}
            </p>
          )}
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-xs text-[#86A8C2]">
              {t.commandPalette.minChars}
              <div className="mt-3 flex justify-center gap-1.5">
                <Tip k="↑↓" v={t.commandPalette.navigate} />
                <Tip k="↵" v={t.commandPalette.open} />
                <Tip k="Esc" v={t.commandPalette.close} />
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
                      ? "bg-[#22D3EE]/10"
                      : "hover:bg-[#1A3E5C]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#22D3EE]/15 text-[#22D3EE]">
                    <KindIcon kind={hit.kind} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F4FAFF]">
                      {hit.label}
                    </p>
                    {hit.sublabel && (
                      <p className="truncate text-xs text-[#86A8C2]">
                        {hit.sublabel}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-[#22506F]/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#B8D0E4]">
                    {kindLabel(hit.kind, locale)}
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

function kindLabel(kind: SearchHit["kind"], locale: "fr" | "en"): string {
  const labels: Record<SearchHit["kind"], { fr: string; en: string }> = {
    client: { fr: "Client", en: "Client" },
    project: { fr: "Projet", en: "Project" },
    devis: { fr: "Devis", en: "Quote" },
    facture: { fr: "Facture", en: "Invoice" },
    task: { fr: "Tâche", en: "Task" },
    member: { fr: "Membre", en: "Member" },
  };
  return labels[kind][locale];
}

function Tip({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[#86A8C2]">
      <kbd className="rounded border border-[#22506F] bg-[#071B2C] px-1.5 py-0.5 text-[10px] font-semibold text-[#B8D0E4]">
        {k}
      </kbd>
      {v}
    </span>
  );
}
