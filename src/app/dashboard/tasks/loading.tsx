import {
  PageHeaderSkeleton,
  KanbanSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <KanbanSkeleton />
    </div>
  );
}
