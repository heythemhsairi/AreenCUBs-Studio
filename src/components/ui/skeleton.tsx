import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Pulsing placeholder. Apply width/height via className. Compose into
 * route-level loading.tsx files (Next.js renders these while the server
 * page is awaiting data).
 */
export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-ink/8 dark:bg-white/8",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Title + description block, matches the PageHeader visual rhythm so the
 * skeleton-to-content transition doesn't jolt.
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-ink/8 pb-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/**
 * Card-shell skeleton with optional rows. Used by table-heavy pages.
 */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass space-y-3 rounded-2xl p-5">
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
 * Kanban column shell (4 columns × 2 cards).
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
