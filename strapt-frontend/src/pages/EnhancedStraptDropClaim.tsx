import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop } from '@/hooks/use-strapt-drop';
import type { DropInfo } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Clock, Users, AlertTriangle, Check, Shuffle, Coins, PartyPopper, QrCode, ChevronLeft, Droplets } from 'lucide-react';
import { formatUnits } from 'viem';
import contractConfig from '@/contracts/contract-config.json';
import QRCodeScanner from '@/components/QRCodeScanner';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import FaucetClaim from '@/components/FaucetClaim';

const EnhancedStraptDropClaim = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const { getDropInfo, claimDrop, hasAddressClaimed, isLoading, isClaiming } = useStraptDrop();

  // Extract drop ID from URL
  const dropId = location.pathname.split('/').pop() || '';

  // State
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load drop info
  useEffect(() => {
    const loadDropInfo = async () => {
      if (!dropId) return;

      try {
        const info = await getDropInfo(dropId);
        setDropInfo(info);

        // Check if user has already claimed
        if (address) {
          const claimed = await hasAddressClaimed(dropId, address);
          setHasClaimed(claimed);
        }
      } catch (error) {
        console.error('Error loading drop info:', error);
        setError('Failed to load drop information');
      }
    };

    loadDropInfo();
  }, [dropId, address, getDropInfo, hasAddressClaimed]);

  // Function to trigger confetti
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0, 0.2) }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0, 0.2) }
      });
    }, 250);
  };

  // Check if drop is expired
  const isExpired = (expiryTime: bigint) => {
    return Date.now() / 1000 > Number(expiryTime);
  };

  // Check if creator is within cooldown period (can't claim their own drop within 24 hours)
  const isCreatorWithinCooldown = (info: DropInfo) => {
    if (!address) return false;
    return address.toLowerCase() === info.creator.toLowerCase();
  };

  // Format token amount
  const formatTokenAmount = (amount: bigint, tokenAddress: string) => {
    const tokenDecimals =
      tokenAddress.toLowerCase() === contractConfig.StraptDrop.supportedTokens.USDC.toLowerCase()
        ? 6
        : tokenAddress.toLowerCase() === contractConfig.StraptDrop.supportedTokens.IDRX.toLowerCase()
          ? 2
          : 18;

    return formatUnits(amount, tokenDecimals);
  };

  // Get token symbol
  const getTokenSymbol = (tokenAddress: string) => {
    if (tokenAddress.toLowerCase() === contractConfig.StraptDrop.supportedTokens.USDC.toLowerCase()) {
      return 'USDC';
    }
    if (tokenAddress.toLowerCase() === contractConfig.StraptDrop.supportedTokens.IDRX.toLowerCase()) {
      return 'IDRX';
    }
    return 'Tokens';
  };

  // Handle claim
  const handleClaim = async () => {
    if (!dropId || !dropInfo || !isConnected) return;

    try {
      const amount = await claimDrop(dropId);
      setClaimAmount(amount);
      setHasClaimed(true);

      // Show success animation
      setShowSuccessAnimation(true);

      // Trigger confetti
      triggerConfetti();

      // Hide success animation after 5 seconds
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 5000);

      toast({
        title: 'Success',
        description: 'Successfully claimed tokens!'
      });
    } catch (error) {
      console.error('Error claiming drop:', error);

      // Handle specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('already claimed')) {
        toast({
          title: 'Already Claimed',
          description: 'You have already claimed tokens from this drop',
          variant: 'destructive'
        });
        setHasClaimed(true);
      } else if (errorMessage.includes('drop is not active')) {
        toast({
          title: 'Drop Inactive',
          description: 'This drop is no longer active',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Claim Failed',
          description: 'Failed to claim tokens. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  // Handle QR code scan
  const handleScan = (data: string) => {
    try {
      // Extract drop ID from URL
      const url = new URL(data);
      const pathSegments = url.pathname.split('/');
      const scannedDropId = pathSegments[pathSegments.length - 1];

      if (scannedDropId) {
        navigate(`/app/strapt-drop/claim/${scannedDropId}`);
      }
    } catch (error) {
      console.error('Invalid QR code data:', error);
      toast({
        title: 'Invalid QR Code',
        description: 'The scanned QR code is not a valid STRAPT Drop',
        variant: 'destructive'
      });
    }
  };

  // Calculate progress percentage
  const getClaimProgress = () => {
    if (!dropInfo) return 0;
    return Number(dropInfo.claimedCount) / Number(dropInfo.totalRecipients) * 100;
  };

  return (
    <div className="container max-w-3xl mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/strapt-drop')}
            className="mr-1"
            aria-label="Back to STRAPT Drop"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Claim STRAPT Drop</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScanner(true)}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Scan QR Code
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/app/strapt-drop')}
          >
            <Gift className="h-4 w-4 mr-2" />
            Create Drop
          </Button>
        </div>
      </div>

      {!dropId ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-primary/20 shadow-md overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-6 text-center">
              <Gift className="h-16 w-16 text-primary/70 mb-6" />
              <h2 className="text-xl font-medium mb-3">No Drop ID Provided</h2>
              <p className="text-base text-muted-foreground mb-8 max-w-md">
                Please scan a QR code or use a link to claim tokens from a STRAPT Drop
              </p>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/app/strapt-drop')}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Scan QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-destructive/20 shadow-md overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-6 text-center">
              <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
              <h2 className="text-xl font-medium mb-3">Drop Not Found</h2>
              <p className="text-base text-muted-foreground mb-8 max-w-md">
                The STRAPT Drop you're looking for doesn't exist or has been removed
              </p>
              <Button
                onClick={() => navigate('/app/strapt-drop')}
              >
                Create a New Drop
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : isLoading ? (
        <Card className="border border-primary/20 shadow-md overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-6 text-center">
            <Loading text="Loading drop information..." />
          </CardContent>
        </Card>
      ) : dropInfo ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl mx-auto"
        >
          <Card className="overflow-hidden border border-primary/20 shadow-lg">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gift className="h-6 w-6 text-primary" />
                STRAPT Drop
              </CardTitle>
              <CardDescription>
                Claim your tokens from this STRAPT Drop
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Token Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                    {getTokenSymbol(dropInfo.tokenAddress) === 'USDC' ? (
                      <img src="/usd-coin-usdc-logo.svg" alt="USDC" className="w-full h-full object-cover" />
                    ) : getTokenSymbol(dropInfo.tokenAddress) === 'IDRX' ? (
                      <img src="/IDRX BLUE COIN.svg" alt="IDRX" className="w-full h-full object-cover" />
                    ) : (
                      <Coins className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">
                      {getTokenSymbol(dropInfo.tokenAddress)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {dropInfo.isRandom ? 'Random amount' : formatTokenAmount(dropInfo.amountPerRecipient, dropInfo.tokenAddress)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <h3 className="font-medium">
                    {Number(dropInfo.claimedCount).toLocaleString()} / {Number(dropInfo.totalRecipients).toLocaleString()}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Recipients claimed
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={getClaimProgress()} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(getClaimProgress())}%</span>
                </div>
              </div>

              {/* Distribution Type */}
              <div className={cn(
                "p-3 rounded-lg border",
                dropInfo.isRandom
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-blue-500/10 border-blue-500/30"
              )}>
                {dropInfo.isRandom ? (
                  <div className="flex items-start gap-3">
                    <Shuffle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Random Distribution</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You'll receive a random amount between 1% and 200% of the average.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Coins className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Fixed Distribution</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each recipient receives exactly {formatTokenAmount(dropInfo.amountPerRecipient, dropInfo.tokenAddress)} {getTokenSymbol(dropInfo.tokenAddress)}.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Expiry Time */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-muted">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {isExpired(dropInfo.expiryTime) ? 'Expired' : 'Expires in'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isExpired(dropInfo.expiryTime)
                      ? 'This drop has expired. Unclaimed tokens can be refunded by the creator.'
                      : `Expires ${new Date(Number(dropInfo.expiryTime) * 1000).toLocaleString()}`
                    }
                  </p>
                </div>
              </div>

              {/* Claimed Amount (if claimed) */}
              <AnimatePresence>
                {hasClaimed && claimAmount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Claimed Successfully
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You received {claimAmount} {getTokenSymbol(dropInfo.tokenAddress)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="pt-2 pb-6 px-6 border-t border-border">
              <div className="flex gap-3 w-full">
                <motion.div
                  className="flex-1"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    className={cn(
                      "w-full text-base py-6",
                      hasClaimed && "bg-green-500 hover:bg-green-600"
                    )}
                    size="lg"
                    disabled={
                      isLoading ||
                      isClaiming ||
                      hasClaimed ||
                      !dropInfo.isActive ||
                      isExpired(dropInfo.expiryTime) ||
                      dropInfo.claimedCount >= dropInfo.totalRecipients ||
                      isCreatorWithinCooldown(dropInfo)
                    }
                    onClick={handleClaim}
                  >
                    {isClaiming ? (
                      <>
                        <Loading size="sm" className="mr-2" />
                        Claiming...
                      </>
                    ) : isLoading ? (
                      <>
                        <Loading size="sm" className="mr-2" />
                        Processing...
                      </>
                    ) : hasClaimed ? (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Already Claimed
                      </>
                    ) : (
                      <>
                        <Gift className="h-5 w-5 mr-2" />
                        Claim Tokens
                      </>
                    )}
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="py-6 px-4"
                    onClick={() => setShowTopupModal(true)}
                  >
                    <Droplets className="h-5 w-5" />
                  </Button>
                </motion.div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      ) : null}

      {/* QR Code Scanner Dialog */}
      <QRCodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
      />

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-card rounded-xl p-8 flex flex-col items-center max-w-md mx-4"
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.7, 1] }}
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-green-500 flex items-center justify-center mb-4 animate-pulse shadow-lg">
                  <PartyPopper className="h-10 w-10 text-white" />
                </div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2"
              >
                Tokens Claimed!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-muted-foreground mb-6"
              >
                You received {claimAmount} {dropInfo ? getTokenSymbol(dropInfo.tokenAddress) : 'tokens'}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={() => setShowSuccessAnimation(false)}
                  className="px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all"
                >
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topup Modal */}
      <Dialog open={showTopupModal} onOpenChange={setShowTopupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              Top Up Tokens
            </DialogTitle>
            <DialogDescription>
              Get free test tokens to use with STRAPT
            </DialogDescription>
          </DialogHeader>
          <FaucetClaim />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedStraptDropClaim;
