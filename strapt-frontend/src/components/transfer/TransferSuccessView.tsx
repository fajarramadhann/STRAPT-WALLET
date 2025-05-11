
import { Shield, Clock, Copy, QrCode, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useTransferContext } from '@/contexts/TransferContext';
import { toast } from 'sonner';

interface TransferSuccessViewProps {
  onReset: () => void;
  onShowQR: () => void;
}

const TransferSuccessView = ({ onReset, onShowQR }: TransferSuccessViewProps) => {
  const {
    recipient,
    amount,
    grossAmount,
    withPassword,
    selectedToken,
    transferType,
    transferLink,
    claimCode,
    transferId,
    shortenTransferId,
  } = useTransferContext();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(transferLink);
    toast.success("Link Copied", {
      description: "Transfer link copied to clipboard",
    });
  };

  const handleCopyClaimCode = () => {
    if (claimCode) {
      navigator.clipboard.writeText(claimCode);
      toast.success("Claim Code Copied", {
        description: "Claim code copied to clipboard",
      });
    }
  };

  const handleCopyTransferId = () => {
    if (transferId) {
      navigator.clipboard.writeText(transferId);
      toast.success("Transfer ID Copied", {
        description: "Transfer ID copied to clipboard",
      });
    }
  };

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto rounded-full bg-primary/20 p-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Transfer Created!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>Your {transferType === 'direct' ? 'direct transfer' : 'protected transfer'} of {amount} {selectedToken.symbol}
          {recipient ? (
            <>to {recipient.length > 12 ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : recipient}</>
          ) : (
            transferType === 'claim' ? ' via Link/QR' : ''
          )} has been {transferType === 'direct' ? 'sent' : 'created'}.</p>

        {/* Display fee information */}
        <div className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded-md">
          <p>Note: A small fee has been deducted from the transfer amount.</p>
          <p className="mt-1">
            <span className="font-medium">Original amount:</span> {grossAmount} {selectedToken.symbol}
          </p>
          <p>
            <span className="font-medium">Recipient will receive:</span> {amount} {selectedToken.symbol}
          </p>
        </div>

        {/* For both direct and claim transfers */}
        <div className="border border-border rounded-lg p-4">
          {transferType === 'claim' ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">Share this link with the recipient:</p>
              <div className="bg-secondary p-2 rounded text-sm mb-2 overflow-hidden text-ellipsis">
                {transferLink}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-1" /> Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={onShowQR}>
                  <QrCode className="h-4 w-4 mr-1" /> Show QR
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-2">Share these details with the recipient:</p>
              <p className="text-sm mb-3">The recipient will need both the Transfer ID and {withPassword ? 'Claim Code' : 'their wallet'} to claim the funds.</p>
            </>
          )}

          {/* Display Transfer ID for both types */}
          <div className={transferType === 'claim' ? "mt-3 border-t border-border pt-3" : ""}>
            <p className="text-sm text-muted-foreground mb-1">Transfer ID:</p>
            <div className="bg-secondary p-2 rounded mb-2 font-mono text-xs overflow-hidden text-ellipsis">
              {transferId ? shortenTransferId(transferId) : 'Not available'}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyTransferId} className="w-full mb-3" disabled={!transferId}>
              <Copy className="h-4 w-4 mr-1" /> Copy ID
            </Button>
          </div>

          {/* Display Claim Code if available (for both types if password protected) */}
          {withPassword && claimCode && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-center mb-1">
                <Key className="h-4 w-4 mr-1 text-amber-500" />
                <p className="text-sm text-amber-500 font-medium">Claim Code (Keep Secure!)</p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded text-center mb-2">
                <span className="text-xl font-mono tracking-widest">{claimCode}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyClaimCode} className="w-full">
                <Copy className="h-4 w-4 mr-1" /> Copy Code
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Share this code securely with the recipient. They will need it to claim the funds.
              </p>
            </div>
          )}

          {/* Display claim instructions */}
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground mb-1">Claim Instructions:</p>
            <p className="text-sm">
              Recipient should visit: <span className="font-medium">{window.location.origin}/app/claims</span>
            </p>
          </div>
        </div>

        {transferType === 'claim' && (
          <div className="bg-secondary/30 p-3 rounded-md text-sm">
            <div className="flex items-center text-amber-500 mb-1">
              <Clock className="h-4 w-4 mr-1" /> Refund Protection Enabled
            </div>
            <p>
              If not claimed within 24 hours, you'll be able to refund the funds back to your wallet.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Link to="/app" className="w-full">
          <Button variant="default" className="w-full">
            Back to Home
          </Button>
        </Link>
        <Button variant="outline" className="w-full" onClick={onReset}>
          Create Another Transfer
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TransferSuccessView;
