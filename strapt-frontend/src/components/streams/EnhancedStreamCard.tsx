import { memo } from 'react';
import { Play, Pause, StopCircle, Milestone, CircleDollarSign, Clock, CheckCircle, Calendar, User, ArrowUpRight, ArrowDownLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import InfoTooltip from '@/components/InfoTooltip';
import LiveStreamCounter from '@/components/LiveStreamCounter';
import { StreamStatus } from '@/hooks/use-payment-stream';
import { Milestone as MilestoneType } from '@/components/MilestoneInput';
// We'll implement date formatting without external dependencies

// UI Stream interface
export interface UIStream {
  id: string;
  recipient: string;
  sender: string;
  total: number;
  streamed: number;
  rate: string; // e.g. "0.1 USDC/min"
  status: 'active' | 'paused' | 'completed' | 'canceled';
  milestones?: MilestoneType[];
  token: string;
  startTime: number; // Unix timestamp in seconds
  endTime: number; // Unix timestamp in seconds
  isRecipient: boolean; // Whether the current user is the recipient
  isSender: boolean; // Whether the current user is the sender
  withdrawn?: number; // Amount already withdrawn from contract
}

interface EnhancedStreamCardProps {
  stream: UIStream;
  onPause?: (id: string) => Promise<void>;
  onResume?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onWithdraw?: (id: string) => Promise<void>;
  onReleaseMilestone?: (stream: UIStream, milestone: MilestoneType) => void;
  onStreamComplete?: (id: string) => void;
}

// Helper functions
const getStatusIcon = (status: 'active' | 'paused' | 'completed' | 'canceled', claimableAmount: number = 1) => {
  // For completed streams with no tokens left to claim, show a check mark
  if (status === 'completed' && claimableAmount <= 0) {
    return <CheckCircle className="h-5 w-5 text-white" />;
  }

  switch (status) {
    case 'active': return <Play className="h-5 w-5 text-white" />;
    case 'paused': return <Pause className="h-5 w-5 text-amber-500" />;
    case 'completed': return <CheckCircle className="h-5 w-5 text-white" />;
    case 'canceled': return <StopCircle className="h-5 w-5 text-red-500" />;
    default: return <Play className="h-5 w-5 text-white" />;
  }
};

const getStatusBadgeVariant = (status: 'active' | 'paused' | 'completed' | 'canceled') => {
  switch (status) {
    case 'active': return 'success'; // Changed from 'default' to 'success' for green color
    case 'paused': return 'warning';
    case 'completed': return 'secondary';
    case 'canceled': return 'destructive';
    default: return 'success';
  }
};

const getProgressColor = (status: 'active' | 'paused' | 'completed' | 'canceled', claimableAmount: number = 1) => {
  // For completed streams with no tokens left to claim, show a green progress bar
  if (status === 'completed' && claimableAmount <= 0) {
    return 'bg-green-500'; // Bright green for fully claimed
  }

  // Use more distinct colors for better visibility of streamed tokens
  switch (status) {
    case 'active':
      return 'bg-blue-500'; // Bright blue for active streams - more visible than purple
    case 'paused':
      return 'bg-orange-500'; // Orange for paused - more visible than amber
    case 'completed':
      return 'bg-green-500'; // Green for completed - success color
    case 'canceled':
      return 'bg-red-500'; // Red for canceled - error/stop color
    default:
      return 'bg-blue-500';
  }
};

const getMilestoneMarkers = (stream: UIStream) => {
  if (!stream.milestones || stream.milestones.length === 0) return null;

  return (
    <div className="relative h-1 mt-1">
      {stream.milestones.map((milestone) => (
        <div
          key={milestone.id}
          className="absolute top-0 w-1 h-3 bg-primary rounded"
          style={{ left: `${milestone.percentage}%`, transform: 'translateX(-50%)' }}
          title={`${milestone.description} (${milestone.percentage}%)`}
        />
      ))}
    </div>
  );
};

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format a timestamp to a human-readable date
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Calculate time remaining in a human-readable format
function getTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);

  if (now >= endTime) {
    return 'Completed';
  }

  const secondsRemaining = endTime - now;

  if (secondsRemaining < 60) {
    return 'in less than a minute';
  }

  if (secondsRemaining < 3600) {
    const minutes = Math.floor(secondsRemaining / 60);
    return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  if (secondsRemaining < 86400) {
    const hours = Math.floor(secondsRemaining / 3600);
    return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  }

  const days = Math.floor(secondsRemaining / 86400);
  return `in ${days} day${days > 1 ? 's' : ''}`;
}

const EnhancedStreamCard = memo(({
  stream,
  onPause,
  onResume,
  onCancel,
  onWithdraw,
  onReleaseMilestone,
  onStreamComplete
}: EnhancedStreamCardProps) => {
  const { toast } = useToast();
  const now = Math.floor(Date.now() / 1000);
  const isActive = stream.status === 'active';
  const isPaused = stream.status === 'paused';
  const isCompleted = stream.status === 'completed';
  const isCanceled = stream.status === 'canceled';
  const isFinished = isCompleted || isCanceled;

  // Calculate claimable amount (streamed - withdrawn)
  const claimableAmount = stream.streamed - (stream.withdrawn || 0);
  const canClaim = (stream.isRecipient && claimableAmount > 0 && !isFinished);

  const streamPercentage = (stream.streamed / stream.total) * 100;
  const isStreamEnded = now >= stream.endTime;
  const isStreamStarted = now >= stream.startTime;
  const timeRemaining = getTimeRemaining(stream.endTime);

  // Handle stream actions
  const handlePause = async () => {
    if (!onPause) return;
    try {
      await onPause(stream.id);
      toast({
        title: "Stream Paused",
        description: "The payment stream has been paused successfully.",
      });
    } catch (error) {
      console.error('Error pausing stream:', error);
      toast({
        title: "Error",
        description: "Failed to pause the stream. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResume = async () => {
    if (!onResume) return;
    try {
      await onResume(stream.id);
      toast({
        title: "Stream Resumed",
        description: "The payment stream has been resumed successfully.",
      });
    } catch (error) {
      console.error('Error resuming stream:', error);
      toast({
        title: "Error",
        description: "Failed to resume the stream. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    try {
      await onCancel(stream.id);
      toast({
        title: "Stream Canceled",
        description: "The payment stream has been canceled successfully.",
      });
    } catch (error) {
      console.error('Error canceling stream:', error);
      // Error handling is done in the hook, so we don't need to show another toast here
      // The hook will show appropriate error messages based on the specific error type
    }
  };

  const handleWithdraw = async () => {
    if (!onWithdraw) return;
    try {
      await onWithdraw(stream.id);
      // Success toast is handled in the hook, no need to show another one here
    } catch (error) {
      console.error('Error withdrawing from stream:', error);
      // Error toast is handled in the hook, no need to show another one here
    }
  };

  // Render milestone release buttons
  const renderMilestoneReleaseButtons = () => {
    if (!stream.milestones || stream.milestones.length === 0 || !stream.isSender) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Milestone Releases:</div>
        <div className="grid grid-cols-2 gap-2">
          {stream.milestones.map((milestone) => {
            const isReachable = streamPercentage >= milestone.percentage;
            return (
              <Button
                key={milestone.id}
                variant={milestone.released ? "ghost" : "outline"}
                size="sm"
                className={`h-auto py-1 text-xs ${milestone.released ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : ''}`}
                disabled={!isReachable || milestone.released || !onReleaseMilestone}
                onClick={() => onReleaseMilestone?.(stream, milestone)}
              >
                {milestone.released ? (
                  <CheckCircle className="h-3 w-3 mr-1 text-white" />
                ) : (
                  <CircleDollarSign className="h-3 w-3 mr-1" />
                )}
                {milestone.released ? (
                  <>Released {milestone.percentage}%</>
                ) : (
                  <>Release {milestone.percentage}%</>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant(stream.status)} className="capitalize">
                {getStatusIcon(stream.status, claimableAmount)}
                <span className="ml-1">
                  {stream.status === 'active' && 'Streaming'}
                  {stream.status === 'paused' && 'Paused'}
                  {stream.status === 'completed' && 'Completed'}
                  {stream.status === 'canceled' && 'Canceled'}
                </span>
              </Badge>

              {stream.isRecipient && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  <ArrowDownLeft className="h-3 w-3 mr-1" />
                  Receiving
                </Badge>
              )}

              {stream.isSender && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Sending
                </Badge>
              )}
            </div>

            <CardTitle className="text-base mt-2">
              {stream.isRecipient ? 'From: ' : 'To: '}
              {formatAddress(stream.isRecipient ? stream.sender : stream.recipient)}
            </CardTitle>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium">{stream.total} {stream.token}</div>
            <div className="text-xs text-muted-foreground">{stream.rate}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-4">
          {/* Stream Progress */}
          <div className="space-y-1">
            <LiveStreamCounter
              startTime={stream.startTime}
              endTime={stream.endTime}
              amount={stream.total.toString()}
              streamed={stream.streamed.toString()}
              status={StreamStatus[stream.status as keyof typeof StreamStatus]}
              token={stream.token}
              streamId={stream.id}
              onStreamComplete={onStreamComplete}
              withdrawn={stream.withdrawn?.toString() || '0'}
            />

            <div className="relative">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary/30">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(stream.status, claimableAmount)}`}
                  style={{ width: `${(stream.streamed / stream.total) * 100}%` }}
                />
              </div>
              {stream.milestones && stream.milestones.length > 0 && getMilestoneMarkers(stream)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center">
                <Calendar className="h-3 w-3 mr-1" /> Start Date
              </div>
              <div>{formatTimestamp(stream.startTime)}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center">
                <Calendar className="h-3 w-3 mr-1" /> End Date
              </div>
              <div>{formatTimestamp(stream.endTime)}</div>
            </div>
          </div>

          <div className="bg-secondary/30 p-2 rounded-md text-sm flex items-center">
            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>
              {isFinished
                ? 'Stream has ended'
                : isActive
                  ? `Ends ${timeRemaining}`
                  : isPaused
                    ? 'Stream is paused'
                    : 'Stream is inactive'}
            </span>
          </div>

          {/* Milestone Release Buttons */}
          {renderMilestoneReleaseButtons()}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        {/* Card Actions */}
        {stream.isSender && !isFinished && (
          <div className="space-y-2 w-full">
            {/* Primary Action */}
            {isActive ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative group">
                  <Button variant="outline" size="sm" onClick={handlePause} disabled={!onPause} className="w-full">
                    <Pause className="h-4 w-4 mr-1" /> Pause
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                    Temporarily stop the stream. Tokens will stop flowing to the recipient.
                  </div>
                </div>
                <div className="relative group">
                  <Button variant="destructive" size="sm" onClick={handleCancel} disabled={!onCancel} className="w-full">
                    <StopCircle className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                    Cancel the stream. Remaining tokens will be returned to you, and streamed tokens can be claimed by the recipient.
                  </div>
                </div>
              </div>
            ) : isPaused ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative group">
                  <Button variant="default" size="sm" onClick={handleResume} disabled={!onResume} className="w-full">
                    <Play className="h-4 w-4 mr-1" /> Resume
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                    Resume the stream. Tokens will continue flowing to the recipient.
                  </div>
                </div>
                <div className="relative group">
                  <Button variant="destructive" size="sm" onClick={handleCancel} disabled={!onCancel} className="w-full">
                    <StopCircle className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                    Cancel the stream. Remaining tokens will be returned to you, and streamed tokens can be claimed by the recipient.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Show info message when stream is complete but recipient hasn't claimed yet */}
        {stream.isSender && (isStreamEnded || streamPercentage >= 99.9) && claimableAmount > 0 && !isFinished && (
          <div className="w-full text-center text-sm text-primary bg-primary/10 p-2 rounded-md border border-primary/20">
            <Info className="h-4 w-4 inline-block mr-1" />
            Waiting for recipient to claim tokens
          </div>
        )}

        {stream.isRecipient && canClaim && (
          <div className="relative group w-full">
            <Button
              variant="default"
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleWithdraw}
              disabled={!onWithdraw || claimableAmount <= 0}
            >
              <CircleDollarSign className="h-4 w-4 mr-1" />
              Claim {claimableAmount.toFixed(stream.token === 'IDRX' ? 2 : 6)} {stream.token}
            </Button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
              Claim the tokens that have been streamed to you. You can claim at any time.
            </div>
          </div>
        )}

        {(isFinished || (isStreamEnded && claimableAmount <= 0)) && (
          <div className="w-full text-center text-sm text-green-600 dark:text-green-400 font-medium py-1">
            <CheckCircle className="h-4 w-4 inline-block mr-1 text-white" /> All tokens have been claimed
          </div>
        )}
      </CardFooter>
    </Card>
  );
});

EnhancedStreamCard.displayName = 'EnhancedStreamCard';

export default EnhancedStreamCard;
