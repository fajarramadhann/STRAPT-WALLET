import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

/**
 * Hook for managing transaction states
 * Provides state variables and setters for loading, approving, confirming, etc.
 */
export function useTransactionState() {
  // Common transaction states
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Write contract hooks from wagmi
  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Reset all states
  const resetStates = useCallback(() => {
    setIsLoading(false);
    setIsApproving(false);
    setIsApproved(false);
    setIsCreating(false);
    setIsClaiming(false);
    setIsRefunding(false);
  }, []);

  // Shorten ID for display
  const shortenId = (id: string | null) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  return {
    // State variables
    isLoading,
    setIsLoading,
    isApproving,
    setIsApproving,
    isApproved,
    setIsApproved,
    isCreating,
    setIsCreating,
    isClaiming,
    setIsClaiming,
    isRefunding,
    setIsRefunding,
    currentId,
    setCurrentId,
    
    // Wagmi hooks
    writeContract,
    isPending,
    hash,
    isConfirming,
    isConfirmed,
    
    // Utility functions
    resetStates,
    shortenId,
    
    // Computed states
    isProcessing: isLoading || isPending || isConfirming || isApproving || isCreating || isClaiming || isRefunding,
  };
}
