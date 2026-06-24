import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <table className={cn("w-full text-sm", className)} {...rest} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="border-b border-[var(--c-border)] bg-[var(--c-elevated)] text-[var(--c-text-2)]"
      {...props}
    />
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-[var(--c-border)]" {...props} />;
}

export function TR(props: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className="transition-colors duration-150 hover:bg-[var(--c-elevated)]"
      {...props}
    />
  );
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-2)] first:pl-4 last:pr-4",
        className,
      )}
      {...rest}
    />
  );
}

export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-3 py-3.5 text-[var(--c-text-1)] first:pl-4 last:pr-4",
        className,
      )}
      {...rest}
    />
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-card)]/50 px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-elevated)] text-[var(--c-text-3)]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6m0 4h.01" />
        </svg>
      </div>
      <p className="text-sm text-[var(--c-text-3)]">{children}</p>
    </div>
  );
}
