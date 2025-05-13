import { memo } from 'react';
import { Play, Pause, StopCircle, Milestone, CircleDollarSign, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import InfoTooltip from '@/components/InfoTooltip';
import LiveStreamCounter from '@/components/LiveStreamCounter';
import { StreamStatus } from '@/hooks/use-payment-stream';
import { Milestone as MilestoneType } from '@/components/MilestoneInput';

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
}

interface StreamCardProps {
  stream: UIStream;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onWithdraw: (id: string) => Promise<void>;
  onReleaseMilestone: (stream: UIStream, milestone: MilestoneType) => void;
  onStreamComplete: (id: string) => void;
  formatAddress: (address: string) => string;
}

// Helper functions
const getStatusIcon = (status: 'active' | 'paused' | 'completed' | 'canceled') => {
  switch (status) {
    case 'active': return <Play className="h-4 w-4 text-green-500" />;
    case 'paused': return <Pause className="h-4 w-4 text-amber-500" />;
    case 'completed': return <StopCircle className="h-4 w-4 text-blue-500" />;
    case 'canceled': return <StopCircle className="h-4 w-4 text-red-500" />;
    default: return <Play className="h-4 w-4 text-green-500" />;
  }
};

const getProgressColor = (status: 'active' | 'paused' | 'completed' | 'canceled') => {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'paused': return 'bg-amber-500';
    case 'completed': return 'bg-blue-500';
    case 'canceled': return 'bg-red-500';
    default: return 'bg-green-500';
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

const StreamCard = memo(({
  stream,
  onPause,
  onResume,
  onCancel,
  onWithdraw,
  onReleaseMilestone,
  onStreamComplete,
  formatAddress
}: StreamCardProps) => {
  const { toast } = useToast();

  const renderMilestoneReleaseButtons = () => {
    if (!stream.milestones || stream.milestones.length === 0) return null;

    const streamPercentage = (stream.streamed / stream.total) * 100;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Milestone Releases:</div>
        <div className="grid grid-cols-2 gap-2">
          {stream.milestones.map((milestone) => {
            const isReachable = streamPercentage >= milestone.percentage;
            return (
              <Button
                key={milestone.id}
                variant="outline"
                size="sm"
                className="h-auto py-1 text-xs"
                disabled={!isReachable || milestone.released}
                onClick={() => onReleaseMilestone(stream, milestone)}
              >
                <CircleDollarSign className="h-3 w-3 mr-1" />
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
    <Card key={stream.id}>
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <CardTitle className="text-base">{formatAddress(stream.recipient)}</CardTitle>
          <div className="flex items-center gap-1 text-sm relative group">
            {getStatusIcon(stream.status)}
            <span className="capitalize">{stream.status}</span>
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
              {stream.status === 'active' && "Tokens are actively streaming to the recipient."}
              {stream.status === 'paused' && "Stream is temporarily paused. No tokens are being streamed."}
              {stream.status === 'completed' && "Stream has completed. All tokens have been streamed."}
              {stream.status === 'canceled' && "Stream was canceled. Remaining tokens returned to sender."}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="relative group">
            <LiveStreamCounter
              startTime={stream.startTime}
              endTime={stream.endTime}
              amount={stream.total.toString()}
              streamed={stream.streamed.toString()}
              status={StreamStatus[stream.status as keyof typeof StreamStatus]}
              token={stream.token}
              streamId={stream.id}
              onStreamComplete={onStreamComplete}
            />
            <div className="absolute top-0 right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <InfoTooltip
                content={
                  <div>
                    <p className="font-medium mb-1">Stream Progress</p>
                    <p className="mb-1">This shows how many tokens have been streamed so far.</p>
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      <li>For active streams, this updates every 5 seconds</li>
                      <li>When a stream reaches 100%, it automatically completes</li>
                      <li>Recipients can claim tokens at any time</li>
                      <li>After claiming, the stream starts from 0 again</li>
                    </ul>
                  </div>
                }
                side="left"
              />
            </div>
            <Progress
              value={(stream.streamed / stream.total) * 100}
              className={getProgressColor(stream.status)}
            />
            {stream.milestones && stream.milestones.length > 0 && getMilestoneMarkers(stream)}
          </div>
          <div className="flex justify-between text-sm relative group">
            <span className="text-muted-foreground flex items-center gap-1">
              Rate
              <InfoTooltip
                content="The rate at which tokens are streamed to the recipient over time."
                iconSize={12}
              />
            </span>
            <span>{stream.rate}</span>
          </div>

          {stream.milestones && stream.milestones.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground relative group">
              <Milestone className="h-3 w-3" />
              <span>{stream.milestones.length} milestone{stream.milestones.length !== 1 ? 's' : ''}</span>
              <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                <p className="font-medium mb-1">Milestones</p>
                <p className="mb-2">This stream has {stream.milestones.length} milestone{stream.milestones.length !== 1 ? 's' : ''} that can be released by the sender:</p>
                <ul className="space-y-1">
                  {stream.milestones.map((milestone) => (
                    <li key={milestone.id} className="flex justify-between">
                      <span>{milestone.description}</span>
                      <span className="font-medium">{milestone.percentage}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {stream.milestones && stream.milestones.length > 0 && renderMilestoneReleaseButtons()}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        {stream.isSender ? (
          // Sender controls
          <div className="grid grid-cols-2 gap-2 w-full">
            {stream.status === 'active' ? (
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await onPause(stream.id);
                    } catch (error) {
                      console.error('Error pausing stream:', error);
                      toast({
                        title: "Error Pausing Stream",
                        description: error instanceof Error ? error.message : "An unknown error occurred",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                  Temporarily stop the stream. The recipient won't receive more tokens until you resume.
                </div>
              </div>
            ) : (
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await onResume(stream.id);
                    } catch (error) {
                      console.error('Error resuming stream:', error);
                      toast({
                        title: "Error Resuming Stream",
                        description: error instanceof Error ? error.message : "An unknown error occurred",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-1" /> Resume
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                  Continue a paused stream. The recipient will start receiving tokens again.
                </div>
              </div>
            )}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await onCancel(stream.id);
                  } catch (error) {
                    console.error('Error canceling stream:', error);
                    toast({
                      title: "Error Canceling Stream",
                      description: error instanceof Error ? error.message : "An unknown error occurred",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <StopCircle className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                Permanently stop the stream. Any unclaimed tokens will be returned to you.
              </div>
            </div>
          </div>
        ) : stream.isRecipient ? (
          // Recipient controls
          <div className="w-full">
            <div className="relative group">
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={async () => {
                  try {
                    await onWithdraw(stream.id);
                  } catch (error) {
                    console.error('Error claiming tokens:', error);
                    toast({
                      title: "Error Claiming Tokens",
                      description: error instanceof Error ? error.message : "An unknown error occurred",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <CircleDollarSign className="h-4 w-4 mr-1" /> Claim Tokens
              </Button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                Withdraw tokens that have been streamed to you so far. After claiming, the stream will start from 0 again.
              </div>
            </div>
          </div>
        ) : (
          // Viewer (not sender or recipient)
          <div className="text-center w-full text-sm text-muted-foreground">
            Stream from {formatAddress(stream.sender)} to {formatAddress(stream.recipient)}
          </div>
        )}
      </CardFooter>
    </Card>
  );
});

StreamCard.displayName = 'StreamCard';

export default StreamCard;
