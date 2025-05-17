import { toast } from 'sonner';
import contractConfig from '@/contracts/contract-config.json';
import WalletService from './wallet-service';
import TransactionService from './transaction-service';

// Contract addresses
const USDC_FAUCET_ADDRESS = contractConfig.USDCFaucet.address as `0x${string}`;

// Constants
const USDC_DECIMALS = 6;

// Faucet info interface
export interface FaucetInfo {
  claimAmount: bigint;
  cooldownPeriod: number;
  maxClaimPerAddress: bigint;
  faucetBalance: bigint;
}

// User claim info interface
export interface UserClaimInfo {
  lastClaimTime: bigint;
  totalClaimed: bigint;
  timeUntilNextClaim: bigint;
  remainingAllowance: bigint;
  canClaim: boolean;
}

/**
 * Service for USDC Faucet functionality
 */
export const USDCFaucetService = {
  /**
   * Format time remaining in a human-readable format
   * @param seconds The time in seconds
   * @returns Formatted time string
   */
  formatTimeRemaining(seconds: bigint): string {
    const totalSeconds = Number(seconds);
    
    if (totalSeconds <= 0) {
      return 'Now';
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  },

  /**
   * Get faucet information
   * @returns The faucet information
   */
  async getFaucetInfo(): Promise<FaucetInfo> {
    try {
      // Get claim amount
      const claimAmount = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'claimAmount',
        args: [],
      }) || 0n;
      
      // Get cooldown period
      const cooldownPeriod = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'cooldownPeriod',
        args: [],
      }) || 0n;
      
      // Get max claim per address
      const maxClaimPerAddress = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'maxClaimPerAddress',
        args: [],
      }) || 0n;
      
      // Get faucet balance
      const faucetBalance = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'getFaucetBalance',
        args: [],
      }) || 0n;
      
      return {
        claimAmount,
        cooldownPeriod: Number(cooldownPeriod),
        maxClaimPerAddress,
        faucetBalance
      };
    } catch (error) {
      console.error('Error getting faucet info:', error);
      return {
        claimAmount: 0n,
        cooldownPeriod: 0,
        maxClaimPerAddress: 0n,
        faucetBalance: 0n
      };
    }
  },

  /**
   * Get user claim information
   * @param address The user's address
   * @returns The user claim information
   */
  async getUserClaimInfo(address: string): Promise<UserClaimInfo> {
    try {
      // Get faucet info
      const faucetInfo = await this.getFaucetInfo();
      
      // Get last claim time
      const lastClaimTime = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'lastClaimTime',
        args: [address as `0x${string}`],
      }) || 0n;
      
      // Get total claimed
      const totalClaimed = await TransactionService.readFromContract<bigint>({
        contractName: 'USDCFaucet',
        functionName: 'totalClaimed',
        args: [address as `0x${string}`],
      }) || 0n;
      
      // Calculate time until next claim
      const now = BigInt(Math.floor(Date.now() / 1000));
      const nextClaimTime = lastClaimTime + BigInt(faucetInfo.cooldownPeriod);
      const timeUntilNextClaim = now >= nextClaimTime ? 0n : nextClaimTime - now;
      
      // Calculate remaining allowance
      const remainingAllowance = faucetInfo.maxClaimPerAddress > totalClaimed
        ? faucetInfo.maxClaimPerAddress - totalClaimed
        : 0n;
      
      // Determine if user can claim
      const canClaim = timeUntilNextClaim === 0n &&
        remainingAllowance >= faucetInfo.claimAmount &&
        faucetInfo.faucetBalance >= faucetInfo.claimAmount;
      
      return {
        lastClaimTime,
        totalClaimed,
        timeUntilNextClaim,
        remainingAllowance,
        canClaim
      };
    } catch (error) {
      console.error('Error getting user claim info:', error);
      return {
        lastClaimTime: 0n,
        totalClaimed: 0n,
        timeUntilNextClaim: 0n,
        remainingAllowance: 0n,
        canClaim: false
      };
    }
  },

  /**
   * Claim tokens from the faucet
   * @returns True if claimed successfully
   */
  async claimTokens(): Promise<boolean> {
    try {
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }
      
      // Ensure correct network
      await WalletService.ensureCorrectNetwork();
      
      // Get user claim info
      const userClaimInfo = await this.getUserClaimInfo(account.address);
      
      // Check if user can claim
      if (!userClaimInfo.canClaim) {
        // Check why user can't claim
        if (userClaimInfo.timeUntilNextClaim > 0n) {
          toast.error('Cooldown period not expired', {
            description: `Please wait ${this.formatTimeRemaining(userClaimInfo.timeUntilNextClaim)} before claiming again`
          });
        } else if (userClaimInfo.remainingAllowance < (await this.getFaucetInfo()).claimAmount) {
          toast.error('Maximum claim limit reached', {
            description: `You've reached your maximum claim limit`
          });
        } else {
          toast.error('Insufficient faucet balance', {
            description: 'The faucet does not have enough USDC to fulfill your claim'
          });
        }
        return false;
      }
      
      // Claim tokens
      const hash = await TransactionService.writeToContract({
        contractName: 'USDCFaucet',
        functionName: 'claimTokens',
        args: [],
      });
      
      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);
      
      toast.success('Tokens claimed successfully!');
      return true;
    } catch (error) {
      console.error('Error claiming tokens:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('CooldownNotExpired')) {
          toast.error('Cooldown period not expired', {
            description: 'Please wait before claiming again'
          });
        } else if (error.message.includes('MaxClaimLimitReached')) {
          toast.error('Maximum claim limit reached', {
            description: `You've reached your maximum claim limit`
          });
        } else if (error.message.includes('InsufficientFaucetBalance')) {
          toast.error('Insufficient faucet balance', {
            description: 'The faucet does not have enough USDC to fulfill your claim'
          });
        } else {
          toast.error('Failed to claim tokens', {
            description: error.message
          });
        }
      }
      
      return false;
    }
  }
};

export default USDCFaucetService;
