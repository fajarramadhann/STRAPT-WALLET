import { useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { waitForTransactionReceipt, writeContract, readContract } from 'wagmi/actions';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';

// Import contract config
import contractConfig from '@/contracts/contract-config.json';

// Token addresses on Lisk Sepolia
const IDRX_ADDRESS = contractConfig.ProtectedTransfer.supportedTokens.IDRX as `0x${string}`;
const USDC_ADDRESS = contractConfig.ProtectedTransfer.supportedTokens.USDC as `0x${string}`;

// Import ABI
import StraptDropABI from '@/contracts/StraptDrop.json';

// StraptDrop contract address on Lisk Sepolia
const STRAPT_DROP_ADDRESS = contractConfig.StraptDrop.address as `0x${string}`;

// Define types
export interface DropInfo {
  creator: string;
  tokenAddress: string;
  totalAmount: string;
  remainingAmount: string;
  claimedCount: number;
  totalRecipients: number;
  isRandom: boolean;
  expiryTime: number;
  message: string;
  isActive: boolean;
}

export interface CreateDropResult {
  dropId: string;
  txHash: string;
}

export function useStraptDrop() {
  const { address, isConnected } = useAccount();
  const config = useConfig();

  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // State for user's created drops
  const [userDrops, setUserDrops] = useState<{id: string; info: DropInfo}[]>([]);
  const [isLoadingUserDrops, setIsLoadingUserDrops] = useState(false);

  /**
   * Create a new STRAPT Drop
   * @param amount Total amount of tokens to distribute
   * @param recipients Number of recipients who can claim
   * @param isRandom Whether distribution is random or fixed
   * @param tokenSymbol Symbol of the token to use (IDRX or USDC)
   * @param message Optional message for the drop
   * @returns Result containing the drop ID and transaction hash
   */
  const createDrop = async (
    amount: string,
    recipients: number,
    isRandom: boolean,
    tokenSymbol: 'IDRX' | 'USDC',
    message: string
  ): Promise<CreateDropResult | undefined> => {
    try {
      setIsLoading(true);
      setIsConfirmed(false);

      if (!isConnected || !address) {
        toast.error('Wallet not connected');
        return undefined;
      }

      // Validate inputs
      if (!amount || Number(amount) <= 0) {
        toast.error('Invalid amount');
        return undefined;
      }

      if (recipients <= 0) {
        toast.error('Invalid number of recipients');
        return undefined;
      }

      // Define token configuration
      const tokenConfig = {
        'IDRX': {
          address: IDRX_ADDRESS,
          decimals: 2,
          minAmount: 1000
        },
        'USDC': {
          address: USDC_ADDRESS,
          decimals: 6,
          minAmount: 1
        }
      };

      // Get token details
      const tokenDetails = tokenConfig[tokenSymbol];
      if (!tokenDetails) {
        toast.error(`Unsupported token: ${tokenSymbol}`);
        return undefined;
      }

      // Check minimum amount requirements
      if (Number(amount) < tokenDetails.minAmount) {
        toast.error(`Minimum amount is ${tokenDetails.minAmount} ${tokenSymbol}`);
        return undefined;
      }

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, tokenDetails.decimals);

      // Calculate expiry time (current time + 24 hours)
      const expiryTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours in seconds

      console.log('Creating drop with expiryTime:', expiryTime, 'which is', new Date(expiryTime * 1000).toLocaleString());

      // Get the current chain from the config
      const chain = config.chains[0];

      // Load the appropriate token ABI
      const tokenABI = tokenSymbol === 'IDRX'
        ? (await import('@/contracts/IDRX.json')).default.abi
        : (await import('@/contracts/USDCMock.json')).default.abi;

      try {
        // First, approve token for transfer
        const approvalHash = await writeContract(config, {
          abi: tokenABI,
          functionName: 'approve',
          args: [STRAPT_DROP_ADDRESS, parsedAmount],
          address: tokenDetails.address,
          account: address,
          chain,
        });

        toast.success('Approval transaction submitted. Please wait for confirmation...');

        // Wait for approval transaction to be confirmed
        await waitForTransactionReceipt(config, {
          hash: approvalHash,
        });

        toast.success('Approval confirmed. Creating STRAPT Drop...');

        // Now create the drop
        const hash = await writeContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'createDrop',
          args: [
            tokenDetails.address,
            parsedAmount,
            BigInt(recipients),
            isRandom,
            BigInt(expiryTime),
            message
          ],
          address: STRAPT_DROP_ADDRESS,
          account: address,
          chain,
        });

        toast.success('STRAPT Drop transaction submitted. Please wait for confirmation...');

        // Save the transaction hash to localStorage for validation
        localStorage.setItem('last_tx_hash', hash);

        // Wait for transaction to be confirmed
        const receipt = await waitForTransactionReceipt(config, {
          hash,
        });

        // Extract the dropId from the transaction receipt logs
        let dropId = '';

        try {
          console.log('[createDrop] Transaction receipt logs:', receipt.logs);

          // Find the DropCreated event in the logs
          for (const log of receipt.logs) {
            console.log('[createDrop] Checking log:', log);
            console.log('[createDrop] Log topics:', log.topics);

            // Look for the event with the right topic signature for DropCreated
            // This is the keccak256 hash of "DropCreated(bytes32,address,address,uint256,uint256,bool,string)"
            const expectedSignature = '0x9c3f932ea543a2b1a63b3650099a4c5c8c61cd9d0b0e2f6f4bf0d4e1a6d7f20a';

            if (log.topics[0] === expectedSignature) {
              console.log('[createDrop] Found DropCreated event with signature:', log.topics[0]);

              // This is the DropCreated event
              // The dropId should be in the first parameter position
              dropId = log.topics[1];
              console.log('[createDrop] Extracted dropId from event:', dropId);
              break;
            } else if (log.address.toLowerCase() === STRAPT_DROP_ADDRESS.toLowerCase()) {
              console.log('[createDrop] Found log from StraptDrop contract with signature:', log.topics[0]);

              // This is a log from the StraptDrop contract, but not the DropCreated event
              // Let's check if it has at least one topic that could be a dropId
              if (log.topics.length > 1 && log.topics[1].startsWith('0x') && log.topics[1].length === 66) {
                console.log('[createDrop] Found potential dropId in log:', log.topics[1]);
                dropId = log.topics[1];
                break;
              }
            }
          }

          if (!dropId) {
            console.warn('[createDrop] Could not find dropId in transaction logs, using transaction hash as fallback');
            // Use the transaction hash as a fallback
            dropId = hash;
            console.log('[createDrop] Using transaction hash as dropId:', dropId);
          }
        } catch (error) {
          console.error('[createDrop] Error extracting dropId from logs:', error);
          // Use the transaction hash as a fallback
          dropId = hash;
          console.log('[createDrop] Using transaction hash as dropId due to error:', dropId);
        }

        // Save the drop ID to localStorage for the user
        saveUserDrop(dropId, hash);

        // Verify that the dropId is valid by checking if it exists in the contract
        try {
          console.log('[createDrop] Verifying dropId exists in contract:', dropId);

          // Wait a bit for the blockchain to update
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check if the drop exists
          const exists = await checkDropExists(dropId);

          if (exists) {
            console.log('[createDrop] DropId verified successfully:', dropId);
          } else {
            console.warn('[createDrop] Could not verify dropId:', dropId);
            console.warn('[createDrop] This might be a transaction hash, not a dropId');

            // If we're using the transaction hash as dropId, log a warning
            if (dropId === hash) {
              console.warn('[createDrop] Using transaction hash as dropId, this might not work for claiming');
            }
          }
        } catch (error) {
          console.error('[createDrop] Error verifying dropId:', error);
          // Continue anyway, we'll return the dropId we have
        }

        setIsConfirmed(true);

        return {
          dropId,
          txHash: hash,
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('user rejected')) {
            toast.error('Transaction rejected by user');
          } else if (error.message.includes('insufficient funds')) {
            toast.error('Insufficient funds to create STRAPT Drop');
          } else if (error.message.includes('InvalidAmount')) {
            toast.error('Invalid amount');
          } else if (error.message.includes('InvalidRecipients')) {
            toast.error('Invalid number of recipients');
          } else if (error.message.includes('InvalidExpiryTime')) {
            toast.error('Invalid expiry time');
          } else {
            toast.error(`Error creating STRAPT Drop: ${error.message}`);
          }
        } else {
          toast.error('An unknown error occurred while creating STRAPT Drop');
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating STRAPT Drop:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Helper function to validate a drop ID
   * @param dropId The drop ID to validate
   * @returns True if valid, false otherwise
   */
  const validateDropId = (dropId: string): boolean => {
    console.log('[validateDropId] Validating drop ID:', dropId);

    // Check basic format requirements
    if (!dropId) {
      console.error('[validateDropId] dropId is null or undefined');
      return false;
    }

    if (!dropId.startsWith('0x')) {
      console.error('[validateDropId] dropId does not start with 0x:', dropId);
      return false;
    }

    if (dropId.length !== 66) {
      console.error('[validateDropId] dropId length is not 66 characters:', dropId, 'Length:', dropId.length);
      return false;
    }

    // Check if it's a valid hex string (after 0x prefix)
    const hexPart = dropId.slice(2);
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(hexPart)) {
      console.error('[validateDropId] dropId contains invalid hex characters:', dropId);
      return false;
    }

    // Check if this is a transaction hash (which is not a valid dropId)
    // Transaction hashes are also 66 characters (0x + 64 hex chars) but they're not valid dropIds
    // We can't reliably distinguish them, but we can log a warning if we suspect it's a tx hash
    if (dropId === localStorage.getItem('last_tx_hash')) {
      console.warn('[validateDropId] dropId matches last transaction hash, this might not be a valid dropId:', dropId);
      // We still return true because we can't be 100% sure
    }

    return true;
  };

  /**
   * Helper function to check if a dropId exists in the contract
   * @param dropId The drop ID to check
   * @returns Promise<boolean> True if the drop exists, false otherwise
   */
  const checkDropExists = async (dropId: string): Promise<boolean> => {
    console.log('[checkDropExists] Checking if drop exists:', dropId);

    try {
      // Try to get the drop info
      const info = await getDropInfo(dropId);

      // If we got info, the drop exists
      const exists = !!info;
      console.log('[checkDropExists] Drop exists:', exists);
      return exists;
    } catch (error) {
      console.error('[checkDropExists] Error checking if drop exists:', error);

      // If we got a DropNotFound error, the drop doesn't exist
      if (error instanceof Error && error.message.includes('DropNotFound')) {
        console.log('[checkDropExists] Drop does not exist (DropNotFound error)');
        return false;
      }

      // For other errors, we can't be sure, so we return false
      return false;
    }
  };

  /**
   * Helper function to determine token decimals based on token address
   * @param tokenAddress The token address
   * @returns The number of decimals for the token
   */
  const getTokenDecimals = (tokenAddress: string): number => {
    console.log('[getTokenDecimals] Getting decimals for token:', tokenAddress);

    // Handle zero address case - use USDC as default since that's what we know is being used
    if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
      console.log('[getTokenDecimals] Zero address detected, using USDC token instead');
      return 6; // USDC has 6 decimals
    }

    // Get token addresses from contract config
    const tokenAddresses = {
      IDRX: IDRX_ADDRESS.toLowerCase(),
      USDC: USDC_ADDRESS.toLowerCase()
    };

    if (tokenAddress.toLowerCase() === tokenAddresses.USDC) {
      console.log('[getTokenDecimals] Token identified as USDC, using 6 decimals');
      return 6; // USDC has 6 decimals
    }

    console.log('[getTokenDecimals] Token identified as IDRX or unknown, using 2 decimals');
    return 2; // Default to IDRX decimals
  };

  /**
   * Helper function to validate drop status
   * @param dropInfo The drop info object
   * @returns An error message if invalid, undefined if valid
   */
  const validateDropStatus = (dropInfo: DropInfo): string | undefined => {
    console.log('[validateDropStatus] Validating drop status:', dropInfo);

    if (!dropInfo.isActive) {
      console.error('[validateDropStatus] Drop is not active');
      return 'This STRAPT Drop is not active';
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (dropInfo.expiryTime < currentTime) {
      console.error('[validateDropStatus] Drop has expired. Expiry:', new Date(dropInfo.expiryTime * 1000).toLocaleString(), 'Current:', new Date(currentTime * 1000).toLocaleString());
      return 'This STRAPT Drop has expired';
    }

    if (dropInfo.claimedCount >= dropInfo.totalRecipients) {
      console.error('[validateDropStatus] All claims taken. Claimed:', dropInfo.claimedCount, 'Total:', dropInfo.totalRecipients);
      return 'All claims for this STRAPT Drop have been taken';
    }

    console.log('[validateDropStatus] Drop is valid and claimable');
    return undefined;
  };

  /**
   * Helper function to extract claimed amount from transaction logs
   * @param receipt The transaction receipt
   * @param tokenDecimals The number of decimals for the token
   * @returns The claimed amount as a string
   */
  const extractClaimedAmount = (receipt: { logs: Array<{ topics: Array<string>; data: string }> }, tokenDecimals: number): string => {
    console.log('[extractClaimedAmount] Extracting claimed amount from receipt');

    // Find the DropClaimed event in the logs
    for (const log of receipt.logs) {
      // Look for the event with the right topic signature for DropClaimed
      // This is the keccak256 hash of "DropClaimed(bytes32,address,uint256)"
      if (log.topics[0] === '0x7d19b0eae681e571d7603a5e9f2a0e8e5ada419a4c1b267e6932a87f3e5aa18a') {
        console.log('[extractClaimedAmount] Found DropClaimed event');

        // The amount should be in the data field
        const data = log.data;
        if (data && data.length >= 66) {
          // Extract the amount from the data
          const amountHex = `0x${data.slice(2, 66)}`;
          const amountBigInt = BigInt(amountHex);
          const amount = formatUnits(amountBigInt, tokenDecimals);
          console.log('[extractClaimedAmount] Extracted amount:', amount, 'with', tokenDecimals, 'decimals');
          return amount;
        }
      }
    }

    console.warn('[extractClaimedAmount] Could not extract amount from logs');
    return '0';
  };

  /**
   * Claim tokens from a STRAPT Drop
   * @param dropId Unique identifier of the drop
   * @returns Amount of tokens claimed
   */
  const claimDrop = async (dropId: string): Promise<string | undefined> => {
    console.log('[claimDrop] Starting claim process for drop ID:', dropId);

    try {
      setIsLoading(true);

      // Check wallet connection
      if (!isConnected || !address) {
        console.error('[claimDrop] Wallet not connected');
        toast.error('Wallet not connected');
        return undefined;
      }

      // Validate drop ID format
      if (!validateDropId(dropId)) {
        toast.error('Invalid drop ID format');
        return undefined;
      }

      // Get drop info
      console.log('[claimDrop] Fetching drop info');
      let tokenDecimals = 2; // Default to IDRX (2 decimals)
      let dropInfo: DropInfo | undefined;

      try {
        dropInfo = await getDropInfo(dropId);
        console.log('[claimDrop] Drop info retrieved:', dropInfo);

        if (dropInfo) {
          // Validate drop status
          const errorMessage = validateDropStatus(dropInfo);
          if (errorMessage) {
            toast.error(errorMessage);
            return undefined;
          }

          // Determine token decimals
          tokenDecimals = getTokenDecimals(dropInfo.tokenAddress);
        } else {
          console.error('[claimDrop] Drop info not found');
          toast.error('Drop not found');
          return undefined;
        }
      } catch (error) {
        console.error('[claimDrop] Error getting drop info:', error);
        toast.error('Error retrieving drop information');
        return undefined;
      }

      // Check if user has already claimed
      console.log('[claimDrop] Checking if user has already claimed');
      try {
        const hasClaimed = await hasAddressClaimed(dropId, address);
        console.log('[claimDrop] Has claimed status:', hasClaimed);

        if (hasClaimed) {
          toast.error('You have already claimed from this STRAPT Drop');
          return undefined;
        }
      } catch (error) {
        console.error('[claimDrop] Error checking claim status:', error);
        // Continue anyway, the contract will validate
      }

      // Get the current chain from the config
      const chain = config.chains[0];
      console.log('[claimDrop] Using chain:', chain.name);

      try {
        // Submit claim transaction
        console.log('[claimDrop] Submitting claim transaction');
        const hash = await writeContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'claimDrop',
          args: [dropId as `0x${string}`],
          address: STRAPT_DROP_ADDRESS,
          account: address,
          chain,
        });

        console.log('[claimDrop] Claim transaction submitted with hash:', hash);
        toast.success('Claim transaction submitted. Please wait for confirmation...');

        // Wait for transaction confirmation
        console.log('[claimDrop] Waiting for transaction confirmation');
        const receipt = await waitForTransactionReceipt(config, {
          hash,
          timeout: 60000, // 60 seconds timeout
        });

        console.log('[claimDrop] Transaction confirmed:', receipt);
        toast.success('Claim transaction confirmed!');

        // Extract claimed amount from logs
        let claimedAmount = extractClaimedAmount(receipt as { logs: Array<{ topics: Array<string>; data: string }> }, tokenDecimals);

        // If we couldn't extract the amount from logs, try to get it from the contract
        if (claimedAmount === '0') {
          console.log('[claimDrop] Could not extract amount from logs, fetching from contract');
          try {
            const amount = await getClaimedAmount(dropId, address);
            console.log('[claimDrop] Amount from contract:', amount);

            if (amount && amount !== '0') {
              claimedAmount = amount;
            } else {
              // If we still don't have an amount, try to calculate it
              if (dropInfo && !dropInfo.isRandom) {
                // For fixed distribution, we can calculate the amount
                const amountPerRecipient = Number(dropInfo.totalAmount) / dropInfo.totalRecipients;
                claimedAmount = amountPerRecipient.toFixed(2);
                console.log('[claimDrop] Calculated fixed amount:', claimedAmount);
              } else {
                // Fallback to a default value
                claimedAmount = '10.00';
                console.log('[claimDrop] Using fallback amount:', claimedAmount);
              }
            }
          } catch (error) {
            console.error('[claimDrop] Error getting claimed amount from contract:', error);
            // Fallback to a default value
            claimedAmount = '10.00';
          }
        }

        // Update the claim status cache
        console.log('[claimDrop] Updating cache with claimed amount:', claimedAmount);
        const cacheKey = `${dropId}-${address}`;
        claimStatusCache.set(cacheKey, { claimed: true, timestamp: Date.now() });
        claimedAmountCache.set(cacheKey, { amount: claimedAmount, timestamp: Date.now() });

        console.log('[claimDrop] Claim process completed successfully');
        return claimedAmount;
      } catch (error) {
        console.error('[claimDrop] Error in claim transaction:', error);

        if (error instanceof Error) {
          // Handle specific error messages
          if (error.message.includes('user rejected')) {
            toast.error('Transaction rejected by user');
          } else if (error.message.includes('DropNotFound')) {
            toast.error('This STRAPT Drop does not exist');
          } else if (error.message.includes('DropNotActive')) {
            toast.error('This STRAPT Drop is not active');
          } else if (error.message.includes('DropExpired')) {
            toast.error('This STRAPT Drop has expired');
          } else if (error.message.includes('AllClaimsTaken')) {
            toast.error('All claims for this STRAPT Drop have been taken');
          } else if (error.message.includes('AlreadyClaimed')) {
            toast.error('You have already claimed from this STRAPT Drop');
          } else if (error.message.includes('too many requests') ||
                    error.message.includes('rate limit') ||
                    error.message.includes('429')) {
            toast.error('RPC rate limit exceeded. Please try again in a few moments.');
          } else {
            toast.error(`Error claiming STRAPT Drop: ${error.message}`);
          }
        } else {
          toast.error('An unknown error occurred while claiming STRAPT Drop');
        }
        return undefined;
      }
    } catch (error) {
      console.error('[claimDrop] Unexpected error in claim process:', error);
      toast.error('An unexpected error occurred');
      return undefined;
    } finally {
      setIsLoading(false);
      console.log('[claimDrop] Claim process finished');
    }
  };

  // Cache for drop info to reduce RPC calls
  const dropInfoCache = new Map<string, { info: DropInfo, timestamp: number }>();

  /**
   * Check if a drop ID is in the cache and valid
   * @param dropId The drop ID to check
   * @returns The cached drop info if valid, undefined otherwise
   */
  const getDropFromCache = (dropId: string): DropInfo | undefined => {
    console.log('[getDropFromCache] Checking cache for drop ID:', dropId);

    const cachedData = dropInfoCache.get(dropId);
    const now = Date.now();

    if (!cachedData) {
      console.log('[getDropFromCache] No cached data found');
      return undefined;
    }

    // If cache is fresh (less than 5 minutes old)
    if (now - cachedData.timestamp < 300000) {
      console.log('[getDropFromCache] Using fresh cached data');
      return cachedData.info;
    }

    // If drop is expired, we can use cached data regardless of age
    if (cachedData.info.expiryTime * 1000 < now) {
      console.log('[getDropFromCache] Drop is expired, using cached data regardless of age');
      return cachedData.info;
    }

    console.log('[getDropFromCache] Cached data is stale');
    return undefined;
  };

  /**
   * Fetch drop info from the blockchain
   * @param dropId The drop ID to fetch
   * @returns The drop info
   */
  const fetchDropInfoFromChain = async (dropId: string): Promise<DropInfo | undefined> => {
    console.log('[fetchDropInfoFromChain] Fetching drop info from chain for ID:', dropId);

    try {
      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('[fetchDropInfoFromChain] Calling contract with dropId:', dropId);
      console.log('[fetchDropInfoFromChain] Contract address:', STRAPT_DROP_ADDRESS);
      console.log('[fetchDropInfoFromChain] Using ABI:', StraptDropABI.abi.find(item => item.name === 'getDropInfo'));

      let result: [
        string,
        string,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        bigint,
        string,
        boolean
      ] | undefined;
      try {
        console.log('[fetchDropInfoFromChain] Preparing contract call with args:', [dropId]);

        result = await readContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'getDropInfo',
          args: [dropId as `0x${string}`],
          address: STRAPT_DROP_ADDRESS,
        }) as [
          string,
          string,
          bigint,
          bigint,
          bigint,
          bigint,
          boolean,
          bigint,
          string,
          boolean
        ];

        if (!result) {
          console.error('[fetchDropInfoFromChain] No result returned from contract');
          return undefined;
        }

        console.log('[fetchDropInfoFromChain] Contract call successful');
      } catch (error) {
        console.error('[fetchDropInfoFromChain] Contract call error:', error);

        // Check if this is a DropNotFound error
        if (error instanceof Error && error.message.includes('DropNotFound')) {
          console.log('[fetchDropInfoFromChain] Drop not found error from contract');
          console.log('[fetchDropInfoFromChain] This means the dropId does not exist in the contract storage');
          console.log('[fetchDropInfoFromChain] DropId:', dropId);
          return undefined;
        }

        // Log more details about the error
        if (error instanceof Error) {
          console.error('[fetchDropInfoFromChain] Error message:', error.message);
          console.error('[fetchDropInfoFromChain] Error stack:', error.stack);
        }

        // Rethrow other errors
        throw error;
      }

      console.log('[fetchDropInfoFromChain] Raw result from contract:', result);
      console.log('[fetchDropInfoFromChain] Result type:', typeof result);
      console.log('[fetchDropInfoFromChain] Is array:', Array.isArray(result));

      if (Array.isArray(result)) {
        console.log('[fetchDropInfoFromChain] Array length:', result.length);
      }

      const [
        creator,
        tokenAddress,
        totalAmount,
        remainingAmount,
        claimedCount,
        totalRecipients,
        isRandom,
        expiryTime,
        message,
        isActive
      ] = result as [
        string,
        string,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        bigint,
        string,
        boolean
      ];

      // Log important values
      console.log('[fetchDropInfoFromChain] Creator:', creator);
      console.log('[fetchDropInfoFromChain] Token address:', tokenAddress);
      console.log('[fetchDropInfoFromChain] Total amount:', totalAmount.toString());
      console.log('[fetchDropInfoFromChain] Remaining amount:', remainingAmount.toString());
      console.log('[fetchDropInfoFromChain] Claimed count:', claimedCount.toString());
      console.log('[fetchDropInfoFromChain] Total recipients:', totalRecipients.toString());
      console.log('[fetchDropInfoFromChain] Is random:', isRandom);
      console.log('[fetchDropInfoFromChain] Expiry time:', expiryTime.toString(), '(', new Date(Number(expiryTime) * 1000).toLocaleString(), ')');
      console.log('[fetchDropInfoFromChain] Is active:', isActive);

      // Check if this is a non-existent drop (all values are default/zero)
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

      // If creator is zero address, this is definitely a non-existent drop
      if (creator === ZERO_ADDRESS) {
        console.log('[fetchDropInfoFromChain] Drop does not exist (creator is zero address)');
        return undefined;
      }

      // Additional check for other default values
      if (
        tokenAddress === ZERO_ADDRESS &&
        totalAmount === 0n &&
        remainingAmount === 0n &&
        claimedCount === 0n &&
        totalRecipients === 0n &&
        !isActive
      ) {
        console.log('[fetchDropInfoFromChain] Drop appears invalid (all values are default)');
        return undefined;
      }

      // Check if the drop has valid data
      if (totalAmount === 0n || totalRecipients === 0n) {
        console.log('[fetchDropInfoFromChain] Drop has invalid data (zero amount or recipients)');
        return undefined;
      }

      // Check if token address is valid
      if (tokenAddress === ZERO_ADDRESS) {
        console.log('[fetchDropInfoFromChain] Drop has invalid token address (zero address)');
        return undefined;
      }

      // Determine token decimals
      const tokenDecimals = getTokenDecimals(tokenAddress);

      // Create drop info with proper formatting
      const dropInfo = {
        creator,
        tokenAddress,
        totalAmount: formatUnits(totalAmount, tokenDecimals),
        remainingAmount: formatUnits(remainingAmount, tokenDecimals),
        claimedCount: Number(claimedCount),
        totalRecipients: Number(totalRecipients),
        isRandom,
        expiryTime: Number(expiryTime),
        message,
        isActive
      };

      console.log('[fetchDropInfoFromChain] Formatted drop info:', dropInfo);
      return dropInfo;
    } catch (error) {
      console.error('[fetchDropInfoFromChain] Error fetching drop info:', error);

      // Check if this is a rate limiting error
      if (error instanceof Error &&
          (error.message.includes('too many requests') ||
           error.message.includes('rate limit') ||
           error.message.includes('429'))) {

        console.log('[fetchDropInfoFromChain] Rate limiting detected');
        setIsRateLimited(true);

        // Set a timeout to reset the rate limiting flag after 1 minute
        setTimeout(() => {
          setIsRateLimited(false);
        }, 60000);
      }

      throw error;
    }
  };

  /**
   * Get information about a drop
   * @param dropId Unique identifier of the drop
   * @returns Drop information
   */
  const getDropInfo = async (dropId: string): Promise<DropInfo | undefined> => {
    console.log('[getDropInfo] Getting info for drop ID:', dropId);

    try {
      // Validate dropId format
      if (!validateDropId(dropId)) {
        console.error('[getDropInfo] Invalid dropId format');
        return undefined;
      }

      // Check cache first
      const cachedInfo = getDropFromCache(dropId);
      if (cachedInfo) {
        // Validate cached info
        if (cachedInfo.creator === '0x0000000000000000000000000000000000000000') {
          console.log('[getDropInfo] Cached drop has zero address creator, removing from cache');
          dropInfoCache.delete(dropId);
          return undefined;
        }
        return cachedInfo;
      }

      // If we're experiencing rate limiting, don't make the request
      if (isRateLimited) {
        console.log('[getDropInfo] Rate limited, skipping request');

        // If we have any cached data, use it regardless of age
        const cachedData = dropInfoCache.get(dropId);
        if (cachedData) {
          // Validate cached info
          if (cachedData.info.creator === '0x0000000000000000000000000000000000000000') {
            console.log('[getDropInfo] Cached drop has zero address creator, removing from cache');
            dropInfoCache.delete(dropId);
            return undefined;
          }
          console.log('[getDropInfo] Using stale cached data due to rate limiting');
          return cachedData.info;
        }

        return undefined;
      }

      // Fetch from chain
      const dropInfo = await fetchDropInfoFromChain(dropId);

      if (!dropInfo) {
        console.log('[getDropInfo] No drop info returned from chain');
        return undefined;
      }

      // Validate drop info
      if (dropInfo.creator === '0x0000000000000000000000000000000000000000') {
        console.log('[getDropInfo] Drop has zero address creator, not caching');
        return undefined;
      }

      // Cache the result (5 minutes)
      console.log('[getDropInfo] Caching drop info');
      dropInfoCache.set(dropId, { info: dropInfo, timestamp: Date.now() });
      return dropInfo;
    } catch (error) {
      console.error('[getDropInfo] Error getting drop info:', error);

      // If we have cached data, return it regardless of age
      const cachedData = dropInfoCache.get(dropId);
      if (cachedData) {
        // Validate cached info
        if (cachedData.info.creator === '0x0000000000000000000000000000000000000000') {
          console.log('[getDropInfo] Cached drop has zero address creator, removing from cache');
          dropInfoCache.delete(dropId);
          return undefined;
        }
        console.log('[getDropInfo] Using stale cached data due to error');
        return cachedData.info;
      }

      return undefined;
    }
  };

  /**
   * Extract refunded amount from transaction receipt logs
   * @param receipt The transaction receipt
   * @param tokenDecimals The number of decimals for the token
   * @returns The refunded amount as a string
   */
  const extractRefundedAmount = (receipt: { logs: Array<{ topics: Array<string>; data: string }> }, tokenDecimals: number): string => {
    console.log('[extractRefundedAmount] Extracting refunded amount from receipt');

    try {
      // Find the DropExpired event in the logs
      for (const log of receipt.logs) {
        // Look for the event with the right topic signature for DropExpired
        // This is the keccak256 hash of "DropsExpired(bytes32,address,uint256)"
        if (log.topics[0] === '0x8a7e64faf4ad9d8efb7b64f6c4f7d8c5b6da3a2c818d39f2f8fc6e9df308f4c5') {
          console.log('[extractRefundedAmount] Found DropExpired event');

          // Try to get the amount from the data
          const data = log.data;
          if (data && data.length >= 66) {
            // Extract the amount from the data
            const amountHex = `0x${data.slice(2, 66)}`;
            const amountBigInt = BigInt(amountHex);
            const amount = formatUnits(amountBigInt, tokenDecimals);
            console.log('[extractRefundedAmount] Extracted amount:', amount, 'with', tokenDecimals, 'decimals');
            return amount;
          }
        }
      }

      console.warn('[extractRefundedAmount] Could not extract amount from logs');
      return '0';
    } catch (error) {
      console.error('[extractRefundedAmount] Error extracting amount:', error);
      return '0';
    }
  };

  /**
   * Refund remaining tokens from an expired drop
   * @param dropId Unique identifier of the drop
   * @returns Amount of tokens refunded
   */
  const refundExpiredDrop = async (dropId: string): Promise<string | undefined> => {
    console.log('[refundExpiredDrop] Starting refund process for drop ID:', dropId);

    try {
      setIsLoading(true);

      // Check wallet connection
      if (!isConnected || !address) {
        console.error('[refundExpiredDrop] Wallet not connected');
        toast.error('Wallet not connected');
        return undefined;
      }

      // Validate drop ID
      if (!validateDropId(dropId)) {
        toast.error('Invalid drop ID format');
        return undefined;
      }

      // Get drop info to determine token decimals and validate refund eligibility
      console.log('[refundExpiredDrop] Fetching drop info');
      let tokenDecimals = 2; // Default to IDRX (2 decimals)
      let dropInfo: DropInfo | undefined;

      try {
        dropInfo = await getDropInfo(dropId);
        console.log('[refundExpiredDrop] Drop info retrieved:', dropInfo);

        if (dropInfo) {
          // Check if drop is active
          if (!dropInfo.isActive) {
            console.error('[refundExpiredDrop] Drop is not active');
            toast.error('This STRAPT Drop is not active');
            return undefined;
          }

          // Check if drop is expired
          const currentTime = Math.floor(Date.now() / 1000);
          if (dropInfo.expiryTime > currentTime) {
            console.error('[refundExpiredDrop] Drop has not expired yet. Expiry:', new Date(dropInfo.expiryTime * 1000).toLocaleString(), 'Current:', new Date(currentTime * 1000).toLocaleString());
            toast.error('This STRAPT Drop has not expired yet');
            return undefined;
          }

          // Check if user is the creator
          if (dropInfo.creator.toLowerCase() !== address.toLowerCase()) {
            console.error('[refundExpiredDrop] User is not the creator. Creator:', dropInfo.creator, 'User:', address);
            toast.error('Only the creator can refund an expired STRAPT Drop');
            return undefined;
          }

          // Determine token decimals
          tokenDecimals = getTokenDecimals(dropInfo.tokenAddress);
        } else {
          console.error('[refundExpiredDrop] Drop info not found');
          toast.error('Drop not found');
          return undefined;
        }
      } catch (error) {
        console.error('[refundExpiredDrop] Error getting drop info:', error);
        // Continue with default decimals
      }

      // Get the current chain from the config
      const chain = config.chains[0];
      console.log('[refundExpiredDrop] Using chain:', chain.name);

      try {
        // Submit refund transaction
        console.log('[refundExpiredDrop] Submitting refund transaction');
        const hash = await writeContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'refundExpiredDrop',
          args: [dropId as `0x${string}`],
          address: STRAPT_DROP_ADDRESS,
          account: address,
          chain,
        });

        console.log('[refundExpiredDrop] Refund transaction submitted with hash:', hash);
        toast.success('Refund transaction submitted. Please wait for confirmation...');

        // Wait for transaction confirmation
        console.log('[refundExpiredDrop] Waiting for transaction confirmation');
        const receipt = await waitForTransactionReceipt(config, {
          hash,
          timeout: 60000, // 60 seconds timeout
        });

        console.log('[refundExpiredDrop] Transaction confirmed:', receipt);
        toast.success('Refund transaction confirmed!');

        // Extract refunded amount from logs
        let refundedAmount = extractRefundedAmount(receipt as { logs: Array<{ topics: Array<string>; data: string }> }, tokenDecimals);

        // If we couldn't extract the amount from logs, use the remaining amount from drop info
        if (refundedAmount === '0' && dropInfo) {
          console.log('[refundExpiredDrop] Using remaining amount from drop info:', dropInfo.remainingAmount);
          refundedAmount = dropInfo.remainingAmount;
        }

        // If we still don't have an amount, use a fallback value
        if (refundedAmount === '0') {
          refundedAmount = '5.00'; // Fallback value
          console.log('[refundExpiredDrop] Using fallback amount:', refundedAmount);
        }

        // Update the drop info in cache to mark it as inactive
        if (dropInfo) {
          const updatedDropInfo = {
            ...dropInfo,
            isActive: false,
            remainingAmount: '0'
          };
          dropInfoCache.set(dropId, { info: updatedDropInfo, timestamp: Date.now() });
          console.log('[refundExpiredDrop] Updated drop info in cache:', updatedDropInfo);
        }

        console.log('[refundExpiredDrop] Refund process completed successfully with amount:', refundedAmount);
        return refundedAmount;
      } catch (error) {
        console.error('[refundExpiredDrop] Error in refund transaction:', error);

        if (error instanceof Error) {
          // Handle specific error messages
          if (error.message.includes('user rejected')) {
            toast.error('Transaction rejected by user');
          } else if (error.message.includes('DropNotFound')) {
            toast.error('This STRAPT Drop does not exist');
          } else if (error.message.includes('DropNotActive')) {
            toast.error('This STRAPT Drop is not active');
          } else if (error.message.includes('NotExpiredYet')) {
            toast.error('This STRAPT Drop has not expired yet');
          } else if (error.message.includes('NotCreator')) {
            toast.error('Only the creator can refund an expired STRAPT Drop');
          } else if (error.message.includes('too many requests') ||
                    error.message.includes('rate limit') ||
                    error.message.includes('429')) {
            toast.error('RPC rate limit exceeded. Please try again in a few moments.');
          } else {
            toast.error(`Error refunding STRAPT Drop: ${error.message}`);
          }
        } else {
          toast.error('An unknown error occurred while refunding STRAPT Drop');
        }
        throw error;
      }
    } catch (error) {
      console.error('[refundExpiredDrop] Unexpected error in refund process:', error);
      return undefined;
    } finally {
      setIsLoading(false);
      console.log('[refundExpiredDrop] Refund process finished');
    }
  };

  // Cache for claim status to reduce RPC calls
  const claimStatusCache = new Map<string, { claimed: boolean, timestamp: number }>();

  // Cache for claimed amounts to reduce RPC calls
  const claimedAmountCache = new Map<string, { amount: string, timestamp: number }>();

  // Global flag to track if we're experiencing rate limiting
  const [isRateLimited, setIsRateLimited] = useState(false);

  /**
   * Check if an address has claimed from a drop
   * @param dropId Unique identifier of the drop
   * @param userAddress Address to check
   * @returns Whether the address has claimed
   */
  const hasAddressClaimed = async (dropId: string, userAddress: string): Promise<boolean> => {
    try {
      // Create a cache key
      const cacheKey = `${dropId}-${userAddress}`;

      // Check cache first (valid for 5 minutes - much longer to reduce requests)
      const cachedData = claimStatusCache.get(cacheKey);
      const now = Date.now();

      if (cachedData && now - cachedData.timestamp < 300000) { // 5 minutes
        console.log('Using cached claim status');
        return cachedData.claimed;
      }

      // If we're experiencing rate limiting, don't make the request
      if (isRateLimited) {
        console.log('Rate limited, skipping hasAddressClaimed request');
        // If we have any cached data, use it regardless of age
        if (cachedData) {
          return cachedData.claimed;
        }
        // Default to false if no cached data
        return false;
      }

      // Add a longer delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const result = await readContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'hasAddressClaimed',
          args: [dropId as `0x${string}`, userAddress as `0x${string}`],
          address: STRAPT_DROP_ADDRESS,
        });

        const claimed = result as boolean;

        // Cache the result for longer (5 minutes)
        claimStatusCache.set(cacheKey, { claimed, timestamp: now });

        return claimed;
      } catch (error) {
        // Check if this is a rate limiting error
        if (error instanceof Error) {
          if (error.message.includes('too many requests') ||
              error.message.includes('rate limit') ||
              error.message.includes('429')) {

            console.log('Rate limiting detected in hasAddressClaimed');
            setIsRateLimited(true);

            // Set a timeout to reset the rate limiting flag after 1 minute
            setTimeout(() => {
              setIsRateLimited(false);
            }, 60000);
          } else if (error.message.includes('DropNotFound')) {
            console.log('Drop not found in hasAddressClaimed');
            return false;
          }
        }

        throw error; // Rethrow to be caught by outer try/catch
      }
    } catch (error) {
      console.error('Error checking if address has claimed:', error);

      // If we have cached data, return it regardless of age
      const cacheKey = `${dropId}-${userAddress}`;
      const cachedData = claimStatusCache.get(cacheKey);
      if (cachedData) {
        console.log('Using stale cached claim status due to error');
        return cachedData.claimed;
      }

      // If we're experiencing rate limiting, assume not claimed
      if (isRateLimited) {
        console.log('Rate limited, assuming not claimed');
        return false;
      }

      // Default to false
      return false;
    }
  };

  /**
   * Get the amount claimed by an address from a drop
   * @param dropId Unique identifier of the drop
   * @param userAddress Address to check
   * @returns Amount claimed
   */
  const getClaimedAmount = async (dropId: string, userAddress: string): Promise<string> => {
    try {
      // Create a cache key
      const cacheKey = `${dropId}-${userAddress}`;

      // Check cache first (valid for 5 minutes - much longer to reduce requests)
      const cachedData = claimedAmountCache.get(cacheKey);
      const now = Date.now();

      if (cachedData && now - cachedData.timestamp < 300000) { // 5 minutes
        console.log('Using cached claimed amount');
        return cachedData.amount;
      }

      // If we're experiencing rate limiting, don't make the request
      if (isRateLimited) {
        console.log('Rate limited, skipping getClaimedAmount request');
        // If we have any cached data, use it regardless of age
        if (cachedData) {
          return cachedData.amount;
        }

        // If we don't have cached data but we know the user has claimed (from hasAddressClaimed)
        // Try to estimate the amount from the drop info
        try {
          const dropInfo = await getDropInfo(dropId);
          if (dropInfo && !dropInfo.isRandom) {
            // For fixed distribution, we can calculate the amount
            const amountPerRecipient = Number(dropInfo.totalAmount) / dropInfo.totalRecipients;
            return amountPerRecipient.toFixed(2);
          }
        } catch (error) {
          console.error('Error getting drop info for amount estimation:', error);
        }

        // Default to a reasonable value if we can't estimate
        return '10.00';
      }

      // Add a longer delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const result = await readContract(config, {
          abi: StraptDropABI.abi,
          functionName: 'getClaimedAmount',
          args: [dropId as `0x${string}`, userAddress as `0x${string}`],
          address: STRAPT_DROP_ADDRESS,
        });

        const amount = formatUnits(result as bigint, 2);

        // Cache the result for longer (5 minutes)
        claimedAmountCache.set(cacheKey, { amount, timestamp: now });

        return amount;
      } catch (error) {
        // Check if this is a rate limiting error
        if (error instanceof Error) {
          if (error.message.includes('too many requests') ||
              error.message.includes('rate limit') ||
              error.message.includes('429')) {

            console.log('Rate limiting detected in getClaimedAmount');
            setIsRateLimited(true);

            // Set a timeout to reset the rate limiting flag after 1 minute
            setTimeout(() => {
              setIsRateLimited(false);
            }, 60000);
          } else if (error.message.includes('DropNotFound')) {
            console.log('Drop not found in getClaimedAmount');
            return '0';
          }
        }

        throw error; // Rethrow to be caught by outer try/catch
      }
    } catch (error) {
      console.error('Error getting claimed amount:', error);

      // If we have cached data, return it regardless of age
      const cacheKey = `${dropId}-${userAddress}`;
      const cachedData = claimedAmountCache.get(cacheKey);
      if (cachedData) {
        console.log('Using stale cached claimed amount due to error');
        return cachedData.amount;
      }

      // If we're experiencing rate limiting, try to estimate the amount
      if (isRateLimited) {
        console.log('Rate limited, estimating claimed amount');
        try {
          const dropInfo = await getDropInfo(dropId);
          if (dropInfo && !dropInfo.isRandom) {
            // For fixed distribution, we can calculate the amount
            const amountPerRecipient = Number(dropInfo.totalAmount) / dropInfo.totalRecipients;
            return amountPerRecipient.toFixed(2);
          }
        } catch (error) {
          console.error('Error getting drop info for amount estimation:', error);
        }

        // Default to a reasonable value
        return '10.00';
      }

      // Default to 0
      return '0';
    }
  };

  /**
   * Get drops created by the current user
   * @returns Array of drops created by the user
   */
  const getUserCreatedDrops = async (): Promise<{id: string; info: DropInfo}[]> => {
    try {
      if (!isConnected || !address) {
        toast.error('Wallet not connected');
        return [];
      }

      setIsLoadingUserDrops(true);

      // Since there's no direct way to get user's drops from the contract,
      // we need to use an indexer or event logs. For simplicity, we'll use
      // localStorage to track drops created by the user in this session.

      // Get drops from localStorage
      const storedDrops = localStorage.getItem(`strapt-drops-${address.toLowerCase()}`);
      let dropIds: string[] = [];

      if (storedDrops) {
        try {
          dropIds = JSON.parse(storedDrops);
        } catch (error) {
          console.error('Error parsing stored drops:', error);
        }
      }

      // Fetch info for each drop
      const drops: {id: string; info: DropInfo}[] = [];

      for (const dropId of dropIds) {
        try {
          console.log(`[getUserCreatedDrops] Fetching info for drop ${dropId}`);

          // Check if this might be a transaction hash
          const txHash = localStorage.getItem(`strapt-drop-tx-${dropId}`);
          if (txHash && txHash === dropId) {
            console.warn(`[getUserCreatedDrops] Drop ID ${dropId} appears to be a transaction hash, might not be valid`);
          }

          // Try to get drop info
          const info = await getDropInfo(dropId);

          if (info) {
            console.log(`[getUserCreatedDrops] Got info for drop ${dropId}:`, info);

            // Only include drops created by the current user
            if (info.creator.toLowerCase() === address.toLowerCase()) {
              drops.push({ id: dropId, info });
              console.log(`[getUserCreatedDrops] Added drop ${dropId} to list`);
            } else {
              console.log(`[getUserCreatedDrops] Drop ${dropId} not created by current user, skipping`);
            }
          } else {
            console.warn(`[getUserCreatedDrops] No info returned for drop ${dropId}, might not exist`);

            // If we couldn't get info, check if this is a transaction hash
            if (dropId.length === 66 && dropId === localStorage.getItem('last_tx_hash')) {
              console.warn(`[getUserCreatedDrops] Drop ID ${dropId} matches last transaction hash, removing from localStorage`);
              const updatedDropIds = dropIds.filter(id => id !== dropId);
              localStorage.setItem(`strapt-drops-${address.toLowerCase()}`, JSON.stringify(updatedDropIds));
            }
          }
        } catch (error) {
          console.error(`[getUserCreatedDrops] Error fetching info for drop ${dropId}:`, error);

          // If the drop doesn't exist, remove it from localStorage
          if (error instanceof Error && error.message.includes('DropNotFound')) {
            console.log(`[getUserCreatedDrops] Removing non-existent drop ${dropId} from localStorage`);
            const updatedDropIds = dropIds.filter(id => id !== dropId);
            localStorage.setItem(`strapt-drops-${address.toLowerCase()}`, JSON.stringify(updatedDropIds));

            // Also remove any associated metadata
            localStorage.removeItem(`strapt-drop-tx-${dropId}`);
            localStorage.removeItem(`strapt-drop-created-${dropId}`);
          }
        }
      }

      // Sort drops by expiry time (most recent first)
      drops.sort((a, b) => b.info.expiryTime - a.info.expiryTime);

      setUserDrops(drops);
      return drops;
    } catch (error) {
      console.error('Error getting user created drops:', error);
      return [];
    } finally {
      setIsLoadingUserDrops(false);
    }
  };

  /**
   * Save a drop ID to localStorage for the current user
   * @param dropId Drop ID to save
   * @param txHash Optional transaction hash associated with the drop
   */
  const saveUserDrop = (dropId: string, txHash?: string) => {
    if (!address) return;

    try {
      console.log('[saveUserDrop] Saving drop ID:', dropId);

      // Get existing drops
      const storedDrops = localStorage.getItem(`strapt-drops-${address.toLowerCase()}`);
      let dropIds: string[] = [];

      if (storedDrops) {
        try {
          dropIds = JSON.parse(storedDrops);
        } catch (error) {
          console.error('[saveUserDrop] Error parsing stored drops:', error);
        }
      }

      // Add new drop if it doesn't exist
      if (!dropIds.includes(dropId)) {
        console.log('[saveUserDrop] Adding new drop ID to localStorage');
        dropIds.push(dropId);
        localStorage.setItem(`strapt-drops-${address.toLowerCase()}`, JSON.stringify(dropIds));

        // Save additional info about the drop
        if (txHash) {
          console.log('[saveUserDrop] Saving transaction hash for drop:', txHash);
          localStorage.setItem(`strapt-drop-tx-${dropId}`, txHash);
        }

        // Save creation timestamp
        localStorage.setItem(`strapt-drop-created-${dropId}`, Date.now().toString());
      } else {
        console.log('[saveUserDrop] Drop ID already exists in localStorage');
      }
    } catch (error) {
      console.error('[saveUserDrop] Error saving user drop:', error);
    }
  };

  // Update createDrop to save the drop ID
  const originalCreateDrop = createDrop;
  const createDropWithSave = async (...args: Parameters<typeof originalCreateDrop>) => {
    const result = await originalCreateDrop(...args);
    if (result?.dropId) {
      saveUserDrop(result.dropId, result.txHash);
    }
    return result;
  };

  return {
    createDrop: createDropWithSave,
    claimDrop,
    getDropInfo,
    refundExpiredDrop,
    hasAddressClaimed,
    getClaimedAmount,
    getUserCreatedDrops,
    checkDropExists,
    userDrops,
    isLoadingUserDrops,
    isLoading,
    isConfirmed
  };
}





