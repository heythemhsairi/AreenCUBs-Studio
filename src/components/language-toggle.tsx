"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-white/8 p-0.5 text-xs backdrop-blur-sm",
        className,
      )}
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            "rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider transition-all duration-200",
            locale === l
              ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-brand-glow"
              : "text-ink/55 hover:bg-white/12 hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
