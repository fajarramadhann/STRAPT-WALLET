import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { TokenOption } from '@/components/TokenSelect';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';

// Contract addresses
const USDC_ADDRESS = USDCABI.address as `0x${string}`;
const IDRX_ADDRESS = IDRXABI.address as `0x${string}`;

// Token decimals
const USDC_DECIMALS = 6;
const IDRX_DECIMALS = 18;

export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState<TokenOption[]>([
    { symbol: 'IDRX', name: 'IDRX Token', balance: 0 },
    { symbol: 'USDC', name: 'USD Coin', balance: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Get USDC balance
  const { data: usdcBalance, isLoading: isLoadingUsdc } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    query: {
      enabled: isConnected,
    },
  });

  // Get IDRX balance
  const { data: idrxBalance, isLoading: isLoadingIdrx } = useBalance({
    address: address,
    token: IDRX_ADDRESS,
    query: {
      enabled: isConnected,
    },
  });

  // Update tokens when balances change
  useEffect(() => {
    if (!isConnected) {
      setTokens([
        { symbol: 'IDRX', name: 'IDRX Token', balance: 0 },
        { symbol: 'USDC', name: 'USD Coin', balance: 0 },
      ]);
      setIsLoading(false);
      return;
    }

    setIsLoading(isLoadingUsdc || isLoadingIdrx);

    if (!isLoadingUsdc && !isLoadingIdrx) {
      const updatedTokens = [
        { 
          symbol: 'IDRX', 
          name: 'IDRX Token', 
          balance: idrxBalance ? parseFloat(idrxBalance.formatted) : 0 
        },
        { 
          symbol: 'USDC', 
          name: 'USD Coin', 
          balance: usdcBalance ? parseFloat(usdcBalance.formatted) : 0 
        },
      ];
      setTokens(updatedTokens);
    }
  }, [isConnected, isLoadingUsdc, isLoadingIdrx, usdcBalance, idrxBalance]);

  return {
    tokens,
    isLoading,
    usdcBalance,
    idrxBalance,
  };
}
