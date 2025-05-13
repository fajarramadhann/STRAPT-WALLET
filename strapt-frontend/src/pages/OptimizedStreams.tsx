import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, BarChart2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePaymentStream } from '@/hooks/use-payment-stream';
import { StreamStatus } from '@/hooks/use-payment-stream';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { Loading } from '@/components/ui/loading';
import InfoTooltip from '@/components/InfoTooltip';
import StreamCard, { UIStream } from '@/components/streams/StreamCard';
import StreamForm from '@/components/streams/StreamForm';
import { Milestone } from '@/components/MilestoneInput';
import { TokenOption } from '@/components/TokenSelect';

// Mock tokens for development
const tokens: TokenOption[] = [
  { symbol: 'IDRX', name: 'IDRX Token', balance: 1000.00, icon: '/IDRX BLUE COIN.svg' },
  { symbol: 'USDC', name: 'USD Coin', balance: 500.45, icon: '/usd-coin-usdc-logo.svg' },
];

const OptimizedStreams = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedStream, setSelectedStream] = useState<UIStream | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const { toast } = useToast();
  const { address, isConnected } = useXellarWallet();

  // Initialize the payment stream hook
  const {
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    useUserStreams
  } = usePaymentStream();

  // Get user streams
  const { streams: contractStreams, isLoading: isLoadingStreams, refetch: refetchStreams, updateStreamStatus } = useUserStreams(address);

  // Convert contract streams to UI streams
  const [activeStreams, setActiveStreams] = useState<UIStream[]>([]);
  const [completedStreams, setCompletedStreams] = useState<UIStream[]>([]);

  // Helper function to format address for display
  const formatAddress = useCallback((address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  // Calculate rate from stream data
  const calculateRateFromStream = useCallback((stream: any): string => {
    const amount = Number(stream.amount);
    const duration = stream.endTime - stream.startTime;

    if (duration <= 0) return '0';

    const ratePerSecond = amount / duration;

    if (ratePerSecond >= 1) {
      return `${ratePerSecond.toFixed(2)} ${stream.tokenSymbol}/second`;
    }
    if (ratePerSecond * 60 >= 1) {
      return `${(ratePerSecond * 60).toFixed(2)} ${stream.tokenSymbol}/minute`;
    }
    if (ratePerSecond * 3600 >= 1) {
      return `${(ratePerSecond * 3600).toFixed(2)} ${stream.tokenSymbol}/hour`;
    }
    return `${(ratePerSecond * 86400).toFixed(4)} ${stream.tokenSymbol}/day`;
  }, []);

  // Helper function to convert StreamStatus to string
  const getStatusString = useCallback((status: StreamStatus): 'active' | 'paused' | 'completed' | 'canceled' => {
    switch (status) {
      case StreamStatus.Active: return 'active';
      case StreamStatus.Paused: return 'paused';
      case StreamStatus.Completed: return 'completed';
      case StreamStatus.Canceled: return 'canceled';
      default: return 'active';
    }
  }, []);

  // Process streams when they change
  useEffect(() => {
    if (!contractStreams) return;

    const active: UIStream[] = [];
    const completed: UIStream[] = [];

    for (const stream of contractStreams) {
      // Convert contract stream to UI stream
      const uiStream: UIStream = {
        id: stream.id,
        recipient: stream.recipient,
        sender: stream.sender,
        total: Number(stream.amount),
        streamed: Number(stream.streamed),
        rate: calculateRateFromStream(stream),
        status: getStatusString(stream.status),
        token: stream.tokenSymbol,
        startTime: stream.startTime,
        endTime: stream.endTime,
        isRecipient: address?.toLowerCase() === stream.recipient.toLowerCase(),
        isSender: address?.toLowerCase() === stream.sender.toLowerCase(),
        milestones: stream.milestones.map((m: any, index: number) => ({
          id: `ms-${stream.id}-${index}`,
          percentage: m.percentage,
          description: m.description,
          released: m.released
        }))
      };

      // Add to appropriate array based on status
      if (stream.status === StreamStatus.Completed || stream.status === StreamStatus.Canceled) {
        completed.push(uiStream);
      } else {
        active.push(uiStream);
      }
    }

    setActiveStreams(active);
    setCompletedStreams(completed);
  }, [contractStreams, address, calculateRateFromStream, getStatusString]);

  // Handle stream creation
  const handleCreateStream = useCallback(async (data: {
    recipient: string;
    tokenType: any;
    amount: string;
    durationInSeconds: number;
    milestonePercentages: number[];
    milestoneDescriptions: string[];
  }) => {
    try {
      setIsCreatingStream(true);

      await createStream(
        data.recipient,
        data.tokenType,
        data.amount,
        data.durationInSeconds,
        data.milestonePercentages,
        data.milestoneDescriptions
      );

      toast({
        title: "Stream Created",
        description: `Successfully started streaming ${data.amount} ${data.tokenType} to ${data.recipient}`,
      });

      // Reset form and refresh streams
      setShowCreate(false);
      
      // Refresh streams list
      refetchStreams();
    } catch (error) {
      console.error('Error creating stream:', error);
      toast({
        title: "Error Creating Stream",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCreatingStream(false);
    }
  }, [createStream, refetchStreams, toast]);

  // Handle pause stream
  const handlePauseStream = useCallback(async (streamId: string) => {
    try {
      await pauseStream(streamId);
      // Update local state immediately
      updateStreamStatus(streamId, StreamStatus.Paused);
      toast({
        title: "Stream Paused",
        description: `Successfully paused stream`
      });
      // Still refetch to ensure data consistency
      refetchStreams();
    } catch (error) {
      console.error('Error pausing stream:', error);
      throw error;
    }
  }, [pauseStream, updateStreamStatus, toast, refetchStreams]);

  // Handle resume stream
  const handleResumeStream = useCallback(async (streamId: string) => {
    try {
      await resumeStream(streamId);
      // Update local state immediately
      updateStreamStatus(streamId, StreamStatus.Active);
      toast({
        title: "Stream Resumed",
        description: `Successfully resumed stream`
      });
      // Still refetch to ensure data consistency
      refetchStreams();
    } catch (error) {
      console.error('Error resuming stream:', error);
      throw error;
    }
  }, [resumeStream, updateStreamStatus, toast, refetchStreams]);

  // Handle cancel stream
  const handleCancelStream = useCallback(async (streamId: string) => {
    try {
      await cancelStream(streamId);
      // Update local state immediately
      updateStreamStatus(streamId, StreamStatus.Canceled);
      toast({
        title: "Stream Canceled",
        description: `Successfully canceled stream`
      });
      // Still refetch to ensure data consistency
      refetchStreams();
    } catch (error) {
      console.error('Error canceling stream:', error);
      throw error;
    }
  }, [cancelStream, updateStreamStatus, toast, refetchStreams]);

  // Handle withdraw from stream
  const handleWithdrawFromStream = useCallback(async (streamId: string) => {
    try {
      await withdrawFromStream(streamId);

      // Update the local state to reflect that tokens have been claimed
      // When a recipient claims tokens, the stream should start from 0 again
      setActiveStreams(prev =>
        prev.map(s =>
          s.id === streamId
            ? { ...s, streamed: 0 }
            : s
        )
      );

      toast({
        title: "Tokens Claimed",
        description: "Successfully claimed tokens from the stream"
      });

      // Refetch to get updated streamed amount from blockchain
      refetchStreams();
    } catch (error) {
      console.error('Error claiming tokens:', error);
      throw error;
    }
  }, [withdrawFromStream, refetchStreams, toast]);

  // Handle release milestone
  const handleReleaseMilestone = useCallback((stream: UIStream, milestone: Milestone) => {
    setSelectedStream(stream);
    setSelectedMilestone(milestone);
    setShowReleaseDialog(true);
  }, []);

  // Handle release funds
  const handleReleaseFunds = useCallback(async () => {
    if (!selectedStream || !selectedMilestone) return;

    try {
      // Extract milestone index from the ID
      const idParts = selectedMilestone.id.split('-');
      const milestoneIndex = Number.parseInt(idParts[idParts.length - 1], 10);

      // Release the milestone
      await releaseMilestone(selectedStream.id, milestoneIndex);

      // Update the milestone in the local state
      const updatedMilestones = selectedStream.milestones?.map((m, index) => {
        if (index === milestoneIndex) {
          return { ...m, released: true };
        }
        return m;
      });

      // Update the UI immediately
      setActiveStreams(prev =>
        prev.map(stream =>
          stream.id === selectedStream.id
            ? { ...stream, milestones: updatedMilestones }
            : stream
        )
      );

      const releaseAmount = (selectedMilestone.percentage / 100) * selectedStream.total;

      toast({
        title: "Funds Released",
        description: `Successfully released ${releaseAmount} ${selectedStream.token} to ${formatAddress(selectedStream.recipient)} for milestone: ${selectedMilestone.description}`,
      });

      // Refresh streams to ensure data consistency
      refetchStreams();
    } catch (error) {
      console.error('Error releasing milestone:', error);
      toast({
        title: "Error Releasing Funds",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setShowReleaseDialog(false);
    }
  }, [selectedStream, selectedMilestone, releaseMilestone, formatAddress, refetchStreams, toast]);

  // Handle stream completion
  const handleStreamComplete = useCallback((streamId: string) => {
    console.log('Stream completed automatically:', streamId);
    // Update local state immediately
    updateStreamStatus(streamId, StreamStatus.Completed);
    // Move the stream from active to completed
    const completedStream = activeStreams.find(s => s.id === streamId);
    if (completedStream) {
      setActiveStreams(prev => prev.filter(s => s.id !== streamId));
      setCompletedStreams(prev => [...prev, {...completedStream, status: 'completed'}]);
    }
  }, [activeStreams, updateStreamStatus]);

  // Memoized empty state components
  const EmptyActiveStreams = useMemo(() => (
    <div className="text-center p-8">
      <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
      <h3 className="font-medium mb-1">No Active Streams</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Start streaming payments to someone
      </p>
    </div>
  ), []);

  const EmptyCompletedStreams = useMemo(() => (
    <div className="text-center p-8">
      <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
      <h3 className="font-medium mb-1">No Completed Streams</h3>
      <p className="text-sm text-muted-foreground">
        Your completed streams will appear here
      </p>
    </div>
  ), []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {!showCreate ? (
        <>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Payment Streams</h2>
              <InfoTooltip
                content={
                  <div>
                    <p className="font-medium mb-1">About Payment Streams</p>
                    <p className="mb-1">Payment streams allow you to send tokens gradually over time to recipients.</p>
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      <li>Tokens are streamed continuously in real-time</li>
                      <li>Recipients can claim tokens at any time</li>
                      <li>Senders can pause, resume, or cancel streams</li>
                      <li>Add milestones to release funds at specific points</li>
                    </ul>
                  </div>
                }
              />
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              size="sm"
              className="flex items-center gap-1"
            >
              <PlusCircle className="h-4 w-4" /> New Stream
            </Button>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              {isLoadingStreams ? (
                <div className="flex justify-center items-center py-12">
                  <Loading size="lg" text="Loading streams..." />
                </div>
              ) : activeStreams.length > 0 ? (
                <div className="space-y-4">
                  {activeStreams.map((stream) => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      onPause={handlePauseStream}
                      onResume={handleResumeStream}
                      onCancel={handleCancelStream}
                      onWithdraw={handleWithdrawFromStream}
                      onReleaseMilestone={handleReleaseMilestone}
                      onStreamComplete={handleStreamComplete}
                      formatAddress={formatAddress}
                    />
                  ))}
                </div>
              ) : EmptyActiveStreams}
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              {isLoadingStreams ? (
                <div className="flex justify-center items-center py-12">
                  <Loading size="lg" text="Loading streams..." />
                </div>
              ) : completedStreams.length > 0 ? (
                <div className="space-y-4">
                  {completedStreams.map((stream) => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      onPause={handlePauseStream}
                      onResume={handleResumeStream}
                      onCancel={handleCancelStream}
                      onWithdraw={handleWithdrawFromStream}
                      onReleaseMilestone={handleReleaseMilestone}
                      onStreamComplete={handleStreamComplete}
                      formatAddress={formatAddress}
                    />
                  ))}
                </div>
              ) : EmptyCompletedStreams}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <StreamForm
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreateStream}
          isCreatingStream={isCreatingStream}
          tokens={tokens}
        />
      )}

      {/* Release Milestone Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Milestone Funds</DialogTitle>
            <DialogDescription>
              Are you sure you want to release funds for this milestone?
            </DialogDescription>
          </DialogHeader>

          {selectedStream && selectedMilestone && (
            <div className="py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm text-muted-foreground">Recipient:</div>
                  <div className="text-sm font-medium">{formatAddress(selectedStream.recipient)}</div>

                  <div className="text-sm text-muted-foreground">Milestone:</div>
                  <div className="text-sm font-medium">{selectedMilestone.description}</div>

                  <div className="text-sm text-muted-foreground">Percentage:</div>
                  <div className="text-sm font-medium">{selectedMilestone.percentage}%</div>

                  <div className="text-sm text-muted-foreground">Amount:</div>
                  <div className="text-sm font-medium">
                    {((selectedMilestone.percentage / 100) * selectedStream.total).toFixed(2)} {selectedStream.token}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>Cancel</Button>
            <Button onClick={handleReleaseFunds}>Release Funds</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OptimizedStreams;
