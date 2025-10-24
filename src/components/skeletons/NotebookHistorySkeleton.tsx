import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const NotebookHistorySkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="p-3 border-border/50">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
