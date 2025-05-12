import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop, type DropInfo } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Clock, Users, Check, AlertTriangle, PartyPopper } from 'lucide-react';

const StraptDropClaim = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address, connectWallet } = useXellarWallet();
  const { getDropInfo, claimDrop, hasAddressClaimed, getClaimedAmount, checkDropExists, isLoading } = useStraptDrop();

  const [dropId, setDropId] = useState<string | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState('0');
  const [tokenSymbol, setTokenSymbol] = useState('IDRX');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Use ref to track if we've already checked claim status for this address
  const claimCheckedForAddress = useRef<string | null>(null);

  // Parse dropId from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');

    // Log the raw ID from URL for debugging
    console.log('Raw dropId from URL:', id);

    // Validate dropId format
    if (id && id?.startsWith('0x') && id?.length === 66) {
      console.log('Valid dropId format detected:', id);

      // Check if this might be a transaction hash
      const lastTxHash = localStorage.getItem('last_tx_hash');
      if (lastTxHash && lastTxHash === id) {
        console.warn('Warning: dropId matches last transaction hash, this might not be a valid dropId');
      }

      setDropId(id);

      // Verify that the dropId exists in the contract
      const verifyDropId = async () => {
        try {
          const exists = await checkDropExists(id);
          if (!exists) {
            console.warn('Drop does not exist in contract:', id);
            toast({
              title: "Drop Not Found",
              description: "This STRAPT Drop does not exist or has expired",
              variant: "destructive"
            });
            navigate('/app');
          } else {
            console.log('Drop exists in contract:', id);
          }
        } catch (error) {
          console.error('Error verifying dropId:', error);
          // Continue anyway, we'll let the normal flow handle errors
        }
      };

      verifyDropId();
    } else {
      console.error('Invalid dropId format:', id);
      toast({
        title: "Invalid Link",
        description: "This STRAPT Drop link is invalid or malformed",
        variant: "destructive"
      });
      navigate('/app');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate, toast]);

  // Circuit breaker to prevent too many requests
  const [circuitBroken, setCircuitBroken] = useState(false);

  // State to track if drop is expired or fully claimed to prevent further requests
  const [dropStatus, setDropStatus] = useState<'loading' | 'expired' | 'claimed' | 'active' | 'not_found'>('loading');

  // Use a ref to track if we've already fetched the drop info
  const dropInfoFetched = useRef(false);

  // Fetch drop info only once on initial load
  useEffect(() => {
    // Only fetch if we have a dropId and haven't fetched yet
    if (!dropId || dropInfoFetched.current) return;

    // If we already know the drop is expired or all claims are taken, don't make any more requests
    if (dropStatus === 'expired' || dropStatus === 'claimed') {
      setIsLoadingInfo(false);
      return;
    }

    // If circuit breaker is triggered, don't make any more requests
    if (circuitBroken) {
      setIsLoadingInfo(false);
      return;
    }

    // Flag to track if the component is still mounted
    let isMounted = true;

    const fetchDropInfo = async () => {
      if (!dropId) return;

      try {
        setIsLoadingInfo(true);

        // Mark that we've attempted to fetch the drop info
        dropInfoFetched.current = true;

        // First, try to get the drop info
        const info = await getDropInfo(dropId);

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        // If info is undefined, it means the drop doesn't exist
        if (!info) {
          console.log('Drop not found or does not exist');
          setDropStatus('not_found');
          toast({
            title: "Drop Not Found",
            description: "This STRAPT Drop does not exist or has expired",
            variant: "destructive"
          });
          navigate('/app');
          return;
        }

        // Check if drop is expired immediately
        const nowInSeconds = Math.floor(Date.now() / 1000);

        // Only fix expiryTime if it's invalid, but keep other data as is
        const modifiedInfo = { ...info };
        let needsModification = false;

        // Check if expiryTime is valid (greater than 0)
        if (info.expiryTime <= 0) {
          console.error('Invalid expiryTime detected in fetchDropInfo:', info.expiryTime);
          // For drops with expiryTime = 0, we'll set it to 24 hours from creation
          modifiedInfo.expiryTime = Math.floor(Date.now() / 1000) + 86400; // Current time + 24 hours in seconds
          console.log('Modified expiryTime:', modifiedInfo.expiryTime);
          needsModification = true;
        }

          // Get token symbol based on hardcoded token addresses
          try {
            // Hardcoded token addresses for IDRX and USDC
            const IDRX_ADDRESS = "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661";
            const USDC_ADDRESS = "0x72db95F0716cF79C0efe160F23fB17bF1c161317";

            // Safely get token address, handling null/undefined cases
            const dropTokenAddress = info.tokenAddress ? info.tokenAddress.toLowerCase() : '';

            // Log the token address for debugging
            console.log('Drop token address:', dropTokenAddress || 'empty');

            // Force USDC for this specific case since we know it's USDC
            if (dropTokenAddress === USDC_ADDRESS.toLowerCase()) {
              console.log('Token identified as USDC');
              setTokenSymbol('USDC');
            }
            // Check if the token address matches IDRX
            else if (dropTokenAddress === IDRX_ADDRESS.toLowerCase()) {
              console.log('Token identified as IDRX');
              setTokenSymbol('IDRX');
            }
            // Handle any other case - default to USDC since that's what we know is being used
            else {
              console.log('Using default token (USDC) for address:', info.tokenAddress);
              setTokenSymbol('USDC');
            }
          } catch (error) {
            console.error('Error determining token symbol:', error);
            // Default to USDC if there's an error since that's what we know is being used
            setTokenSymbol('USDC');
          }

          // Log warnings for other invalid data but don't modify them
          if (info.totalRecipients <= 0) {
            console.warn('Warning: totalRecipients is 0 or negative:', info.totalRecipients);
          }

          if (info.totalAmount === '0' || info.totalAmount === '0.00') {
            console.warn('Warning: totalAmount is 0:', info.totalAmount);
          }

          // If we modified expiryTime, use the modified info
          if (needsModification) {
            setDropInfo(modifiedInfo);
            setDropStatus('active');
            setIsLoadingInfo(false);
            return;
          }

          const isExpired = info.expiryTime < nowInSeconds;

          // Log the values for debugging
          console.log('Drop expiryTime in fetchDropInfo:', info.expiryTime);
          console.log('Current time (seconds) in fetchDropInfo:', nowInSeconds);
          console.log('Is expired in fetchDropInfo:', isExpired);

          setDropInfo(info);

          // If drop is expired, we can skip checking claim status and prevent further requests
          if (isExpired) {
            console.log('Drop is expired, skipping claim status check');
            setDropStatus('expired');
            setIsLoadingInfo(false);
            return;
          }

          // Check if all claims are taken
          // If totalRecipients is 0 or less, consider it as not all claims taken
          const allClaimsTaken = info.totalRecipients <= 0 ? false : info.claimedCount >= info.totalRecipients;
          if (allClaimsTaken) {
            console.log('All claims taken, skipping claim status check');
            setDropStatus('claimed');
            setIsLoadingInfo(false);
            return;
          }

          // Drop is active, set status
          setDropStatus('active');

          // Claim status will be checked in the separate effect that watches for address changes
      } catch (error) {
        console.error('Error fetching drop info:', error);

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        // Check for specific errors
        if (error instanceof Error) {
          if (error.message.includes('too many requests') ||
              error.message.includes('rate limit') ||
              error.message.includes('429')) {

            // Trigger circuit breaker to prevent more requests
            setCircuitBroken(true);

            toast({
              title: "Rate Limit Exceeded",
              description: "Too many requests to the blockchain. Please try again later.",
              variant: "destructive"
            });

            // After 5 minutes, reset the circuit breaker
            setTimeout(() => {
              setCircuitBroken(false);
            }, 300000); // 5 minutes
          } else if (error.message.includes('DropNotFound')) {
            setDropStatus('not_found');
            toast({
              title: "Drop Not Found",
              description: "This STRAPT Drop does not exist",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Error",
              description: "Failed to load STRAPT Drop information",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to load STRAPT Drop information",
            variant: "destructive"
          });
        }

        navigate('/app');
      } finally {
        if (isMounted) {
          setIsLoadingInfo(false);
        }
      }
    };

    fetchDropInfo();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  // This effect only needs to run once when the dropId is available
  }, [dropId, dropStatus, circuitBroken, getDropInfo, navigate, toast]);

  // Separate effect to handle address changes for claim status checks
  useEffect(() => {
    // Only check claim status if we have a dropId, an address, and the drop is active
    if (!dropId || !address || dropStatus !== 'active' || !dropInfo) return;

    // Skip if we've already checked this address
    if (claimCheckedForAddress.current === address) return;

    // Skip if circuit breaker is triggered
    if (circuitBroken) return;

    const checkClaimStatus = async () => {
      try {
        console.log('Checking claim status for new address:', address);
        // Mark this address as checked to prevent duplicate requests
        claimCheckedForAddress.current = address;

        // Check if the user has claimed
        const claimed = await hasAddressClaimed(dropId, address);

        if (claimed) {
          setHasClaimed(true);

          // Only get claimed amount if we know the user has claimed
          const amount = await getClaimedAmount(dropId, address);
          if (amount && amount !== '0') {
            setClaimedAmount(amount);
          }
        }
      } catch (error) {
        console.error('Error checking claim status for new address:', error);

        // Check for specific errors
        if (error instanceof Error) {
          if (error.message.includes('too many requests') ||
              error.message.includes('rate limit') ||
              error.message.includes('429')) {

            // Trigger circuit breaker to prevent more requests
            setCircuitBroken(true);

            // After 5 minutes, reset the circuit breaker
            setTimeout(() => {
              setCircuitBroken(false);
            }, 300000); // 5 minutes

            console.log('Rate limited during claim status check, continuing with available data');
          } else if (error.message.includes('DropNotFound')) {
            console.log('Drop not found during claim status check');
            setDropStatus('not_found');
            toast({
              title: "Drop Not Found",
              description: "This STRAPT Drop does not exist",
              variant: "destructive"
            });
            navigate('/app');
          }
        }
      }
    };

    checkClaimStatus();
  // This effect runs when the address or drop status changes
  // We want to check claim status when a new wallet connects
  }, [address, dropId, dropStatus, dropInfo, circuitBroken, hasAddressClaimed, getClaimedAmount, navigate, toast]);

  // Handle claim
  const handleClaim = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim this STRAPT Drop",
        variant: "destructive"
      });
      return;
    }

    if (!dropId) return;

    try {
      // The claimDrop function now handles errors internally and returns undefined on error
      const amount = await claimDrop(dropId);

      if (amount) {
        setClaimedAmount(amount);
        setHasClaimed(true);
        setShowSuccessAnimation(true);

        toast({
          title: "STRAPT Drop Claimed",
          description: `You received ${amount} ${tokenSymbol}!`,
        });

        // Hide success animation after 5 seconds
        setTimeout(() => {
          setShowSuccessAnimation(false);
        }, 5000);
      }
    } catch (error) {
      // This should rarely happen now since errors are handled in the hook
      console.error('Unhandled error claiming STRAPT Drop:', error);
      toast({
        title: "Error Claiming STRAPT Drop",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive"
      });
    }
  };

  // Check if drop is expired
  const isExpired = dropInfo ? (() => {
    // Log the values for debugging
    console.log('Drop expiryTime:', dropInfo.expiryTime);
    console.log('Current time (seconds):', Math.floor(Date.now() / 1000));
    console.log('Current time (ms):', Date.now());

    // Check if expiryTime is valid (greater than 0)
    if (dropInfo.expiryTime <= 0) {
      console.error('Invalid expiryTime detected:', dropInfo.expiryTime);
      // For drops with expiryTime = 0, we'll treat them as never expiring
      return false; // Don't mark as expired if expiryTime is invalid
    }

    // Compare timestamps in seconds (not milliseconds)
    const result = dropInfo.expiryTime < Math.floor(Date.now() / 1000);
    console.log('Comparison result:', result);

    return result;
  })() : false;

  // Check if all claims are taken
  const allClaimsTaken = dropInfo ?
    // If totalRecipients is 0 or less, consider it as not all claims taken
    (dropInfo.totalRecipients <= 0 ? false : dropInfo.claimedCount >= dropInfo.totalRecipients)
    : false;

  // Format expiry time
  const formatExpiryTime = () => {
    if (!dropInfo) return '';

    // Special handling for expiryTime = 0
    if (dropInfo.expiryTime <= 0) {
      return 'No expiration';
    }

    // expiryTime is already in seconds, convert to milliseconds for Date object
    const expiryDate = new Date(dropInfo.expiryTime * 1000);

    // Log for debugging
    console.log('Expiry date:', expiryDate.toLocaleString());
    console.log('Current date:', new Date().toLocaleString());

    if (isExpired) {
      return 'Expired';
    }

    // Calculate time difference
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    // We don't need this condition anymore since we're using 24 hours
    // All drops should expire within 24 hours

    // Format based on time remaining
    if (diffDays > 0) {
      return diffDays === 1
        ? `Expires in 1 day ${diffHours > 0 ? `and ${diffHours} hour${diffHours > 1 ? 's' : ''}` : ''}`
        : `Expires in ${diffDays} days${diffHours > 0 ? ` and ${diffHours} hour${diffHours > 1 ? 's' : ''}` : ''}`;
    }
    if (diffHours > 0) {
      return diffHours === 1
        ? `Expires in 1 hour${diffMinutes > 0 ? ` and ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}` : ''}`
        : `Expires in ${diffHours} hours${diffMinutes > 0 ? ` and ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}` : ''}`;
    }
    if (diffMinutes > 0) {
      return `Expires in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
    return 'Expires in less than a minute';
  };

  return (
    <div className="container max-w-md mx-auto py-6">

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            STRAPT Drop
          </CardTitle>
          <CardDescription>
            Claim your tokens
          </CardDescription>
        </CardHeader>

        {isLoadingInfo ? (
          <CardContent className="flex justify-center py-8">
            <Loading size="lg" text="Loading STRAPT Drop..." />
          </CardContent>
        ) : !dropInfo ? (
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Drop Not Found</p>
            <p className="text-muted-foreground">This STRAPT Drop does not exist or has expired</p>
          </CardContent>
        ) : hasClaimed ? (
          <CardContent className="space-y-6 text-center py-8">
            <div className={`w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto ${showSuccessAnimation ? 'animate-bounce' : ''}`}>
              {showSuccessAnimation ? (
                <PartyPopper className="h-10 w-10 text-primary" />
              ) : (
                <Check className="h-10 w-10 text-primary" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold mb-1">{claimedAmount} {tokenSymbol}</p>
              <p className="text-muted-foreground">Successfully claimed!</p>
            </div>
            <div className="bg-secondary/30 p-4 rounded-lg">
              {dropInfo.message && (
                <p className="italic mb-2">"{dropInfo.message}"</p>
              )}
              <p className="text-sm text-muted-foreground">
                From: {dropInfo.creator.slice(0, 6)}...{dropInfo.creator.slice(-4)}
              </p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            <div className="bg-secondary/30 p-4 rounded-lg text-center">
              {Number(dropInfo.totalAmount) > 0 ? (
                <p className="text-lg font-medium mb-2">
                  {dropInfo.totalAmount} {tokenSymbol}
                </p>
              ) : (
                <p className="text-lg font-medium mb-2 text-yellow-500">
                  Loading token amount...
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {dropInfo.totalRecipients > 0
                  ? `For ${dropInfo.totalRecipients} recipients • ${dropInfo.isRandom ? 'Random' : 'Fixed'} distribution`
                  : 'Distribution details unavailable'
                }
              </p>
              {dropInfo.message && (
                <p className="mt-2 italic">"{dropInfo.message}"</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Expiry
                </span>
                <span className={isExpired ? 'text-destructive' : ''}>
                  {formatExpiryTime()}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" /> Claims
                </span>
                <span className={allClaimsTaken ? 'text-destructive' : ''}>
                  {dropInfo.totalRecipients > 0
                    ? `${dropInfo.claimedCount} / ${dropInfo.totalRecipients}`
                    : `${dropInfo.claimedCount} claimed`
                  }
                </span>
              </div>
            </div>

            {isExpired ? (
              <div className="bg-destructive/10 p-4 rounded-lg text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-destructive font-medium">This STRAPT Drop has expired</p>
              </div>
            ) : allClaimsTaken ? (
              <div className="bg-destructive/10 p-4 rounded-lg text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-destructive font-medium">All claims have been taken</p>
              </div>
            ) : null}
          </CardContent>
        )}

        <CardFooter>
          {!isConnected ? (
            <Button className="w-full" onClick={() => connectWallet()}>
              Connect Wallet to Claim
            </Button>
          ) : hasClaimed ? (
            <div className="flex gap-2 w-full">
              <Button className="flex-1" variant="outline" onClick={() => navigate('/app/strapt-drop/my-drops')}>
                My Drops
              </Button>
              <Button className="flex-1" onClick={() => navigate('/app')}>
                Return to Home
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={handleClaim}
              disabled={isLoading || isExpired || allClaimsTaken}
            >
              {isLoading ? (
                <>
                  <Loading size="sm" className="mr-2" /> Claiming...
                </>
              ) : isExpired ? (
                'Drop Expired'
              ) : allClaimsTaken ? (
                'All Claims Taken'
              ) : (
                'Claim STRAPT Drop'
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default StraptDropClaim;



