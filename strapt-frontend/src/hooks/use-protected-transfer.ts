import { useState, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatUnits, keccak256, toBytes, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import ProtectedTransferABI from '@/contracts/ProtectedTransfer.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';

// Contract addresses
const PROTECTED_TRANSFER_ADDRESS = ProtectedTransferABI.address as `0x${string}`;
const USDC_ADDRESS = USDCABI.address as `0x${string}`;
const IDRX_ADDRESS = IDRXABI.address as `0x${string}`;

// Token decimals
const USDC_DECIMALS = 6;
const IDRX_DECIMALS = 2;

// Token types
export type TokenType = 'USDC' | 'IDRX';

// Transfer status enum
export enum TransferStatus {
  Pending = 0,
  Claimed = 1,
  Refunded = 2
}

// Transfer type
export interface Transfer {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  expiry: number;
  status: TransferStatus;
  createdAt: number;
  isLinkTransfer: boolean;
}

export function useProtectedTransfer() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTransferId, setCurrentTransferId] = useState<string | null>(null);

  // Write contract hooks
  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Generate a random claim code
  const generateClaimCode = useCallback(() => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }, []);

  // Hash a claim code
  const hashClaimCode = useCallback((claimCode: string) => {
    return keccak256(toBytes(claimCode));
  }, []);

  // Get token address from token type
  const getTokenAddress = useCallback((tokenType: TokenType): `0x${string}` => {
    return tokenType === 'USDC' ? USDC_ADDRESS : IDRX_ADDRESS;
  }, []);

  // Get token decimals from token type
  const getTokenDecimals = useCallback((tokenType: TokenType): number => {
    return tokenType === 'USDC' ? USDC_DECIMALS : IDRX_DECIMALS;
  }, []);

  // Check token allowance
  const checkAllowance = async (
    tokenType: TokenType,
    amount: string,
    ownerAddress: string
  ): Promise<boolean> => {
    try {
      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Get token ABI
      const tokenABI = tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;

      // Import necessary functions
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');

      // Read allowance
      const allowance = await readContract(config, {
        abi: tokenABI,
        address: tokenAddress,
        functionName: 'allowance',
        args: [ownerAddress, PROTECTED_TRANSFER_ADDRESS],
      });

      console.log('Token allowance check:', {
        token: tokenType,
        allowance: allowance.toString(),
        required: parsedAmount.toString(),
        sufficient: BigInt(allowance) >= BigInt(parsedAmount)
      });

      // Return true if allowance is sufficient
      return BigInt(allowance) >= BigInt(parsedAmount);
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  // Create a transfer with claim code
  const createTransfer = async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    customPassword: string | null = null,
  ) => {
    try {
      setIsLoading(true);

      // Use custom password if provided, otherwise generate a random one
      const claimCode = customPassword || generateClaimCode();
      const claimCodeHash = hashClaimCode(claimCode);

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp) ? expiryTimestamp : Math.floor(Date.now() / 1000) + 86400;
      console.log('Transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Skip token approval - it's already done in the TransferContext

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      // Log the arguments for debugging
      console.log('Preparing direct transfer with args:', {
        recipient,
        tokenAddress,
        parsedAmount: parsedAmount.toString(),
        expiryTimestamp: validExpiryTimestamp,
        claimCodeHash,
        account: account.address
      });

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        abi: ProtectedTransferABI.abi,
        address: PROTECTED_TRANSFER_ADDRESS,
        functionName: 'createTransfer',
        args: [recipient, tokenAddress, parsedAmount, BigInt(validExpiryTimestamp), claimCodeHash],
        account: account.address,
      });

      // Send the transaction - this will prompt the user to sign
      console.log('Sending transaction request:', request);
      const hash = await writeContractAction(config, request);
      console.log('Transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      console.log('Waiting for transaction receipt with hash:', hash);
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Transaction receipt received:', receipt);

      // Extract transfer ID from event logs
      let transferId = '';
      if (receipt?.logs) {
        console.log('Transaction logs:', receipt.logs);

        // Find the TransferCreated event and extract the transfer ID
        for (const log of receipt.logs) {
          try {
            console.log('Checking log:', log);
            console.log('Log topics:', log.topics);

            // The TransferCreated event signature
            // keccak256("TransferCreated(bytes32,address,address,address,uint256,uint256)")
            const transferCreatedSignature = '0xc01e8d8af68c8ec1e9a9ca9c29f9b4c5f8f8e26aec7917a8dbcbf812bcd7d2c3';

            // Check if this log is from our contract
            if (log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()) {
              console.log('Found log from our contract');

              // Check if this is the TransferCreated event
              if (log.topics[0] === transferCreatedSignature) {
                console.log('Found TransferCreated event');
                transferId = log.topics[1] as `0x${string}`;
                console.log('Extracted transfer ID:', transferId);
                break;
              }
            }
          } catch (e) {
            console.error('Error parsing log:', e);
          }
        }

        // If we still don't have a transfer ID, try a different approach
        if (!transferId) {
          console.log('Transfer ID not found in topics, trying to decode logs...');

          // Try to find any log from our contract
          const contractLogs = receipt.logs.filter(
            (log: any) => log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()
          );

          if (contractLogs.length > 0) {
            console.log('Found logs from our contract:', contractLogs);

            // Just use the first log's first topic as the transfer ID if available
            if (contractLogs[0].topics.length > 1) {
              transferId = contractLogs[0].topics[1] as `0x${string}`;
              console.log('Using first topic as transfer ID:', transferId);
            }
            // If we still don't have a transfer ID, generate one from the transaction hash
            else if (hash) {
              // Use the transaction hash as a seed to generate a transfer ID
              transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
              console.log('Generated transfer ID from transaction hash:', transferId);
            }
          }
          // If we still don't have a transfer ID and we have a transaction hash, generate one from it
          else if (hash) {
            // Use the transaction hash as a seed to generate a transfer ID
            transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
            console.log('Generated transfer ID from transaction hash (no logs):', transferId);
          }
        }
      }

      // Set the current transfer ID
      if (transferId) {
        setCurrentTransferId(transferId);
      }

      // Return claim code and transfer ID
      return { claimCode, transferId: transferId || currentTransferId };
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error('Failed to create transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a link transfer
  const createLinkTransfer = async (
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
  ) => {
    try {
      setIsLoading(true);

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp) ? expiryTimestamp : Math.floor(Date.now() / 1000) + 86400;
      console.log('Link transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');

      // Get account information
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      // Check if token is approved
      const isAllowanceSufficient = await checkAllowance(tokenType, amount, account.address);

      if (!isAllowanceSufficient) {
        console.error("Insufficient token allowance");
        throw new Error("Insufficient token allowance. Please approve the token first.");
      }

      // Prepare the transaction
      try {
        // Log the arguments for debugging
        console.log('Preparing link transfer with args:', {
          tokenAddress,
          parsedAmount: parsedAmount.toString(),
          expiryTimestamp: validExpiryTimestamp,
          account: account.address
        });

        // Import necessary functions from wagmi
        const { simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');

        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'createLinkTransfer',
          args: [tokenAddress, parsedAmount, BigInt(validExpiryTimestamp)],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        // Extract transfer ID from event logs
        let transferId = '';
        if (receipt?.logs) {
          console.log('Transaction logs:', receipt.logs);

          // Find the TransferCreated event and extract the transfer ID
          for (const log of receipt.logs) {
            try {
              console.log('Checking log:', log);
              console.log('Log topics:', log.topics);

              // The TransferCreated event signature
              // keccak256("TransferCreated(bytes32,address,address,address,uint256,uint256)")
              const transferCreatedSignature = '0xc01e8d8af68c8ec1e9a9ca9c29f9b4c5f8f8e26aec7917a8dbcbf812bcd7d2c3';

              // Check if this log is from our contract
              if (log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()) {
                console.log('Found log from our contract');

                // Check if this is the TransferCreated event
                if (log.topics[0] === transferCreatedSignature) {
                  console.log('Found TransferCreated event');
                  transferId = log.topics[1] as `0x${string}`;
                  console.log('Extracted transfer ID:', transferId);
                  break;
                }
              }
            } catch (e) {
              console.error('Error parsing log:', e);
            }
          }

          // If we still don't have a transfer ID, try a different approach
          if (!transferId) {
            console.log('Transfer ID not found in topics, trying to decode logs...');

            // Try to find any log from our contract
            const contractLogs = receipt.logs.filter(
              log => log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()
            );

            if (contractLogs.length > 0) {
              console.log('Found logs from our contract:', contractLogs);

              // Just use the first log's first topic as the transfer ID if available
              if (contractLogs[0].topics.length > 1) {
                transferId = contractLogs[0].topics[1] as `0x${string}`;
                console.log('Using first topic as transfer ID:', transferId);
              }
              // If we still don't have a transfer ID, generate one from the transaction hash
              else if (hash) {
                // Use the transaction hash as a seed to generate a transfer ID
                transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
                console.log('Generated transfer ID from transaction hash:', transferId);
              }
            }
            // If we still don't have a transfer ID and we have a transaction hash, generate one from it
            else if (hash) {
              // Use the transaction hash as a seed to generate a transfer ID
              transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
              console.log('Generated transfer ID from transaction hash (no logs):', transferId);
            }
          }
        }

        // Set the current transfer ID
        if (transferId) {
          setCurrentTransferId(transferId);
        }

        // Return transfer ID
        return { transferId: transferId || currentTransferId };
      } catch (error) {
        console.error('Error in link transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to create link transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error creating link transfer:', error);
      toast.error('Failed to create link transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Claim a transfer with claim code
  const claimTransfer = async (
    transferId: string,
    claimCode: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account.address) {
        throw new Error("No wallet connected");
      }

      // Claim transfer
      const hash = await writeContract(config, {
        abi: ProtectedTransferABI.abi,
        address: PROTECTED_TRANSFER_ADDRESS,
        functionName: 'claimTransfer',
        args: [transferId as `0x${string}`, claimCode],
        account: account.address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      await waitForTransactionReceipt(config, { hash });

      return true;
    } catch (error) {
      console.error('Error claiming transfer:', error);
      toast.error('Failed to claim transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Claim a link transfer
  const claimLinkTransfer = async (
    transferId: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account.address) {
        throw new Error("No wallet connected");
      }

      // Claim link transfer
      const hash = await writeContract(config, {
        abi: ProtectedTransferABI.abi,
        address: PROTECTED_TRANSFER_ADDRESS,
        functionName: 'claimLinkTransfer',
        args: [transferId as `0x${string}`],
        account: account.address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      await waitForTransactionReceipt(config, { hash });

      return true;
    } catch (error) {
      console.error('Error claiming link transfer:', error);
      toast.error('Failed to claim link transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Refund a transfer
  const refundTransfer = async (
    transferId: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account.address) {
        throw new Error("No wallet connected");
      }

      // Refund transfer
      const hash = await writeContract(config, {
        abi: ProtectedTransferABI.abi,
        address: PROTECTED_TRANSFER_ADDRESS,
        functionName: 'refundTransfer',
        args: [transferId as `0x${string}`],
        account: account.address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      await waitForTransactionReceipt(config, { hash });

      return true;
    } catch (error) {
      console.error('Error refunding transfer:', error);
      toast.error('Failed to refund transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get transfer details
  const useTransferDetails = (transferId: string | null) => {
    return useReadContract({
      abi: ProtectedTransferABI.abi,
      address: PROTECTED_TRANSFER_ADDRESS,
      functionName: 'getTransfer',
      args: transferId ? [transferId as `0x${string}`] : undefined,
      query: {
        enabled: !!transferId,
      }
    });
  };

  // Check if a transfer is claimable
  const useIsTransferClaimable = (transferId: string | null) => {
    return useReadContract({
      abi: ProtectedTransferABI.abi,
      address: PROTECTED_TRANSFER_ADDRESS,
      functionName: 'isTransferClaimable',
      args: transferId ? [transferId as `0x${string}`] : undefined,
      query: {
        enabled: !!transferId,
      }
    });
  };

  return {
    isLoading: isLoading || isPending || isConfirming,
    isConfirmed,
    createTransfer,
    createLinkTransfer,
    claimTransfer,
    claimLinkTransfer,
    refundTransfer,
    useTransferDetails,
    useIsTransferClaimable,
    generateClaimCode,
    hashClaimCode,
    getTokenAddress,
    getTokenDecimals,
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  };
}
