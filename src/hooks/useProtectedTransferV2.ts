import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import ProtectedTransferService, { TransferStatus, TransferDetails } from '@/services/protected-transfer-service';
import { TokenType } from '@/services/token-service';

/**
 * Hook for interacting with the Protected Transfer V2 contract
 */
export function useProtectedTransferV2() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [currentTransferId, setCurrentTransferId] = useState<string | null>(null);

  /**
   * Create a direct transfer
   * @param recipient The recipient address
   * @param tokenType The token type
   * @param amount The amount to transfer
   * @param expiryTimestamp The expiry timestamp
   * @param withPassword Whether to use password protection
   * @param customPassword A custom password (optional)
   * @returns The transfer ID and claim code
   */
  const createDirectTransfer = useCallback(async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    withPassword: boolean = true,
    customPassword: string | null = null,
  ): Promise<{ transferId: string; claimCode: string | null }> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Generate claim code if using password protection
      const claimCode = withPassword ? (customPassword || ProtectedTransferService.generateClaimCode()) : null;
      
      // Create the transfer
      const transferId = await ProtectedTransferService.createDirectTransfer(
        recipient,
        tokenType,
        amount,
        expiryTimestamp,
        withPassword,
        claimCode
      );
      
      setCurrentTransferId(transferId);
      setIsConfirmed(true);
      
      return { transferId, claimCode };
    } catch (error) {
      console.error('Error creating direct transfer:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Create a link transfer
   * @param tokenType The token type
   * @param amount The amount to transfer
   * @param expiryTimestamp The expiry timestamp
   * @param withPassword Whether to use password protection
   * @param customPassword A custom password (optional)
   * @returns The transfer ID and claim code
   */
  const createLinkTransfer = useCallback(async (
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    withPassword: boolean = false,
    customPassword: string | null = null,
  ): Promise<{ transferId: string; claimCode: string }> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Create the transfer
      const result = await ProtectedTransferService.createLinkTransfer(
        tokenType,
        amount,
        expiryTimestamp,
        withPassword,
        customPassword
      );
      
      setCurrentTransferId(result.transferId);
      setIsConfirmed(true);
      
      return result;
    } catch (error) {
      console.error('Error creating link transfer:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Claim a transfer
   * @param transferId The transfer ID
   * @param claimCode The claim code (if password protected)
   * @returns True if claimed successfully
   */
  const claimTransfer = useCallback(async (
    transferId: string,
    claimCode: string = '',
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Claim the transfer
      const success = await ProtectedTransferService.claimTransfer(
        transferId,
        claimCode
      );
      
      if (success) {
        setIsConfirmed(true);
      }
      
      return success;
    } catch (error) {
      console.error('Error claiming transfer:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Refund a transfer
   * @param transferId The transfer ID
   * @returns True if refunded successfully
   */
  const refundTransfer = useCallback(async (
    transferId: string,
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setIsPending(true);
      
      // Refund the transfer
      const success = await ProtectedTransferService.refundTransfer(
        transferId
      );
      
      if (success) {
        setIsConfirmed(true);
      }
      
      return success;
    } catch (error) {
      console.error('Error refunding transfer:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsPending(false);
    }
  }, []);

  /**
   * Check if a transfer is password protected
   * @param transferId The transfer ID
   * @returns True if password protected, false otherwise
   */
  const isPasswordProtected = useCallback(async (
    transferId: string,
  ): Promise<boolean> => {
    return ProtectedTransferService.isPasswordProtected(transferId);
  }, []);

  /**
   * Check if a transfer is claimable
   * @param transferId The transfer ID
   * @returns True if claimable, false otherwise
   */
  const isTransferClaimable = useCallback(async (
    transferId: string,
  ): Promise<boolean> => {
    return ProtectedTransferService.isTransferClaimable(transferId);
  }, []);

  /**
   * Get transfer details
   * @param transferId The transfer ID
   * @returns The transfer details
   */
  const getTransferDetails = useCallback(async (
    transferId: string,
  ): Promise<TransferDetails | null> => {
    return ProtectedTransferService.getTransferDetails(transferId);
  }, []);

  /**
   * Get recipient transfers
   * @param recipient The recipient address
   * @returns Array of transfer IDs
   */
  const getRecipientTransfers = useCallback(async (
    recipient: string = address as string,
  ): Promise<string[]> => {
    if (!recipient) {
      return [];
    }
    
    return ProtectedTransferService.getRecipientTransfers(recipient);
  }, [address]);

  /**
   * Generate a random claim code
   * @returns A random claim code
   */
  const generateClaimCode = useCallback((): string => {
    return ProtectedTransferService.generateClaimCode();
  }, []);

  /**
   * Hash a claim code for use with the contract
   * @param claimCode The claim code to hash
   * @returns The hashed claim code
   */
  const hashClaimCode = useCallback((claimCode: string): `0x${string}` => {
    return ProtectedTransferService.hashClaimCode(claimCode);
  }, []);

  return {
    isLoading,
    isPending,
    isConfirming,
    isConfirmed,
    currentTransferId,
    createDirectTransfer,
    createLinkTransfer,
    claimTransfer,
    refundTransfer,
    isPasswordProtected,
    isTransferClaimable,
    getTransferDetails,
    getRecipientTransfers,
    generateClaimCode,
    hashClaimCode,
  };
}

export default useProtectedTransferV2;
