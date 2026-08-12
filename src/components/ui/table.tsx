import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    /*
     * A border OR a shadow, not both — the hard-coded rgba shadow that used to
     * sit alongside this border was the "ghost card" pairing, and it was
     * black-on-black in the dark theme anyway.
     *
     * overflow-x-auto stays as the LAST RESORT for a table that genuinely
     * cannot fit. It is not the mobile strategy: routes pair `hidden md:block`
     * on the table with a card list below the breakpoint, so a phone gets
     * readable stacked records instead of a sideways scroll.
     */
    <div className="w-full overflow-x-auto rounded-xl border border-line bg-surface">
      <table className={cn("w-full text-sm", className)} {...rest} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="border-b border-line bg-surface-2 text-content-2 [&_th]:sticky [&_th]:top-0"
      {...props}
    />
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-line" {...props} />;
}

export function TR(props: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className="transition-colors duration-1 ease-ac hover:bg-hover"
      {...props}
    />
  );
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-content-2 first:pl-4 last:pr-4",
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
        // Denser rows and tabular figures: in an operational table the
        // digits are the content, and proportional numerals make a column of
        // amounts impossible to scan.
        "px-3 py-2.5 text-content first:pl-4 last:pr-4 [&_.num]:tabular-nums",
        className,
      )}
      {...rest}
    />
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-content-3">
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
      <p className="text-sm text-content-3">{children}</p>
    </div>
  );
}
