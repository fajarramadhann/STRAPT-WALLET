import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { Network, LogOut, Copy, ExternalLink, Wallet, Check } from 'lucide-react';
import { useState } from 'react';
import { useConfig, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { polygonAmoy, liskSepolia, baseSepolia } from 'viem/chains';

const XellarWalletProfile = () => {
  const { isConnected, address, disconnectWallet, connectWallet } = useXellarWallet();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // Use wagmi hooks
  const chainId = useChainId();
  const config = useConfig();
  const { switchChain } = useSwitchChain();
  
  // Get balance using the account hook
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  });
  
  // Get the current chain information
  const currentChain = config.chains.find(c => c.id === chainId);

  // Available networks
  const networks = [
    { ...liskSepolia, name: 'Lisk Sepolia' },
    { ...baseSepolia, name: 'Base Sepolia' },
    { ...polygonAmoy, name: 'Polygon Amoy' }
  ];

  // If not connected, show connect button
  if (!isConnected || !address) {
    return (
      <Button onClick={() => connectWallet()} className="gap-2" size="sm">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  
  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast("Address Copied", {
        description: "Your wallet address has been copied to clipboard",
      });
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectWallet();
      toast("Disconnected", {
        description: "Your wallet has been disconnected",
      });
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast("Error", {
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchNetwork = async (chainId: number) => {
    try {
      await switchChain({ chainId });
      toast("Network Changed", {
        description: `Switched to ${networks.find(n => n.id === chainId)?.name || 'new network'}`,
      });
    } catch (error) {
      console.error("Error switching network:", error);
      toast("Error", {
        description: "Failed to switch network",
        variant: "destructive",
      });
    }
  };

  const handleViewOnExplorer = () => {
    if (!address || !currentChain?.blockExplorers?.default?.url) return;
    
    const explorerUrl = `${currentChain.blockExplorers.default.url}/address/${address}`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback>{truncatedAddress.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{truncatedAddress}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {balance && `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}`}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={handleViewOnExplorer}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <div className="flex items-center">
            <Network className="mr-2 h-4 w-4" />
            <span>Network</span>
          </div>
        </DropdownMenuLabel>
        {networks.map((network) => (
          <DropdownMenuItem
            key={network.id}
            className="cursor-pointer"
            onClick={() => handleSwitchNetwork(network.id)}
          >
            <div className="flex items-center justify-between w-full">
              <span>{network.name}</span>
              {chainId === network.id && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive" 
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoading ? 'Disconnecting...' : 'Disconnect'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default XellarWalletProfile;
