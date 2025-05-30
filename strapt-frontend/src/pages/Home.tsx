import {
  ArrowDown,
  ArrowUp,
  PlusCircle,
  BarChart2,
  QrCode,
  UserPlus,
  Copy,
  Droplets,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import QuickAction from "@/components/QuickAction";
import ActivityItem from "@/components/ActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import EnhancedUsernameRegistration from "@/components/EnhancedUsernameRegistration";
import ReceivedStats from "@/components/ReceivedStats";
import QRCode from "@/components/QRCode";
import QRCodeScanner from "@/components/QRCodeScanner";
import { useXellarWallet } from "@/hooks/use-xellar-wallet";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useChainId, useConfig } from "wagmi";
import { formatUnits } from "viem";
import { liskSepolia, baseSepolia } from "viem/chains";
import BalanceSkeleton from "@/components/skeletons/BalanceSkeleton";
import ReceivedStatsSkeleton from "@/components/skeletons/ReceivedStatsSkeleton";
import ActivitySkeleton from "@/components/skeletons/ActivitySkeleton";
import { formatBalanceWithoutDecimals } from "@/utils/format-utils";
import { useUSDCFaucet } from "@/hooks/use-usdc-faucet";
import { useTransactionHistory } from "@/hooks/use-transaction-history";
import toast from "@/utils/toast-deduplication";

const Home = () => {
  const { isConnected, address } = useXellarWallet();
  const [prices, setPrices] = useState<{ [key: string]: number }>({
    'usdc': 1.0, // USDC is pegged to USD
    'idrx': 0.000065 // Example price for IDRX (adjust as needed)
  });

  // Use updated wagmi hooks for current network
  const chainId = useChainId();
  const config = useConfig();

  // Get token balances
  const { tokens, isLoading, usdcBalance, idrxBalance } = useTokenBalances();

  // Get the current chain information
  const currentChain = config.chains.find(c => c.id === chainId);

  // Fetch token prices - simplified for demo
  useEffect(() => {
    // For a real app, you would fetch prices from an API
    // For this demo, we'll use hardcoded prices
    setPrices({
      'usdc': 1.0, // USDC is pegged to USD
      'idrx': 0.000065 // Example price for IDRX
    });
  }, []);

  // Calculate USD value
  const getUSDValue = (balance: number, symbol: string): number => {
    const tokenSymbol = symbol.toLowerCase();
    const price = prices[tokenSymbol] || 0;
    return balance * price;
  };

  // Format balance with proper decimals
  const formatBalance = (
    balance: bigint | undefined,
    decimals: number,
    precision = 2
  ): string => {
    if (!balance) return "0";
    const raw = Number(formatUnits(balance, decimals));
    return raw.toFixed(precision);
  };

  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);
  const [showUsernameReg, setShowUsernameReg] = useState(false);

  // USDC Faucet functionality
  const { claimTokens, isClaiming, userClaimInfo } = useUSDCFaucet();

  // Real transaction history data
  const {
    transactions,
    isLoading: isLoadingHistory,
    hasMore,
    loadMore,
    totalReceived,
    recentActivity
  } = useTransactionHistory();

  const handleCompleteRegistration = () => {
    setShowUsernameReg(false);
  };

  const handleTopup = async () => {
    try {
      const success = await claimTokens();
      if (success) {
        // Token balances will be automatically refreshed
        toast.success("USDC claimed successfully!", {
          description: "Your balance will be updated shortly"
        });
      }
    } catch (error) {
      console.error("Error claiming USDC:", error);
      toast.error("Failed to claim USDC", {
        description: "Please try again later"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Balance */}
      {isLoading ? (
        <BalanceSkeleton />
      ) : (
        <Card className="overflow-hidden dark:border-primary/20 border-primary/30">
          <CardHeader className="bg-gradient-to-r from-primary to-accent text-white">
            <CardTitle className="text-xl text-white flex items-center justify-between">
              Your Balance
              <Button
                size="sm"
                variant="ghost"
                className="text-white h-7 hover:bg-white/20"
                onClick={() => setShowQR(true)}
              >
                <QrCode className="h-4 w-4 mr-1" /> Receive
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              {!isConnected ? (
                <div className="text-sm text-muted-foreground">
                  Connect wallet to view balance
                </div>
              ) : tokens.length > 0 ? (
                <div className="space-y-4">
                  {/* IDRX Balance */}
                  {idrxBalance && (
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <img
                          src="/IDRX BLUE COIN.svg"
                          alt="IDRX"
                          className="w-8 h-8"
                        />
                        <div className="text-2xl font-bold">
                          {formatBalanceWithoutDecimals(idrxBalance.value, idrxBalance.symbol)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ≈ ${(Number(formatBalanceWithoutDecimals(idrxBalance.value)) * prices.idrx).toFixed(2)} USD
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No tokens found
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <Button
                variant="secondary"
                className="flex items-center gap-2 rounded-xl"
                onClick={() => navigate("/app/claims")}
              >
                <ArrowDown className="h-4 w-4" /> Claims
              </Button>
              <Button
                variant="secondary"
                className="flex items-center gap-2 rounded-xl"
                onClick={handleTopup}
                disabled={isClaiming || !userClaimInfo.canClaim}
              >
                <Droplets className="h-4 w-4" />
                {isClaiming ? "Claiming..." : "Topup"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <QuickAction
            icon={ArrowUp}
            label="Send"
            to="/app/transfer"
            color="bg-gradient-to-br from-primary to-accent"
          />
          <QuickAction
            icon={BarChart2}
            label="Stream Payment"
            to="/app/streams"
            color="bg-gradient-to-br from-blue-500 to-cyan-400"
          />
          <QuickAction
            icon={UserPlus}
            label="Set your STRAPT ID"
            onClick={() => setShowUsernameReg(true)}
            color="bg-gradient-to-br from-emerald-500 to-green-400"
          />
        </div>
      </div>

      {/* Stablecoin Balances */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Stablecoin Balances</h2>
        <Card className="dark:border-primary/20 border-primary/30">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-secondary rounded-full animate-pulse" />
                    <div className="space-y-1">
                      <div className="w-16 h-4 bg-secondary rounded animate-pulse" />
                      <div className="w-24 h-3 bg-secondary rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-secondary rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-secondary rounded-full animate-pulse" />
                    <div className="space-y-1">
                      <div className="w-16 h-4 bg-secondary rounded animate-pulse" />
                      <div className="w-24 h-3 bg-secondary rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-secondary rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {tokens.filter(token => token.symbol === 'IDRX' || token.symbol === 'USDC').map((token) => (
                  <div key={token.symbol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={token.icon}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div>
                        <p className="font-medium">{token.symbol}</p>
                        <p className="text-sm text-muted-foreground">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatBalanceWithoutDecimals(BigInt(Math.floor(token.balance * (token.symbol === 'IDRX' ? 100 : 1000000))), token.symbol)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
      Commented out sections - preserved for future use

      Received Stats:
      {isLoading || isLoadingHistory ? (
        <ReceivedStatsSkeleton />
      ) : (
        <ReceivedStats
          totalReceived={totalReceived}
          recentActivity={recentActivity}
        />
      )}

      Recent Activity:
      {isLoading || isLoadingHistory ? (
        <ActivitySkeleton />
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Recent Activity</h2>
          <Card className="dark:border-primary/20 border-primary/30">
            <CardContent className="p-0">
              {transactions.length > 0 ? (
                <>
                  {transactions.map((transaction) => (
                    <ActivityItem
                      key={transaction.id}
                      type={transaction.type === 'received' || transaction.type === 'stream_received' ? 'received' :
                            transaction.status === 'pending' ? 'pending' : 'sent'}
                      title={transaction.title}
                      amount={`${transaction.amount} ${transaction.tokenSymbol}`}
                      date={transaction.date.toLocaleDateString()}
                      recipient={transaction.recipient}
                      hash={transaction.hash}
                    />
                  ))}
                  {hasMore && (
                    <div className="p-3 border-t border-border">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={loadMore}
                        disabled={isLoadingHistory}
                      >
                        {isLoadingHistory ? "Loading..." : "Load More"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <p>No recent activity</p>
                  <p className="text-sm">Your transactions will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      */}

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Wallet QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            <QRCode value={address || ''} size={200} />
            <p className="text-sm font-medium">Your Wallet Address</p>
            <p className="text-xs text-muted-foreground">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
            </p>
            <div className="flex flex-col w-full gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (address) {
                    navigator.clipboard.writeText(address);
                    toast.success("Address copied to clipboard");
                  }
                }}
                disabled={!address}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy Address
              </Button>
              <QRCodeScanner
                buttonVariant="outline"
                buttonText="Scan QR Code to Claim"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Username Registration Dialog */}
      <Dialog open={showUsernameReg} onOpenChange={setShowUsernameReg}>
        <DialogContent className="p-0 overflow-hidden max-w-md">
          <EnhancedUsernameRegistration onComplete={handleCompleteRegistration} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
