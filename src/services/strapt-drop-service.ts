import { decodeEventLog } from 'viem';
import { toast } from 'sonner';
import contractConfig from '@/contracts/contract-config.json';
import WalletService from './wallet-service';
import TransactionService from './transaction-service';
import TokenService, { TokenType } from './token-service';

// Contract addresses
const STRAPT_DROP_ADDRESS = contractConfig.StraptDrop.address as `0x${string}`;

// Drop info interface
export interface DropInfo {
  creator: string;
  tokenAddress: string;
  tokenSymbol: string;
  totalAmount: string;
  remainingAmount: string;
  claimedCount: number;
  totalRecipients: number;
  amountPerRecipient: string;
  isRandom: boolean;
  expiryTime: number;
  message: string;
  isActive: boolean;
}

/**
 * Service for STRAPT Drop functionality
 */
export const StraptDropService = {
  /**
   * Get drop information
   * @param dropId The drop ID
   * @returns The drop information
   */
  async getDropInfo(dropId: string): Promise<DropInfo | null> {
    try {
      const result = await TransactionService.readFromContract<any[]>({
        contractName: 'StraptDrop',
        functionName: 'getDrop',
        args: [dropId as `0x${string}`],
      });

      if (!result || !result[0]) {
        return null;
      }

      const [
        creator,
        tokenAddress,
        totalAmount,
        remainingAmount,
        claimedCount,
        totalRecipients,
        amountPerRecipient,
        isRandom,
        expiryTime,
        message,
        isActive
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

      return {
        creator,
        tokenAddress,
        tokenSymbol,
        totalAmount: TransactionService.formatTokenAmount(totalAmount, decimals),
        remainingAmount: TransactionService.formatTokenAmount(remainingAmount, decimals),
        claimedCount: Number(claimedCount),
        totalRecipients: Number(totalRecipients),
        amountPerRecipient: TransactionService.formatTokenAmount(amountPerRecipient, decimals),
        isRandom: Boolean(isRandom),
        expiryTime: Number(expiryTime),
        message,
        isActive: Boolean(isActive)
      };
    } catch (error) {
      console.error('Error getting drop info:', error);
      return null;
    }
  },

  /**
   * Check if an address has claimed from a drop
   * @param dropId The drop ID
   * @param address The address to check
   * @returns True if the address has claimed, false otherwise
   */
  async hasAddressClaimed(dropId: string, address: string): Promise<boolean> {
    try {
      const result = await TransactionService.readFromContract<boolean>({
        contractName: 'StraptDrop',
        functionName: 'hasClaimed',
        args: [dropId as `0x${string}`, address as `0x${string}`],
      });

      return result;
    } catch (error) {
      console.error('Error checking if address has claimed:', error);
      return false;
    }
  },

  /**
   * Create a new STRAPT Drop
   * @param tokenType The token type
   * @param amount The total amount
   * @param recipients The number of recipients
   * @param isRandom Whether to distribute randomly
   * @param message A message for the drop
   * @returns The drop ID
   */
  async createDrop(
    tokenType: TokenType,
    amount: string,
    recipients: number,
    isRandom: boolean,
    message: string = ''
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

      // Calculate expiry time (24 hours from now)
      const expiryTime = Math.floor(Date.now() / 1000) + 86400;

      // Ensure token is approved
      await TokenService.ensureTokenApproved(
        tokenType,
        amount,
        STRAPT_DROP_ADDRESS
      );

      // Create the drop
      const hash = await TransactionService.writeToContract({
        contractName: 'StraptDrop',
        functionName: 'createDrop',
        args: [
          tokenAddress,
          parsedAmount,
          BigInt(recipients),
          isRandom,
          BigInt(expiryTime),
          message
        ],
      });

      // Wait for transaction to be confirmed
      const receipt = await TransactionService.waitForTransaction(hash);

      // Extract drop ID from logs
      let dropId = '';
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: await TransactionService.getContractABI('StraptDrop'),
              data: log.data,
              topics: log.topics,
            });

            if (event.eventName === 'DropCreated') {
              dropId = event.args.dropId as string;
              break;
            }
          } catch (e) {
            // Skip logs that can't be decoded
            continue;
          }
        }
      }

      if (!dropId) {
        throw new Error('Failed to extract drop ID from transaction receipt');
      }

      toast.success('STRAPT Drop created successfully!');

      return dropId;
    } catch (error) {
      console.error('Error creating drop:', error);
      throw error;
    }
  },

  /**
   * Claim tokens from a STRAPT Drop
   * @param dropId The drop ID
   * @returns True if claimed successfully
   */
  async claimDrop(dropId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if drop exists
      const dropInfo = await this.getDropInfo(dropId);
      if (!dropInfo) {
        toast.error('Drop not found');
        return false;
      }

      // Check if drop is active
      if (!dropInfo.isActive) {
        toast.error('Drop is not active');
        return false;
      }

      // Check if drop has expired
      const now = Math.floor(Date.now() / 1000);
      if (now >= dropInfo.expiryTime) {
        toast.error('Drop has expired');
        return false;
      }

      // Check if all claims are taken
      if (dropInfo.claimedCount >= dropInfo.totalRecipients) {
        toast.error('All claims have been taken');
        return false;
      }

      // Check if address has already claimed
      const hasClaimed = await this.hasAddressClaimed(dropId, account.address);
      if (hasClaimed) {
        toast.error('You have already claimed from this drop');
        return false;
      }

      // Check if creator is trying to claim their own drop
      if (dropInfo.creator.toLowerCase() === account.address.toLowerCase()) {
        toast.error('You cannot claim your own drop');
        return false;
      }

      // Claim the drop
      const hash = await TransactionService.writeToContract({
        contractName: 'StraptDrop',
        functionName: 'claimDrop',
        args: [dropId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Successfully claimed tokens from STRAPT Drop!');
      return true;
    } catch (error) {
      console.error('Error claiming drop:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('DropNotFound')) {
          toast.error('Drop not found');
        } else if (error.message.includes('DropNotActive')) {
          toast.error('Drop is not active');
        } else if (error.message.includes('DropExpired')) {
          toast.error('Drop has expired');
        } else if (error.message.includes('AllClaimsTaken')) {
          toast.error('All claims have been taken');
        } else if (error.message.includes('AlreadyClaimed')) {
          toast.error('You have already claimed from this drop');
        } else {
          toast.error('Failed to claim from drop', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Refund an expired drop
   * @param dropId The drop ID
   * @returns True if refunded successfully
   */
  async refundExpiredDrop(dropId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if drop exists
      const dropInfo = await this.getDropInfo(dropId);
      if (!dropInfo) {
        toast.error('Drop not found');
        return false;
      }

      // Check if drop is active
      if (!dropInfo.isActive) {
        toast.error('Drop is not active');
        return false;
      }

      // Check if creator is the current user
      if (dropInfo.creator.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the creator can refund this drop'
        });
        return false;
      }

      // Check if drop has expired
      const now = Math.floor(Date.now() / 1000);
      if (now < dropInfo.expiryTime) {
        toast.error('Drop has not expired yet', {
          description: 'You can only refund expired drops'
        });
        return false;
      }

      // Refund the drop
      const hash = await TransactionService.writeToContract({
        contractName: 'StraptDrop',
        functionName: 'refundExpiredDrop',
        args: [dropId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Drop refunded successfully!');
      return true;
    } catch (error) {
      console.error('Error refunding drop:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('DropNotFound')) {
          toast.error('Drop not found');
        } else if (error.message.includes('DropNotActive')) {
          toast.error('Drop is not active');
        } else if (error.message.includes('NotCreator')) {
          toast.error('Not authorized', {
            description: 'Only the creator can refund this drop'
          });
        } else if (error.message.includes('DropNotExpired')) {
          toast.error('Drop has not expired yet', {
            description: 'You can only refund expired drops'
          });
        } else {
          toast.error('Failed to refund drop', {
            description: error.message
          });
        }
      }

      return false;
    }
  },

  /**
   * Get drops created by a user
   * @param address The user's address
   * @returns Array of drop IDs and info
   */
  async getUserCreatedDrops(address: string): Promise<{id: string; info: DropInfo}[]> {
    try {
      const dropIds = await TransactionService.readFromContract<string[]>({
        contractName: 'StraptDrop',
        functionName: 'getUserCreatedDrops',
        args: [address as `0x${string}`],
      });

      if (!dropIds || dropIds.length === 0) {
        return [];
      }

      // Get info for each drop
      const drops: {id: string; info: DropInfo}[] = [];
      for (const dropId of dropIds) {
        const info = await this.getDropInfo(dropId);
        if (info) {
          drops.push({ id: dropId, info });
        }
      }

      return drops;
    } catch (error) {
      console.error('Error getting user created drops:', error);
      return [];
    }
  }
};

export default StraptDropService;
