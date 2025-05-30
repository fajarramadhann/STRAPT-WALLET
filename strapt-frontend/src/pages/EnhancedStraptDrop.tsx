import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop } from '@/hooks/use-strapt-drop';
import type { TokenType } from '@/hooks/use-strapt-drop';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { Loading } from '@/components/ui/loading';
import { Gift, AlertTriangle, Check, Share2, QrCode, Shuffle, Coins, Clock, ChevronLeft, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import QRCode from '@/components/QRCode';
import { generateDropClaimLink } from '@/utils/qr-code-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TokenSelect from '@/components/TokenSelect';

const EnhancedStraptDrop = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useXellarWallet();
  const { createDrop, isLoading, isApproving, isCreating, currentDropId } = useStraptDrop();
  const { tokens } = useTokenBalances();

  // Form state
  const [tokenType, setTokenType] = useState<TokenType>('IDRX');
  const [amount, setAmount] = useState('');
  const [recipients, setRecipients] = useState('10');
  const [isRandomDistribution, setIsRandomDistribution] = useState(false);
  // Fixed expiry time at 24 hours
  const expiryHours = 24;

  // Find selected token from tokens list
  const selectedToken = tokens.find(token => token.symbol === tokenType) || tokens[0];

  // UI state
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [dropLink, setDropLink] = useState('');

  // Validation
  const [errors, setErrors] = useState<{
    amount?: string;
    recipients?: string;
  }>({});

  // Reset form when navigating away
  useEffect(() => {
    return () => {
      setShowSuccess(false);
      setShowQR(false);
    };
  }, []);

  // Show success dialog when drop is created
  useEffect(() => {
    if (currentDropId) {
      const link = generateDropClaimLink(currentDropId);
      setDropLink(link);
      setShowSuccess(true);
    }
  }, [currentDropId]);

  const validateForm = () => {
    const newErrors: {
      amount?: string;
      recipients?: string;
    } = {};

    // Validate amount
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    } else if (selectedToken && selectedToken.balance !== undefined && Number(amount) > selectedToken.balance) {
      newErrors.amount = 'Amount exceeds your balance';
    }

    // Validate recipients
    if (!recipients) {
      newErrors.recipients = 'Number of recipients is required';
    } else if (Number.isNaN(Number(recipients)) || Number(recipients) <= 0 || !Number.isInteger(Number(recipients))) {
      newErrors.recipients = 'Recipients must be a positive integer';
    } else if (Number(recipients) > 100) {
      newErrors.recipients = 'Maximum 100 recipients allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateDrop = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await createDrop(
        tokenType,
        amount,
        Number.parseInt(recipients),
        isRandomDistribution,
        expiryHours,
        "" // Empty message
      );
    } catch (error) {
      console.error('Error creating drop:', error);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(dropLink);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="container max-w-3xl mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app')}
            className="mr-1"
            aria-label="Back to App"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Create STRAPT Drop</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/app/strapt-drop/my-drops')}
          className="w-full sm:w-auto"
        >
          View My Drops
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-primary/20 shadow-md overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5 text-primary" />
                Create New STRAPT Drop
              </CardTitle>
              <CardDescription>
                Distribute tokens to multiple recipients with a single transaction
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              {/* Token Selection */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="token-type" className="text-sm font-medium">Token</Label>
                  {/* {selectedToken && selectedToken.balance !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Balance: {selectedToken.balance.toLocaleString()} {selectedToken.symbol}
                    </span>
                  )} */}
                </div>
                <TokenSelect
                  tokens={tokens.map(token => ({
                    symbol: token.symbol,
                    name: token.name || token.symbol,
                    balance: token.balance,
                    icon: token.symbol === 'USDC'
                      ? '/usd-coin-usdc-logo.svg'
                      : token.symbol === 'IDRX'
                        ? '/IDRX BLUE COIN.svg'
                        : undefined
                  }))}
                  selectedToken={{
                    symbol: selectedToken.symbol,
                    name: selectedToken.name || selectedToken.symbol,
                    balance: selectedToken.balance,
                    icon: selectedToken.symbol === 'USDC'
                      ? '/usd-coin-usdc-logo.svg'
                      : selectedToken.symbol === 'IDRX'
                        ? '/IDRX BLUE COIN.svg'
                        : undefined
                  }}
                  onTokenChange={(token) => setTokenType(token.symbol as TokenType)}
                  className="w-full"
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="amount" className="text-sm font-medium">Total Amount</Label>
                  {selectedToken && selectedToken.balance !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Balance: {selectedToken.balance.toLocaleString()} {selectedToken.symbol}
                    </span>
                  )}
                </div>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={errors.amount ? 'border-destructive' : ''}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount}</p>
                )}
              </div>

              {/* Recipients Input */}
              <div className="space-y-2">
                <Label htmlFor="recipients" className="text-sm font-medium">Number of Recipients</Label>
                <Input
                  id="recipients"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Enter number of recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className={errors.recipients ? 'border-destructive' : ''}
                />
                {errors.recipients && (
                  <p className="text-xs text-destructive">{errors.recipients}</p>
                )}
              </div>

              {/* Distribution Type */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="distribution-type" className="text-sm font-medium">Random Distribution</Label>
                  <Switch
                    id="distribution-type"
                    checked={isRandomDistribution}
                    onCheckedChange={setIsRandomDistribution}
                  />
                </div>

                <div className={cn(
                  "p-3 rounded-lg border",
                  isRandomDistribution
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-blue-500/10 border-blue-500/30"
                )}>
                  {isRandomDistribution ? (
                    <div className="flex items-start gap-3">
                      <Shuffle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Random Distribution</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recipients will receive random amounts between 1% and 200% of the average amount.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Coins className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Fixed Distribution</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Each recipient will receive exactly {amount && recipients ? (Number(amount) / Number(recipients)).toLocaleString() : '0'} {selectedToken?.symbol}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expiry Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Expiry Time</Label>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-muted">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">24 Hours</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unclaimed tokens can be refunded after 24 hours.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end pt-2 pb-6 px-6 border-t border-border">
              <Button
                onClick={handleCreateDrop}
                disabled={isLoading || isApproving || isCreating}
                className="min-w-32"
              >
                {isApproving ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Approving...
                  </>
                ) : isCreating ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Create Drop
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              STRAPT Drop Created!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Your STRAPT Drop has been created successfully. Share the link with recipients.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                readOnly
                value={dropLink}
                className="flex-1 text-sm"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopyLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowQR(true)}
                className="w-full sm:w-auto"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Show QR Code
              </Button>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSuccess(false);
                  navigate('/app/strapt-drop/my-drops');
                }}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                View My Drops
              </Button>
              <Button
                onClick={() => {
                  setShowSuccess(false);
                  setTokenType('IDRX');
                  setAmount('');
                  setRecipients('10');
                  setIsRandomDistribution(false);
                }}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                Create Another Drop
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              STRAPT Drop QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this QR code to claim tokens from the STRAPT Drop
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-6">
            <QRCode value={dropLink} size={250} />
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border">
            <Button
              onClick={() => setShowQR(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedStraptDrop;
