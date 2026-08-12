import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A section heading for the operational surfaces.
 *
 * The dashboards previously marked their sections with a styled `<p>`:
 *
 *   const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-widest…"
 *
 * which looks like a heading and is not one. A screen-reader user navigating by
 * heading skipped straight from the page title to whatever `<h3>` happened to
 * sit inside a card, so a dashboard of eight sections announced as one
 * undifferentiated block — and 10px uppercase is below the size at which
 * letter-spaced small caps stay comfortably readable.
 *
 * This is an `<h2>`, sized to sit clearly beneath the page title and clearly
 * above card titles, with an optional trailing slot for a count or a link so
 * the row does not need a second flex wrapper at every call site.
 */
export function SectionHeading({
  children,
  action,
  className,
  id,
}: {
  children: ReactNode;
  /** Right-aligned slot: a count, a filter, a "see all" link. */
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <h2
        id={id}
        className="text-[13px] font-semibold uppercase tracking-[0.09em] text-content-2"
      >
        {children}
      </h2>
      {action && <div className="shrink-0 text-xs text-content-3">{action}</div>}
    </div>
  );
}
