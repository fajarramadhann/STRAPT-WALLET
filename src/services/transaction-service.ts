import { 
  readContract, 
  writeContract, 
  simulateContract, 
  waitForTransactionReceipt,
  getAccount
} from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import { toast } from 'sonner';
import { parseUnits, formatUnits } from 'viem';
import WalletService from './wallet-service';
import contractConfig from '@/contracts/contract-config.json';

// Define types for contract interaction
export interface ContractCallOptions {
  contractName: string;
  functionName: string;
  args: any[];
  value?: bigint;
}

export interface ContractReadOptions extends ContractCallOptions {
  enabled?: boolean;
}

/**
 * Service for handling blockchain transactions
 */
export const TransactionService = {
  /**
   * Get the ABI for a contract
   * @param contractName The name of the contract
   * @returns The contract ABI
   */
  async getContractABI(contractName: string): Promise<any> {
    try {
      // Dynamic import to avoid bundling all ABIs
      const module = await import(`@/contracts/${contractName}.json`);
      return module.abi || module.default.abi;
    } catch (error) {
      console.error(`Error loading ABI for ${contractName}:`, error);
      throw new Error(`Failed to load ABI for ${contractName}`);
    }
  },

  /**
   * Get the address for a contract
   * @param contractName The name of the contract
   * @returns The contract address
   */
  getContractAddress(contractName: string): `0x${string}` {
    const address = contractConfig[contractName]?.address;
    if (!address) {
      throw new Error(`Contract address not found for ${contractName}`);
    }
    return address as `0x${string}`;
  },

  /**
   * Read data from a contract
   * @param options Contract read options
   * @returns Promise with the read result
   */
  async readFromContract<T>(options: ContractReadOptions): Promise<T | null> {
    try {
      const { contractName, functionName, args, enabled = true } = options;
      
      if (!enabled) {
        return null;
      }
      
      const contractAddress = this.getContractAddress(contractName);
      const contractABI = await this.getContractABI(contractName);
      
      const result = await readContract(config, {
        address: contractAddress,
        abi: contractABI,
        functionName,
        args,
      }) as T;
      
      return result;
    } catch (error) {
      console.error(`Error reading from ${options.contractName}:`, error);
      return null;
    }
  },

  /**
   * Write data to a contract
   * @param options Contract call options
   * @returns Promise with the transaction hash
   */
  async writeToContract(options: ContractCallOptions): Promise<`0x${string}`> {
    try {
      const { contractName, functionName, args, value } = options;
      
      // Ensure wallet is connected
      const account = WalletService.getCurrentAccount();
      if (!account) {
        throw new Error('No wallet connected');
      }
      
      const contractAddress = this.getContractAddress(contractName);
      const contractABI = await this.getContractABI(contractName);
      
      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: contractAddress,
        abi: contractABI,
        functionName,
        args,
        account: account.address,
        value,
      });
      
      // Send the transaction
      const hash = await writeContract(config, request);
      
      // Show pending toast
      toast.info('Transaction submitted', {
        description: 'Please wait for confirmation...',
        id: hash,
      });
      
      return hash;
    } catch (error) {
      console.error(`Error writing to ${options.contractName}:`, error);
      
      // Handle specific error messages
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          toast.error('Transaction rejected', {
            description: 'You rejected the transaction'
          });
        } else {
          toast.error('Transaction failed', {
            description: error.message
          });
        }
      }
      
      throw error;
    }
  },

  /**
   * Wait for a transaction to be confirmed
   * @param hash The transaction hash
   * @returns Promise with the transaction receipt
   */
  async waitForTransaction(hash: `0x${string}`) {
    try {
      const receipt = await waitForTransactionReceipt(config, { hash });
      
      // Update toast to show success
      toast.success('Transaction confirmed', {
        description: 'Your transaction has been confirmed',
        id: hash,
      });
      
      return receipt;
    } catch (error) {
      console.error('Error waiting for transaction:', error);
      
      // Update toast to show error
      toast.error('Transaction failed', {
        description: 'Your transaction failed to confirm',
        id: hash,
      });
      
      throw error;
    }
  },

  /**
   * Parse token amount based on decimals
   * @param amount The amount as a string
   * @param decimals The number of decimals
   * @returns The parsed amount as a bigint
   */
  parseTokenAmount(amount: string, decimals: number): bigint {
    try {
      return parseUnits(amount, decimals);
    } catch (error) {
      console.error('Error parsing token amount:', error);
      throw new Error('Invalid amount format');
    }
  },

  /**
   * Format token amount based on decimals
   * @param amount The amount as a bigint
   * @param decimals The number of decimals
   * @returns The formatted amount as a string
   */
  formatTokenAmount(amount: bigint, decimals: number): string {
    try {
      return formatUnits(amount, decimals);
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  }
};

export default TransactionService;
