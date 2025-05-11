
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Scan, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Helper function to process QR code data - exported for reuse
export const processQRCodeData = (
  decodedText: string,
  navigate: (to: string) => void,
  toast: {
    (props: { title: string; description?: string; variant?: "default" | "destructive" }): void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  }
): boolean => {
  console.log("Processing QR code:", decodedText);

  try {
    // Check if it's a URL
    if (decodedText.startsWith('http')) {
      const url = new URL(decodedText);

      // Check if it's a claim URL
      if (url.pathname.includes('/claim/')) {
        const claimId = url.pathname.split('/claim/')[1];
        const params = new URLSearchParams(url.search);
        const code = params.get('code');

        if (claimId) {
          // If we have a code parameter, include it in the URL
          if (code) {
            navigate(`/app/claims?id=${claimId}&code=${code}`);
          } else {
            navigate(`/app/claims?id=${claimId}`);
          }

          toast({
            title: "QR Code Scanned Successfully",
            description: "Opening the claim page",
          });
          return true;
        }
      }

      // Check if URL contains transfer ID in query params
      const params = new URLSearchParams(url.search);
      const transferId = params.get('id') || params.get('transferId');
      const claimCode = params.get('code') || params.get('claimCode');

      if (transferId && transferId.startsWith('0x')) {
        if (claimCode) {
          navigate(`/app/claims?id=${transferId}&code=${claimCode}`);
        } else {
          navigate(`/app/claims?id=${transferId}`);
        }

        toast({
          title: "Transfer ID Detected in URL",
          description: "Opening the claim page",
        });
        return true;
      }

      // If it's just a website URL without transfer info
      toast({
        title: "Not a Payment Code",
        description: "This QR code doesn't contain payment information",
        variant: "destructive",
      });
      return false;
    }

    // Check if it's a JSON string containing transfer data
    if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
      try {
        const jsonData = JSON.parse(decodedText);

        // Check if JSON contains transfer ID
        if (jsonData.id || jsonData.transferId) {
          const transferId = jsonData.id || jsonData.transferId;
          const claimCode = jsonData.code || jsonData.claimCode || jsonData.password;

          if (transferId.startsWith('0x')) {
            if (claimCode) {
              navigate(`/app/claims?id=${transferId}&code=${claimCode}`);
            } else {
              navigate(`/app/claims?id=${transferId}`);
            }

            toast({
              title: "Transfer Data Detected",
              description: "Opening the claim page",
            });
            return true;
          }
        }

        // Check if JSON contains wallet address
        if (jsonData.address && jsonData.address.startsWith('0x')) {
          navigate(`/app/transfer?to=${jsonData.address}`);
          toast({
            title: "Wallet Address Detected",
            description: "Opening the transfer page",
          });
          return true;
        }
      } catch (e) {
        console.error("Error parsing JSON from QR code:", e);
      }
    }

    // Check if it's an Ethereum address
    if (decodedText.startsWith('0x') && decodedText.length === 42) {
      // It's an Ethereum address, navigate to transfer page with pre-filled recipient
      navigate(`/app/transfer?to=${decodedText}`);
      toast({
        title: "Wallet Address Detected",
        description: "Opening the transfer page",
      });
      return true;
    }

    // Check if it's a transfer ID (32 bytes hex)
    if (decodedText.startsWith('0x') && decodedText.length === 66) {
      // It's likely a transfer ID, navigate to claims page
      navigate(`/app/claims?id=${decodedText}`);
      toast({
        title: "Transfer ID Detected",
        description: "Opening the claim page",
      });
      return true;
    }

    // Check if it contains a transfer ID anywhere in the text
    const hexRegex = /0x[a-fA-F0-9]{64}/;
    const match = decodedText.match(hexRegex);
    if (match) {
      const transferId = match[0];
      navigate(`/app/claims?id=${transferId}`);
      toast({
        title: "Transfer ID Found",
        description: "Opening the claim page",
      });
      return true;
    }

    // If we get here, the format wasn't recognized
    toast({
      title: "Unknown QR Code Format",
      description: "This QR code format isn't recognized",
      variant: "destructive",
    });
    return false;
  } catch (e) {
    console.error("Error processing QR code:", e);
    toast({
      title: "Invalid QR Code",
      description: "This QR code format isn't recognized",
      variant: "destructive",
    });
    return false;
  }
};

interface QRCodeScannerProps {
  onScanSuccess?: (decodedText: string) => void;
  triggerType?: 'button' | 'popover' | 'dialog';
  buttonText?: string;
  buttonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  buttonClassName?: string;
  iconOnly?: boolean;
}

const QRCodeScanner = ({
  onScanSuccess,
  triggerType = 'button',
  buttonText = 'Scan QR Code',
  buttonVariant = 'default',
  buttonSize = 'default',
  buttonClassName = '',
  iconOnly = false,
}: QRCodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();

  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qrcode-scanner';

  const startScanner = async () => {
    if (!html5QrCode.current) {
      html5QrCode.current = new Html5Qrcode(scannerContainerId);
    }

    setIsScanning(true);

    try {
      const qrCodeSuccessCallback = (decodedText: string) => {
        stopScanner();

        if (onScanSuccess) {
          // Call the custom handler first
          onScanSuccess(decodedText);

          // Also process with our standard handler to ensure consistent behavior
          // across all QR code scanners in the app
          processQRCodeData(decodedText, navigate, toast);
        } else {
          // Use the standard processing function
          processQRCodeData(decodedText, navigate, toast);
        }

        setScannerOpen(false);
      };

      const config = { fps: 10, qrbox: isMobile ? 250 : 300 };

      await html5QrCode.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        () => {} // Ignore failures to avoid console noise
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setIsScanning(false);
      toast({
        title: "Camera Access Needed",
        description: "Please allow camera access to scan QR codes",
        variant: "destructive",
      });
    }
  };

  const stopScanner = () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      html5QrCode.current.stop()
        .catch(err => console.error("Error stopping scanner:", err))
        .finally(() => setIsScanning(false));
    }
  };

  const handleOpenChange = (open: boolean) => {
    setScannerOpen(open);
    if (!open && isScanning) {
      stopScanner();
    }
    if (open) {
      setTimeout(() => startScanner(), 500);
    }
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const scannerContent = (
    <div className="flex flex-col items-center">
      <div id={scannerContainerId} className="w-full max-w-[300px] h-[300px] relative">
        <div className="absolute inset-0 flex items-center justify-center">
          {!isScanning && <Scan className="h-10 w-10 text-muted-foreground animate-pulse" />}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-4 mb-2">
        Point your camera at a QR code to scan it
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(false)}
        className="mt-2"
      >
        Cancel
      </Button>
    </div>
  );

  const triggerButton = (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={buttonClassName}
      onClick={triggerType === 'button' ? () => handleOpenChange(true) : undefined}
    >
      <Scan className={`h-4 w-4 ${!iconOnly ? 'mr-2' : ''}`} />
      {!iconOnly && buttonText}
    </Button>
  );

  // Render different trigger types
  if (triggerType === 'dialog') {
    return (
      <>
        {triggerButton}
        <Dialog open={scannerOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-xs mx-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Scan a QR code to claim a transfer or add a contact
              </DialogDescription>
            </DialogHeader>
            {scannerContent}
          </DialogContent>
        </Dialog>
      </>
    );
  } else if (triggerType === 'popover') {
    return (
      <Popover open={scannerOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent className="w-80" align="center">
          {scannerContent}
        </PopoverContent>
      </Popover>
    );
  } else {
    return (
      <>
        {triggerButton}
        <Dialog open={scannerOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-xs mx-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Scan a QR code to claim a transfer or add a contact
              </DialogDescription>
            </DialogHeader>
            {scannerContent}
          </DialogContent>
        </Dialog>
      </>
    );
  }
};

export default QRCodeScanner;
