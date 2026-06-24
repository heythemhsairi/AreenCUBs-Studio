import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Base dark-themed skeleton block.
 * Background: #18212F with animate-pulse.
 * Apply width/height via className.
 * Compose into route-level loading.tsx files.
 */
export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-[#18212F]",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * N lines of text-shaped skeletons.
 * Last line is shorter to mimic natural paragraph endings.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4 w-full",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full",
          )}
          style={
            i === lines - 1 && lines > 1 ? { width: "75%" } : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * Card-shaped skeleton with a header area and body lines.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[#18212F] p-5 space-y-4",
        className,
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Card body lines */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      {/* Card footer */}
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Row of KPI card skeletons, defaulting to 4 cards.
 */
export function SkeletonKpi({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        count === 1 && "grid-cols-1",
        count === 2 && "grid-cols-1 sm:grid-cols-2",
        count === 3 && "grid-cols-1 sm:grid-cols-3",
        count >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[#18212F] p-5 space-y-3"
        >
          {/* Label */}
          <Skeleton className="h-3 w-24" />
          {/* Big number */}
          <Skeleton className="h-8 w-32" />
          {/* Trend badge */}
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table skeleton with configurable rows and columns.
 * Renders a header row + body rows.
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-2xl bg-[#18212F] overflow-hidden">
      {/* Header row */}
      <div
        className="grid gap-3 px-5 py-3 border-b border-[#263244]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 w-3/4" />
        ))}
      </div>
      {/* Body rows */}
      <div className="divide-y divide-[#263244]">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 px-5 py-3 animate-pulse"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4", c === 0 ? "w-full" : "w-2/3")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Title + description block, matches the PageHeader visual rhythm so the
 * skeleton-to-content transition doesn't jolt.
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-[#263244] pb-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/**
 * Card-shell skeleton with optional rows. Used by table-heavy pages.
 * Kept for backward compatibility.
 */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-[#18212F] space-y-3 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Kanban column shell (4 columns x 2 cards).
 * Kept for backward compatibility.
 */
export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, c) => (
        <div key={c} className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 2 }).map((_, r) => (
            <Skeleton key={r} className="h-24 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
