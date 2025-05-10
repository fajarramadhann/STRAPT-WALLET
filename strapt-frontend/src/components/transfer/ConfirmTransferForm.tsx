
import { Shield, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransferContext } from '@/contexts/TransferContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ConfirmTransferFormProps {
  onSubmit: () => void;
}

const ConfirmTransferForm = ({ onSubmit }: ConfirmTransferFormProps) => {
  const {
    recipient,
    amount,
    note,
    withTimeout,
    withPassword,
    selectedToken,
    transferType,
    formatTimeout,
    isLoading,
    isApproving,
    isApproved,
    approveToken,
    createProtectedTransfer,
    createProtectedLinkTransfer,
  } = useTransferContext();

  // Handle approval only
  const handleApprove = async () => {
    await approveToken();
    // No automatic submission - wait for user to confirm
  };

  // Handle confirmation/transfer
  const handleConfirm = async () => {
    try {
      let success = false;

      // Log debug information
      console.log('Confirming transfer with type:', transferType);
      console.log('Amount:', amount, 'Token:', selectedToken.symbol);
      console.log('Timeout enabled:', withTimeout, 'Password enabled:', withPassword);

      // Call the appropriate transfer function based on transfer type
      if (transferType === 'direct') {
        try {
          // Validate inputs before proceeding
          if (!amount || Number.parseFloat(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
          }

          if (!recipient) {
            toast.error("Please enter a recipient address");
            return;
          }

          // Create the direct transfer
          const result = await createProtectedTransfer();
          console.log('Direct transfer result:', result);
          success = !!result;
        } catch (error) {
          console.error('Error creating direct transfer:', error);
          toast.error(`Failed to create direct transfer: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      } else if (transferType === 'claim') {
        try {
          // Validate inputs before proceeding
          if (!amount || Number.parseFloat(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
          }

          // Create the link transfer
          const result = await createProtectedLinkTransfer();
          console.log('Link transfer result:', result);
          success = !!result;
        } catch (error) {
          console.error('Error creating link transfer:', error);
          toast.error(`Failed to create link transfer: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      }

      // Only move to success screen if the transfer was successful
      if (success) {
        onSubmit();
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      toast.error(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary" />
          Confirm Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transfer Steps */}
        <div className="mb-2">
          {!isApproved && !isApproving && (
            <Alert variant="default" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Token Approval Required</AlertTitle>
              <AlertDescription>
                You need to approve the contract to use your {selectedToken.symbol} tokens.
                After approval, you'll be able to confirm your transfer.
              </AlertDescription>
            </Alert>
          )}

          {isApproving && (
            <Alert variant="default" className="mt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Approving Token</AlertTitle>
              <AlertDescription>
                Please wait while we approve the contract to use your {selectedToken.symbol} tokens.
              </AlertDescription>
            </Alert>
          )}

          {isApproved && (
            <Alert className="mt-4 bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Token Approved</AlertTitle>
              <AlertDescription className="text-green-600">
                You have successfully approved the contract to use your {selectedToken.symbol} tokens.
                Please click the "Confirm Transfer" button below to complete your transfer.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        <div className="border border-border rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Recipient:</span>
            <span className="font-medium">
              {recipient && recipient.length > 12
                ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
                : recipient}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Amount:</span>
            <span className="font-medium">{amount} {selectedToken.symbol}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Method:</span>
            <span className="font-medium">{transferType === 'direct' ? 'Direct Transfer' : 'Claim via Link/QR'}</span>
          </div>
          {note && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Note:</span>
              <span className="font-medium">{note}</span>
            </div>
          )}
          {withTimeout && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Timeout:</span>
              <span className="font-medium">{formatTimeout()}</span>
            </div>
          )}
          {withPassword && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Password Protected:</span>
              <span className="font-medium">Yes</span>
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Transfer Fee:</span>
            <span className="font-medium">0.001 {selectedToken.symbol}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total:</span>
            <span>{(Number.parseFloat(amount) + 0.001).toFixed(3)} {selectedToken.symbol}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {!isApproved ? (
          <Button
            type="button"
            onClick={handleApprove}
            className="w-full"
            disabled={isApproving || isLoading}
          >
            {isApproving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving Token...
              </>
            ) : (
              "Approve Token"
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Transfer...
              </>
            ) : (
              "Confirm Transfer"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ConfirmTransferForm;
