"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-xs",
        className,
      )}
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            "rounded px-2.5 py-1 font-medium uppercase transition-colors",
            locale === l
              ? "bg-brand text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
