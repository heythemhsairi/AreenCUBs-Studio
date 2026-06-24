"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "areencubs.theme";

function getSystemIsDark(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const isDark = mode === "dark" || (mode === "system" && getSystemIsDark());
  document.documentElement.classList.toggle("light", !isDark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let saved: ThemeMode = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") saved = raw;
    } catch {}
    setMode(saved);
    applyTheme(saved);
    setMounted(true);

    // Watch system preference when in system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange() {
      const current = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
        } catch {
          return "system";
        }
      })() as ThemeMode;
      if (current === "system") applyTheme("system");
    }
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  function select(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  if (!mounted) {
    return (
      <div className={cn("flex h-7 w-[60px] rounded-md border border-[#22506F] bg-[#123A5A] animate-pulse", className)} />
    );
  }

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "Clair",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Sombre",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "Auto",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-[#22506F]/60 bg-[#0D2D47] p-0.5 gap-0.5",
        className,
      )}
      role="group"
      aria-label="Thème"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          aria-pressed={mode === opt.value}
          title={opt.label}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-all",
            mode === opt.value
              ? "bg-[#22B8D6] text-[#071B2C] shadow-sm"
              : "text-[#86A8C2] hover:text-[#F4FAFF]",
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
