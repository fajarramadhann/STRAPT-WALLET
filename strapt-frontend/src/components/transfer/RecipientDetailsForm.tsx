
import { Shield, Send, Share2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import TokenSelect from '@/components/TokenSelect';
import { ArrowRight } from 'lucide-react';
import { useTransferContext } from '@/contexts/TransferContext';
import QRCodeScanner from '@/components/QRCodeScanner';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

interface RecipientDetailsFormProps {
  onNext: () => void;
}

const RecipientDetailsForm = ({ onNext }: RecipientDetailsFormProps) => {
  const {
    recipient,
    setRecipient,
    amount,
    setAmount,
    selectedToken,
    setSelectedToken,
    transferType,
    setTransferType,
  } = useTransferContext();

  const location = useLocation();

  // Check for recipient in URL query parameters (from QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const toAddress = params.get('to');

    if (toAddress && toAddress.startsWith('0x')) {
      setRecipient(toAddress);
      // Automatically set to direct transfer when an address is provided
      setTransferType('direct');
    }
  }, [location.search, setRecipient, setTransferType]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary" />
          Recipient Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="recipient" className="text-sm font-medium">
            Recipient {transferType === 'direct' ? '(Required)' : '(Optional for Link/QR)'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="recipient"
                placeholder={transferType === 'direct'
                  ? "@username or wallet address 0x..."
                  : "Optional for Link/QR transfers"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required={transferType === 'direct'}
              />
            </div>
            <QRCodeScanner
              buttonVariant="outline"
              buttonSize="icon"
              iconOnly={true}
              onScanSuccess={(result) => {
                // Check if it's an Ethereum address
                if (result.startsWith('0x') && result.length === 42) {
                  setRecipient(result);
                  // Set to direct transfer when scanning an address
                  setTransferType('direct');
                }
              }}
            />
          </div>
          {transferType === 'claim' && (
            <p className="text-xs text-muted-foreground">
              For Link/QR transfers, recipient is optional as anyone with the link can claim the funds.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-medium">
            Token
          </label>
          <TokenSelect
            tokens={useTransferContext().tokens}
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-medium">
            Amount
          </label>
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
              className="pr-16"
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
          <p className="text-xs text-muted-foreground">
            Available: {selectedToken.balance?.toFixed(2) || 0} {selectedToken.symbol}
          </p>
        </div>

        {/* <div className="space-y-2">
          <label htmlFor="note" className="text-sm font-medium">
            Note (Optional)
          </label>
          <Input
            id="note"
            placeholder="What's this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div> */}

        <div className="space-y-2">
          <label htmlFor="transfer-method" className="text-sm font-medium">
            Transfer Method
          </label>
          <RadioGroup
            id="transfer-method"
            value={transferType}
            onValueChange={(value) => setTransferType(value as 'direct' | 'claim')}
            className="grid grid-cols-1 gap-4 pt-2"
          >
            <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-secondary/20">
              <RadioGroupItem value="direct" id="direct" />
              <Label htmlFor="direct" className="flex items-center cursor-pointer">
                <Send className="h-4 w-4 mr-2 text-primary" />
                <div>
                  <div className="font-medium">Direct Transfer</div>
                  <div className="text-xs text-muted-foreground">Send tokens directly to recipient</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-secondary/20">
              <RadioGroupItem value="claim" id="claim" />
              <Label htmlFor="claim" className="flex items-center cursor-pointer">
                <Share2 className="h-4 w-4 mr-2 text-primary" />
                <div>
                  <div className="font-medium">Claim via Link/QR</div>
                  <div className="text-xs text-muted-foreground">Recipient claims via shared link or QR code</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={onNext} className="w-full">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RecipientDetailsForm;
