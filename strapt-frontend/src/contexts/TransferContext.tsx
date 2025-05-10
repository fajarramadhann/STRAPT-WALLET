
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { TokenOption } from '@/components/TokenSelect';
import { DurationUnit } from '@/components/DurationSelect';
import { useProtectedTransfer, TokenType } from '@/hooks/use-protected-transfer';
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
  timeout: number;
  setTimeout: (value: number) => void;
  timeoutUnit: DurationUnit;
  setTimeoutUnit: (value: DurationUnit) => void;
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

  // Token data
  tokens: TokenOption[];
  isLoadingTokens: boolean;

  // Protected Transfer functions
  isLoading: boolean;
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
  createProtectedLinkTransfer: () => Promise<boolean>;
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
  const [note, setNote] = useState('');
  const [withTimeout, setWithTimeout] = useState(true); // Default to true for expiry
  const [withPassword, setWithPassword] = useState(true); // Default to true for claim code
  const [timeout, setTimeout] = useState(24);
  const [timeoutUnit, setTimeoutUnit] = useState<DurationUnit>('hours');
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

  // Use the Protected Transfer hook
  const {
    isLoading,
    isConfirmed,
    createTransfer,
    createLinkTransfer,
    claimTransfer,
    claimLinkTransfer,
    refundTransfer,
    generateClaimCode,
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  } = useProtectedTransfer();

  // Format timeout for display
  const formatTimeout = () => {
    switch (timeoutUnit) {
      case 'seconds':
        return timeout === 1 ? "1 second" : `${timeout} seconds`;
      case 'minutes':
        return timeout === 1 ? "1 minute" : `${timeout} minutes`;
      case 'hours':
        return timeout === 1 ? "1 hour" : `${timeout} hours`;
      case 'days':
        return timeout === 1 ? "1 day" : `${timeout} days`;
      default:
        return `${timeout} ${timeoutUnit}`;
    }
  };

  // Shorten transfer ID for display
  const shortenTransferId = (id: string | null) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  // Convert timeoutUnit and timeout to seconds for contract
  const getExpirySeconds = () => {
    switch (timeoutUnit) {
      case 'seconds': return timeout;
      case 'minutes': return timeout * 60;
      case 'hours': return timeout * 3600;
      case 'days': return timeout * 86400;
      default: return timeout * 3600; // Default to hours
    }
  };

  // Get expiry timestamp (current time + timeout in seconds)
  const getExpiryTimestamp = () => {
    return Math.floor(Date.now() / 1000) + getExpirySeconds();
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
      const protectedTransferAddress = (await import('@/contracts/ProtectedTransfer.json')).default.address as `0x${string}`;

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

  // Create a protected transfer
  const createProtectedTransfer = async () => {
    try {
      // Check if token is already approved
      if (!isApproved) {
        toast.error("Please approve token transfer first");
        return;
      }

      // Calculate expiry timestamp
      const expiryTimestamp = withTimeout ? getExpiryTimestamp() : Math.floor(Date.now() / 1000) + 86400; // Default to 24 hours

      // Use custom password if withPassword is true, otherwise generate a random one
      const customPassword = withPassword && password ? password : null;

      // Create the transfer
      const result = await createTransfer(
        recipient,
        getTokenType(),
        amount,
        expiryTimestamp,
        customPassword
      );

      if (result?.transferId) {
        // Save the claim code and transfer ID
        setClaimCode(result.claimCode || '');
        setTransferId(result.transferId);

        // Generate transfer link with real domain
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/claim?id=${result.transferId}&code=${result.claimCode}`;
        setTransferLink(link);

        toast.success("Transfer created successfully");

        // Reset approval state for next transfer
        setIsApproved(false);

        return true;
      }
      toast.error("Failed to create transfer: No transfer ID returned");
      return false;
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error("Failed to create transfer");
      return false;
    }
  };

  // Create a protected link transfer
  const createProtectedLinkTransfer = async (): Promise<boolean> => {
    try {
      // Get the current account
      const { getAccount } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');
      const account = getAccount(config);

      if (!account || !account.address) {
        toast.error("No wallet connected");
        return false;
      }

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

      // Calculate expiry timestamp
      const expiryTimestamp = withTimeout ? getExpiryTimestamp() : Math.floor(Date.now() / 1000) + 86400; // Default to 24 hours

      // Create the link transfer
      const result = await createLinkTransfer(
        getTokenType(),
        amount,
        expiryTimestamp
      );

      if (result?.transferId) {
        // Save the transfer ID
        setTransferId(result.transferId);

        // For link transfers, we don't need a claim code
        setClaimCode('');

        // Generate transfer link with real domain
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/claim?id=${result.transferId}`;
        setTransferLink(link);

        toast.success("Link transfer created successfully");

        // Reset approval state for next transfer
        setIsApproved(false);

        return true;
      }

      toast.error("Failed to create link transfer: No transfer ID returned");
      return false;
    } catch (error) {
      console.error('Error creating link transfer:', error);
      toast.error("Failed to create link transfer");
      return false;
    }
  };

  // Claim a protected transfer
  const claimProtectedTransfer = async (id: string, code: string) => {
    try {
      return await claimTransfer(id, code);
    } catch (error) {
      console.error('Error claiming transfer:', error);
      toast.error("Failed to claim transfer");
      return false;
    }
  };

  // Claim a protected link transfer
  const claimProtectedLinkTransfer = async (id: string) => {
    try {
      return await claimLinkTransfer(id);
    } catch (error) {
      console.error('Error claiming link transfer:', error);
      toast.error("Failed to claim link transfer");
      return false;
    }
  };

  // Refund a protected transfer
  const refundProtectedTransfer = async (id: string) => {
    try {
      return await refundTransfer(id);
    } catch (error) {
      console.error('Error refunding transfer:', error);
      toast.error("Failed to refund transfer");
      return false;
    }
  };

  const value = {
    // Form state
    recipient,
    setRecipient,
    amount,
    setAmount,
    note,
    setNote,
    withTimeout,
    setWithTimeout,
    withPassword,
    setWithPassword,
    timeout,
    setTimeout,
    timeoutUnit,
    setTimeoutUnit,
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
    isLoading: isLoading || isLoadingTokens,
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
