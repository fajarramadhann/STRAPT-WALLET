
import { CheckIcon, ChevronDown, HelpCircle } from 'lucide-react';
import { useState } from 'react';
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

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 mt-0.5 mr-10 z-10">
        {/* <InfoTooltip
          content={
            <div>
              <p className="font-medium mb-1">Select Token</p>
              <p className="mb-1">Choose which token to use for your payment stream.</p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li>Make sure you have enough tokens for the stream</li>
                <li>Different tokens may have different fees</li>
                <li>Your available balance is shown for each token</li>
              </ul>
            </div>
          }
          side="right"
        /> */}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
          >
            <div className="flex items-center">
              {selectedToken.icon && (
                <div className="mr-2 h-6 w-6 overflow-hidden rounded-full bg-secondary/50">
                  <img src={selectedToken.icon} alt={selectedToken.name} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium">{selectedToken.symbol}</span>
                {selectedToken.balance !== undefined && (
                  <span className="text-xs text-muted-foreground">Balance: {selectedToken.balance.toFixed(2)}</span>
                )}
              </div>
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
                    className="flex items-center"
                  >
                    {token.icon && (
                      <div className="mr-2 h-5 w-5 overflow-hidden rounded-full bg-secondary/50">
                        <img src={token.icon} alt={token.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <span className="flex-1 font-medium">{token.symbol}</span>
                    {token.balance !== undefined && (
                      <span className="text-xs font-medium text-foreground">{token.balance.toFixed(2)}</span>
                    )}
                    {token.symbol === selectedToken.symbol && (
                      <CheckIcon className="ml-2 h-4 w-4" />
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
