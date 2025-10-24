import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const PatientProfileSkeleton = () => {
  return (
    <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/50">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        
        {/* Info fields */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
