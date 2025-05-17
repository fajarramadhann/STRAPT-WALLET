import { keccak256, toBytes, decodeEventLog } from 'viem';
import { toast } from 'sonner';
import contractConfig from '@/contracts/contract-config.json';
import WalletService from './wallet-service';
import TransactionService from './transaction-service';
import TokenService, { TokenType } from './token-service';

// Contract addresses
const PROTECTED_TRANSFER_V2_ADDRESS = contractConfig.ProtectedTransferV2.address as `0x${string}`;

// Transfer status enum
export enum TransferStatus {
  Pending = 0,
  Claimed = 1,
  Refunded = 2,
  Expired = 3
}

// Transfer details interface
export interface TransferDetails {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  grossAmount: string;
  expiry: number;
  status: TransferStatus;
  createdAt: number;
  isLinkTransfer: boolean;
  hasPassword: boolean;
}

/**
 * Service for Protected Transfer functionality
 */
export const ProtectedTransferService = {
  /**
   * Generate a random claim code
   * @returns A random claim code
   */
  generateClaimCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const length = 8;

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
  },

  /**
   * Hash a claim code for use with the contract
   * @param claimCode The claim code to hash
   * @returns The hashed claim code
   */
  hashClaimCode(claimCode: string): `0x${string}` {
    return keccak256(toBytes(claimCode));
  },

  /**
   * Check if a transfer is password protected
   * @param transferId The transfer ID
   * @returns True if password protected, false otherwise
   */
  async isPasswordProtected(transferId: string): Promise<boolean> {
    try {
      const result = await TransactionService.readFromContract<number>({
        contractName: 'ProtectedTransferV2',
        functionName: 'isPasswordProtected',
        args: [transferId as `0x${string}`],
      });

      return result === 1;
    } catch (error) {
      console.error('Error checking if transfer is password protected:', error);
      return false;
    }
  },

  /**
   * Check if a transfer is claimable
   * @param transferId The transfer ID
   * @returns True if claimable, false otherwise
   */
  async isTransferClaimable(transferId: string): Promise<boolean> {
    try {
      const result = await TransactionService.readFromContract<boolean>({
        contractName: 'ProtectedTransferV2',
        functionName: 'isTransferClaimable',
        args: [transferId as `0x${string}`],
      });

      return result;
    } catch (error) {
      console.error('Error checking if transfer is claimable:', error);
      return false;
    }
  },

  /**
   * Get transfer details
   * @param transferId The transfer ID
   * @returns The transfer details
   */
  async getTransferDetails(transferId: string): Promise<TransferDetails | null> {
    try {
      const result = await TransactionService.readFromContract<any[]>({
        contractName: 'ProtectedTransferV2',
        functionName: 'getTransfer',
        args: [transferId as `0x${string}`],
      });

      if (!result || !result[0]) {
        return null;
      }

      const [
        sender,
        recipient,
        tokenAddress,
        amount,
        grossAmount,
        expiry,
        status,
        createdAt,
        isLinkTransfer,
        hasPassword
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
        id: transferId,
        sender,
        recipient,
        tokenAddress,
        tokenSymbol,
        amount: TransactionService.formatTokenAmount(amount, decimals),
        grossAmount: TransactionService.formatTokenAmount(grossAmount, decimals),
        expiry: Number(expiry),
        status: Number(status),
        createdAt: Number(createdAt),
        isLinkTransfer: Boolean(isLinkTransfer),
        hasPassword: Boolean(hasPassword)
      };
    } catch (error) {
      console.error('Error getting transfer details:', error);
      return null;
    }
  },

  /**
   * Create a direct transfer
   * @param recipient The recipient address
   * @param tokenType The token type
   * @param amount The amount to transfer
   * @param expiryTimestamp The expiry timestamp
   * @param withPassword Whether to use password protection
   * @param customPassword A custom password (optional)
   * @returns The transfer ID
   */
  async createDirectTransfer(
    recipient: string,
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    withPassword: boolean = true,
    customPassword: string | null = null,
  ): Promise<string> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Use custom password if provided and password protection is enabled, otherwise generate a random one
      const claimCode = withPassword ? (customPassword || this.generateClaimCode()) : '';
      const claimCodeHash = withPassword ? this.hashClaimCode(claimCode) : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      // Get token address and parse amount
      const tokenAddress = TokenService.getTokenAddress(tokenType);
      const parsedAmount = TokenService.parseTokenAmount(amount, tokenType);

      // Ensure token is approved
      await TokenService.ensureTokenApproved(
        tokenType,
        amount,
        PROTECTED_TRANSFER_V2_ADDRESS
      );

      // Create the transfer
      const hash = await TransactionService.writeToContract({
        contractName: 'ProtectedTransferV2',
        functionName: 'createDirectTransfer',
        args: [
          recipient as `0x${string}`,
          tokenAddress,
          parsedAmount,
          BigInt(expiryTimestamp),
          withPassword,
          claimCodeHash
        ],
      });

      // Wait for transaction to be confirmed
      const receipt = await TransactionService.waitForTransaction(hash);

      // Extract transfer ID from logs
      let transferId = '';
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: await TransactionService.getContractABI('ProtectedTransferV2'),
              data: log.data,
              topics: log.topics,
            });

            if (event.eventName === 'TransferCreated') {
              transferId = event.args.transferId as string;
              break;
            }
          } catch (e) {
            // Skip logs that can't be decoded
            continue;
          }
        }
      }

      if (!transferId) {
        throw new Error('Failed to extract transfer ID from transaction receipt');
      }

      // Show success message with claim code if password protected
      if (withPassword) {
        toast.success('Transfer created successfully!', {
          description: `Claim code: ${claimCode}`,
          duration: 10000,
        });
      } else {
        toast.success('Transfer created successfully!');
      }

      return transferId;
    } catch (error) {
      console.error('Error creating direct transfer:', error);
      throw error;
    }
  },

  /**
   * Create a link transfer
   * @param tokenType The token type
   * @param amount The amount to transfer
   * @param expiryTimestamp The expiry timestamp
   * @param withPassword Whether to use password protection
   * @param customPassword A custom password (optional)
   * @returns The transfer ID and claim code
   */
  async createLinkTransfer(
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    withPassword: boolean = false,
    customPassword: string | null = null,
  ): Promise<{ transferId: string; claimCode: string }> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Use custom password if provided and password protection is enabled, otherwise use empty string
      const claimCode = withPassword ? (customPassword || this.generateClaimCode()) : '';
      const claimCodeHash = withPassword ? this.hashClaimCode(claimCode) : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      // Get token address and parse amount
      const tokenAddress = TokenService.getTokenAddress(tokenType);
      const parsedAmount = TokenService.parseTokenAmount(amount, tokenType);

      // Ensure token is approved
      await TokenService.ensureTokenApproved(
        tokenType,
        amount,
        PROTECTED_TRANSFER_V2_ADDRESS
      );

      // Create the transfer
      const hash = await TransactionService.writeToContract({
        contractName: 'ProtectedTransferV2',
        functionName: 'createLinkTransfer',
        args: [
          tokenAddress,
          parsedAmount,
          BigInt(expiryTimestamp),
          withPassword,
          claimCodeHash
        ],
      });

      // Wait for transaction to be confirmed
      const receipt = await TransactionService.waitForTransaction(hash);

      // Extract transfer ID from logs
      let transferId = '';
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: await TransactionService.getContractABI('ProtectedTransferV2'),
              data: log.data,
              topics: log.topics,
            });

            if (event.eventName === 'TransferCreated') {
              transferId = event.args.transferId as string;
              break;
            }
          } catch (e) {
            // Skip logs that can't be decoded
            continue;
          }
        }
      }

      if (!transferId) {
        throw new Error('Failed to extract transfer ID from transaction receipt');
      }

      toast.success('Link transfer created successfully!');

      return { transferId, claimCode };
    } catch (error) {
      console.error('Error creating link transfer:', error);
      throw error;
    }
  },

  /**
   * Claim a transfer
   * @param transferId The transfer ID
   * @param claimCode The claim code (if password protected)
   * @returns True if claimed successfully
   */
  async claimTransfer(
    transferId: string,
    claimCode = ''
  ): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Check if transfer is claimable
      const isClaimable = await this.isTransferClaimable(transferId);
      if (!isClaimable) {
        toast.error('Transfer is not claimable', {
          description: 'This transfer may have expired, been claimed, or been refunded'
        });
        return false;
      }

      // Check if transfer is password protected
      const isPasswordProtected = await this.isPasswordProtected(transferId);

      // If password protected but no claim code provided
      if (isPasswordProtected && !claimCode) {
        toast.error('Claim code required', {
          description: 'This transfer requires a claim code'
        });
        return false;
      }

      // Claim the transfer
      const hash = await TransactionService.writeToContract({
        contractName: 'ProtectedTransferV2',
        functionName: 'claimTransfer',
        args: [
          transferId as `0x${string}`,
          claimCode
        ],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Transfer claimed successfully!');
      return true;
    } catch (error) {
      console.error('Error claiming transfer:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('InvalidClaimCode')) {
          toast.error('Invalid claim code', {
            description: 'The claim code you provided is incorrect'
          });
        } else if (error.message.includes('TransferNotClaimable')) {
          toast.error('Transfer not claimable', {
            description: 'This transfer may have expired, been claimed, or been refunded'
          });
        } else if (error.message.includes('TransferExpired')) {
          toast.error('Transfer expired', {
            description: 'This transfer has expired and can no longer be claimed'
          });
        }
      }

      return false;
    }
  },

  /**
   * Refund a transfer
   * @param transferId The transfer ID
   * @returns True if refunded successfully
   */
  async refundTransfer(transferId: string): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      // Ensure correct network
      await WalletService.ensureCorrectNetwork();

      // Get transfer details
      const transfer = await this.getTransferDetails(transferId);
      if (!transfer) {
        toast.error('Transfer not found');
        return false;
      }

      // Check if transfer is refundable
      if (transfer.status !== TransferStatus.Pending) {
        toast.error('Transfer not refundable', {
          description: 'This transfer has already been claimed, refunded, or expired'
        });
        return false;
      }

      // Check if sender is the current user
      if (transfer.sender.toLowerCase() !== account.address.toLowerCase()) {
        toast.error('Not authorized', {
          description: 'Only the sender can refund this transfer'
        });
        return false;
      }

      // Check if transfer has expired
      const now = Math.floor(Date.now() / 1000);
      if (now < transfer.expiry) {
        toast.error('Transfer not expired', {
          description: 'This transfer has not expired yet and cannot be refunded'
        });
        return false;
      }

      // Refund the transfer
      const hash = await TransactionService.writeToContract({
        contractName: 'ProtectedTransferV2',
        functionName: 'refundTransfer',
        args: [transferId as `0x${string}`],
      });

      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);

      toast.success('Transfer refunded successfully!');
      return true;
    } catch (error) {
      console.error('Error refunding transfer:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('NotSender')) {
          toast.error('Not authorized', {
            description: 'Only the sender can refund this transfer'
          });
        } else if (error.message.includes('TransferNotRefundable')) {
          toast.error('Transfer not refundable', {
            description: 'This transfer has already been claimed, refunded, or expired'
          });
        } else if (error.message.includes('TransferNotExpired')) {
          toast.error('Transfer not expired', {
            description: 'This transfer has not expired yet and cannot be refunded'
          });
        }
      }

      return false;
    }
  },

  /**
   * Get recipient transfers
   * @param recipient The recipient address
   * @returns Array of transfer IDs
   */
  async getRecipientTransfers(recipient: string): Promise<string[]> {
    try {
      const result = await TransactionService.readFromContract<string[]>({
        contractName: 'ProtectedTransferV2',
        functionName: 'getRecipientTransfers',
        args: [recipient as `0x${string}`],
      });

      return result || [];
    } catch (error) {
      console.error('Error getting recipient transfers:', error);
      return [];
    }
  }
};

export default ProtectedTransferService;
