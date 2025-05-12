import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop, type DropInfo } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Clock, Users, RefreshCcw, AlertTriangle, Check } from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import contractConfig from '@/contracts/contract-config.json';

const MyDrops = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const {
    getUserCreatedDrops,
    refundExpiredDrop,
    isLoading,
    isLoadingUserDrops
  } = useStraptDrop();

  const [drops, setDrops] = useState<{id: string; info: DropInfo}[]>([]);
  const [isRefunding, setIsRefunding] = useState<{[key: string]: boolean}>({});
  const [tokenSymbols, setTokenSymbols] = useState<{[key: string]: string}>({});

  // Load user's drops
  useEffect(() => {
    if (isConnected && address) {
      loadUserDrops();
    }
  }, [isConnected, address]);

  // Load user's drops
  const loadUserDrops = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet to view your drops');
      return;
    }

    try {
      const userDrops = await getUserCreatedDrops();
      setDrops(userDrops);

      // Determine token symbols for each drop
      const symbols: {[key: string]: string} = {};

      for (const drop of userDrops) {
        const tokenAddress = drop.info.tokenAddress.toLowerCase();
        const idrxAddress = contractConfig.ProtectedTransfer.supportedTokens.IDRX.toLowerCase();
        const usdcAddress = contractConfig.ProtectedTransfer.supportedTokens.USDC.toLowerCase();

        if (tokenAddress === idrxAddress) {
          symbols[drop.id] = 'IDRX';
        } else if (tokenAddress === usdcAddress) {
          symbols[drop.id] = 'USDC';
        } else {
          symbols[drop.id] = 'Token';
        }
      }

      setTokenSymbols(symbols);
    } catch (error) {
      console.error('Error loading user drops:', error);
      toast.error('Failed to load your drops');
    }
  };

  // Handle refund
  const handleRefund = async (dropId: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet to refund this drop');
      return;
    }

    try {
      setIsRefunding(prev => ({ ...prev, [dropId]: true }));

      const amount = await refundExpiredDrop(dropId);

      if (amount) {
        toast.success(`Successfully refunded ${amount} ${tokenSymbols[dropId] || 'tokens'}`);

        // Reload drops after refund
        await loadUserDrops();
      }
    } catch (error) {
      console.error('Error refunding drop:', error);

      if (error instanceof Error) {
        if (error.message.includes('NotExpiredYet')) {
          toast.error('This drop has not expired yet');
        } else if (error.message.includes('NotCreator')) {
          toast.error('Only the creator can refund this drop');
        } else if (error.message.includes('DropNotActive')) {
          toast.error('This drop is not active');
        } else if (error.message.includes('DropNotFound')) {
          toast.error('This drop does not exist');
          // Reload drops to remove the non-existent drop from the list
          await loadUserDrops();
        } else {
          toast.error(`Error refunding drop: ${error.message}`);
        }
      } else {
        toast.error('An unknown error occurred while refunding the drop');
      }
    } finally {
      setIsRefunding(prev => ({ ...prev, [dropId]: false }));
    }
  };

  // Format expiry time
  const formatExpiryTime = (expiryTime: number) => {
    if (expiryTime <= 0) return 'No expiration';

    const expiryDate = new Date(expiryTime * 1000);
    const now = new Date();

    if (expiryDate <= now) {
      return 'Expired';
    }

    // Calculate time difference in hours
    const diffInHours = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Expires in less than an hour';
    }

    if (diffInHours === 1) {
      return 'Expires in 1 hour';
    }

    return `Expires in ${diffInHours} hours`;
  };

  // Check if a drop is expired
  const isExpired = (expiryTime: number) => {
    return expiryTime > 0 && expiryTime * 1000 < Date.now();
  };

  // Check if a drop can be refunded
  const canRefund = (drop: DropInfo) => {
    return drop.isActive && isExpired(drop.expiryTime) && Number(drop.remainingAmount) > 0;
  };

  return (
    <div className="container max-w-4xl mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">My STRAPT Drops</h1>
          <InfoTooltip
            content={
              <div>
                <p className="font-medium mb-1">About My STRAPT Drops</p>
                <p className="mb-1">View and manage your created STRAPT Drops.</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>See all drops you've created</li>
                  <li>Refund expired drops that haven't been fully claimed</li>
                  <li>Track claim status of your drops</li>
                </ul>
              </div>
            }
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUserDrops}
            disabled={isLoadingUserDrops}
            className="flex-1 sm:flex-none"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/app/strapt-drop')}
            className="flex-1 sm:flex-none"
          >
            <Gift className="h-4 w-4 mr-2" />
            Create New Drop
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 sm:px-6 text-center">
            <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium mb-2">Wallet Not Connected</p>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">Please connect your wallet to view your STRAPT Drops</p>
          </CardContent>
        </Card>
      ) : isLoadingUserDrops ? (
        <div className="flex justify-center py-8 sm:py-12">
          <Loading size="lg" text="Loading your STRAPT Drops..." />
        </div>
      ) : drops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 sm:px-6 text-center">
            <Gift className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium mb-2">No STRAPT Drops Found</p>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">You haven't created any STRAPT Drops yet</p>
            <Button
              onClick={() => navigate('/app/strapt-drop')}
              size="sm"
              className="text-xs sm:text-sm"
            >
              Create Your First Drop
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {drops.map((drop) => (
            <Card key={drop.id} className={drop.info.isActive ? '' : 'opacity-70'}>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  {drop.info.isActive ? 'Active Drop' : 'Inactive Drop'}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Created {new Date(drop.info.expiryTime * 1000 - 24 * 60 * 60 * 1000).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2 px-4 sm:px-6">
                <div className="bg-secondary/30 p-3 rounded-lg">
                  <p className="font-medium text-sm sm:text-base">
                    {drop.info.totalAmount} {tokenSymbols[drop.id] || 'tokens'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    For {drop.info.totalRecipients} recipients • {drop.info.isRandom ? 'Random' : 'Fixed'} distribution
                  </p>
                  {drop.info.message && (
                    <p className="mt-1 text-xs sm:text-sm italic truncate">{drop.info.message.length > 50 ? `"${drop.info.message.substring(0, 50)}..."` : `"${drop.info.message}"`}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" /> Expiry
                    </span>
                    <span className={isExpired(drop.info.expiryTime) ? 'text-destructive' : ''}>
                      {formatExpiryTime(drop.info.expiryTime)}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4" /> Claims
                    </span>
                    <span>
                      {drop.info.claimedCount} / {drop.info.totalRecipients}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span>
                      {drop.info.remainingAmount} {tokenSymbols[drop.id] || 'tokens'}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-4 sm:px-6">
                {canRefund(drop.info) ? (
                  <Button
                    className="w-full text-xs sm:text-sm"
                    onClick={() => handleRefund(drop.id)}
                    disabled={isRefunding[drop.id] || isLoading}
                    size="sm"
                  >
                    {isRefunding[drop.id] ? (
                      <>
                        <Loading size="sm" className="mr-2" /> Refunding...
                      </>
                    ) : (
                      'Refund Expired Drop'
                    )}
                  </Button>
                ) : drop.info.isActive && !isExpired(drop.info.expiryTime) ? (
                  <Button
                    className="w-full text-xs sm:text-sm"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Generate share link
                      const baseUrl = window.location.origin;
                      const link = `${baseUrl}/app/strapt-drop/claim?id=${drop.id}`;

                      // Copy to clipboard
                      navigator.clipboard.writeText(link)
                        .then(() => toast.success('Link copied to clipboard'))
                        .catch(() => toast.error('Failed to copy link'));
                    }}
                  >
                    Copy Share Link
                  </Button>
                ) : !drop.info.isActive && drop.info.claimedCount >= drop.info.totalRecipients ? (
                  <div className="w-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground py-2">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-green-500" /> All tokens claimed
                  </div>
                ) : !drop.info.isActive && Number(drop.info.remainingAmount) === 0 ? (
                  <div className="w-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground py-2">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-green-500" /> Drop refunded
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground py-2">
                    Drop inactive
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyDrops;
