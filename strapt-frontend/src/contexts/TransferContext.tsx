
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { TokenOption } from '@/components/TokenSelect';
import { useProtectedTransferV2, TokenType } from '@/hooks/use-protected-transfer-v2';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { toast } from 'sonner';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';
import { useAccount } from 'wagmi';
import { config } from '@/providers/XellarProvider';

export type TransferType = 'direct' | 'claim';

interface TransferContextType {
  // Form state
  recipient: string;
  setRecipient: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  withTimeout: boolean;
  setWithTimeout: (value: boolean) => void;
  withPassword: boolean;
  setWithPassword: (value: boolean) => void;
  password: string;
  setPassword: (value: string) => void;
  selectedToken: TokenOption;
  setSelectedToken: (value: TokenOption) => void;
  transferType: TransferType;
  setTransferType: (value: TransferType) => void;
  transferLink: string;
  setTransferLink: (value: string) => void;
  formatTimeout: () => string;
  shortenTransferId: (id: string | null) => string;
  grossAmount: string;
  setGrossAmount: (value: string) => void;

  // Token data
  tokens: TokenOption[];
  isLoadingTokens: boolean;

  // Protected Transfer functions
  isLoading: boolean;
  isDirectTransferLoading: boolean;
  isConfirmed: boolean;
  isApproving: boolean;
  isApproved: boolean;
  claimCode: string;
  transferId: string | null;
  setTransferId: (value: string | null) => void;

  // Approval functions
  approveToken: () => Promise<boolean>;

  // Contract interaction functions
  createProtectedTransfer: () => Promise<boolean | undefined>;
  createProtectedLinkTransfer: () => Promise<boolean | undefined>;
  claimProtectedTransfer: (transferId: string, claimCode: string) => Promise<boolean>;
  claimProtectedLinkTransfer: (transferId: string) => Promise<boolean>;
  refundProtectedTransfer: (transferId: string) => Promise<boolean>;
}

export const TransferContext = createContext<TransferContextType | undefined>(undefined);

export function useTransferContext() {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error('useTransferContext must be used within a TransferProvider');
  }
  return context;
}

// Tokens will be loaded dynamically from useTokenBalances

export const TransferProvider = ({ children }: { children: ReactNode }) => {
  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [note, setNote] = useState('');
  const [withTimeout, setWithTimeout] = useState(true); // Always true for 24-hour expiry
  const [withPassword, setWithPassword] = useState(true); // Default to true for claim code
  const [password, setPassword] = useState('');
  const [transferType, setTransferType] = useState<TransferType>('claim');
  const [transferLink, setTransferLink] = useState('');

  // Get account information
  const { address } = useAccount();

  // Get real token balances
  const { tokens, isLoading: isLoadingTokens } = useTokenBalances();
  const [selectedToken, setSelectedToken] = useState<TokenOption>({
    symbol: 'IDRX',
    name: 'IDRX Token',
    balance: 0,
  });

  useEffect(() => {
    if (tokens.length > 0) {
      setSelectedToken(tokens[0]);
    }
  }, [tokens]);

  // Protected Transfer state
  const [claimCode, setClaimCode] = useState('');
  const [transferId, setTransferId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isDirectTransferLoading, setIsDirectTransferLoading] = useState(false);

  // Use the Protected Transfer V2 hook
  const {
    isLoading,
    isConfirmed,
    createDirectTransfer,
    createLinkTransfer,
    claimTransfer,
    refundTransfer,
    generateClaimCode,
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  } = useProtectedTransferV2();

  // Format timeout for display - always returns 24 hours
  const formatTimeout = () => {
    return "24 hours";
  };

  // Shorten transfer ID for display
  const shortenTransferId = (id: string | null) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  // Get expiry timestamp (current time + 24 hours)
  const getExpiryTimestamp = () => {
    return Math.floor(Date.now() / 1000) + 86400; // Fixed 24 hours (86400 seconds)
  };

  // Get token type from selected token
  const getTokenType = (): TokenType => {
    return selectedToken.symbol === 'USDC' ? 'USDC' : 'IDRX';
  };

  // Get token address from selected token
  const getTokenAddress = (): `0x${string}` => {
    return selectedToken.symbol === 'USDC' ? USDC_ADDRESS : IDRX_ADDRESS;
  };

  // Approve token for transfer
  const approveToken = async (): Promise<boolean> => {
    try {
      setIsApproving(true);
      setIsApproved(false);

      // Check if wallet is connected
      if (!address) {
        toast.error("No wallet connected");
        return false;
      }

      // For direct transfers without password protection, we don't need approval
      // as we'll use a direct ERC20 transfer
      if (transferType === 'direct' && !withPassword) {
        // Skip approval for direct transfers without password
        setIsApproved(true);
        toast.success("Direct transfer doesn't require approval");
        return true;
      }

      // Get token ABI based on selected token
      const tokenABI = selectedToken.symbol === 'USDC'
        ? (await import('@/contracts/USDCMock.json')).default.abi
        : (await import('@/contracts/IDRX.json')).default.abi;

      // Parse amount with correct decimals
      const { parseUnits } = await import('viem');
      const decimals = selectedToken.symbol === 'USDC' ? 6 : 2;
      const parsedAmount = parseUnits(amount, decimals);

      // Get token address
      const tokenAddress = getTokenAddress();

      // Get protected transfer contract address
      const protectedTransferAddress = (await import('@/contracts/contract-config.json')).default.ProtectedTransferV2.address as `0x${string}`;

      // Approve token transfer with account parameter
      const hash = await writeContract(config, {
        abi: tokenABI,
        functionName: 'approve',
        args: [protectedTransferAddress, parsedAmount],
        address: tokenAddress,
        account: address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, {
        hash
      });

      if (receipt.status === 'success') {
        setIsApproved(true);
        toast.success("Token approval successful");
        return true;
      }

      toast.error("Token approval failed");
      console.log(receipt);
      return false;
    } catch (error) {
      console.error('Error approving token:', error);
      toast.error("Failed to approve token");
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  // Create a transfer (direct or protected)
  const createProtectedTransfer = async () => {
    try {
      // Check if wallet is connected
      if (!address) {
        toast.error("No wallet connected");
        return false;
      }

      // For direct transfers without password protection, we don't need approval
      // For all other transfers, check if token is already approved
      if (!isApproved && !(transferType === 'direct' && !withPassword)) {
        toast.error("Please approve token transfer first");
        return false;
      }

      // For direct transfers without password protection, use standard ERC20 transfer
      if (transferType === 'direct' && !withPassword) {
        try {
          // Set loading state for direct transfer
          setIsDirectTransferLoading(true);

          // Get token ABI based on selected token
          const tokenABI = selectedToken.symbol === 'USDC'
            ? (await import('@/contracts/USDCMock.json')).default.abi
            : (await import('@/contracts/IDRX.json')).default.abi;

          // Parse amount with correct decimals
          const { parseUnits } = await import('viem');
          const decimals = selectedToken.symbol === 'USDC' ? 6 : 2;
          const parsedAmount = parseUnits(amount, decimals);

          // Get token address
          const tokenAddress = getTokenAddress();

          // Execute direct ERC20 transfer
          const hash = await writeContract(config, {
            abi: tokenABI,
            functionName: 'transfer',
            args: [recipient as `0x${string}`, parsedAmount],
            address: tokenAddress,
            account: address,
            chain: config.chains[0], // Use the first chain in the config
          });

          // Wait for transaction to be confirmed
          const receipt = await waitForTransactionReceipt(config, {
            hash
          });

          if (receipt.status === 'success') {
            toast.success("Direct transfer successful");

            // Reset approval state for next transfer
            setIsApproved(false);

            // Set the gross amount (original amount)
            setGrossAmount(amount);

            return true;
          }

          toast.error("Direct transfer failed");
          return false;
        } catch (error) {
          console.error('Error executing direct transfer:', error);
          toast.error(`Direct transfer failed: ${error instanceof Error ? error.message : String(error)}`);
          return false;
        } finally {
          // Reset loading state
          setIsDirectTransferLoading(false);
        }
      }

      // For protected transfers (with password or link/QR transfers)
      // Use fixed 24-hour expiry timestamp if withTimeout is true, otherwise no expiry
      const expiryTimestamp = withTimeout ? getExpiryTimestamp() : 0; // 0 means no expiry

      // Use custom password if withPassword is true, otherwise generate a random one
      const customPassword = withPassword && password ? password : null;

      // Create the protected transfer
      // For Link/QR transfers, recipient can be empty
      const recipientAddress = transferType === 'direct' ? recipient : (recipient || '0x0000000000000000000000000000000000000000');

      const result = await createDirectTransfer(
        recipientAddress,
        getTokenType(),
        amount,
        expiryTimestamp,
        withPassword,
        customPassword
      );

      if (result?.transferId) {
        // Save the claim code and transfer ID
        setClaimCode(result.claimCode || '');
        setTransferId(result.transferId);

        // Set the gross amount (original amount before fee)
        setGrossAmount(amount);

        // Generate transfer link with real domain
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/app/claims?id=${result.transferId}&code=${result.claimCode}`;
        setTransferLink(link);

        toast.success("Transfer created successfully", {
          description: `${amount} ${selectedToken.symbol} sent to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`
        });

        // Reset approval state for next transfer
        setIsApproved(false);

        return true;
      }
      toast.error("Transfer failed", {
        description: "Could not create transfer. Please try again."
      });
      return false;
    } catch (error) {
      console.error('Error creating transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to complete this transaction"
        });
      } else {
        toast.error("Transfer failed", {
          description: "Could not create transfer. Please try again."
        });
      }

      return false;
    }
  };

  // Create a protected link transfer
  const createProtectedLinkTransfer = async (): Promise<boolean | undefined> => {
    try {
      // Get the current account
      const { getAccount } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');
      const account = getAccount(config);

      if (!account || !account.address) {
        toast.error("No wallet connected");
        return false;
      }

      // For Link/QR transfers, recipient is optional
      // If no recipient is provided, anyone with the link can claim the funds

      // Check if token is already approved
      if (!isApproved) {
        toast.error("Please approve token transfer first");
        return false;
      }

      // Double-check allowance to make sure it's sufficient
      const hasAllowance = await checkAllowance(getTokenType(), amount, account.address);

      if (!hasAllowance) {
        toast.error("Insufficient token allowance. Please approve the token first.");
        setIsApproved(false); // Reset approval state
        return false;
      }

      // Use fixed 24-hour expiry timestamp if withTimeout is true, otherwise no expiry
      const expiryTimestamp = withTimeout ? getExpiryTimestamp() : 0; // 0 means no expiry

      let result: { transferId: string; claimCode?: string } | undefined;

      // If password protection is enabled, use createProtectedLinkTransfer
      if (withPassword) {
        console.log('Creating password-protected link transfer');

        // Generate a custom password if password protection is enabled
        const customPassword = password || generateClaimCode();
        console.log('Using password:', customPassword);

        // Use createLinkTransfer with password protection
        result = await createLinkTransfer(
          getTokenType(),
          amount,
          expiryTimestamp,
          true, // withPassword = true
          customPassword
        );

        // Save the claim code
        setClaimCode(result.claimCode || '');

        // Generate transfer link with real domain and claim code
        if (result?.transferId) {
          const baseUrl = window.location.origin;
          const link = `${baseUrl}/app/claims?id=${result.transferId}&code=${result.claimCode}`;
          setTransferLink(link);
        }
      } else {
        // If no password protection, use createLinkTransfer
        console.log('Creating link transfer without password protection');

        result = await createLinkTransfer(
          getTokenType(),
          amount,
          expiryTimestamp
        );

        // For link transfers without password, we don't need a claim code
        setClaimCode('');

        // Generate transfer link with real domain (no claim code)
        if (result?.transferId) {
          const baseUrl = window.location.origin;
          const link = `${baseUrl}/app/claims?id=${result.transferId}`;
          setTransferLink(link);
        }
      }

      if (result?.transferId) {
        // Save the transfer ID
        setTransferId(result.transferId);

        // Set the gross amount (original amount before fee)
        setGrossAmount(amount);

        toast.success("Transfer link created", {
          description: withPassword
            ? `Password-protected transfer of ${amount} ${selectedToken.symbol} is ready to share`
            : `Transfer of ${amount} ${selectedToken.symbol} is ready to share`
        });

        // Reset approval state for next transfer
        setIsApproved(false);

        return true;
      }

      toast.error("Transfer link failed", {
        description: "Could not create transfer link. Please try again."
      });
      return false;
    } catch (error) {
      console.error('Error creating link transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to complete this transaction"
        });
      } else {
        toast.error("Transfer link failed", {
          description: "Could not create transfer link. Please try again."
        });
      }

      return false;
    }
  };

  // Claim a protected transfer
  const claimProtectedTransfer = async (id: string, code: string) => {
    try {
      return await claimTransfer(id, code);
    } catch (error) {
      console.error('Error claiming transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the claim transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to pay for transaction fees"
        });
      } else if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
        toast.error("Invalid claim code", {
          description: "The claim code you entered is incorrect"
        });
      } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
        toast.error("Transfer not claimable", {
          description: "This transfer has already been claimed or is not available"
        });
      } else {
        toast.error("Claim failed", {
          description: "Could not claim transfer. Please try again."
        });
      }

      return false;
    }
  };

  // Claim a protected link transfer
  const claimProtectedLinkTransfer = async (id: string) => {
    try {
      // For transfers without password, we can use an empty string as the claim code
      return await claimTransfer(id, '');
    } catch (error) {
      console.error('Error claiming link transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the claim transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to pay for transaction fees"
        });
      } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
        toast.error("Transfer not claimable", {
          description: "This transfer has already been claimed or is not available"
        });
      } else {
        toast.error("Claim failed", {
          description: "Could not claim transfer. Please try again."
        });
      }

      return false;
    }
  };

  // Refund a protected transfer
  const refundProtectedTransfer = async (id: string) => {
    try {
      return await refundTransfer(id);
    } catch (error) {
      console.error('Error refunding transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the refund transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to pay for transaction fees"
        });
      } else if (error.message?.includes('not refundable') || error.message?.includes('cannot refund')) {
        toast.error("Transfer not refundable", {
          description: "This transfer cannot be refunded or has already been claimed"
        });
      } else {
        toast.error("Refund failed", {
          description: "Could not refund transfer. Please try again."
        });
      }

      return false;
    }
  };

  const value = {
    // Form state
    recipient,
    setRecipient,
    amount,
    setAmount,
    grossAmount,
    setGrossAmount,
    note,
    setNote,
    withTimeout,
    setWithTimeout,
    withPassword,
    setWithPassword,
    password,
    setPassword,
    selectedToken,
    setSelectedToken,
    transferType,
    setTransferType,
    transferLink,
    setTransferLink,
    formatTimeout,
    shortenTransferId,

    // Token data
    tokens,
    isLoadingTokens,

    // Protected Transfer state
    isLoading: isLoading || isLoadingTokens || isDirectTransferLoading,
    isDirectTransferLoading,
    isConfirmed,
    isApproving,
    isApproved,
    claimCode,
    transferId,
    setTransferId,

    // Approval functions
    approveToken,

    // Contract interaction functions
    createProtectedTransfer,
    createProtectedLinkTransfer,
    claimProtectedTransfer,
    claimProtectedLinkTransfer,
    refundProtectedTransfer,
  };

  return <TransferContext.Provider value={value}>{children}</TransferContext.Provider>;
};
