import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import USDCFaucetService, { FaucetInfo, UserClaimInfo } from '@/services/usdc-faucet-service';

/**
 * Hook for interacting with the USDC Faucet contract
 */
export function useUSDCFaucet() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [faucetInfo, setFaucetInfo] = useState<FaucetInfo | null>(null);
  const [userClaimInfo, setUserClaimInfo] = useState<UserClaimInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  /**
   * Claim tokens from the faucet
   * @returns True if claimed successfully
   */
  const claimTokens = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Claim tokens
      const success = await USDCFaucetService.claimTokens();
      
      if (success) {
        setIsConfirmed(true);
        // Refresh info
        fetchFaucetInfo();
        fetchUserClaimInfo();
      }
      
      return success;
    } catch (error) {
      console.error('Error claiming tokens:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Fetch faucet information
   */
  const fetchFaucetInfo = useCallback(async () => {
    try {
      setIsLoadingInfo(true);
      const info = await USDCFaucetService.getFaucetInfo();
      setFaucetInfo(info);
    } catch (error) {
      console.error('Error fetching faucet info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  }, []);

  /**
   * Fetch user claim information
   */
  const fetchUserClaimInfo = useCallback(async () => {
    if (!address) {
      setUserClaimInfo(null);
      return;
    }
    
    try {
      setIsLoadingInfo(true);
      const info = await USDCFaucetService.getUserClaimInfo(address);
      setUserClaimInfo(info);
      
      // Format time remaining
      if (info.timeUntilNextClaim > 0n) {
        setTimeRemaining(USDCFaucetService.formatTimeRemaining(info.timeUntilNextClaim));
      } else {
        setTimeRemaining('Now');
      }
    } catch (error) {
      console.error('Error fetching user claim info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  }, [address]);

  // Fetch info when address changes
  useEffect(() => {
    fetchFaucetInfo();
    if (address) {
      fetchUserClaimInfo();
    }
  }, [address, fetchFaucetInfo, fetchUserClaimInfo]);

  // Update time remaining every second
  useEffect(() => {
    if (!userClaimInfo || userClaimInfo.timeUntilNextClaim === 0n) {
      return;
    }
    
    const interval = setInterval(() => {
      if (userClaimInfo.timeUntilNextClaim > 0n) {
        const newTimeUntilNextClaim = userClaimInfo.timeUntilNextClaim - 1n;
        setUserClaimInfo(prev => {
          if (!prev) return null;
          return {
            ...prev,
            timeUntilNextClaim: newTimeUntilNextClaim,
            canClaim: newTimeUntilNextClaim === 0n &&
              prev.remainingAllowance >= (faucetInfo?.claimAmount || 0n) &&
              (faucetInfo?.faucetBalance || 0n) >= (faucetInfo?.claimAmount || 0n)
          };
        });
        
        // Format time remaining
        setTimeRemaining(USDCFaucetService.formatTimeRemaining(newTimeUntilNextClaim));
      } else {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [userClaimInfo, faucetInfo]);

  return {
    isLoading,
    isPending,
    isConfirming,
    isConfirmed,
    faucetInfo,
    userClaimInfo,
    isLoadingInfo,
    timeRemaining,
    claimTokens,
    fetchFaucetInfo,
    fetchUserClaimInfo,
  };
}

export default useUSDCFaucet;
