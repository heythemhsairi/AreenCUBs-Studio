"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";

type ToastItem = { id: number; tone: Tone; message: string };

type ToastCtx = {
  push: (tone: Tone, message: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: Tone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Bridge so any code can call `toast.success(...)` without a hook
  useEffect(() => {
    toastBridge = { push };
    return () => {
      toastBridge = null;
    };
  }, [push]);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastBubble
            key={t.id}
            item={t}
            onDismiss={() =>
              setItems((prev) => prev.filter((x) => x.id !== t.id))
            }
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const toneClass =
    item.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : item.tone === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-ink/10 bg-white text-ink";

  const icon =
    item.tone === "success"
      ? "✓"
      : item.tone === "error"
        ? "!"
        : "ℹ";

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-white/95 px-4 py-3 text-sm shadow-lift backdrop-blur",
        "animate-[toast-in_240ms_cubic-bezier(0.2,0.65,0.25,1)_both]",
        toneClass,
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-bold">
        {icon}
      </span>
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-current/40 hover:text-current"
        aria-label="Fermer"
      >
        ×
      </button>
      <style jsx>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// Imperative bridge — any module can call `toast.success(...)` without a hook.
let toastBridge: { push: (tone: Tone, message: string) => void } | null = null;

export const toast = {
  success(message: string) {
    toastBridge?.push("success", message);
  },
  error(message: string) {
    toastBridge?.push("error", message);
  },
  info(message: string) {
    toastBridge?.push("info", message);
  },
};

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
