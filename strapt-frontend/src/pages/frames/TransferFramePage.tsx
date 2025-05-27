import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TransferFrame } from '@/components/frames/TransferFrame';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { generateFrameMetadata, type FrameResponse } from '@/api/frames';

/**
 * Frame page for STRAPT transfers
 * Handles frame-specific routing and metadata
 */
export const TransferFramePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { frameContext, isConnected } = useFarcaster();
  const [frameMetadata, setFrameMetadata] = useState<Record<string, string>>({});

  // Extract frame parameters
  const step = searchParams.get('step') || 'input';
  const recipient = searchParams.get('recipient') || '';
  const amount = searchParams.get('amount') || '';
  const token = searchParams.get('token') || 'IDRX';

  useEffect(() => {
    // Generate frame metadata for social sharing
    const baseUrl = window.location.origin;
    const frameResponse: FrameResponse = {
      image: `${baseUrl}/api/frames/transfer/image?step=${step}&recipient=${recipient}&amount=${amount}&token=${token}`,
      buttons: [
        { label: 'Send Transfer', action: 'post' },
        { label: 'View App', action: 'link', target: `${baseUrl}/app/transfer` },
      ],
      input: step === 'input' ? { text: 'Enter recipient address' } : undefined,
      postUrl: `${baseUrl}/api/frames/transfer`,
    };

    const metadata = generateFrameMetadata(frameResponse);
    setFrameMetadata(metadata);

    // Update document head with frame metadata
    Object.entries(metadata).forEach(([key, value]) => {
      let metaTag = document.querySelector(`meta[property="${key}"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('property', key);
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', value);
    });

    // Add Open Graph metadata
    const ogMetadata = {
      'og:title': 'STRAPT Transfer',
      'og:description': 'Send secure transfers with STRAPT protocol',
      'og:image': frameResponse.image,
      'og:url': window.location.href,
    };

    Object.entries(ogMetadata).forEach(([key, value]) => {
      let metaTag = document.querySelector(`meta[property="${key}"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('property', key);
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', value);
    });
  }, [step, recipient, amount, token]);

  const handleTransferComplete = (txHash: string) => {
    // Update URL to success state
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('step', 'success');
    newUrl.searchParams.set('txHash', txHash);
    window.history.pushState({}, '', newUrl.toString());

    // Update frame metadata for success state
    const successFrame: FrameResponse = {
      image: `${window.location.origin}/api/frames/transfer/image?step=success&txHash=${txHash}&amount=${amount}&token=${token}`,
      buttons: [
        { label: 'Send Another', action: 'post', target: `${window.location.origin}/frames/transfer` },
        { label: 'View Transaction', action: 'link', target: `https://sepolia-blockscout.lisk.com/tx/${txHash}` },
      ],
    };

    const metadata = generateFrameMetadata(successFrame);
    Object.entries(metadata).forEach(([key, value]) => {
      const metaTag = document.querySelector(`meta[property="${key}"]`);
      if (metaTag) {
        metaTag.setAttribute('content', value);
      }
    });
  };

  const handleBack = () => {
    // Navigate back to main app
    window.location.href = '/app';
  };

  // If not in frame context and not connected, show connection prompt
  if (!frameContext.isInFrame && !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold">STRAPT Transfer</h1>
          <p className="text-muted-foreground">
            Connect your wallet to start sending secure transfers
          </p>
          <button
            onClick={() => window.location.href = '/app'}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            Open STRAPT App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TransferFrame
          onTransferComplete={handleTransferComplete}
          onBack={frameContext.isInFrame ? undefined : handleBack}
        />
      </div>
    </div>
  );
};

export default TransferFramePage;
