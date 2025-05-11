import { useState, useEffect } from 'react';
import { StreamStatus } from '@/hooks/use-payment-stream';

interface LiveStreamCounterProps {
  startTime: number;
  endTime: number;
  amount: string;
  streamed: string;
  status: StreamStatus;
  token: string;
  streamId?: string;
  onStreamComplete?: (streamId: string) => void;
}

/**
 * Component to display a live counter of streamed tokens
 * Updates every second for active streams
 */
const LiveStreamCounter = ({
  startTime,
  endTime,
  amount,
  streamed,
  status,
  token,
  streamId,
  onStreamComplete
}: LiveStreamCounterProps) => {
  const [currentStreamed, setCurrentStreamed] = useState(streamed);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // For completed or canceled streams, just show the final amount
    if (status === StreamStatus.Completed || status === StreamStatus.Canceled) {
      setCurrentStreamed(amount);
      setPercentage(100);
      return;
    }

    // For paused streams, show the current streamed amount
    if (status === StreamStatus.Paused) {
      setCurrentStreamed(streamed);
      setPercentage(Number(streamed) / Number(amount) * 100);
      return;
    }

    // For active streams, calculate and update in real-time
    const calculateStreamed = () => {
      const now = Math.floor(Date.now() / 1000);
      const totalDuration = endTime - startTime;

      // Check if the stream has completed based on time
      const isTimeComplete = now >= endTime;

      // For resumed streams, we need to use the current streamed amount
      // instead of calculating from scratch
      const totalAmount = Number(amount);
      const alreadyStreamed = Number(streamed);

      // If the stream is complete by time but still active, update its status
      if (isTimeComplete && status === StreamStatus.Active && streamId && onStreamComplete) {
        console.log('Stream completed by time:', streamId);
        onStreamComplete(streamId);

        // Show the full amount
        setCurrentStreamed(totalAmount.toFixed(6));
        setPercentage(100);
        return;
      }

      // If we already have streamed tokens, use that as the base
      // This ensures resumed streams don't start from 0
      if (alreadyStreamed > 0) {
        // Calculate only the additional amount streamed since the last update
        const remainingAmount = totalAmount - alreadyStreamed;
        const remainingDuration = endTime - now;
        const totalRemainingDuration = endTime - startTime;

        // If there's still time left to stream
        if (remainingDuration > 0 && totalRemainingDuration > 0) {
          const additionalStreamed = remainingAmount *
            ((totalRemainingDuration - remainingDuration) / totalRemainingDuration);

          const newStreamedAmount = Math.min(
            alreadyStreamed + additionalStreamed,
            totalAmount
          );

          setCurrentStreamed(newStreamedAmount.toFixed(6));
          const newPercentage = (newStreamedAmount / totalAmount) * 100;
          setPercentage(newPercentage);

          // If we've reached 100% but the stream is still active, mark it as complete
          if (newPercentage >= 99.9 && status === StreamStatus.Active && streamId && onStreamComplete) {
            console.log('Stream completed by amount:', streamId);
            onStreamComplete(streamId);
          }
        } else {
          // If time is up, show the full amount
          setCurrentStreamed(totalAmount.toFixed(6));
          setPercentage(100);

          // If the stream is still active, mark it as complete
          if (status === StreamStatus.Active && streamId && onStreamComplete) {
            console.log('Stream completed by time (remaining duration check):', streamId);
            onStreamComplete(streamId);
          }
        }
      } else {
        // If no tokens have been streamed yet, calculate from scratch
        const elapsedDuration = Math.min(now - startTime, totalDuration);
        const streamedSoFar = Math.min(
          totalAmount * (elapsedDuration / totalDuration),
          totalAmount
        );

        setCurrentStreamed(streamedSoFar.toFixed(6));
        const newPercentage = (streamedSoFar / totalAmount) * 100;
        setPercentage(newPercentage);

        // If we've reached 100% but the stream is still active, mark it as complete
        if (newPercentage >= 99.9 && status === StreamStatus.Active && streamId && onStreamComplete) {
          console.log('Stream completed by amount (from scratch):', streamId);
          onStreamComplete(streamId);
        }
      }
    };

    // Calculate initial value
    calculateStreamed();

    // Update every 5 seconds for active streams
    const interval = setInterval(calculateStreamed, 5000);

    return () => clearInterval(interval);
  }, [startTime, endTime, amount, streamed, status, streamId, onStreamComplete]);

  return (
    <div className="flex justify-between text-sm mb-1">
      <span className="text-muted-foreground">Streamed</span>
      <span className="font-medium">
        {Number(currentStreamed).toFixed(4)} / {Number(amount).toFixed(4)} {token}
        <span className="text-xs text-muted-foreground ml-1">
          ({percentage.toFixed(1)}%)
        </span>
      </span>
    </div>
  );
};

export default LiveStreamCounter;
