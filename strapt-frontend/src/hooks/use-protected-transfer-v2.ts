import { useState, useCallback, useMemo, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatUnits, keccak256, toBytes, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import ProtectedTransferV2ABI from '@/contracts/ProtectedTransferV2.json';
import contractConfig from '@/contracts/contract-config.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';

// Contract addresses
const PROTECTED_TRANSFER_V2_ADDRESS = contractConfig.ProtectedTransferV2.address as `0x${string}`;
const USDC_ADDRESS = contractConfig.ProtectedTransferV2.supportedTokens.USDC as `0x${string}`;
const IDRX_ADDRESS = contractConfig.ProtectedTransferV2.supportedTokens.IDRX as `0x${string}`;

// Token decimals
const USDC_DECIMALS = 6;
const IDRX_DECIMALS = 2;

// Token types
export type TokenType = 'USDC' | 'IDRX';

// Transfer status enum
export enum TransferStatus {
  Pending = 0,
  Claimed = 1,
  Refunded = 2,
  Expired = 3
}

// Transfer type
export interface Transfer {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;       // Net amount after fee
  grossAmount: string;  // Original amount before fee
  expiry: number;
  status: TransferStatus;
  createdAt: number;
  isLinkTransfer: boolean;
  hasPassword: boolean;
}

export function useProtectedTransferV2() {
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
        args: [ownerAddress, PROTECTED_TRANSFER_V2_ADDRESS],
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

  // Create a direct transfer
  const createDirectTransfer = async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    withPassword: boolean = true,
    customPassword: string | null = null,
  ) => {
    try {
      setIsLoading(true);

      // Use custom password if provided and password protection is enabled, otherwise generate a random one
      const claimCode = withPassword ? (customPassword || generateClaimCode()) : '';
      const claimCodeHash = withPassword ? hashClaimCode(claimCode) : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number (24 hours from now by default)
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp)
        ? expiryTimestamp
        : Math.floor(Date.now() / 1000) + 86400;

      console.log('Transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

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
        hasPassword: withPassword,
        claimCodeHash,
        account: account.address
      });

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        abi: ProtectedTransferV2ABI.abi,
        address: PROTECTED_TRANSFER_V2_ADDRESS,
        functionName: 'createDirectTransfer',
        args: [
          recipient,
          tokenAddress,
          parsedAmount,
          BigInt(validExpiryTimestamp),
          withPassword,
          claimCodeHash
        ],
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
            // Check if this log is from our contract
            if (log.address.toLowerCase() === PROTECTED_TRANSFER_V2_ADDRESS.toLowerCase()) {
              // The TransferCreated event signature
              const transferCreatedSignature = '0x5a17d6f61b0f9c9df5e311e12f0d52ea0b0c4d8cb3b761b23ac1bae23a7b0b80';

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
        if (!transferId && receipt.logs.length > 0) {
          // Try to find any log from our contract
          const contractLogs = receipt.logs.filter(
            (log: { address: string; topics: string[] }) =>
              log.address.toLowerCase() === PROTECTED_TRANSFER_V2_ADDRESS.toLowerCase()
          );

          if (contractLogs.length > 0 && contractLogs[0].topics.length > 1) {
            transferId = contractLogs[0].topics[1] as `0x${string}`;
            console.log('Using first topic as transfer ID:', transferId);
          }
        }
      }

      // Set the current transfer ID
      if (transferId) {
        setCurrentTransferId(transferId);
      }

      // Return claim code and transfer ID
      return {
        claimCode: withPassword ? claimCode : '',
        transferId: transferId || null,
        withPassword
      };
    } catch (error) {
      console.error('Error creating direct transfer:', error);
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
    withPassword: boolean = false,
    customPassword: string | null = null,
  ) => {
    try {
      setIsLoading(true);

      // Use custom password if provided and password protection is enabled, otherwise use empty string
      const claimCode = withPassword ? (customPassword || generateClaimCode()) : '';
      const claimCodeHash = withPassword ? hashClaimCode(claimCode) : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number (24 hours from now by default)
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp)
        ? expiryTimestamp
        : Math.floor(Date.now() / 1000) + 86400;

      console.log('Link transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
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

      // Log the arguments for debugging
      console.log('Preparing link transfer with args:', {
        tokenAddress,
        parsedAmount: parsedAmount.toString(),
        expiryTimestamp: validExpiryTimestamp,
        hasPassword: withPassword,
        claimCodeHash,
        account: account.address
      });

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        abi: ProtectedTransferV2ABI.abi,
        address: PROTECTED_TRANSFER_V2_ADDRESS,
        functionName: 'createLinkTransfer',
        args: [
          tokenAddress,
          parsedAmount,
          BigInt(validExpiryTimestamp),
          withPassword,
          claimCodeHash
        ],
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
            // Check if this log is from our contract
            if (log.address.toLowerCase() === PROTECTED_TRANSFER_V2_ADDRESS.toLowerCase()) {
              // The TransferCreated event signature
              const transferCreatedSignature = '0x5a17d6f61b0f9c9df5e311e12f0d52ea0b0c4d8cb3b761b23ac1bae23a7b0b80';

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
        if (!transferId && receipt.logs.length > 0) {
          // Try to find any log from our contract
          const contractLogs = receipt.logs.filter(
            (log: { address: string; topics: string[] }) =>
              log.address.toLowerCase() === PROTECTED_TRANSFER_V2_ADDRESS.toLowerCase()
          );

          if (contractLogs.length > 0 && contractLogs[0].topics.length > 1) {
            transferId = contractLogs[0].topics[1] as `0x${string}`;
            console.log('Using first topic as transfer ID:', transferId);
          }
        }
      }

      // Set the current transfer ID
      if (transferId) {
        setCurrentTransferId(transferId);
      }

      // Return claim code and transfer ID
      return {
        claimCode: withPassword ? claimCode : '',
        transferId: transferId || null,
        withPassword
      };
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
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      console.log('Claiming transfer with ID:', transferId, 'and claim code:', claimCode);

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferV2ABI.abi,
          address: PROTECTED_TRANSFER_V2_ADDRESS,
          functionName: 'claimTransfer',
          args: [transferId as `0x${string}`, claimCode],
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

        return true;
      } catch (error) {
        console.error('Error in claim transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to claim transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error claiming transfer:', error);
      toast.error('Failed to claim transfer');
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
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      console.log('Refunding transfer with ID:', transferId);

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferV2ABI.abi,
          address: PROTECTED_TRANSFER_V2_ADDRESS,
          functionName: 'refundTransfer',
          args: [transferId as `0x${string}`],
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

        return true;
      } catch (error) {
        console.error('Error in refund transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to refund transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error refunding transfer:', error);
      toast.error('Failed to refund transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a transfer is password protected
  const isPasswordProtected = async (transferId: string): Promise<boolean> => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');

      console.log('Checking if transfer is password protected:', transferId);

      // Get the transfer details to check if it has password protection
      const transferDetails = await getTransferDetails(transferId);

      if (!transferDetails) {
        console.error('Transfer not found');
        return false;
      }

      console.log('Transfer details for password check:', transferDetails);

      // In ProtectedTransferV2, we can directly check if the transfer has password protection
      return transferDetails.hasPassword;
    } catch (error) {
      console.error('Error checking if transfer is password protected:', error);
      // Default to requiring a password to be safe
      return true;
    }
  };

  // Get transfer details
  const getTransferDetails = async (transferId: string): Promise<Transfer | null> => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');

      console.log('Getting transfer details for ID:', transferId);

      try {
        // Read transfer data from the contract
        const data = await readContract(config, {
          abi: ProtectedTransferV2ABI.abi,
          address: PROTECTED_TRANSFER_V2_ADDRESS,
          functionName: 'getTransfer',
          args: [transferId as `0x${string}`],
        });

        if (!data) return null;

        // Log the data for debugging
        console.log('Raw transfer data:', data);

        // Handle the data as an array without strict typing
        const dataArray = data as unknown[];

        if (!Array.isArray(dataArray) || dataArray.length < 10) {
          console.error('Invalid data format:', dataArray);
          return null;
        }

        // Extract values manually
        const sender = dataArray[0] as string;
        const recipient = dataArray[1] as string;
        const tokenAddress = dataArray[2] as string;
        const amount = dataArray[3] as bigint;
        const grossAmount = dataArray[4] as bigint;
        const expiry = dataArray[5] as bigint;
        const status = dataArray[6]; // Don't cast this yet
        const createdAt = dataArray[7] as bigint;
        const isLinkTransfer = dataArray[8]; // Don't cast this yet
        const hasPassword = dataArray[9]; // Don't cast this yet

        // Determine token symbol based on token address
        let tokenSymbol = 'Unknown';
        if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          tokenSymbol = 'USDC';
        } else if (tokenAddress.toLowerCase() === IDRX_ADDRESS.toLowerCase()) {
          tokenSymbol = 'IDRX';
        }

        // Format amount based on token
        const decimals = tokenSymbol === 'USDC' ? USDC_DECIMALS : IDRX_DECIMALS;
        const formattedAmount = formatUnits(amount, decimals);
        const formattedGrossAmount = formatUnits(grossAmount, decimals);

        // Convert status to number safely
        const statusNumber = typeof status === 'bigint' ? Number(status) :
                            typeof status === 'number' ? status : 0;

        // Convert isLinkTransfer to boolean safely
        const isLinkTransferBool = isLinkTransfer === true || isLinkTransfer === 1 || isLinkTransfer === 1n;

        // Convert hasPassword to boolean safely
        const hasPasswordBool = hasPassword === true || hasPassword === 1 || hasPassword === 1n;

        return {
          sender,
          recipient,
          tokenAddress,
          tokenSymbol,
          amount: formattedAmount,
          grossAmount: formattedGrossAmount,
          expiry: Number(expiry),
          status: statusNumber,
          createdAt: Number(createdAt),
          isLinkTransfer: isLinkTransferBool,
          hasPassword: hasPasswordBool,
          id: transferId
        };
      } catch (error) {
        console.error('Error with contract call:', error);
        return null;
      }
    } catch (error) {
      console.error('Error getting transfer details:', error);
      return null;
    }
  };

  // Check if a transfer is claimable
  const isTransferClaimable = async (transferId: string): Promise<boolean> => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');

      console.log('Checking if transfer is claimable:', transferId);

      const isClaimable = await readContract(config, {
        abi: ProtectedTransferV2ABI.abi,
        address: PROTECTED_TRANSFER_V2_ADDRESS,
        functionName: 'isTransferClaimable',
        args: [transferId as `0x${string}`],
      });

      console.log('Transfer claimable status:', isClaimable);

      return !!isClaimable;
    } catch (error) {
      console.error('Error checking if transfer is claimable:', error);
      return false;
    }
  };

  // Get recipient transfers
  const getRecipientTransfers = async (recipientAddress: string): Promise<string[]> => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');

      console.log('Getting transfers for recipient:', recipientAddress);

      const transfers = await readContract(config, {
        abi: ProtectedTransferV2ABI.abi,
        address: PROTECTED_TRANSFER_V2_ADDRESS,
        functionName: 'getRecipientTransfers',
        args: [recipientAddress as `0x${string}`],
      });

      console.log('Recipient transfers:', transfers);

      return transfers as string[];
    } catch (error) {
      console.error('Error getting recipient transfers:', error);
      return [];
    }
  };

  // Return all the functions and values
  return {
    isLoading: isLoading || isPending || isConfirming,
    isConfirmed,
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
    getTokenAddress,
    getTokenDecimals,
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  };
}