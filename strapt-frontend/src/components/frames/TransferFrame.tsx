import React, { useState } from 'react';
import { ArrowRight, Send, Shield, Clock } from 'lucide-react';
import {
  FrameLayout,
  FrameHeader,
  FrameContent,
  FrameActions,
  FrameButton,
  FrameInput,
  FrameStatus,
} from './FrameLayout';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { formatUnits } from 'viem';

interface TransferFrameProps {
  onTransferComplete?: (txHash: string) => void;
  onBack?: () => void;
}

type TransferStep = 'input' | 'confirm' | 'processing' | 'success' | 'error';

export const TransferFrame: React.FC<TransferFrameProps> = ({
  onTransferComplete,
  onBack,
}) => {
  const { frameContext } = useFarcaster();
  const { balances, isLoading: balancesLoading } = useTokenBalances();
  
  const [step, setStep] = useState<TransferStep>('input');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('IDRX');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const tokenBalance = balances?.find(b => b.symbol === selectedToken);
  const formattedBalance = tokenBalance 
    ? formatUnits(tokenBalance.balance, tokenBalance.decimals)
    : '0';

  const handleNext = () => {
    if (!recipient || !amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (parseFloat(amount) > parseFloat(formattedBalance)) {
      setError('Insufficient balance');
      return;
    }

    setError('');
    setStep('confirm');
  };

  const handleTransfer = async () => {
    setStep('processing');
    setError('');

    try {
      // Simulate transfer process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock transaction hash
      const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);
      setTxHash(mockTxHash);
      setStep('success');
      
      onTransferComplete?.(mockTxHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
      setStep('error');
    }
  };

  const renderInputStep = () => (
    <>
      <FrameContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Recipient
            </label>
            <FrameInput
              placeholder="Enter username or address"
              value={recipient}
              onChange={setRecipient}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount ({selectedToken})
            </label>
            <FrameInput
              placeholder="0.00"
              value={amount}
              onChange={setAmount}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Balance: {formattedBalance} {selectedToken}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="usePassword"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="usePassword" className="text-sm text-foreground">
              Protect with password
            </label>
          </div>

          {usePassword && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <FrameInput
                placeholder="Enter password"
                value={password}
                onChange={setPassword}
              />
            </div>
          )}

          {error && <FrameStatus type="error" message={error} />}
        </div>
      </FrameContent>

      <FrameActions>
        {onBack && (
          <FrameButton variant="outline" onClick={onBack}>
            Back
          </FrameButton>
        )}
        <FrameButton onClick={handleNext} fullWidth>
          Next <ArrowRight className="w-4 h-4 ml-1" />
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderConfirmStep = () => (
    <>
      <FrameContent>
        <div className="space-y-4">
          <div className="bg-card rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">To:</span>
              <span className="text-sm font-medium">{recipient}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="text-sm font-medium">{amount} {selectedToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Protection:</span>
              <span className="text-sm font-medium">
                {usePassword ? 'Password Protected' : 'Direct Transfer'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secure transfer via STRAPT protocol</span>
          </div>
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton variant="outline" onClick={() => setStep('input')}>
          Back
        </FrameButton>
        <FrameButton onClick={handleTransfer} fullWidth>
          <Send className="w-4 h-4 mr-1" />
          Send Transfer
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderProcessingStep = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <div>
            <h3 className="font-medium text-foreground">Processing Transfer</h3>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </FrameContent>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Send className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Transfer Sent!</h3>
            <p className="text-sm text-muted-foreground">
              {amount} {selectedToken} sent to {recipient}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
          </div>
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton onClick={() => window.location.reload()} fullWidth>
          Send Another
        </FrameButton>
      </FrameActions>
    </>
  );

  const renderErrorStep = () => (
    <>
      <FrameContent className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <FrameStatus type="error" message={error} />
        </div>
      </FrameContent>

      <FrameActions>
        <FrameButton onClick={() => setStep('input')} fullWidth>
          Try Again
        </FrameButton>
      </FrameActions>
    </>
  );

  const getStepContent = () => {
    switch (step) {
      case 'input':
        return renderInputStep();
      case 'confirm':
        return renderConfirmStep();
      case 'processing':
        return renderProcessingStep();
      case 'success':
        return renderSuccessStep();
      case 'error':
        return renderErrorStep();
      default:
        return renderInputStep();
    }
  };

  return (
    <FrameLayout>
      <FrameHeader
        title="Send Transfer"
        subtitle={`Step ${step === 'input' ? '1' : step === 'confirm' ? '2' : '3'} of 3`}
        icon={<Send className="w-4 h-4" />}
      />
      {getStepContent()}
    </FrameLayout>
  );
};
