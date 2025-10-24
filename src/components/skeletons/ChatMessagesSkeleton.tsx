import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ChatMessagesSkeleton = () => {
  return (
    <div className="space-y-4 p-4">
      {/* User message */}
      <div className="flex justify-end">
        <Card className="p-3 max-w-[80%] bg-primary/10">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </Card>
      </div>
      
      {/* Assistant message */}
      <div className="flex justify-start">
        <Card className="p-3 max-w-[80%] bg-muted/30">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </div>
      
      {/* User message */}
      <div className="flex justify-end">
        <Card className="p-3 max-w-[80%] bg-primary/10">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    </div>
  );
};
