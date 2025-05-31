import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const StreamCardSkeleton = () => {
  return (
    <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="animate-pulse">
                <Skeleton className="h-4 w-4 mr-1" />
                <Skeleton className="h-4 w-16" />
              </Badge>
              <Badge variant="outline" className="animate-pulse">
                <Skeleton className="h-3 w-3 mr-1" />
                <Skeleton className="h-4 w-20" />
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <Skeleton className="h-6 w-24 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stream Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between text-xs">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* Stream Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        {/* Time Information */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex justify-between items-center text-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Milestones (optional) */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </CardFooter>
    </Card>
  );
};

const StreamListSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="space-y-4">
      {Array(count).fill(0).map((_, index) => (
        <StreamCardSkeleton key={index} />
      ))}
    </div>
  );
};

export { StreamCardSkeleton, StreamListSkeleton };
export default StreamCardSkeleton;
