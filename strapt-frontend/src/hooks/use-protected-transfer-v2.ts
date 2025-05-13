import { formatUnits } from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';
import ProtectedTransferV2ABI from '@/contracts/ProtectedTransferV2.json';
import { TokenType, useTokenUtils } from './useTokenUtils';
import { useTransactionState } from './useTransactionState';
import { useErrorHandler } from './useErrorHandler';
import { useClaimCodeUtils } from './useClaimCodeUtils';
import { useContractUtils } from './useContractUtils';

// Re-export TokenType for use in other components
export type { TokenType };

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
  // Use our utility hooks
  const {
    getTokenAddress,
    parseTokenAmount,
    formatTokenAmount,
    getTokenABI,
    USDC_ADDRESS,
    IDRX_ADDRESS
  } = useTokenUtils();

  const {
    isLoading,
    setIsLoading,
    isConfirmed,
    isPending,
    isConfirming,
    setCurrentId: setCurrentTransferId
  } = useTransactionState();

  const { handleError } = useErrorHandler();
  const { generateClaimCode, hashClaimCode } = useClaimCodeUtils();
  const { getContractAddress, getExpiryTimestamp } = useContractUtils();

  // Get the contract address
  const PROTECTED_TRANSFER_V2_ADDRESS = getContractAddress('ProtectedTransferV2');

  // Check token allowance
  const checkAllowance = async (
    tokenType: TokenType,
    amount: string,
    ownerAddress: string
  ): Promise<boolean> => {
    try {
      // Get token address and parse amount
      const tokenAddress = getTokenAddress(tokenType);
      const parsedAmount = parseTokenAmount(amount, tokenType);
      const tokenABI = getTokenABI(tokenType);

      // Import necessary functions
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');

      // Read allowance
      const allowance = await readContract(config, {
        abi: tokenABI,
        address: tokenAddress,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, PROTECTED_TRANSFER_V2_ADDRESS],
      });

      const allowanceBigInt = BigInt(allowance as string || '0');

      console.log('Token allowance check:', {
        token: tokenType,
        allowance: allowanceBigInt.toString(),
        required: parsedAmount.toString(),
        sufficient: allowanceBigInt >= parsedAmount
      });

      // Return true if allowance is sufficient
      return allowanceBigInt >= parsedAmount;
    } catch (error) {
      handleError(error, 'Error checking token allowance');
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

      // Get token address and parse amount
      const tokenAddress = getTokenAddress(tokenType);
      const parsedAmount = parseTokenAmount(amount, tokenType);

      // Ensure expiryTimestamp is valid (at least 1 hour in the future)
      const minExpiryTime = Math.floor(Date.now() / 1000) + 3600; // Current time + 1 hour
      const validExpiryTimestamp = expiryTimestamp > minExpiryTime ? expiryTimestamp : getExpiryTimestamp(24);

      console.log('Transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Get the account
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');
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
              const transferCreatedSignature = '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0';

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
      handleError(error, 'Failed to create transfer');
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

      // Get token address and parse amount
      const tokenAddress = getTokenAddress(tokenType);
      const parsedAmount = parseTokenAmount(amount, tokenType);

      // Ensure expiryTimestamp is valid (at least 1 hour in the future)
      const minExpiryTime = Math.floor(Date.now() / 1000) + 3600; // Current time + 1 hour
      const validExpiryTimestamp = expiryTimestamp > minExpiryTime ? expiryTimestamp : getExpiryTimestamp(24);

      console.log('Link transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Get the account
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');
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
              const transferCreatedSignature = '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0';

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
      handleError(error, 'Failed to create link transfer');
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
        throw error;
      }
    } catch (error) {
      handleError(error, 'Failed to claim transfer');
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
        throw error;
      }
    } catch (error) {
      handleError(error, 'Failed to refund transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a transfer is password protected
  const isPasswordProtected = async (transferId: string): Promise<boolean> => {
    try {
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
      handleError(error, 'Error checking if transfer is password protected');
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
        let tokenType: TokenType | null = null;

        if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          tokenSymbol = 'USDC';
          tokenType = 'USDC';
        } else if (tokenAddress.toLowerCase() === IDRX_ADDRESS.toLowerCase()) {
          tokenSymbol = 'IDRX';
          tokenType = 'IDRX';
        }

        // Format amount based on token type
        let formattedAmount = '0';
        let formattedGrossAmount = '0';

        if (tokenType) {
          formattedAmount = formatTokenAmount(amount, tokenType);
          formattedGrossAmount = formatTokenAmount(grossAmount, tokenType);
        } else {
          // Fallback to default formatting if token type is unknown
          formattedAmount = formatUnits(amount, 18);
          formattedGrossAmount = formatUnits(grossAmount, 18);
        }

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
        handleError(error, 'Error getting transfer details');
        return null;
      }
    } catch (error) {
      handleError(error, 'Error getting transfer details');
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
      handleError(error, 'Error checking if transfer is claimable');
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
      handleError(error, 'Error getting recipient transfers');
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
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  };
}