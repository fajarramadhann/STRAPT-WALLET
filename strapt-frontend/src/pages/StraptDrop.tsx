import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { useStraptDrop } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Share2, Users, Coins, Clock, ArrowRight, QrCode } from 'lucide-react';
import QRCode from '@/components/QRCode';
import InfoTooltip from '@/components/InfoTooltip';
import TokenSelect from '@/components/TokenSelect';
import type { TokenOption } from '@/components/TokenSelect';

const StraptDrop = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const { tokens } = useTokenBalances();
  const { createDrop, isLoading, isConfirmed } = useStraptDrop();

  // State for create drop form
  const [amount, setAmount] = useState('');
  const [recipients, setRecipients] = useState('10');
  const [isRandom, setIsRandom] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenOption>({
    symbol: 'IDRX',
    name: 'IDRX Token',
    balance: 0,
    icon: '/IDRX BLUE COIN.svg',
  });

  // State for created drop
  const [activeTab, setActiveTab] = useState('create');
  const [createdDropId, setCreatedDropId] = useState('');
  const [shareLink, setShareLink] = useState('');

  // Calculate per-recipient amount for fixed distribution
  const perRecipientAmount = amount && recipients
    ? (Number(amount) / Number(recipients)).toFixed(2)
    : '0.00';

  // Handle form submission
  const handleCreateDrop = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a STRAPT Drop",
        variant: "destructive"
      });
      return;
    }

    if (!amount || !recipients) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validate amount (minimum 1000 for IDRX, 1 for USDC)
    const minAmount = selectedToken.symbol === 'IDRX' ? 1000 : 1;
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) < minAmount) {
      toast({
        title: "Invalid Amount",
        description: `Please enter a valid amount of at least ${minAmount} ${selectedToken.symbol}`,
        variant: "destructive"
      });
      return;
    }

    // Validate recipients
    if (!recipients || Number.isNaN(Number(recipients)) || Number(recipients) <= 0) {
      toast({
        title: "Invalid Recipients",
        description: "Please enter a valid number of recipients greater than 0",
        variant: "destructive"
      });
      return;
    }

    // Check if amount is greater than balance
    const selectedBalance = tokens.find(t => t.symbol === selectedToken.symbol)?.balance || 0;
    if (Number(amount) > selectedBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${selectedBalance.toFixed(2)} ${selectedToken.symbol} available`,
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await createDrop(
        amount,
        Number(recipients),
        isRandom,
        selectedToken.symbol as 'IDRX' | 'USDC',
        message
      );

      if (result?.dropId) {
        // Generate share link
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/app/strapt-drop/claim?id=${result.dropId}`;

        setCreatedDropId(result.dropId);
        setShareLink(link);
        setActiveTab('share');

        toast({
          title: "STRAPT Drop Created",
          description: "Your STRAPT Drop has been created successfully!"
        });
      }
    } catch (error) {
      console.error('Error creating STRAPT Drop:', error);
      toast({
        title: "Error Creating STRAPT Drop",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };

  // Handle copy link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Link Copied",
      description: "STRAPT Drop link copied to clipboard"
    });
  };

  // Handle share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'STRAPT Drop',
          text: message || 'I sent you a STRAPT Drop!',
          url: shareLink,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">STRAPT Drop</h1>
          <InfoTooltip
            content={
              <div>
                <p className="font-medium mb-1">About STRAPT Drop</p>
                <p className="mb-1">Create and share tokens with multiple recipients.</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>Choose IDRX or USDC tokens</li>
                  <li>Minimum amount: 1000 IDRX or 1 USDC</li>
                  <li>Choose fixed or random distribution</li>
                  <li>Set number of recipients</li>
                  <li>Share via link or QR code</li>
                  <li>Unclaimed tokens can be refunded by creator after 24 hours</li>
                </ul>
              </div>
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/strapt-drop/my-drops')}
        >
          My Drops
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="share" disabled={!createdDropId}>Share</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create STRAPT Drop</CardTitle>
              <CardDescription>
                Share tokens with multiple recipients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-muted-foreground" /> Token
                </Label>
                <TokenSelect
                  tokens={tokens}
                  selectedToken={selectedToken}
                  onTokenChange={setSelectedToken}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center gap-1">
                <Coins className="h-4 w-4 text-muted-foreground" />  Total Amount
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder={selectedToken.symbol === 'IDRX' ? "1000.00" : "1.00"}
                    min={selectedToken.symbol === 'IDRX' ? "1000" : "1"}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className={`pr-16 ${
                      amount && (
                        Number.isNaN(Number(amount)) ||
                        Number(amount) < (selectedToken.symbol === 'IDRX' ? 1000 : 1) ||
                        (Number(amount) > (tokens.find(t => t.symbol === selectedToken.symbol)?.balance || 0))
                      ) ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }`}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    <span className="text-xs text-muted-foreground mr-2">{selectedToken.symbol}</span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground"
                      onClick={() => {
                        const balance = tokens.find(t => t.symbol === selectedToken.symbol)?.balance;
                        if (balance) {
                          setAmount(balance.toString());
                        }
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Available: {tokens.find(t => t.symbol === selectedToken.symbol)?.balance.toFixed(2) || '0.00'} {selectedToken.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  Minimum amount: {selectedToken.symbol === 'IDRX' ? '1000' : '1'} {selectedToken.symbol}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipients" className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />  Number of Recipients
                </Label>
                <Input
                  id="recipients"
                  type="number"
                  placeholder="10"
                  min="1"
                  step="1"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  required
                  className={`${
                    recipients && (
                      Number.isNaN(Number(recipients)) ||
                      Number(recipients) <= 0
                    ) ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                {recipients && Number(recipients) > 0 && !isRandom && (
                  <p className="text-xs text-muted-foreground">
                    Each recipient will receive {perRecipientAmount} {selectedToken.symbol}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="random"
                  checked={isRandom}
                  onCheckedChange={setIsRandom}
                />
                <Label htmlFor="random" className="flex items-center gap-1">
                  Random Distribution
                  <InfoTooltip
                    content={
                      <div>
                        <p className="font-medium mb-1">Random Distribution</p>
                        <p>- When enabled, each recipient will receive a random amount of tokens.</p>
                        <p>- When disabled, each recipient will receive an equal amount.</p>
                      </div>
                    }
                    iconSize={14}
                  />
                </Label>
              </div>

              {/* <div className="space-y-2">
                <Label htmlFor="message" className="flex items-center gap-1">
                  Message (Optional) <Gift className="h-4 w-4 text-muted-foreground" />
                </Label>
                <Textarea
                  id="message"
                  placeholder="Add a message for your recipients..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none"
                />
              </div> */}

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />  Expiry Time
                </Label>
                <div className="p-3 bg-secondary/30 rounded-md">
                  <p className="text-sm">24 hours</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unclaimed tokens can be refunded by you after 24 hours
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleCreateDrop}
                disabled={
                  isLoading ||
                  !amount ||
                  !recipients ||
                  Number.isNaN(Number(amount)) ||
                  Number(amount) < (selectedToken.symbol === 'IDRX' ? 1000 : 1) ||
                  Number.isNaN(Number(recipients)) ||
                  Number(recipients) <= 0 ||
                  (Number(amount) > (tokens.find(t => t.symbol === selectedToken.symbol)?.balance || 0))
                }
              >
                {isLoading ? (
                  <>
                    <Loading size="sm" className="mr-2" /> Creating...
                  </>
                ) : (
                  <>
                    Create STRAPT Drop <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="share">
          {createdDropId && (
            <Card>
              <CardHeader>
                <CardTitle>Share Your STRAPT Drop</CardTitle>
                <CardDescription>
                  Share this link or QR code with your recipients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-secondary/30 p-4 rounded-lg text-center">
                  <p className="text-lg font-medium mb-2">
                    {amount} {selectedToken.symbol}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    For {recipients} recipients • {isRandom ? 'Random' : 'Fixed'} distribution
                  </p>
                  {message && (
                    <p className="mt-2 italic">"{message}"</p>
                  )}
                </div>

                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg">
                    <QRCode value={shareLink} size={200} bgColor="#FFFFFF" fgColor="#000000" />
                  </div>
                </div>

                <div className="relative">
                  <Input
                    value={shareLink}
                    readOnly
                    className="pr-24"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={handleCopyLink}
                  >
                    Copy Link
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Expires in 24 hours</p>
                  <p className="mt-1">Unclaimed tokens can be refunded by you after expiry</p>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setActiveTab('create')}>
                  Create Another
                </Button>
                <Button className="flex-1" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StraptDrop;
