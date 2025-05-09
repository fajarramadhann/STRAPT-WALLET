
import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, ShieldCheck, Copy, QrCode, LockKeyhole, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import QRCode from '@/components/QRCode';
import QRCodeScanner from '@/components/QRCodeScanner';
import { useAccount } from 'wagmi';
import { useProtectedTransfer } from '@/hooks/use-protected-transfer';

interface TransferDetails {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  expiry: number;
  status: number;
  createdAt: number;
  isLinkTransfer: boolean;
  passwordProtected?: boolean; // For backward compatibility
}

const Claims = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address } = useAccount();
  const [showQR, setShowQR] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<TransferDetails | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingClaims, setPendingClaims] = useState<TransferDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualClaimDialog, setShowManualClaimDialog] = useState(false);
  const [manualTransferId, setManualTransferId] = useState('');
  const [manualClaimCode, setManualClaimCode] = useState('');
  const [manualClaimError, setManualClaimError] = useState('');

  // Get claim functions from useProtectedTransfer
  const {
    claimTransfer,
    claimLinkTransfer,
    useTransferDetails,
    isPasswordProtected,
    getTransferDetails,
  } = useProtectedTransfer();

  // Helper function to shorten transfer IDs
  const shortenTransferId = (id: string) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  // Check for claim ID in URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const claimId = params.get('id');
    const code = params.get('code');

    if (claimId) {
      // If we have a claim code in the URL, show the password dialog
      if (code) {
        setManualTransferId(claimId);
        setManualClaimCode(code);
        setShowPasswordDialog(true);
      } else {
        // Try to claim as a link transfer (no password)
        handleClaimLinkTransfer(claimId);
      }
    }
  }, [location.search]);

  const formatTimeRemaining = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diffSecs = timestamp - now;

    if (diffSecs <= 0) {
      return 'Expired';
    }

    const diffHrs = Math.floor(diffSecs / 3600);
    const diffMins = Math.floor((diffSecs % 3600) / 60);

    return `${diffHrs}h ${diffMins}m`;
  };

  // Handle claiming a transfer with password
  const handleClaimWithPassword = async (transferId: string, password: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    setIsValidating(true);
    setPasswordError('');

    try {
      const success = await claimTransfer(transferId, password);

      if (success) {
        toast.success('Transfer claimed successfully!');
        setShowPasswordDialog(false);
        setClaimCode('');
        // Refresh the list of pending claims
        // fetchPendingClaims();
        return true;
      } else {
        setPasswordError('Failed to claim transfer. Please check the password.');
        return false;
      }
    } catch (error) {
      console.error('Error claiming transfer:', error);
      setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Handle claiming a link transfer (no password)
  const handleClaimLinkTransfer = async (transferId: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    setIsLoading(true);

    try {
      // First, check if the transfer requires a password
      const requiresPassword = await isPasswordProtected(transferId);

      if (requiresPassword) {
        // Get transfer details to show in the password dialog
        const details = await getTransferDetails(transferId);
        if (details) {
          setActiveTransfer({
            id: transferId,
            sender: details.sender,
            recipient: details.recipient,
            tokenAddress: details.tokenAddress,
            tokenSymbol: details.tokenSymbol,
            amount: details.amount,
            expiry: details.expiry,
            status: details.status,
            createdAt: details.createdAt,
            isLinkTransfer: details.isLinkTransfer,
            passwordProtected: true
          });
          setManualTransferId(transferId);
          setShowPasswordDialog(true);
          setIsLoading(false);
          return false; // Don't proceed with claim yet
        }

        toast.error('This transfer requires a claim code. Please enter it to proceed.');
        return false;
      }

      // If no password required, proceed with claim
      const success = await claimLinkTransfer(transferId);

      if (success) {
        toast.success('Transfer claimed successfully!');
        // Refresh the list of pending claims
        // fetchPendingClaims();
        return true;
      }

      toast.error('Failed to claim transfer. Please check the transfer ID.');
      return false;
    } catch (error) {
      console.error('Error claiming link transfer:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowQR = (transfer: TransferDetails) => {
    setActiveTransfer(transfer);
    setShowQR(true);
  };

  const handleCopyLink = (transferId: string) => {
    navigator.clipboard.writeText(`https://truststream.app/claim/${transferId}`);
    toast({
      title: "Link Copied",
      description: "Transfer link copied to clipboard",
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualTransferId) {
      setPasswordError('Transfer ID is required');
      return;
    }

    if (!manualClaimCode) {
      setPasswordError('Claim code is required');
      return;
    }

    await handleClaimWithPassword(manualTransferId, manualClaimCode);
  };

  const handleScanSuccess = (decodedText: string) => {
    try {
      const url = new URL(decodedText);

      if (url.pathname.includes('/claim/')) {
        const claimId = url.pathname.split('/claim/')[1];
        const params = new URLSearchParams(url.search);
        const code = params.get('code');

        if (claimId) {
          if (code) {
            // If we have a claim code, show the password dialog
            setManualTransferId(claimId);
            setManualClaimCode(code);
            setShowPasswordDialog(true);
          } else {
            // Try to claim as a link transfer (no password)
            handleClaimLinkTransfer(claimId);
          }
        }
      }
    } catch (e) {
      toast.error('Invalid QR Code. Could not parse the QR code data');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mr-4 p-0 h-auto"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Claim Transfers</h1>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualClaimDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Claim New
          </Button>
          <QRCodeScanner
            buttonVariant="outline"
            buttonSize="sm"
            buttonText="Scan QR"
            onScanSuccess={handleScanSuccess}
          />
        </div>
      </div>

      {pendingClaims.length > 0 ? (
        <div className="space-y-4">
          {pendingClaims.map((claim) => (
            <Card key={claim.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center">
                    <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                    Protected Transfer
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {claim.passwordProtected && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <LockKeyhole className="h-3 w-3" />
                        <span>Password</span>
                      </Badge>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>{formatTimeRemaining(claim.expiresAt)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">From:</span>
                    <span className="font-medium">{claim.sender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-medium">{claim.amount} SEI</span>
                  </div>
                  {claim.note && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Note:</span>
                      <span className="font-medium">{claim.note}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="font-medium">{claim.expiresAt.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Button
                  onClick={() => {
                    if (claim.passwordProtected) {
                      setActiveTransfer(claim);
                      setShowPasswordDialog(true);
                    } else {
                      handleClaim(claim.id);
                    }
                  }}
                  className="w-full"
                >
                  {claim.passwordProtected ? (
                    <>
                      <LockKeyhole className="h-4 w-4 mr-1" /> Claim (Password Protected)
                    </>
                  ) : (
                    "Claim Transfer"
                  )}
                </Button>
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCopyLink(claim.id)}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleShowQR(claim)}
                  >
                    <QrCode className="h-4 w-4 mr-1" /> Show QR
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No Pending Claims</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have any pending transfers to claim. Use the "Claim New" button to claim a transfer using its ID and claim code, or scan a QR code.
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => setShowManualClaimDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Claim New Transfer
            </Button>
            <Button onClick={() => navigate('/app')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* QR code dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            {activeTransfer && (
              <>
                <QRCode value={`https://truststream.app/claim/${activeTransfer.id}`} size={200} />
                <p className="text-sm text-center text-muted-foreground">
                  Share this QR code to claim {activeTransfer.amount} SEI
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password verification dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Claim Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4">
              {activeTransfer ? (
                <div className="space-y-4">
                  <div className="bg-secondary p-3 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">From:</span>
                      <span className="font-medium">
                        {activeTransfer.sender && activeTransfer.sender.length > 12
                          ? `${activeTransfer.sender.slice(0, 6)}...${activeTransfer.sender.slice(-4)}`
                          : activeTransfer.sender}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Amount:</span>
                      <span className="font-medium">
                        {activeTransfer.amount} {activeTransfer.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transfer ID:</span>
                      <span className="font-mono text-xs">
                        {shortenTransferId(activeTransfer.id)}
                      </span>
                    </div>
                    {activeTransfer.expiry && (
                      <div className="flex justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Expires:</span>
                        <span className="font-medium">
                          {new Date(activeTransfer.expiry * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-amber-500 font-medium flex items-center justify-center">
                      <LockKeyhole className="h-4 w-4 mr-1" />
                      This transfer requires a claim code
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the claim code to claim this transfer
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="claimCode">Claim Code</Label>
                <Input
                  id="claimCode"
                  value={manualClaimCode}
                  onChange={(e) => setManualClaimCode(e.target.value)}
                  placeholder="Enter the claim code"
                  className={passwordError ? "border-red-500" : ""}
                  disabled={isValidating}
                />
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isValidating || !manualClaimCode}>
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  "Claim Transfer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual claim dialog */}
      <Dialog open={showManualClaimDialog} onOpenChange={setShowManualClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim a Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the transfer ID and claim code (if required) to claim a transfer
            </p>

            <div className="space-y-2">
              <Label htmlFor="transferId">Transfer ID</Label>
              <Input
                id="transferId"
                value={manualTransferId}
                onChange={(e) => setManualTransferId(e.target.value)}
                placeholder="Enter transfer ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualClaimCode">Claim Code (if required)</Label>
              <Input
                id="manualClaimCode"
                value={manualClaimCode}
                onChange={(e) => setManualClaimCode(e.target.value)}
                placeholder="Enter claim code if needed"
              />
            </div>

            {/* Button to fetch transfer details */}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!manualTransferId) {
                  setManualClaimError('Transfer ID is required');
                  return;
                }

                setIsLoading(true);
                try {
                  const details = await getTransferDetails(manualTransferId);
                  if (details) {
                    setActiveTransfer({
                      id: manualTransferId,
                      sender: details.sender,
                      recipient: details.recipient,
                      tokenAddress: details.tokenAddress,
                      tokenSymbol: details.tokenSymbol,
                      amount: details.amount,
                      expiry: details.expiry,
                      status: details.status,
                      createdAt: details.createdAt,
                      isLinkTransfer: details.isLinkTransfer,
                      passwordProtected: await isPasswordProtected(manualTransferId)
                    });

                    // Show a toast with the details
                    toast.success('Transfer details loaded');
                  } else {
                    setManualClaimError('Transfer not found. Please check the ID and try again.');
                  }
                } catch (error) {
                  console.error('Error fetching transfer details:', error);
                  setManualClaimError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading || !manualTransferId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Check Transfer Details"
              )}
            </Button>

            {/* Display transfer details if available */}
            {activeTransfer && (
              <div className="bg-secondary p-3 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <span className="font-medium">
                    {activeTransfer.sender && activeTransfer.sender.length > 12
                      ? `${activeTransfer.sender.slice(0, 6)}...${activeTransfer.sender.slice(-4)}`
                      : activeTransfer.sender}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {activeTransfer.amount} {activeTransfer.tokenSymbol}
                  </span>
                </div>
                {activeTransfer.expiry && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {new Date(activeTransfer.expiry * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {activeTransfer.passwordProtected && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-sm text-amber-500 font-medium flex items-center">
                      <LockKeyhole className="h-4 w-4 mr-1" />
                      This transfer requires a claim code
                    </p>
                  </div>
                )}
              </div>
            )}

            {manualClaimError && (
              <p className="text-sm text-red-500">{manualClaimError}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowManualClaimDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  setManualClaimError('');

                  if (!manualTransferId) {
                    setManualClaimError('Transfer ID is required');
                    return;
                  }

                  try {
                    // First, get transfer details to show the user what they're claiming
                    const details = await getTransferDetails(manualTransferId);
                    if (!details) {
                      setManualClaimError('Transfer not found. Please check the ID and try again.');
                      return;
                    }

                    // Check if transfer requires password
                    const requiresPassword = await isPasswordProtected(manualTransferId);

                    if (requiresPassword && !manualClaimCode) {
                      // Set active transfer for the password dialog
                      setActiveTransfer({
                        id: manualTransferId,
                        sender: details.sender,
                        recipient: details.recipient,
                        tokenAddress: details.tokenAddress,
                        tokenSymbol: details.tokenSymbol,
                        amount: details.amount,
                        expiry: details.expiry,
                        status: details.status,
                        createdAt: details.createdAt,
                        isLinkTransfer: details.isLinkTransfer,
                        passwordProtected: true
                      });

                      setShowManualClaimDialog(false);
                      setShowPasswordDialog(true);
                      return;
                    }

                    if (manualClaimCode) {
                      // Try with password
                      const success = await handleClaimWithPassword(manualTransferId, manualClaimCode);
                      if (success) {
                        setShowManualClaimDialog(false);
                        setManualTransferId('');
                        setManualClaimCode('');
                      }
                    } else {
                      // Try as link transfer
                      const success = await handleClaimLinkTransfer(manualTransferId);
                      if (success) {
                        setShowManualClaimDialog(false);
                        setManualTransferId('');
                      }
                    }
                  } catch (error) {
                    console.error('Error in manual claim:', error);
                    setManualClaimError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                disabled={isLoading || isValidating}
              >
                {isLoading || isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  "Claim Transfer"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Claims;
