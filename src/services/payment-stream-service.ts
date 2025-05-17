import { decodeEventLog } from 'viem';
import { toast } from 'sonner';
import contractConfig from '@/contracts/contract-config.json';
import WalletService from './wallet-service';
import TransactionService from './transaction-service';
import TokenService, { TokenType } from './token-service';

// Contract addresses
const PAYMENT_STREAM_ADDRESS = contractConfig.PaymentStream.address as `0x${string}`;

// Stream status enum
export enum StreamStatus {
  Active = 0,
  Paused = 1,
  Completed = 2,
  Canceled = 3
}

// Milestone interface
export interface Milestone {
  percentage: number;
  description: string;
  released: boolean;
}

// Stream interface
export interface Stream {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  streamed: string;
  startTime: number;
  endTime: number;
  lastUpdate: number;
  status: StreamStatus;
  milestones: Milestone[];
}

/**
 * Service for Payment Stream functionality
 */
export const PaymentStreamService = {
  /**
   * Get stream details
   * @param streamId The stream ID
   * @returns The stream details
   */
  async getStreamDetails(streamId: string): Promise<Stream | null> {
    try {
      const result = await TransactionService.readFromContract<any[]>({
        contractName: 'PaymentStream',
        functionName: 'getStream',
        args: [streamId as `0x${string}`],
      });

      if (!result || !result[0]) {
        return null;
      }

      const [
        sender,
        recipient,
        tokenAddress,
        amount,
        streamed,
        startTime,
        endTime,
        lastUpdate,
        status,
        milestonesData
      ] = result;

      // Determine token symbol
      let tokenSymbol = 'Unknown';
      if (tokenAddress === TokenService.getTokenAddress('USDC')) {
        tokenSymbol = 'USDC';
      } else if (tokenAddress === TokenService.getTokenAddress('IDRX')) {
        tokenSymbol = 'IDRX';
      }

      // Determine token decimals
      const decimals = tokenSymbol === 'USDC' ? 6 : tokenSymbol === 'IDRX' ? 2 : 18;

      // Parse milestones
      const milestones: Milestone[] = [];
      if (milestonesData && Array.isArray(milestonesData)) {
        for (const milestone of milestonesData) {
          if (milestone && Array.isArray(milestone) && milestone.length >= 3) {
            milestones.push({
              percentage: Number(milestone[0]),
              description: milestone[1],
              released: Boolean(milestone[2])
            });
          }
        }
      }

      return {
        id: streamId,
        sender,
        recipient,
        tokenAddress,
        tokenSymbol,
        amount: TransactionService.formatTokenAmount(amount, decimals),
        streamed: TransactionService.formatTokenAmount(streamed, decimals),
        startTime: Number(startTime),
        endTime: Number(endTime),
        lastUpdate: Number(lastUpdate),
        status: Number(status),
        milestones
      };
    } catch (error) {
      console.error('Error getting stream details:', error);
      return null;
    }
  },

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
  async createStream(
    recipient: string,
    tokenType: TokenType,
    amount: string,
    durationInSeconds: number,
    milestonePercentages: number[] = [],
    milestoneDescriptions: string[] = []
  ): Promise<string> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Get token address and parse amount
      const tokenAddress = TokenService.getTokenAddress(tokenType);
      const parsedAmount = TokenService.parseTokenAmount(amount, tokenType);

      // Validate milestone arrays
      if (milestonePercentages.length !== milestoneDescriptions.length) {
        throw new Error('Milestone percentages and descriptions must have the same length');
      }

      // Ensure token is approved
      await TokenService.ensureTokenApproved(
        tokenType,
        amount,
        PAYMENT_STREAM_ADDRESS
      );

      // Create the stream
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'createStream',
        args: [
          recipient as `0x${string}`,
          tokenAddress,
          parsedAmount,
          BigInt(durationInSeconds),
          milestonePercentages.map(p => BigInt(p)),
          milestoneDescriptions
        ],
      });

      // Wait for transaction to be confirmed
      const receipt = await TransactionService.waitForTransaction(hash);

      // Extract stream ID from logs
      let streamId = '';
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: await TransactionService.getContractABI('PaymentStream'),
              data: log.data,
              topics: log.topics,
            });

            if (event.eventName === 'StreamCreated') {
              streamId = event.args.streamId as string;
              break;
            }
          } catch (e) {
            // Skip logs that can't be decoded
            continue;
          }
        }
      }

      if (!streamId) {
        throw new Error('Failed to extract stream ID from transaction receipt');
      }

      toast.success('Payment stream created successfully!');

      return streamId;
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  },

  /**
   * Pause a stream
   * @param streamId The stream ID
   * @returns True if paused successfully
   */
  async pauseStream(streamId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if stream exists
      const stream = await this.getStreamDetails(streamId);
      if (!stream) {
        toast.error('Stream not found');
        return false;
      }

      // Check if stream is active
      if (stream.status !== StreamStatus.Active) {
        toast.error('Stream is not active', {
          description: 'Only active streams can be paused'
        });
        return false;
      }

      // Check if sender is the current user
      if (stream.sender.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the sender can pause this stream'
        });
        return false;
      }

      // Pause the stream
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'pauseStream',
        args: [streamId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Stream paused successfully!');
      return true;
    } catch (error) {
      console.error('Error pausing stream:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('StreamNotActive')) {
          toast.error('Stream is not active', {
            description: 'Only active streams can be paused'
          });
        } else if (error.message.includes('NotSender')) {
          toast.error('Not authorized', {
            description: 'Only the sender can pause this stream'
          });
        } else {
          toast.error('Failed to pause stream', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Resume a paused stream
   * @param streamId The stream ID
   * @returns True if resumed successfully
   */
  async resumeStream(streamId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if stream exists
      const stream = await this.getStreamDetails(streamId);
      if (!stream) {
        toast.error('Stream not found');
        return false;
      }

      // Check if stream is paused
      if (stream.status !== StreamStatus.Paused) {
        toast.error('Stream is not paused', {
          description: 'Only paused streams can be resumed'
        });
        return false;
      }

      // Check if sender is the current user
      if (stream.sender.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the sender can resume this stream'
        });
        return false;
      }

      // Resume the stream
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'resumeStream',
        args: [streamId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Stream resumed successfully!');
      return true;
    } catch (error) {
      console.error('Error resuming stream:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('StreamNotPaused')) {
          toast.error('Stream is not paused', {
            description: 'Only paused streams can be resumed'
          });
        } else if (error.message.includes('NotSender')) {
          toast.error('Not authorized', {
            description: 'Only the sender can resume this stream'
          });
        } else {
          toast.error('Failed to resume stream', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Cancel a stream
   * @param streamId The stream ID
   * @returns True if canceled successfully
   */
  async cancelStream(streamId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if stream exists
      const stream = await this.getStreamDetails(streamId);
      if (!stream) {
        toast.error('Stream not found');
        return false;
      }

      // Check if stream is active or paused
      if (stream.status !== StreamStatus.Active && stream.status !== StreamStatus.Paused) {
        toast.error('Stream cannot be canceled', {
          description: 'Only active or paused streams can be canceled'
        });
        return false;
      }

      // Check if sender is the current user
      if (stream.sender.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the sender can cancel this stream'
        });
        return false;
      }

      // Cancel the stream
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'cancelStream',
        args: [streamId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Stream canceled successfully!');
      return true;
    } catch (error) {
      console.error('Error canceling stream:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('StreamNotCancelable')) {
          toast.error('Stream cannot be canceled', {
            description: 'Only active or paused streams can be canceled'
          });
        } else if (error.message.includes('NotSender')) {
          toast.error('Not authorized', {
            description: 'Only the sender can cancel this stream'
          });
        } else {
          toast.error('Failed to cancel stream', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Release a milestone
   * @param streamId The stream ID
   * @param milestoneIndex The milestone index
   * @returns True if released successfully
   */
  async releaseMilestone(streamId: string, milestoneIndex: number): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if stream exists
      const stream = await this.getStreamDetails(streamId);
      if (!stream) {
        toast.error('Stream not found');
        return false;
      }

      // Check if stream is active or paused
      if (stream.status !== StreamStatus.Active && stream.status !== StreamStatus.Paused) {
        toast.error('Stream is not active or paused', {
          description: 'Milestones can only be released for active or paused streams'
        });
        return false;
      }

      // Check if sender is the current user
      if (stream.sender.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the sender can release milestones'
        });
        return false;
      }

      // Check if milestone exists
      if (milestoneIndex < 0 || milestoneIndex >= stream.milestones.length) {
        toast.error('Invalid milestone index');
        return false;
      }

      // Check if milestone is already released
      if (stream.milestones[milestoneIndex].released) {
        toast.error('Milestone already released');
        return false;
      }

      // Release the milestone
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'releaseMilestone',
        args: [streamId as `0x${string}`, BigInt(milestoneIndex)],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Milestone released successfully!');
      return true;
    } catch (error) {
      console.error('Error releasing milestone:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('NotSender')) {
          toast.error('Not authorized', {
            description: 'Only the sender can release milestones'
          });
        } else if (error.message.includes('InvalidMilestoneIndex')) {
          toast.error('Invalid milestone index');
        } else if (error.message.includes('MilestoneAlreadyReleased')) {
          toast.error('Milestone already released');
        } else {
          toast.error('Failed to release milestone', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Withdraw from a stream
   * @param streamId The stream ID
   * @returns True if withdrawn successfully
   */
  async withdrawFromStream(streamId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if stream exists
      const stream = await this.getStreamDetails(streamId);
      if (!stream) {
        toast.error('Stream not found');
        return false;
      }

      // Check if recipient is the current user
      if (stream.recipient.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the recipient can withdraw from this stream'
        });
        return false;
      }

      // Withdraw from the stream
      const hash = await TransactionService.writeToContract({
        contractName: 'PaymentStream',
        functionName: 'withdrawFromStream',
        args: [streamId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Withdrawn from stream successfully!');
      return true;
    } catch (error) {
      console.error('Error withdrawing from stream:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('NotRecipient')) {
          toast.error('Not authorized', {
            description: 'Only the recipient can withdraw from this stream'
          });
        } else if (error.message.includes('NoFundsToWithdraw')) {
          toast.error('No funds to withdraw');
        } else {
          toast.error('Failed to withdraw from stream', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Get user streams (both sent and received)
   * @param address The user's address
   * @returns Array of streams
   */
  async getUserStreams(address: string): Promise<Stream[]> {
    try {
      // Get sent streams
      const sentStreamIds = await TransactionService.readFromContract<string[]>({
        contractName: 'PaymentStream',
        functionName: 'getSenderStreams',
        args: [address as `0x${string}`],
      });

      // Get received streams
      const receivedStreamIds = await TransactionService.readFromContract<string[]>({
        contractName: 'PaymentStream',
        functionName: 'getRecipientStreams',
        args: [address as `0x${string}`],
      });

      // Combine and deduplicate stream IDs
      const streamIds = [...new Set([...(sentStreamIds || []), ...(receivedStreamIds || [])])];

      if (streamIds.length === 0) {
        return [];
      }

      // Get details for each stream
      const streams: Stream[] = [];
      for (const streamId of streamIds) {
        const stream = await this.getStreamDetails(streamId);
        if (stream) {
          streams.push(stream);
        }
      }

      return streams;
    } catch (error) {
      console.error('Error getting user streams:', error);
      return [];
    }
  },

  /**
   * Calculate the current streamed amount
   * @param stream The stream object
   * @returns The current streamed amount
   */
  calculateStreamedAmount(stream: Stream): string {
    try {
      if (!stream) {
        return '0';
      }

      // If stream is completed or canceled, return the streamed amount
      if (stream.status === StreamStatus.Completed || stream.status === StreamStatus.Canceled) {
        return stream.streamed;
      }

      // If stream is paused, return the streamed amount at the time of pausing
      if (stream.status === StreamStatus.Paused) {
        return stream.streamed;
      }

      // If stream is active, calculate the current streamed amount
      const now = Math.floor(Date.now() / 1000);
      const elapsedTime = Math.min(now, stream.endTime) - stream.lastUpdate;
      const totalDuration = stream.endTime - stream.startTime;

      if (totalDuration <= 0) {
        return stream.streamed;
      }

      // Determine token decimals
      const decimals = stream.tokenSymbol === 'USDC' ? 6 : stream.tokenSymbol === 'IDRX' ? 2 : 18;

      // Parse amount to bigint
      const amount = TransactionService.parseTokenAmount(stream.amount, decimals);
      const streamed = TransactionService.parseTokenAmount(stream.streamed, decimals);

      // Calculate additional streamed amount
      const additionalStreamed = (amount * BigInt(elapsedTime)) / BigInt(totalDuration);

      // Calculate total streamed amount
      const totalStreamed = streamed + additionalStreamed;

      // Format and return the result
      return TransactionService.formatTokenAmount(totalStreamed, decimals);
    } catch (error) {
      console.error('Error calculating streamed amount:', error);
      return stream.streamed;
    }
  }
};

export default PaymentStreamService;
