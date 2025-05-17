import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import PaymentStreamService, { Stream, StreamStatus, Milestone } from '@/services/payment-stream-service';
import { TokenType } from '@/services/token-service';

/**
 * Hook for interacting with the Payment Stream contract
 */
export function usePaymentStream() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);

  /**
   * Create a new payment stream
   * @param recipient The recipient address
   * @param tokenType The token type
   * @param amount The amount to stream
   * @param durationInSeconds The duration in seconds
   * @param milestonePercentages The milestone percentages
   * @param milestoneDescriptions The milestone descriptions
   * @returns The stream ID
   */
  const createStream = useCallback(async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    durationInSeconds: number,
    milestonePercentages: number[] = [],
    milestoneDescriptions: string[] = []
  ): Promise<string> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Create the stream
      const streamId = await PaymentStreamService.createStream(
        recipient,
        tokenType,
        amount,
        durationInSeconds,
        milestonePercentages,
        milestoneDescriptions
      );
      
      setCurrentStreamId(streamId);
      setIsConfirmed(true);
      
      return streamId;
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Pause a stream
   * @param streamId The stream ID
   * @returns True if paused successfully
   */
  const pauseStream = useCallback(async (
    streamId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Pause the stream
      const success = await PaymentStreamService.pauseStream(streamId);
      
      if (success) {
        setIsConfirmed(true);
        // Refresh streams
        fetchUserStreams();
      }
      
      return success;
    } catch (error) {
      console.error('Error pausing stream:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Resume a paused stream
   * @param streamId The stream ID
   * @returns True if resumed successfully
   */
  const resumeStream = useCallback(async (
    streamId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Resume the stream
      const success = await PaymentStreamService.resumeStream(streamId);
      
      if (success) {
        setIsConfirmed(true);
        // Refresh streams
        fetchUserStreams();
      }
      
      return success;
    } catch (error) {
      console.error('Error resuming stream:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Cancel a stream
   * @param streamId The stream ID
   * @returns True if canceled successfully
   */
  const cancelStream = useCallback(async (
    streamId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Cancel the stream
      const success = await PaymentStreamService.cancelStream(streamId);
      
      if (success) {
        setIsConfirmed(true);
        // Refresh streams
        fetchUserStreams();
      }
      
      return success;
    } catch (error) {
      console.error('Error canceling stream:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Release a milestone
   * @param streamId The stream ID
   * @param milestoneIndex The milestone index
   * @returns True if released successfully
   */
  const releaseMilestone = useCallback(async (
    streamId: string,
    milestoneIndex: number
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Release the milestone
      const success = await PaymentStreamService.releaseMilestone(streamId, milestoneIndex);
      
      if (success) {
        setIsConfirmed(true);
        // Refresh streams
        fetchUserStreams();
      }
      
      return success;
    } catch (error) {
      console.error('Error releasing milestone:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Withdraw from a stream
   * @param streamId The stream ID
   * @returns True if withdrawn successfully
   */
  const withdrawFromStream = useCallback(async (
    streamId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Withdraw from the stream
      const success = await PaymentStreamService.withdrawFromStream(streamId);
      
      if (success) {
        setIsConfirmed(true);
        // Refresh streams
        fetchUserStreams();
      }
      
      return success;
    } catch (error) {
      console.error('Error withdrawing from stream:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Get stream details
   * @param streamId The stream ID
   * @returns The stream details
   */
  const getStreamDetails = useCallback(async (
    streamId: string
  ): Promise<Stream | null> => {
    return PaymentStreamService.getStreamDetails(streamId);
  }, []);

  /**
   * Calculate the current streamed amount
   * @param stream The stream object
   * @returns The current streamed amount
   */
  const calculateStreamedAmount = useCallback((
    stream: Stream
  ): string => {
    return PaymentStreamService.calculateStreamedAmount(stream);
  }, []);

  /**
   * Fetch user streams
   */
  const fetchUserStreams = useCallback(async () => {
    if (!address) {
      setStreams([]);
      return;
    }
    
    try {
      setIsLoadingStreams(true);
      const userStreams = await PaymentStreamService.getUserStreams(address);
      setStreams(userStreams);
    } catch (error) {
      console.error('Error fetching user streams:', error);
    } finally {
      setIsLoadingStreams(false);
    }
  }, [address]);

  // Fetch user streams when address changes
  useEffect(() => {
    if (address) {
      fetchUserStreams();
    }
  }, [address, fetchUserStreams]);

  // Update streamed amounts every 5 seconds
  useEffect(() => {
    if (streams.length === 0) {
      return;
    }
    
    const interval = setInterval(() => {
      setStreams(prevStreams => {
        return prevStreams.map(stream => {
          if (stream.status === StreamStatus.Active) {
            return {
              ...stream,
              streamed: calculateStreamedAmount(stream)
            };
          }
          return stream;
        });
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [streams, calculateStreamedAmount]);

  return {
    isLoading,
    isPending,
    isConfirming,
    isConfirmed,
    currentStreamId,
    streams,
    isLoadingStreams,
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    getStreamDetails,
    calculateStreamedAmount,
    fetchUserStreams,
  };
}

export default usePaymentStream;
