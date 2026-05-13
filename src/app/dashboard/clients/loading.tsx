import {
  PageHeaderSkeleton,
  CardSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <CardSkeleton rows={6} />
    </div>
  );
}
