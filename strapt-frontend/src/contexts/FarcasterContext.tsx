import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';

export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  verifications?: string[];
}

export interface FarcasterSigner {
  fid: number;
  status: 'pending_approval' | 'approved' | 'revoked';
  publicKey: string;
  privateKey?: string;
  signerUuid?: string;
}

export interface FarcasterFrameContext {
  user?: FarcasterUser;
  signer?: FarcasterSigner;
  isInFrame: boolean;
  frameUrl?: string;
  castHash?: string;
  parentCastFid?: number;
  parentCastHash?: string;
}

interface FarcasterContextType {
  frameContext: FarcasterFrameContext;
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
  connectFarcaster: () => Promise<void>;
  disconnectFarcaster: () => void;
  signFrameAction: (actionData: any) => Promise<string>;
  updateFrameContext: (context: Partial<FarcasterFrameContext>) => void;
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined);

interface FarcasterProviderProps {
  children: ReactNode;
}

export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  const { address, isConnected: walletConnected } = useAccount();
  const [frameContext, setFrameContext] = useState<FarcasterFrameContext>({
    isInFrame: false,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Detect if we're running inside a Farcaster frame
  useEffect(() => {
    const detectFrameContext = () => {
      // Check for frame-specific URL parameters or headers
      const urlParams = new URLSearchParams(window.location.search);
      const isInFrame = !!(
        urlParams.get('frame') ||
        urlParams.get('fc_frame') ||
        window.parent !== window ||
        document.referrer.includes('warpcast.com') ||
        document.referrer.includes('farcaster.xyz')
      );

      if (isInFrame) {
        setFrameContext(prev => ({
          ...prev,
          isInFrame: true,
          frameUrl: window.location.href,
          castHash: urlParams.get('cast_hash') || undefined,
          parentCastFid: urlParams.get('parent_fid') ? parseInt(urlParams.get('parent_fid')!) : undefined,
          parentCastHash: urlParams.get('parent_hash') || undefined,
        }));
      }
    };

    detectFrameContext();
  }, []);

  // Mock Farcaster connection for development
  const connectFarcaster = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // In a real implementation, this would connect to Farcaster
      // For now, we'll simulate a connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockUser: FarcasterUser = {
        fid: 12345,
        username: 'strapt_user',
        displayName: 'STRAPT User',
        pfpUrl: '/placeholder.svg',
        bio: 'Using STRAPT for secure transfers',
        followerCount: 100,
        followingCount: 50,
        verifications: [address || ''],
      };

      const mockSigner: FarcasterSigner = {
        fid: 12345,
        status: 'approved',
        publicKey: '0x1234567890abcdef',
        privateKey: '0xabcdef1234567890',
        signerUuid: 'uuid-1234',
      };

      setFrameContext(prev => ({
        ...prev,
        user: mockUser,
        signer: mockSigner,
      }));

      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Farcaster');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectFarcaster = () => {
    setFrameContext(prev => ({
      ...prev,
      user: undefined,
      signer: undefined,
    }));
    setIsConnected(false);
    setError(undefined);
  };

  const signFrameAction = async (actionData: any): Promise<string> => {
    if (!frameContext.signer) {
      throw new Error('No Farcaster signer available');
    }

    // In a real implementation, this would sign the frame action
    // For now, we'll return a mock signature
    return 'mock_signature_' + Date.now();
  };

  const updateFrameContext = (context: Partial<FarcasterFrameContext>) => {
    setFrameContext(prev => ({ ...prev, ...context }));
  };

  const value: FarcasterContextType = {
    frameContext,
    isConnected,
    isLoading,
    error,
    connectFarcaster,
    disconnectFarcaster,
    signFrameAction,
    updateFrameContext,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
};

export const useFarcaster = (): FarcasterContextType => {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
};

// Fallback frame context for when not in a frame
export const fallbackFrameContext: FarcasterFrameContext = {
  isInFrame: false,
  user: {
    fid: 1,
    username: 'demo_user',
    displayName: 'Demo User',
  },
};
