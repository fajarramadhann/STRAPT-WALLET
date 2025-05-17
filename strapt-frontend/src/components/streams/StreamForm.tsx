import { useState, useCallback } from 'react';
import { ArrowRight, BarChart2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';
import MilestoneInput from '@/components/MilestoneInput';
import type { Milestone } from '@/components/MilestoneInput';
import DurationSelect from '@/components/DurationSelect';
import type { DurationUnit } from '@/components/DurationSelect';
import TokenSelect from '@/components/TokenSelect';
import type { TokenOption } from '@/components/TokenSelect';
import type { TokenType } from '@/hooks/use-payment-stream';

interface StreamFormProps {
  onCancel: () => void;
  onSubmit: (data: {
    recipient: string;
    tokenType: TokenType;
    amount: string;
    durationInSeconds: number;
    milestonePercentages: number[];
    milestoneDescriptions: string[];
  }) => Promise<void>;
  isCreatingStream: boolean;
  tokens: TokenOption[];
  isLoadingTokens: boolean;
}

const StreamForm = ({ onCancel, onSubmit, isCreatingStream, tokens, isLoadingTokens }: StreamFormProps) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(60);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('minutes');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenOption>(tokens[0]);
  const { toast } = useToast();

  const handleDurationChange = useCallback((value: number, unit: DurationUnit) => {
    setDuration(value);
    setDurationUnit(unit);
  }, []);

  const calculateStreamRate = useCallback(() => {
    if (!amount || !duration) return '0';

    const amountNum = Number.parseFloat(amount);

    let seconds = duration;
    if (durationUnit === 'minutes') seconds *= 60;
    if (durationUnit === 'hours') seconds *= 3600;
    if (durationUnit === 'days') seconds *= 86400;

    const ratePerSecond = amountNum / seconds;

    if (ratePerSecond >= 1) {
      return `${ratePerSecond.toFixed(2)} ${selectedToken.symbol}/second`;
    }

    if (ratePerSecond * 60 >= 1) {
      return `${(ratePerSecond * 60).toFixed(2)} ${selectedToken.symbol}/minute`;
    }

    if (ratePerSecond * 3600 >= 1) {
      return `${(ratePerSecond * 3600).toFixed(2)} ${selectedToken.symbol}/hour`;
    }

    return `${(ratePerSecond * 86400).toFixed(4)} ${selectedToken.symbol}/day`;
  }, [amount, duration, durationUnit, selectedToken.symbol]);

  const getDurationInMinutes = useCallback(() => {
    switch (durationUnit) {
      case 'seconds': return duration / 60;
      case 'minutes': return duration;
      case 'hours': return duration * 60;
      case 'days': return duration * 24 * 60;
      default: return duration;
    }
  }, [duration, durationUnit]);

  const handleCreateStream = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipient || !amount || !duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validate amount
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    // Check if amount is greater than balance
    if (selectedToken.balance && Number(amount) > selectedToken.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${selectedToken.balance} ${selectedToken.symbol} available`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Calculate duration in seconds
      let durationInSeconds = duration;
      if (durationUnit === 'minutes') durationInSeconds *= 60;
      if (durationUnit === 'hours') durationInSeconds *= 3600;
      if (durationUnit === 'days') durationInSeconds *= 86400;

      // Extract milestone data
      const milestonePercentages = milestones.map(m => m.percentage);
      const milestoneDescriptions = milestones.map(m => m.description);

      // Create the stream
      const tokenType = selectedToken.symbol as TokenType;
      await onSubmit({
        recipient,
        tokenType,
        amount,
        durationInSeconds,
        milestonePercentages,
        milestoneDescriptions
      });
    } catch (error) {
      console.error('Error creating stream:', error);
      toast({
        title: "Error Creating Stream",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [recipient, amount, duration, durationUnit, milestones, selectedToken, toast, onSubmit]);

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={onCancel} className="mr-4 p-0 h-auto">
          <ArrowRight className="h-5 w-5 rotate-180" />
        </Button>
        <h2 className="text-xl font-semibold">Create Stream</h2>
      </div>

      <form onSubmit={handleCreateStream}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <BarChart2 className="h-5 w-5 mr-2 text-primary" />
              Stream Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient</Label>
              <Input
                id="recipient"
                placeholder="wallet address 0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <TokenSelect
                tokens={tokens}
                selectedToken={selectedToken}
                onTokenChange={setSelectedToken}
                isLoading={isLoadingTokens}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Total Amount</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className={`pr-16 ${
                    amount && (
                      Number.isNaN(Number(amount)) ||
                      Number(amount) <= 0 ||
                      (selectedToken.balance && Number(amount) > selectedToken.balance)
                    ) ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground"
                  onClick={() => {
                    const balance = selectedToken.balance || 0;
                    setAmount(balance.toString());
                  }}
                >
                  MAX
                </button>
              </div>
              {amount && Number.isNaN(Number(amount)) && (
                <p className="text-xs text-red-500">
                  Please enter a valid number
                </p>
              )}
              {amount && !Number.isNaN(Number(amount)) && Number(amount) <= 0 && (
                <p className="text-xs text-red-500">
                  Amount must be greater than 0
                </p>
              )}
              {amount && !Number.isNaN(Number(amount)) && selectedToken.balance && Number(amount) > selectedToken.balance && (
                <p className="text-xs text-red-500">
                  Insufficient balance
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Available: {selectedToken.balance?.toFixed(2) || 0} {selectedToken.symbol}
              </p>
            </div>

            <DurationSelect
              value={duration}
              unit={durationUnit}
              onChange={handleDurationChange}
              label="Duration"
            />

            {amount && duration && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate:</span>
                  <span>
                    {calculateStreamRate()}
                  </span>
                </div>
              </div>
            )}

            {duration > 0 && (
              <MilestoneInput
                milestones={milestones}
                onChange={setMilestones}
                duration={getDurationInMinutes()}
              />
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={
                isCreatingStream ||
                !recipient ||
                !amount ||
                Number.isNaN(Number(amount)) ||
                Number(amount) <= 0 ||
                (selectedToken.balance && Number(amount) > selectedToken.balance)
              }
            >
              {isCreatingStream ? (
                <>
                  <Loading size="sm" className="mr-2" /> Creating Stream...
                </>
              ) : (
                <>
                  Start Stream <Play className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default StreamForm;
