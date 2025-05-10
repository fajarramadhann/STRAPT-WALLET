import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield, LockKeyhole, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { useProtectedTransfer } from '@/hooks/use-protected-transfer';

const Claim = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address } = useAccount();
  const [transferId, setTransferId] = useState<string>('');
  const [claimCode, setClaimCode] = useState<string>('');
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [transferDetails, setTransferDetails] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Get claim functions from useProtectedTransfer
  const {
    claimTransfer,
    claimLinkTransfer,
    useTransferDetails,
    shortenTransferId,
  } = useProtectedTransfer();

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const code = params.get('code');
    
    if (id) {
      setTransferId(id);
      setIsPasswordProtected(!!code);
      
      if (code) {
        setClaimCode(code);
      }
    }
  }, [location.search]);

  // Fetch transfer details if we have a transfer ID
  const { data: details, isLoading: isLoadingDetails } = useTransferDetails(transferId || '');

  // Update transfer details when data is loaded
  useEffect(() => {
    if (details && !isLoadingDetails) {
      setTransferDetails(details);
    }
  }, [details, isLoadingDetails]);

  // Handle claim button click
  const handleClaim = async () => {
    if (!transferId) {
      setError('Transfer ID is required');
      return;
    }

    if (isPasswordProtected && !claimCode) {
      setError('Claim code is required');
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let success;
      
      if (isPasswordProtected) {
        // Claim with password
        success = await claimTransfer(transferId, claimCode);
      } else {
        // Claim link transfer
        success = await claimLinkTransfer(transferId);
      }

      if (success) {
        setIsSuccess(true);
        toast.success('Transfer claimed successfully!');
      } else {
        setError('Failed to claim transfer. Please check the transfer ID and claim code.');
      }
    } catch (err) {
      console.error('Error claiming transfer:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mr-4 p-0 h-auto"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Claim Transfer</h1>
      </div>

      {isSuccess ? (
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto rounded-full bg-green-500/20 p-3 mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Transfer Claimed!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              The funds have been successfully transferred to your wallet.
            </p>
            {transferDetails && (
              <div className="bg-secondary p-3 rounded-lg mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {transferDetails.amount} {transferDetails.tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transfer ID:</span>
                  <span className="font-mono text-xs">
                    {shortenTransferId(transferId)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/app')} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto rounded-full bg-primary/20 p-3 mb-2">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Claim Protected Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : transferDetails ? (
              <div className="space-y-4">
                <div className="bg-secondary p-3 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">From:</span>
                    <span className="font-medium">
                      {transferDetails.sender && transferDetails.sender.length > 12
                        ? `${transferDetails.sender.slice(0, 6)}...${transferDetails.sender.slice(-4)}`
                        : transferDetails.sender}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-medium">
                      {transferDetails.amount} {transferDetails.tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {new Date(transferDetails.expiry * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isPasswordProtected && (
                  <div className="space-y-2">
                    <Label htmlFor="claimCode" className="flex items-center">
                      <LockKeyhole className="h-4 w-4 mr-1" /> Claim Code
                    </Label>
                    <Input
                      id="claimCode"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value)}
                      placeholder="Enter claim code"
                    />
                  </div>
                )}

                {error && (
                  <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="transferId">Transfer ID</Label>
                  <Input
                    id="transferId"
                    value={transferId}
                    onChange={(e) => setTransferId(e.target.value)}
                    placeholder="Enter transfer ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claimCode" className="flex items-center">
                    <LockKeyhole className="h-4 w-4 mr-1" /> Claim Code (if required)
                  </Label>
                  <Input
                    id="claimCode"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    placeholder="Enter claim code if needed"
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
                    {error}
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleClaim}
              className="w-full"
              disabled={isLoading || (!transferId || (isPasswordProtected && !claimCode))}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                "Claim Transfer"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default Claim;
