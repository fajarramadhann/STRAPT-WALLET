import React, { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { StraptDropFrame } from '@/components/frames/StraptDropFrame';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { generateFrameMetadata, type FrameResponse } from '@/api/frames';

/**
 * Frame page for STRAPT drops
 * Handles both creation and claiming of drops
 */
export const StraptDropFramePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { dropId } = useParams<{ dropId?: string }>();
  const { frameContext, isConnected } = useFarcaster();
  const [frameMetadata, setFrameMetadata] = useState<Record<string, string>>({});

  // Determine mode based on URL
  const mode = dropId ? 'claim' : searchParams.get('mode') === 'create' ? 'create' : 'view';
  const step = searchParams.get('step') || 'input';

  useEffect(() => {
    // Generate frame metadata based on mode
    const baseUrl = window.location.origin;
    let frameResponse: FrameResponse;

    if (mode === 'claim' && dropId) {
      frameResponse = {
        image: `${baseUrl}/api/frames/drop/image?mode=claim&dropId=${dropId}&step=${step}`,
        buttons: [
          { label: 'Claim Drop', action: 'post' },
          { label: 'View Details', action: 'link', target: `${baseUrl}/app/strapt-drop/claim/${dropId}` },
        ],
        postUrl: `${baseUrl}/api/frames/drop/claim/${dropId}`,
      };
    } else {
      frameResponse = {
        image: `${baseUrl}/api/frames/drop/image?mode=create&step=${step}`,
        buttons: [
          { label: 'Create Drop', action: 'post' },
          { label: 'View App', action: 'link', target: `${baseUrl}/app/strapt-drop` },
        ],
        input: step === 'input' ? { text: 'Enter total amount' } : undefined,
        postUrl: `${baseUrl}/api/frames/drop/create`,
      };
    }

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
    const ogTitle = mode === 'claim' ? 'Claim STRAPT Drop' : 'Create STRAPT Drop';
    const ogDescription = mode === 'claim' 
      ? 'Claim your share of tokens from this STRAPT drop'
      : 'Distribute tokens to multiple recipients with STRAPT';

    const ogMetadata = {
      'og:title': ogTitle,
      'og:description': ogDescription,
      'og:image': frameResponse.image,
      'og:url': window.location.href,
      'og:type': 'website',
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

    // Add Twitter Card metadata
    const twitterMetadata = {
      'twitter:card': 'summary_large_image',
      'twitter:title': ogTitle,
      'twitter:description': ogDescription,
      'twitter:image': frameResponse.image,
    };

    Object.entries(twitterMetadata).forEach(([key, value]) => {
      let metaTag = document.querySelector(`meta[name="${key}"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', key);
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', value);
    });
  }, [mode, dropId, step]);

  const handleDropCreated = (newDropId: string) => {
    // Update URL to success state
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('step', 'success');
    newUrl.searchParams.set('dropId', newDropId);
    window.history.pushState({}, '', newUrl.toString());

    // Update frame metadata for success state
    const successFrame: FrameResponse = {
      image: `${window.location.origin}/api/frames/drop/image?mode=created&dropId=${newDropId}`,
      buttons: [
        { label: 'Share Drop', action: 'link', target: `${window.location.origin}/frames/drop/${newDropId}` },
        { label: 'Create Another', action: 'post', target: `${window.location.origin}/frames/drop?mode=create` },
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

  const handleDropClaimed = (amount: string) => {
    // Update URL to claimed state
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('step', 'claimed');
    newUrl.searchParams.set('amount', amount);
    window.history.pushState({}, '', newUrl.toString());

    // Update frame metadata for claimed state
    const claimedFrame: FrameResponse = {
      image: `${window.location.origin}/api/frames/drop/image?mode=claimed&amount=${amount}&dropId=${dropId}`,
      buttons: [
        { label: 'View Transaction', action: 'link', target: `${window.location.origin}/app/profile` },
        { label: 'Explore STRAPT', action: 'link', target: `${window.location.origin}/app` },
      ],
    };

    const metadata = generateFrameMetadata(claimedFrame);
    Object.entries(metadata).forEach(([key, value]) => {
      const metaTag = document.querySelector(`meta[property="${key}"]`);
      if (metaTag) {
        metaTag.setAttribute('content', value);
      }
    });
  };

  // If not in frame context and not connected, show connection prompt
  if (!frameContext.isInFrame && !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold">
            {mode === 'claim' ? 'Claim STRAPT Drop' : 'STRAPT Drop'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'claim' 
              ? 'Connect your wallet to claim your tokens'
              : 'Connect your wallet to create and manage drops'
            }
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
        <StraptDropFrame
          dropId={dropId}
          mode={mode as 'create' | 'claim' | 'view'}
          onDropCreated={handleDropCreated}
          onDropClaimed={handleDropClaimed}
        />
      </div>
    </div>
  );
};

export default StraptDropFramePage;
