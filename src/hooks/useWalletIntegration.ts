import { useState, useCallback, useEffect } from 'react';
import { useAccount, useNetwork, useSwitchNetwork } from 'wagmi';
import { liskSepolia, baseSepolia } from 'viem/chains';
import { toast } from 'sonner';
import WalletService from '@/services/wallet-service';

/**
 * Hook for wallet integration
 */
export function useWalletIntegration() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { switchNetwork, isLoading: isSwitchingNetwork } = useSwitchNetwork();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  /**
   * Check if the wallet is connected to the correct network
   * @param requiredChainId The required chain ID
   * @returns True if connected to the correct network, false otherwise
   */
  const checkCorrectNetwork = useCallback((requiredChainId: number = liskSepolia.id): boolean => {
    const isCorrect = chain?.id === requiredChainId;
    setIsCorrectNetwork(isCorrect);
    return isCorrect;
  }, [chain?.id]);

  /**
   * Switch to the specified network
   * @param chainId The chain ID to switch to
   * @returns A promise that resolves when the switch is complete
   */
  const switchToNetwork = useCallback(async (chainId: number = liskSepolia.id) => {
    try {
      if (!isConnected) {
        throw new Error('No wallet connected');
      }
      
      if (chain?.id === chainId) {
        return true;
      }
      
      const chainName = chainId === liskSepolia.id ? 'Lisk Sepolia' : 
                        chainId === baseSepolia.id ? 'Base Sepolia' : 
                        `Chain ID ${chainId}`;
      
      toast.info(`Switching to ${chainName}...`);
      
      await switchNetwork?.(chainId);
      return true;
    } catch (error) {
      console.error('Error switching network:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          toast.error('Network switch rejected', {
            description: 'You need to approve the network switch to continue'
          });
        } else {
          toast.error('Failed to switch network', {
            description: error.message
          });
        }
      }
      
      return false;
    }
  }, [isConnected, chain?.id, switchNetwork]);

  /**
   * Ensure the wallet is connected to the correct network
   * @param chainId The required chain ID
   * @returns A promise that resolves to true if connected to the correct network
   */
  const ensureCorrectNetwork = useCallback(async (chainId: number = liskSepolia.id): Promise<boolean> => {
    try {
      if (!checkCorrectNetwork(chainId)) {
        return await switchToNetwork(chainId);
      }
      return true;
    } catch (error) {
      console.error('Error ensuring correct network:', error);
      return false;
    }
  }, [checkCorrectNetwork, switchToNetwork]);

  /**
   * Format an address for display
   * @param address The address to format
   * @returns The formatted address
   */
  const formatAddress = useCallback((address: string): string => {
    return WalletService.formatAddress(address);
  }, []);

  // Check if connected to the correct network when chain changes
  useEffect(() => {
    if (isConnected && chain) {
      checkCorrectNetwork();
    }
  }, [isConnected, chain, checkCorrectNetwork]);

  return {
    isConnected,
    address,
    chain,
    isCorrectNetwork,
    isSwitchingNetwork,
    checkCorrectNetwork,
    switchToNetwork,
    ensureCorrectNetwork,
    formatAddress,
  };
}

export default useWalletIntegration;
