import { Skeleton } from "@/components/ui/skeleton";

interface GeneralLoadingSkeletonProps {
  rows?: number;
  variant?: 'list' | 'grid' | 'form';
}

export const GeneralLoadingSkeleton = ({ rows = 3, variant = 'list' }: GeneralLoadingSkeletonProps) => {
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2 p-4 border border-border rounded-lg">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  
  if (variant === 'form') {
    return (
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};
