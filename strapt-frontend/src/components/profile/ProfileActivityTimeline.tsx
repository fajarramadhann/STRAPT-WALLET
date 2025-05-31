
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Check, Clock, X, ArrowUpRight, Download, ShieldCheck, Users, BarChart2, Gift, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileActivity } from '@/hooks/use-profile-activity';
import type { ProfileActivity } from '@/hooks/use-profile-activity';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

type Activity = ProfileActivity;

const ProfileActivityTimeline = () => {
  const { activities, isLoading } = useProfileActivity();
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [displayedActivities, setDisplayedActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Apply filter when activities change or filter changes
  useEffect(() => {
    if (!activities) {
      setFilteredActivities([]);
      return;
    }

    if (!filter) {
      setFilteredActivities(activities);
      return;
    }

    let filtered: ProfileActivity[];
    if (filter === 'received') {
      // Filter for received activities (claims, received transfers, etc.)
      filtered = activities.filter(activity =>
        activity.type === 'claim' ||
        activity.title.toLowerCase().includes('received') ||
        activity.title.toLowerCase().includes('claimed')
      );
    } else {
      filtered = activities.filter(activity => activity.type === filter);
    }
    setFilteredActivities(filtered);
  }, [activities, filter]);

  // Apply pagination when filtered activities change
  useEffect(() => {
    const totalItems = filteredActivities.length;
    const displayedItems = currentPage * ITEMS_PER_PAGE;
    const displayed = filteredActivities.slice(0, displayedItems);
    setDisplayedActivities(displayed);
  }, [filteredActivities, currentPage]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Calculate if there are more items to load
  const hasMore = displayedActivities.length < filteredActivities.length;

  // Load more function
  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  const getStatusIcon = (status: string, type: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'active':
        return <BarChart2 className="h-5 w-5 text-blue-500" />;
      case 'failed':
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return <ArrowUpRight className="h-5 w-5" />;
      case 'claim':
        return <ShieldCheck className="h-5 w-5" />;
      case 'received':
        return <ArrowDownLeft className="h-5 w-5" />;
      case 'pool':
        return <Users className="h-5 w-5" />;
      case 'stream':
        return <BarChart2 className="h-5 w-5" />;
      case 'drop':
        return <Gift className="h-5 w-5" />;
      default:
        return <Download className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-amber-500';
      case 'active':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="bg-black rounded-t-none border-t-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Recent Activity</CardTitle>
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              !filter ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('transfer')}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              filter === 'transfer' ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            Transfers
          </button>
          <button
            type="button"
            onClick={() => setFilter('stream')}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              filter === 'stream' ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            Streams
          </button>
          <button
            type="button"
            onClick={() => setFilter('claim')}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              filter === 'claim' ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            Claims
          </button>
          <button
            type="button"
            onClick={() => setFilter('drop')}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              filter === 'drop' ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            Drops
          </button>
          <button
            type="button"
            onClick={() => setFilter('received')}
            className={cn(
              "text-xs px-3 py-1 rounded-full whitespace-nowrap",
              filter === 'received' ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            )}
          >
            Received
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            // Show skeletons while loading
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}-${Date.now()}`} className="flex items-start gap-3 py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-2" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : displayedActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent activity to display</p>
          ) : (
            <>
              {displayedActivities.map((activity, index) => (
                <div key={`${activity.type}-${activity.id}-${activity.timestamp}`}>
                  <div className="flex items-start gap-3 py-2">
                    <div className={cn(
                      "rounded-full p-2",
                      "bg-muted flex items-center justify-center"
                    )}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">{activity.amount}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <div className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              getStatusColor(activity.status)
                            )} />
                            <span className="text-sm font-medium">
                              {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < displayedActivities.length - 1 && <Separator />}
                </div>
              ))}
              {hasMore && (
                <div className="pt-4 border-t border-border mt-4">
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Load More"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileActivityTimeline;
