import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Shown while the server component in `page.tsx` awaits the portal views.
 * Mirrors the real shell's proportions (sidebar rail + header + stat row) so
 * the swap to real content doesn't jolt the layout.
 */
export default function PortalLoading() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <div className="mb-5 flex h-9 items-center px-1">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="mb-5 flex items-center gap-2.5 px-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 md:py-9">
          <div className="space-y-4 border-b border-line pb-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
