"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-ink/10 bg-white p-0.5 text-xs",
        className,
      )}
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            "rounded-full px-2.5 py-1 font-semibold uppercase transition-colors",
            locale === l
              ? "bg-brand text-white shadow-sm"
              : "text-ink/50 hover:bg-cream-dark",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
