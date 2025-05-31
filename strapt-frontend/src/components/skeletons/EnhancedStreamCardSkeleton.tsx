import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EnhancedStreamCardSkeleton = () => {
  return (
    <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {/* Status Badge */}
              <Badge variant="outline" className="animate-pulse">
                <Skeleton className="h-5 w-5 mr-1" />
                <Skeleton className="h-4 w-16" />
              </Badge>
              
              {/* Role Badge */}
              <Badge variant="outline" className="animate-pulse">
                <Skeleton className="h-3 w-3 mr-1" />
                <Skeleton className="h-4 w-20" />
              </Badge>
            </div>
          </div>
          
          {/* Amount and Token */}
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-4 w-16 mt-1" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recipient/Sender Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>

        {/* Live Stream Counter */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-1">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex justify-between text-xs">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* Stream Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        {/* Time Information */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Milestones Section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        {/* Action Buttons */}
        <div className="space-y-2 w-full">
          {/* Primary Action */}
          <Skeleton className="h-10 w-full" />
          
          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

const EnhancedStreamListSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array(count).fill(0).map((_, index) => (
        <EnhancedStreamCardSkeleton key={index} />
      ))}
    </div>
  );
};

export { EnhancedStreamCardSkeleton, EnhancedStreamListSkeleton };
export default EnhancedStreamCardSkeleton;
