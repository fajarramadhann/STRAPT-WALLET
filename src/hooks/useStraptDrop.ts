import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import StraptDropService, { DropInfo } from '@/services/strapt-drop-service';
import { TokenType } from '@/services/token-service';

/**
 * Hook for interacting with the STRAPT Drop contract
 */
export function useStraptDrop() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [currentDropId, setCurrentDropId] = useState<string | null>(null);

  /**
   * Create a new STRAPT Drop
   * @param tokenType The token type
   * @param amount The total amount
   * @param recipients The number of recipients
   * @param isRandom Whether to distribute randomly
   * @param message A message for the drop
   * @returns The drop ID
   */
  const createDrop = useCallback(async (
    tokenType: TokenType,
    amount: string,
    recipients: number,
    isRandom: boolean,
    message: string = ''
  ): Promise<string> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Create the drop
      const dropId = await StraptDropService.createDrop(
        tokenType,
        amount,
        recipients,
        isRandom,
        message
      );
      
      setCurrentDropId(dropId);
      setIsConfirmed(true);
      
      return dropId;
    } catch (error) {
      console.error('Error creating drop:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Claim tokens from a STRAPT Drop
   * @param dropId The drop ID
   * @returns True if claimed successfully
   */
  const claimDrop = useCallback(async (
    dropId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Claim the drop
      const success = await StraptDropService.claimDrop(dropId);
      
      if (success) {
        setIsConfirmed(true);
      }
      
      return success;
    } catch (error) {
      console.error('Error claiming drop:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Refund an expired drop
   * @param dropId The drop ID
   * @returns True if refunded successfully
   */
  const refundExpiredDrop = useCallback(async (
    dropId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Refund the drop
      const success = await StraptDropService.refundExpiredDrop(dropId);
      
      if (success) {
        setIsConfirmed(true);
      }
      
      return success;
    } catch (error) {
      console.error('Error refunding drop:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Get drop information
   * @param dropId The drop ID
   * @returns The drop information
   */
  const getDropInfo = useCallback(async (
    dropId: string
  ): Promise<DropInfo | null> => {
    return StraptDropService.getDropInfo(dropId);
  }, []);

  /**
   * Check if an address has claimed from a drop
   * @param dropId The drop ID
   * @param address The address to check
   * @returns True if the address has claimed, false otherwise
   */
  const hasAddressClaimed = useCallback(async (
    dropId: string,
    address: string = address as string
  ): Promise<boolean> => {
    if (!address) {
      return false;
    }
    
    return StraptDropService.hasAddressClaimed(dropId, address);
  }, [address]);

  /**
   * Get drops created by a user
   * @param address The user's address
   * @returns Array of drop IDs and info
   */
  const getUserCreatedDrops = useCallback(async (
    address: string = address as string
  ): Promise<{id: string; info: DropInfo}[]> => {
    if (!address) {
      return [];
    }
    
    return StraptDropService.getUserCreatedDrops(address);
  }, [address]);

  return {
    isLoading,
    isPending,
    isConfirming,
    isConfirmed,
    currentDropId,
    createDrop,
    claimDrop,
    refundExpiredDrop,
    getDropInfo,
    hasAddressClaimed,
    getUserCreatedDrops,
  };
}

export default useStraptDrop;
