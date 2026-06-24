import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[#263244] bg-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <table className={cn("w-full text-sm", className)} {...rest} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="border-b border-[#263244] bg-[#18212F] text-[#94A3B8]"
      {...props}
    />
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-[#1E2A3A]" {...props} />;
}

export function TR(props: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className="transition-colors duration-150 hover:bg-[#1E2A3A]"
      {...props}
    />
  );
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8] first:pl-4 last:pr-4",
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
        "px-3 py-3.5 text-[#F8FAFC] first:pl-4 last:pr-4",
        className,
      )}
      {...rest}
    />
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#263244] bg-[#111827]/50 px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#18212F] text-[#64748B]">
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
      <p className="text-sm text-[#64748B]">{children}</p>
    </div>
  );
}
