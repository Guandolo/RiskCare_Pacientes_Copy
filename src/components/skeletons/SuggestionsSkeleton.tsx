import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const SuggestionsSkeleton = () => {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="flex-shrink-0 w-[200px] px-2.5 py-1.5 bg-muted/30">
          <Skeleton className="h-6 w-full" />
        </Card>
      ))}
    </>
  );
};
