import { CheckIcon, ChevronDown } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import InfoTooltip from '@/components/InfoTooltip';

// Token color mapping for dynamic styling
const TOKEN_COLORS = {
  'USDC': {
    bg: 'bg-blue-100',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700',
    textDark: 'dark:text-blue-100',
    border: 'border-blue-500',
    borderDark: 'dark:border-blue-400',
  },
  'IDRX': {
    bg: 'bg-purple-100',
    bgDark: 'dark:bg-purple-900/30',
    text: 'text-purple-700',
    textDark: 'dark:text-purple-100',
    border: 'border-purple-500',
    borderDark: 'dark:border-purple-400',
  },
  // Add more tokens here in the future
};

export interface TokenOption {
  symbol: string;
  name: string;
  icon?: string;
  balance?: number;
}

interface TokenSelectProps {
  tokens: TokenOption[];
  selectedToken: TokenOption;
  onTokenChange: (token: TokenOption) => void;
  className?: string;
}

const TokenSelect = ({ tokens, selectedToken, onTokenChange, className }: TokenSelectProps) => {
  const [open, setOpen] = useState(false);

  // Helper function to get token colors or default colors
  const getTokenColors = useCallback((symbol: string) => {
    return TOKEN_COLORS[symbol as keyof typeof TOKEN_COLORS] || {
      bg: 'bg-gray-100',
      bgDark: 'dark:bg-gray-800',
      text: 'text-gray-700',
      textDark: 'dark:text-gray-300',
      border: 'border-gray-400',
      borderDark: 'dark:border-gray-600',
    };
  }, []);

  // Get colors for the selected token
  const selectedTokenColors = useMemo(() =>
    getTokenColors(selectedToken.symbol),
    [selectedToken.symbol, getTokenColors]
  );

  // Debug log for selected token
  useEffect(() => {
    console.log('Selected Token:', {
      symbol: selectedToken.symbol,
      balance: selectedToken.balance
    });
  }, [selectedToken]);

  // Debug log for all tokens
  useEffect(() => {
    console.log('All Tokens:', tokens.map(token => ({
      symbol: token.symbol,
      balance: token.balance
    })));
  }, [tokens]);

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 mt-0.5 mr-10 z-10">
        <InfoTooltip
          content={
            <div>
              <p className="font-medium mb-1">Select Token</p>
              <p className="mb-1">Choose which token to use for your transfer.</p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li>Make sure you have enough tokens in your wallet</li>
                <li>No fees are charged for any token</li>
              </ul>
            </div>
          }
          side="right"
        />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              selectedTokenColors.border,
              selectedTokenColors.borderDark,
              selectedTokenColors.text,
              selectedTokenColors.textDark,
              className
            )}
          >
            <div className="flex items-center">
              {selectedToken.icon && (
                <div className={cn(
                  "mr-2 h-6 w-6 overflow-hidden rounded-full",
                  selectedTokenColors.bg,
                  selectedTokenColors.bgDark
                )}>
                  <img src={selectedToken.icon} alt={selectedToken.name} className="h-full w-full object-cover" />
                </div>
              )}
              <span className="font-medium">{selectedToken.symbol}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search token..." />
            <CommandEmpty>No token found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {tokens.map((token) => (
                  <CommandItem
                    key={token.symbol}
                    onSelect={() => {
                      onTokenChange(token);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center",
                      getTokenColors(token.symbol).bg,
                      getTokenColors(token.symbol).bgDark
                    )}
                  >
                    {token.icon && (
                      <div className={cn(
                        "mr-2 h-5 w-5 overflow-hidden rounded-full",
                        "bg-white",
                        token.symbol === 'USDC' && "dark:bg-blue-800",
                        token.symbol === 'IDRX' && "dark:bg-purple-800"
                      )}>
                        <img src={token.icon} alt={token.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <span className={cn(
                      "flex-1 font-medium",
                      getTokenColors(token.symbol).text,
                      getTokenColors(token.symbol).textDark
                    )}>{token.symbol}</span>
                    {token.symbol === selectedToken.symbol && (
                      <CheckIcon className={cn(
                        "ml-2 h-4 w-4",
                        getTokenColors(token.symbol).text,
                        getTokenColors(token.symbol).textDark
                      )} />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TokenSelect;
