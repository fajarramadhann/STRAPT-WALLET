import React, { useState } from 'react';
import { Users, Gift, Share2, Clock, Coins } from 'lucide-react';
import {
  FrameLayout,
  FrameHeader,
  FrameContent,
  FrameActions,
  FrameButton,
  FrameInput,
  FrameStatus,
  FrameImage,
} from './FrameLayout';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { formatUnits } from 'viem';

interface StraptDropFrameProps {
  dropId?: string;
  mode?: 'create' | 'claim' | 'view';
  onDropCreated?: (dropId: string) => void;
  onDropClaimed?: (amount: string) => void;
}

type DropStep = 'input' | 'confirm' | 'processing' | 'success' | 'claim' | 'claimed';

interface DropData {
  id?: string;
  totalAmount: string;
  recipientCount: number;
  distributionType: 'fixed' | 'random';
  token: string;
  expiresAt: Date;
  claimedCount: number;
  remainingAmount: string;
  creator: string;
}

export const StraptDropFrame: React.FC<StraptDropFrameProps> = ({
  dropId,
  mode = 'create',
  onDropCreated,
  onDropClaimed,
}) => {
  const { frameContext } = useFarcaster();
  const { balances } = useTokenBalances();
  
  const [step, setStep] = useState<DropStep>(mode === 'claim' ? 'claim' : 'input');
  const [totalAmount, setTotalAmount] = useState('');
  const [recipientCount, setRecipientCount] = useState('10');
  const [distributionType, setDistributionType] = useState<'fixed' | 'random'>('fixed');
  const [selectedToken, setSelectedToken] = useState('IDRX');
  const [error, setError] = useState('');
  const [dropData, setDropData] = useState<DropData | null>(null);
  const [claimedAmount, setClaimedAmount] = useState('');

  const tokenBalance = balances?.find(b => b.symbol === selectedToken);
  const formattedBalance = tokenBalance 
    ? formatUnits(tokenBalance.balance, tokenBalance.decimals)
    : '0';

  // Mock drop data for claim mode
  React.useEffect(() => {
    if (mode === 'claim' && dropId) {
      // Simulate fetching drop data
      setDropData({
        id: dropId,
        totalAmount: '1000',
        recipientCount: 50,
        distributionType: 'random',
        token: 'IDRX',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        claimedCount: 23,
        remainingAmount: '540',
        creator: 'strapt_creator',
      });
    }
  }, [mode, dropId]);

  const handleCreateDrop = () => {
    if (!totalAmount || !recipientCount) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(totalAmount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (parseFloat(totalAmount) > parseFloat(formattedBalance)) {
      setError('Insufficient balance');
      return;
    }

    setError('');
    setStep('confirm');
  };

  const handleConfirmDrop = async () => {
    setStep('processing');
    setError('');

    try {
      // Simulate drop creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockDropId = 'drop_' + Math.random().toString(36).substr(2, 9);
      setDropData({
        id: mockDropId,
        totalAmount,
        recipientCount: parseInt(recipientCount),
        distributionType,
        token: selectedToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        claimedCount: 0,
        remainingAmount: totalAmount,
        creator: frameContext.user?.username || 'anonymous',
      });
      
      setStep('success');
      onDropCreated?.(mockDropId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create drop');
      setStep('input');
    }
  };

  const handleClaimDrop = async () => {
    if (!dropData) return;

    setStep('processing');
    setError('');

    try {
      // Simulate claiming
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Calculate random claim amount
      const maxClaim = parseFloat(dropData.remainingAmount) / (dropData.recipientCount - dropData.claimedCount);
      const claimAmount = distributionType === 'fixed' 
        ? (parseFloat(dropData.totalAmount) / dropData.recipientCount).toFixed(2)
        : (Math.random() * maxClaim * 2).toFixed(2);
      
      setClaimedAmount(claimAmount);
      setStep('claimed');
      onDropClaimed?.(claimAmount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim drop');
      setStep('claim');
    }
  };

  const renderCreateInput = () => (
    <>
      <FrameContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Total Amount ({selectedToken})
            </label>
            <FrameInput
              placeholder="1000"
              value={totalAmount}
              onChange={setTotalAmount}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Balance: {formattedBalance} {selectedToken}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Number of Recipients
            </label>
            <FrameInput
              placeholder="10"
              value={recipientCount}
              onChange={setRecipientCount}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Distribution Type
            </label>
            <div className="flex gap-2">
              <FrameButton
                variant={distributionType === 'fixed' ? 'primary' : 'outline'}
                onClick={() => setDistributionType('fixed')}
                fullWidth
              >
                Fixed Amount
              </FrameButton>
              <FrameButton
                variant={distributionType === 'random' ? 'primary' : 'outline'}
                onClick={() => setDistributionType('random')}
                fullWidth
              >
                Random Amount
              </FrameButton>
            </div>
          </div>

          {error && <FrameStatus type="error" message={error} />}
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton onClick={handleCreateDrop} fullWidth>
          Create Drop <Gift className="w-4 h-4 ml-1" />
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderConfirm = () => (
    <>
      <FrameContent>
        <div className="space-y-4">
          <div className="bg-card rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Amount:</span>
              <span className="text-sm font-medium">{totalAmount} {selectedToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Recipients:</span>
              <span className="text-sm font-medium">{recipientCount} people</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Distribution:</span>
              <span className="text-sm font-medium">
                {distributionType === 'fixed' ? 'Fixed Amount' : 'Random Amount'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Per Person:</span>
              <span className="text-sm font-medium">
                {distributionType === 'fixed' 
                  ? `${(parseFloat(totalAmount) / parseInt(recipientCount)).toFixed(2)} ${selectedToken}`
                  : 'Random'
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Expires in 24 hours</span>
          </div>
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton variant="outline" onClick={() => setStep('input')}>
          Back
        </FrameButton>
        <FrameButton onClick={handleConfirmDrop} fullWidth>
          Confirm Drop
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderClaim = () => {
    if (!dropData) return null;

    return (
      <>
        <FrameContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-lg">STRAPT Drop</h3>
              <p className="text-sm text-muted-foreground">
                From @{dropData.creator}
              </p>
            </div>

            <div className="bg-card rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">{dropData.totalAmount} {dropData.token}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Claimed:</span>
                <span className="font-medium">{dropData.claimedCount}/{dropData.recipientCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium">{dropData.remainingAmount} {dropData.token}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Clock className="w-4 h-4" />
              <span>Expires {dropData.expiresAt.toLocaleDateString()}</span>
            </div>
          </div>
        </FrameContent>

        <FrameActions>
          <FrameButton onClick={handleClaimDrop} fullWidth>
            <Coins className="w-4 h-4 mr-1" />
            Claim Drop
          </FrameButton>
        </FrameActions>
      </>
    );
  };

  const renderSuccess = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Gift className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Drop Created!</h3>
            <p className="text-sm text-muted-foreground">
              {totalAmount} {selectedToken} for {recipientCount} recipients
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Drop ID: {dropData?.id}
            </p>
          </div>
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton onClick={() => window.location.reload()} fullWidth>
          <Share2 className="w-4 h-4 mr-1" />
          Share Drop
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderClaimed = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Coins className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Claimed Successfully!</h3>
            <p className="text-sm text-muted-foreground">
              You received {claimedAmount} {dropData?.token}
            </p>
          </div>
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton onClick={() => window.location.reload()} fullWidth>
          Done
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderProcessing = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <div>
            <h3 className="font-medium text-foreground">
              {step === 'processing' && mode === 'create' ? 'Creating Drop' : 'Claiming Drop'}
            </h3>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </FrameContent>
    </>
  );

  const getStepContent = () => {
    switch (step) {
      case 'input':
        return renderCreateInput();
      case 'confirm':
        return renderConfirm();
      case 'claim':
        return renderClaim();
      case 'processing':
        return renderProcessing();
      case 'success':
        return renderSuccess();
      case 'claimed':
        return renderClaimed();
      default:
        return renderCreateInput();
    }
  };

  return (
    <FrameLayout>
      <FrameHeader
        title={mode === 'claim' ? 'Claim Drop' : 'Create STRAPT Drop'}
        subtitle={mode === 'claim' ? 'Claim your tokens' : 'Distribute tokens to multiple recipients'}
        icon={<Users className="w-4 h-4" />}
      />
      {getStepContent()}
    </FrameLayout>
  );
};
