import { useState, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import TokenService, { TokenType, TOKEN_ADDRESSES } from '@/services/token-service';
import { toast } from 'sonner';

/**
 * Hook for token-related functionality
 */
export function useTokens() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Get USDC balance
  const { 
    data: usdcBalance,
    isLoading: isLoadingUSDCBalance,
    refetch: refetchUSDCBalance
  } = useBalance({
    address: address,
    token: TOKEN_ADDRESSES.USDC,
    enabled: isConnected,
  });

  // Get IDRX balance
  const { 
    data: idrxBalance,
    isLoading: isLoadingIDRXBalance,
    refetch: refetchIDRXBalance
  } = useBalance({
    address: address,
    token: TOKEN_ADDRESSES.IDRX,
    enabled: isConnected,
  });

  /**
   * Check if a token allowance is sufficient
   * @param tokenType The token type
   * @param amount The amount to check
   * @param spender The token spender
   * @returns True if allowance is sufficient, false otherwise
   */
  const checkAllowance = useCallback(async (
    tokenType: TokenType,
    amount: string,
    spender: `0x${string}`
  ): Promise<boolean> => {
    if (!address) {
      return false;
    }
    
    return TokenService.checkAllowance(
      tokenType,
      amount,
      address,
      spender
    );
  }, [address]);

  /**
   * Approve a token for spending
   * @param tokenType The token type
   * @param amount The amount to approve
   * @param spender The token spender
   * @returns The transaction hash
   */
  const approveToken = useCallback(async (
    tokenType: TokenType,
    amount: string,
    spender: `0x${string}`
  ): Promise<`0x${string}`> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Approve the token
      const hash = await TokenService.approveToken(
        tokenType,
        amount,
        spender
      );
      
      setIsConfirmed(true);
      
      // Refresh balances
      if (tokenType === 'USDC') {
        refetchUSDCBalance();
      } else if (tokenType === 'IDRX') {
        refetchIDRXBalance();
      }
      
      return hash;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, [refetchUSDCBalance, refetchIDRXBalance]);

  /**
   * Ensure a token is approved for spending
   * @param tokenType The token type
   * @param amount The amount to approve
   * @param spender The token spender
   * @returns True if approved, false otherwise
   */
  const ensureTokenApproved = useCallback(async (
    tokenType: TokenType,
    amount: string,
    spender: `0x${string}`
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Check if already approved
      const isApproved = await checkAllowance(
        tokenType,
        amount,
        spender
      );
      
      if (isApproved) {
        return true;
      }
      
      // Approve the token
      await approveToken(
        tokenType,
        amount,
        spender
      );
      
      return true;
    } catch (error) {
      console.error('Error ensuring token approval:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkAllowance, approveToken]);

  /**
   * Get the address for a token
   * @param tokenType The token type
   * @returns The token address
   */
  const getTokenAddress = useCallback((
    tokenType: TokenType
  ): `0x${string}` => {
    return TokenService.getTokenAddress(tokenType);
  }, []);

  /**
   * Get the decimals for a token
   * @param tokenType The token type
   * @returns The token decimals
   */
  const getTokenDecimals = useCallback((
    tokenType: TokenType
  ): number => {
    return TokenService.getTokenDecimals(tokenType);
  }, []);

  /**
   * Parse a token amount based on token type
   * @param amount The amount as a string
   * @param tokenType The token type
   * @returns The parsed amount as a bigint
   */
  const parseTokenAmount = useCallback((
    amount: string,
    tokenType: TokenType
  ): bigint => {
    return TokenService.parseTokenAmount(amount, tokenType);
  }, []);

  /**
   * Refresh token balances
   */
  const refreshBalances = useCallback(() => {
    refetchUSDCBalance();
    refetchIDRXBalance();
  }, [refetchUSDCBalance, refetchIDRXBalance]);

  return {
    isLoading,
    isPending,
    isConfirming,
    isConfirmed,
    usdcBalance,
    idrxBalance,
    isLoadingUSDCBalance,
    isLoadingIDRXBalance,
    checkAllowance,
    approveToken,
    ensureTokenApproved,
    getTokenAddress,
    getTokenDecimals,
    parseTokenAmount,
    refreshBalances,
  };
}

export default useTokens;
