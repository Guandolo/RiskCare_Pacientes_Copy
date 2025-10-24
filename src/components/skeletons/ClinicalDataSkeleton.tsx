import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ClinicalDataSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* Header section */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Card>
      
      {/* Data sections */}
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <div className="space-y-2 pl-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </Card>
      ))}
      
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
};
