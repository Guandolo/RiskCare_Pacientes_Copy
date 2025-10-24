import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const MainPanelsSkeleton = () => {
  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel Skeleton */}
      <div className="w-80 border-r border-border p-4 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        
        <Card className="p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </Card>
        
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Center Panel Skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        
        <div className="flex-1 p-4 space-y-4">
          {/* Chat messages skeleton */}
          <div className="flex justify-start">
            <Card className="p-3 max-w-[80%]">
              <Skeleton className="h-4 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </Card>
          </div>
          <div className="flex justify-end">
            <Card className="p-3 max-w-[80%]">
              <Skeleton className="h-4 w-56" />
            </Card>
          </div>
        </div>
        
        <div className="border-t border-border p-4">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
      
      {/* Right Panel Skeleton */}
      <div className="w-80 border-l border-border p-4 space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3 space-y-2">
              <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
