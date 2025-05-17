import { getAccount, getNetwork, switchNetwork } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import { liskSepolia, baseSepolia } from 'viem/chains';
import { toast } from 'sonner';

/**
 * Service for wallet-related functionality
 */
export const WalletService = {
  /**
   * Get the current connected account
   * @returns The connected account or null if not connected
   */
  getCurrentAccount() {
    try {
      const account = getAccount(config);
      return account.isConnected ? account : null;
    } catch (error) {
      console.error('Error getting current account:', error);
      return null;
    }
  },

  /**
   * Get the current network
   * @returns The current network or null if not available
   */
  getCurrentNetwork() {
    try {
      const network = getNetwork(config);
      return network.chain;
    } catch (error) {
      console.error('Error getting current network:', error);
      return null;
    }
  },

  /**
   * Check if the wallet is connected to the correct network
   * @param requiredChainId The required chain ID
   * @returns True if connected to the correct network, false otherwise
   */
  isCorrectNetwork(requiredChainId: number = liskSepolia.id) {
    const network = this.getCurrentNetwork();
    return network?.id === requiredChainId;
  },

  /**
   * Switch to the specified network
   * @param chainId The chain ID to switch to
   * @returns A promise that resolves when the switch is complete
   */
  async switchToNetwork(chainId: number = liskSepolia.id) {
    try {
      const account = this.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }

      const result = await switchNetwork(config, { chainId });
      return result;
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
      
      throw error;
    }
  },

  /**
   * Ensure the wallet is connected to the correct network
   * @param chainId The required chain ID
   * @returns A promise that resolves to true if connected to the correct network
   */
  async ensureCorrectNetwork(chainId: number = liskSepolia.id): Promise<boolean> {
    try {
      if (!this.isCorrectNetwork(chainId)) {
        const chainName = chainId === liskSepolia.id ? 'Lisk Sepolia' : 
                          chainId === baseSepolia.id ? 'Base Sepolia' : 
                          `Chain ID ${chainId}`;
        
        toast.info(`Switching to ${chainName}...`);
        await this.switchToNetwork(chainId);
        
        // Verify the switch was successful
        return this.isCorrectNetwork(chainId);
      }
      return true;
    } catch (error) {
      console.error('Error ensuring correct network:', error);
      return false;
    }
  },

  /**
   * Format an address for display
   * @param address The address to format
   * @returns The formatted address
   */
  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
};

export default WalletService;
