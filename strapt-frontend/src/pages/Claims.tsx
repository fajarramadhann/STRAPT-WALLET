import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Clock, ShieldCheck, Copy, QrCode, LockKeyhole, Loader2, Plus, PartyPopper, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import QRCode from '@/components/QRCode';
import QRCodeScanner from '@/components/QRCodeScanner';
import { useAccount } from 'wagmi';
import { useProtectedTransferV2 } from '@/hooks/use-protected-transfer-v2';
import { useConfetti } from '@/hooks/use-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';

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

// Utility function to standardize claim code format
const standardizeClaimCode = (code: string): string => {
  // Trim any whitespace and ensure we have a valid string
  if (!code) return '';

  // Remove any special formatting characters that might cause issues
  const formatted = code.trim();

  // Log the processed code for debugging
  console.log(`Standardized claim code from [${code}] to [${formatted}], length: ${formatted.length}`);

  return formatted;
};

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
  const [searchParams] = useSearchParams();
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState('');
  const [claimedTokenSymbol, setClaimedTokenSymbol] = useState('');

  // Use ref to track processing state to prevent infinite loops
  const isProcessingRef = useRef(false);
  const processedUrlRef = useRef<string>('');

  // Get claim functions from useProtectedTransferV2
  const {
    claimTransfer,
    isPasswordProtected,
    getTransferDetails,
  } = useProtectedTransferV2();

  // Get confetti functions
  const { triggerClaimConfetti } = useConfetti();

  // Function to trigger confetti (same as STRAPT drop)
  const triggerConfetti = useCallback(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0, 0.2) }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0, 0.2) }
      });
    }, 250);
  }, []);

  // Helper function to shorten transfer IDs
  const shortenTransferId = (id: string) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  // Handle claiming a link transfer (no password)
  const handleClaimLinkTransfer = useCallback(async (transferId: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    // Prevent multiple simultaneous claims
    if (isLoading) {
      console.log('Already processing claim, skipping duplicate attempt');
      return false;
    }

    setIsLoading(true);

    try {
      // First, check if the transfer requires a password using the contract's isPasswordProtected function
      const requiresPassword = await isPasswordProtected(transferId);
      console.log('Transfer requires password (from contract):', requiresPassword);

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
          toast.info('This transfer requires a claim code. Please enter it to proceed.');
          return false; // Don't proceed with claim yet
        }

        toast.error('This transfer requires a claim code. Please enter it to proceed.');
        return false;
      }

      // If no password required, proceed with claim using empty password
      toast.info('Claiming transfer without password...');
      const success = await claimTransfer(transferId, '');

      if (success) {
        // Get transfer details to show in success animation
        try {
          const details = await getTransferDetails(transferId);
          if (details) {
            setClaimedAmount(details.amount);
            setClaimedTokenSymbol(details.tokenSymbol);
          }
        } catch (e) {
          // Fallback values
          setClaimedAmount('');
          setClaimedTokenSymbol('tokens');
        }

        // Show success animation
        setShowSuccessAnimation(true);

        // Trigger confetti
        triggerConfetti();

        // Hide success animation after 5 seconds
        setTimeout(() => {
          setShowSuccessAnimation(false);
        }, 5000);

        // Refresh the list of pending claims
        // fetchPendingClaims();
        return true;
      }

      toast.error('Claim failed', {
        description: 'Could not claim transfer. Please check the transfer ID and try again.'
      });
      return false;
    } catch (error) {
      console.error('Error claiming link transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the claim transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to pay for transaction fees"
        });
      } else if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
        toast.error("Invalid claim code", {
          description: "The claim code you entered is incorrect"
        });
      } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
        toast.error("Transfer not claimable", {
          description: "This transfer has already been claimed or is not available"
        });
      } else {
        toast.error("Claim failed", {
          description: "Could not claim transfer. Please try again."
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, isLoading, isPasswordProtected, getTransferDetails, claimTransfer, triggerConfetti]);


  // Process a transfer ID from URL or QR code
  const processTransferId = useCallback(async (transferId: string, claimCode?: string | null) => {
    if (!transferId) {
      toast.error('Invalid transfer ID');
      return;
    }

    // Clean up the transfer ID (remove any URL part if present)
    let cleanTransferId = transferId;
    if (transferId.includes('/')) {
      cleanTransferId = transferId.split('/').pop() || '';
    }

    // If the ID is a full URL, extract just the ID part
    if (cleanTransferId.includes('?id=')) {
      const parts = cleanTransferId.split('?id=');
      cleanTransferId = parts[1]?.split('&')[0] || '';
    }

    console.log('Processing transfer ID:', cleanTransferId);

    if (!cleanTransferId || cleanTransferId.length !== 66) {  // 0x + 64 hex chars
      toast.error('Invalid transfer ID format');
      return;
    }

    // Process the claim code if provided
    let cleanClaimCode = '';
    if (claimCode) {
      // URL decode the claim code if needed
      try {
        // Check if it needs decoding
        if (claimCode.includes('%')) {
          cleanClaimCode = decodeURIComponent(claimCode);
        } else {
          cleanClaimCode = claimCode;
        }

        // Standardize the format
        cleanClaimCode = standardizeClaimCode(cleanClaimCode);
        console.log('Processed claim code:', cleanClaimCode);
      } catch (error) {
        console.error('Error decoding claim code:', error);
        cleanClaimCode = claimCode;
      }
    }

    try {
      // Check if the transfer exists and requires a password
      const isProtected = await isPasswordProtected(cleanTransferId);
      console.log('Transfer is password protected:', isProtected);

      // Get transfer details
      const details = await getTransferDetails(cleanTransferId);

      if (!details) {
        toast.error('Transfer not found or has expired');
        setManualTransferId('');
        setManualClaimCode('');
        return;
      }

      setActiveTransfer({
        ...details,
        passwordProtected: isProtected
      });

      if (isProtected) {
        // Set the values in the password dialog
        setManualTransferId(cleanTransferId);

        // If we have a claim code, pre-fill it
        if (cleanClaimCode) {
          setManualClaimCode(cleanClaimCode);
          setShowPasswordDialog(true);
          toast.info('Transfer details loaded. Please review and confirm to claim.');
        } else {
          // Show password dialog
          setShowPasswordDialog(true);
          toast.info('This transfer requires a password for claiming.');
        }
      } else {
        // For non-password-protected transfers, try to claim directly
        toast.info('Attempting to claim transfer without password...');
        await handleClaimLinkTransfer(cleanTransferId);
      }
    } catch (error) {
      console.error('Error processing transfer ID:', error);
      toast.error('Error processing transfer', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [isPasswordProtected, getTransferDetails, handleClaimLinkTransfer]);

  // Process URL parameters on component mount and when they change
  useEffect(() => {
    const id = searchParams.get('id');
    const code = searchParams.get('code');
    const currentUrl = `${id}-${code}`;

    // Only process if we have an ID, user is connected, and we haven't processed this URL yet
    if (id && address && !isProcessingRef.current && processedUrlRef.current !== currentUrl) {
      console.log(`Processing transfer ID from URL: ${id}, code present: ${!!code}`);
      isProcessingRef.current = true;
      processedUrlRef.current = currentUrl;
      setIsProcessingUrl(true);

      // Standardize the claim code if present
      const standardizedCode = code ? standardizeClaimCode(code) : '';

      // Process with a small delay to prevent race conditions
      setTimeout(() => {
        processTransferId(id, standardizedCode).finally(() => {
          isProcessingRef.current = false;
          setIsProcessingUrl(false);
        });
      }, 100);
    }
  }, [searchParams, address, processTransferId]);

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

  // Handle claiming with password
  const handleClaimWithPassword = async (transferId: string, password: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    // Prevent multiple simultaneous claims
    if (isValidating) {
      console.log('Already validating, skipping duplicate claim attempt');
      return false;
    }

    setIsValidating(true);
    setPasswordError('');

    try {
      // First check if this transfer requires a password using the contract's isPasswordProtected function
      const requiresPassword = await isPasswordProtected(transferId);
      console.log('Transfer requires password (from contract):', requiresPassword);

      if (requiresPassword) {
        // If it requires a password, use claimTransfer with the password
        if (!password) {
          setPasswordError('Claim code is required for this transfer');
          return false;
        }

        // Ensure claim code is properly formatted
        const cleanPassword = standardizeClaimCode(password);
        console.log('Attempting to claim with password:', cleanPassword, 'length:', cleanPassword.length);

        try {
          const success = await claimTransfer(transferId, cleanPassword);
          if (success) {
            // Get transfer details to show in success animation
            try {
              const details = await getTransferDetails(transferId);
              if (details) {
                setClaimedAmount(details.amount);
                setClaimedTokenSymbol(details.tokenSymbol);
              }
            } catch (e) {
              // Fallback values
              setClaimedAmount('');
              setClaimedTokenSymbol('tokens');
            }

            // Show success animation
            setShowSuccessAnimation(true);

            // Trigger confetti
            triggerConfetti();

            // Hide success animation after 5 seconds
            setTimeout(() => {
              setShowSuccessAnimation(false);
            }, 5000);

            setShowPasswordDialog(false);
            setClaimCode('');
            // Refresh the list of pending claims
            // fetchPendingClaims();
            return true;
          }

          setPasswordError('Failed to claim transfer. Please check the password.');
          return false;
        } catch (error) {
          console.error('Error claiming transfer with password:', error);

          // Check for specific InvalidClaimCode error
          if (error.message?.includes('InvalidClaimCode') || error.message?.includes('invalid claim code')) {
            setPasswordError('Invalid password. Please double-check and try again.');
            toast.error('Invalid password', {
              description: 'The password you entered does not match the transfer. Please check for typos or spaces.'
            });
          } else if (error.message?.includes('already claimed')) {
            setPasswordError('This transfer has already been claimed.');
            toast.error('Already claimed', {
              description: 'This transfer has already been claimed and cannot be claimed again.'
            });
          } else {
            setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            toast.error('Claim failed', {
              description: 'An error occurred while claiming the transfer. Please try again.'
            });
          }
          return false;
        }
      }

      // If it doesn't require a password, use claimTransfer with empty password
      toast.info('This transfer does not require a password. Claiming directly...');
      const success = await claimTransfer(transferId, '');
      if (success) {
        // Get transfer details to show in success animation
        try {
          const details = await getTransferDetails(transferId);
          if (details) {
            setClaimedAmount(details.amount);
            setClaimedTokenSymbol(details.tokenSymbol);
          }
        } catch (e) {
          // Fallback values
          setClaimedAmount('');
          setClaimedTokenSymbol('tokens');
        }

        // Show success animation
        setShowSuccessAnimation(true);

        // Trigger confetti
        triggerConfetti();

        // Hide success animation after 5 seconds
        setTimeout(() => {
          setShowSuccessAnimation(false);
        }, 5000);

        setShowPasswordDialog(false);
        setClaimCode('');
        return true;
      }

      setPasswordError('Failed to claim transfer. Please check the transfer ID.');
      return false;
    } catch (error) {
      console.error('Error claiming transfer:', error);
      setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleShowQR = (transfer: TransferDetails) => {
    setActiveTransfer(transfer);
    setShowQR(true);
  };

  const handleCopyLink = (transferId: string) => {
    navigator.clipboard.writeText(`https://truststream.app/claim/${transferId}`);
    toast.success("Link Copied", {
      description: "Transfer link copied to clipboard"
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualTransferId) {
      setPasswordError('Transfer ID is required');
      return;
    }

    // Check if the transfer requires a password
    const requiresPassword = await isPasswordProtected(manualTransferId);

    if (requiresPassword) {
      if (!manualClaimCode) {
        setPasswordError('Claim code is required');
        return;
      }
      await handleClaimWithPassword(manualTransferId, manualClaimCode);
    } else {
      // If no password required, use claimLinkTransfer instead
      setIsValidating(true);
      try {
        // For transfers without password protection, we can claim directly with empty password
        const success = await claimTransfer(manualTransferId, '');
        if (success) {
          // Get transfer details to show in success animation
          try {
            const details = await getTransferDetails(manualTransferId);
            if (details) {
              setClaimedAmount(details.amount);
              setClaimedTokenSymbol(details.tokenSymbol);
            }
          } catch (e) {
            // Fallback values
            setClaimedAmount('');
            setClaimedTokenSymbol('tokens');
          }

          // Show success animation
          setShowSuccessAnimation(true);

          // Trigger confetti
          triggerConfetti();

          // Hide success animation after 5 seconds
          setTimeout(() => {
            setShowSuccessAnimation(false);
          }, 5000);

          setShowPasswordDialog(false);
        }
      } catch (error) {
        console.error('Error claiming transfer:', error);

        // Check for specific errors
        if (error.message?.includes('rejected') || error.message?.includes('denied')) {
          setPasswordError('Transaction cancelled. You cancelled the claim transaction.');
        } else if (error.message?.includes('insufficient funds')) {
          setPasswordError('Insufficient funds. You do not have enough funds to pay for transaction fees.');
        } else if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
          setPasswordError('Invalid claim code. The claim code you entered is incorrect.');
        } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
          setPasswordError('Transfer not claimable. This transfer has already been claimed or is not available.');
        } else {
          setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        setIsValidating(false);
      }
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    console.log("Scanned QR code in Claims page:", decodedText);

    try {
      // Check if it's a URL
      if (decodedText.startsWith('http')) {
        const url = new URL(decodedText);

        // Check if it's a claim URL with /claim/ path
        if (url.pathname.includes('/claim/')) {
          const claimId = url.pathname.split('/claim/')[1];
          const params = new URLSearchParams(url.search);
          const code = params.get('code');

          if (claimId) {
            await processTransferId(claimId, code);
            return;
          }
        }

        // Check if URL contains transfer ID in query params
        const params = new URLSearchParams(url.search);
        const transferId = params.get('id') || params.get('transferId');
        const claimCode = params.get('code') || params.get('claimCode');

        if (transferId?.startsWith('0x')) {
          await processTransferId(transferId, claimCode);
          return;
        }
      }

      // Check if it's a JSON string containing transfer data
      if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
        try {
          const jsonData = JSON.parse(decodedText);

          // Check if JSON contains transfer ID
          if (jsonData.id || jsonData.transferId) {
            const transferId = jsonData.id || jsonData.transferId;
            const claimCode = jsonData.code || jsonData.claimCode || jsonData.password;

            if (transferId?.startsWith('0x')) {
              await processTransferId(transferId, claimCode);
              return;
            }
          }
        } catch (e) {
          console.error("Error parsing JSON from QR code:", e);
        }
      }

      // Check if it's a transfer ID (32 bytes hex)
      if (decodedText.startsWith('0x') && decodedText.length === 66) {
        await processTransferId(decodedText);
        return;
      }

      // Check if it contains a transfer ID anywhere in the text
      const hexRegex = /0x[a-fA-F0-9]{64}/;
      const match = decodedText.match(hexRegex);
      if (match) {
        const transferId = match[0];
        await processTransferId(transferId);
        return;
      }

      // If we get here, the format wasn't recognized
      toast.error('Unrecognized QR code format. Please scan a valid transfer QR code.');
    } catch (e) {
      console.error("Error processing QR code:", e);
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
            <Plus className="h-4 w-4 mr-2" />
            Manual Claim
          </Button>
          <QRCodeScanner
            onScanSuccess={handleScanSuccess}
            buttonText="Scan QR"
            buttonVariant="default"
            buttonSize="sm"
            icon={<QrCode className="h-4 w-4 mr-2" />}
          />
        </div>
      </div>

      {pendingClaims.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingClaims.map((claim) => (
            <Card key={claim.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center">
                    <ShieldCheck className="h-5 w-5 mr-2 text-green-500" />
                    Protected Transfer
                  </CardTitle>
                  {claim.passwordProtected && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <LockKeyhole className="h-3 w-3" />
                      Password
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  From: {shortenTransferId(claim.sender)}
                </p>
                <p className="text-2xl font-bold">
                  {claim.amount} {claim.tokenSymbol}
                </p>
                <p className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Expires in: {formatTimeRemaining(claim.expiry)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created: {dayjs.unix(claim.createdAt).format('MMM D, YYYY h:mm A')}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Button
                  className="w-full"
                  onClick={async () => {
                    setActiveTransfer(claim);
                    if (claim.passwordProtected) {
                      setManualTransferId(claim.id);
                      setShowPasswordDialog(true);
                    } else {
                      await handleClaimLinkTransfer(claim.id);
                    }
                  }}
                  disabled={isLoading || isValidating}
                >
                  {isLoading || isValidating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Claim Now
                </Button>
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleShowQR(claim)}
                  >
                    <QrCode className="h-4 w-4 mr-2" /> Show QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleCopyLink(claim.id)}
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy Link
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <PartyPopper className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No pending claims</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You currently have no transfers to claim.
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualClaimDialog(true)}
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Manual Claim
            </Button>
            <QRCodeScanner
              onScanSuccess={handleScanSuccess}
              buttonText="Scan QR to Claim"
              buttonVariant="default"
              buttonSize="sm"
              buttonClassName="mt-4"
              icon={<QrCode className="h-4 w-4 mr-2" />}
            />
          </div>
        </div>
      )}

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan to Claim</DialogTitle>
            <DialogDescription>
              Scan this QR code with another device to claim the transfer.
            </DialogDescription>
          </DialogHeader>
          {activeTransfer && (
            <div className="flex flex-col items-center space-y-2">
              <QRCode
                value={`https://truststream.app/claim/${activeTransfer.id}${activeTransfer.passwordProtected ? `?code=${encodeURIComponent(claimCode || 'YOUR_CLAIM_CODE')}` : ''}`}
                size={256}
              />
              <p className="text-sm text-muted-foreground">
                Transfer ID: {shortenTransferId(activeTransfer.id)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeTransfer?.passwordProtected ? 'Enter Claim Code' : 'Confirm Claim'}
            </DialogTitle>
            <DialogDescription>
              {activeTransfer?.passwordProtected
                ? 'This transfer is protected. Enter the claim code to proceed.'
                : 'Review the details and confirm to claim this transfer.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeTransfer ? (
              <div className="space-y-2">
                <p><strong>Amount:</strong> {activeTransfer.amount} {activeTransfer.tokenSymbol}</p>
                <p><strong>From:</strong> {shortenTransferId(activeTransfer.sender)}</p>
                <p className="text-xs text-muted-foreground">
                  Expires in: {formatTimeRemaining(activeTransfer.expiry)}
                </p>
                {activeTransfer.passwordProtected && (
                  <div className="space-y-2">
                    <Label htmlFor="claim-code">Claim Code</Label>
                    <Input
                      id="claim-code"
                      type="text"
                      value={manualClaimCode}
                      onChange={(e) => {
                        setManualClaimCode(e.target.value);
                        setPasswordError(''); // Clear error on change
                      }}
                      placeholder="Enter claim code"
                    />
                  </div>
                )}
                {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              </div>
            ) : (
              <p>Loading transfer details...</p>
            )}
            <Button
              type="submit"
              className="w-full"
              onClick={handlePasswordSubmit}
              disabled={isValidating || (activeTransfer?.passwordProtected && !manualClaimCode)}
            >
              {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {activeTransfer?.passwordProtected ? 'Claim with Code' : 'Confirm & Claim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualClaimDialog} onOpenChange={setShowManualClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Claim</DialogTitle>
            <DialogDescription>
              Enter the Transfer ID and Claim Code (if any) to claim a transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-transfer-id">Transfer ID</Label>
              <Input
                id="manual-transfer-id"
                value={manualTransferId}
                onChange={(e) => setManualTransferId(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-claim-code">Claim Code (Optional)</Label>
              <Input
                id="manual-claim-code"
                value={manualClaimCode}
                onChange={(e) => setManualClaimCode(e.target.value)}
                placeholder="Enter claim code if required"
              />
            </div>
            {manualClaimError && <p className="text-sm text-red-500">{manualClaimError}</p>}
            <Button
              className="w-full"
              disabled={!manualTransferId || isLoading || isValidating}
              onClick={async () => {
                if (!manualTransferId) {
                  setManualClaimError('Transfer ID is required.');
                  return;
                }
                setManualClaimError('');
                setIsLoading(true);
                try {
                  const isProtected = await isPasswordProtected(manualTransferId);
                  const details = await getTransferDetails(manualTransferId);

                  if (!details) {
                    toast.error('Transfer not found or has expired.');
                    setManualClaimError('Transfer not found or has expired.');
                    setIsLoading(false);
                    return;
                  }

                  setActiveTransfer({ ...details, passwordProtected: isProtected });

                  if (isProtected) {
                    if (!manualClaimCode) {
                      setManualClaimError('This transfer requires a claim code.');
                      setShowPasswordDialog(true); // Show the main password dialog prefilled
                      setShowManualClaimDialog(false); // Close manual dialog
                      setIsLoading(false);
                      return;
                    }
                    // If code provided, attempt claim via password dialog logic
                    setShowManualClaimDialog(false);
                    setShowPasswordDialog(true);
                    // No direct claim here, let the password dialog handle it
                  } else {
                    // Not protected, claim directly
                    const success = await handleClaimLinkTransfer(manualTransferId);
                    if (success) {
                      setShowManualClaimDialog(false);
                      setManualTransferId('');
                      setManualClaimCode('');
                    } else {
                      setManualClaimError('Failed to claim this transfer.');
                    }
                  }
                } catch (error) {
                  console.error('Error during manual claim:', error);
                  setManualClaimError(error instanceof Error ? error.message : 'An unknown error occurred.');
                  toast.error("Error during manual claim", { description: error instanceof Error ? error.message : 'An unknown error occurred.' });
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              {isLoading || isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Fetch & Claim
            </Button>

            <DialogFooter className="sm:justify-start">
              <p className="text-xs text-muted-foreground">
                If the transfer is password-protected and you provide the code here, it will be used.
                Otherwise, you'll be prompted if a code is needed.
              </p>
            </DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowManualClaimDialog(false);
                  // Open QR scanner from here if needed
                  // This might require a ref to the QRScanner button or a shared state
                  // For now, just closing the dialog.
                  // Consider triggering the main page's QR scanner.
                  const qrButton = document.getElementById('main-qr-scanner-button'); // Assuming you add an ID
                  if (qrButton) {
                    qrButton.click();
                  } else {
                    toast.info("Click 'Scan QR' on the main page to use the scanner.");
                  }
                }}
              >
                Scan QR Instead
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  // Logic to paste from clipboard
                  navigator.clipboard.readText().then(text => {
                    if (text) {
                      // Try to parse as URL or ID
                      if (text.startsWith('http')) {
                        try {
                          const url = new URL(text);
                          if (url.pathname.includes('/claim/')) {
                            const claimId = url.pathname.split('/claim/')[1];
                            const params = new URLSearchParams(url.search);
                            const code = params.get('code');
                            setManualTransferId(claimId);
                            if (code) setManualClaimCode(code);
                            toast.success("Pasted from clipboard!");
                            return;
                          }
                          const params = new URLSearchParams(url.search);
                          const transferId = params.get('id') || params.get('transferId');
                          const claimCode = params.get('code') || params.get('claimCode');
                          if (transferId) setManualTransferId(transferId);
                          if (claimCode) setManualClaimCode(claimCode);
                          toast.success("Pasted from clipboard!");
                          return;
                        } catch (e) { /* ignore parsing error, treat as plain text */ }
                      }
                      // Try to extract ID and code if it's a combined string
                      // Example: 0x123...abc?code=XYZ
                      const parts = text.split('?code=');
                      if (parts[0]?.startsWith('0x')) {
                        setManualTransferId(parts[0]);
                        if (parts[1]) setManualClaimCode(parts[1]);
                        toast.success("Pasted from clipboard!");
                        return;
                      }
                      // Assume it's just an ID if it's a hex string
                      if (text.startsWith('0x') && text.length === 66) {
                        setManualTransferId(text);
                        toast.success("Pasted Transfer ID from clipboard!");
                        return;
                      }
                      toast.error("Could not parse clipboard content.");
                    } else {
                      toast.error("Clipboard is empty or permission denied.");
                    }
                  }).catch(err => {
                    toast.error("Failed to read from clipboard.");
                    console.error('Failed to read clipboard contents: ', err);
                  });
                }}
              >
                Paste from Clipboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Animation Modal */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowSuccessAnimation(false)} // Close on click outside
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-card p-8 rounded-lg shadow-xl text-center max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: 360 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 10 }}
                className="mx-auto mb-6 h-20 w-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center"
              >
                <Check className="h-12 w-12 text-green-500" />
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-bold mb-2 text-card-foreground"
              >
                Transfer Claimed!
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-muted-foreground mb-6"
              >
                You have successfully claimed {claimedAmount ? `${claimedAmount} ${claimedTokenSymbol}` : 'the transfer'}.
              </motion.p>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Button onClick={() => setShowSuccessAnimation(false)} className="w-full">
                  Awesome!
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Claims;
