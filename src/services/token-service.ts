import { parseUnits } from 'viem';
import { readContract, simulateContract, writeContract } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import contractConfig from '@/contracts/contract-config.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';
import { toast } from 'sonner';
import WalletService from './wallet-service';
import TransactionService from './transaction-service';

// Token types
export type TokenType = 'USDC' | 'IDRX';

// Token decimals
export const TOKEN_DECIMALS = {
  USDC: 6,
  IDRX: 2
};

// Token addresses
export const TOKEN_ADDRESSES = {
  USDC: contractConfig.StraptDrop.supportedTokens.USDC as `0x${string}`,
  IDRX: contractConfig.StraptDrop.supportedTokens.IDRX as `0x${string}`
};

/**
 * Service for token-related functionality
 */
export const TokenService = {
  /**
   * Get the address for a token
   * @param tokenType The token type
   * @returns The token address
   */
  getTokenAddress(tokenType: TokenType): `0x${string}` {
    return TOKEN_ADDRESSES[tokenType];
  },

  /**
   * Get the decimals for a token
   * @param tokenType The token type
   * @returns The token decimals
   */
  getTokenDecimals(tokenType: TokenType): number {
    return TOKEN_DECIMALS[tokenType];
  },

  /**
   * Get the ABI for a token
   * @param tokenType The token type
   * @returns The token ABI
   */
  getTokenABI(tokenType: TokenType): any {
    return tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;
  },

  /**
   * Parse a token amount based on token type
   * @param amount The amount as a string
   * @param tokenType The token type
   * @returns The parsed amount as a bigint
   */
  parseTokenAmount(amount: string, tokenType: TokenType): bigint {
    const decimals = this.getTokenDecimals(tokenType);
    return parseUnits(amount, decimals);
  },

  /**
   * Check if a token allowance is sufficient
   * @param tokenType The token type
   * @param amount The amount to check
   * @param owner The token owner
   * @param spender The token spender
   * @returns True if allowance is sufficient, false otherwise
   */
  async checkAllowance(
    tokenType: TokenType,
    amount: string,
    owner: `0x${string}`,
    spender: `0x${string}`
  ): Promise<boolean> {
    try {
      const tokenAddress = this.getTokenAddress(tokenType);
      const decimals = this.getTokenDecimals(tokenType);
      const parsedAmount = parseUnits(amount, decimals);
      const abi = this.getTokenABI(tokenType);

      const allowance = await readContract(config, {
        address: tokenAddress,
        abi,
        functionName: 'allowance',
        args: [owner, spender],
      }) as bigint;

      return allowance >= parsedAmount;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  },

  /**
   * Approve a token for spending
   * @param tokenType The token type
   * @param amount The amount to approve
   * @param spender The token spender
   * @returns The transaction hash
   */
  async approveToken(
    tokenType: TokenType,
    amount: string,
    spender: `0x${string}`
  ): Promise<`0x${string}`> {
    try {
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      const tokenAddress = this.getTokenAddress(tokenType);
      const decimals = this.getTokenDecimals(tokenType);
      const parsedAmount = parseUnits(amount, decimals);
      const abi = this.getTokenABI(tokenType);

      toast.info('Approving token...', {
        description: `Approving ${amount} ${tokenType} for spending`
      });

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: tokenAddress,
        abi,
        functionName: 'approve',
        args: [spender, parsedAmount],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContract(config, request);
      
      // Wait for transaction to be confirmed
      await TransactionService.waitForTransaction(hash);
      
      toast.success('Token approved', {
        description: `Successfully approved ${amount} ${tokenType}`
      });

      return hash;
    } catch (error) {
      console.error('Error approving token:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          toast.error('Approval rejected', {
            description: 'You rejected the token approval'
          });
        } else {
          toast.error('Approval failed', {
            description: error.message
          });
        }
      }
      
      throw error;
    }
  },

  /**
   * Ensure a token is approved for spending
   * @param tokenType The token type
   * @param amount The amount to approve
   * @param spender The token spender
   * @returns True if approved, false otherwise
   */
  async ensureTokenApproved(
    tokenType: TokenType,
    amount: string,
    spender: `0x${string}`
  ): Promise<boolean> {
    try {
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      const isApproved = await this.checkAllowance(
        tokenType,
        amount,
        account.address,
        spender
      );

      if (!isApproved) {
        await this.approveToken(tokenType, amount, spender);
        return true;
      }

      return true;
    } catch (error) {
      console.error('Error ensuring token approval:', error);
      return false;
    }
  }
};

export default TokenService;
