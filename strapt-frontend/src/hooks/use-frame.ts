import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { handleFrameRequest, validateFrameRequest, type FrameRequest } from '@/api/frames';

export interface FrameState {
  isLoading: boolean;
  error?: string;
  frameData?: any;
  currentStep: string;
  userInput?: string;
}

export interface FrameConfig {
  homeFrameUrl: string;
  frameActionProxy?: string;
  frameGetProxy?: string;
  onFrameAction?: (action: any) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for managing Farcaster frame state and interactions
 */
export const useFrame = (config: FrameConfig) => {
  const { address, isConnected } = useAccount();
  const { frameContext, signFrameAction } = useFarcaster();
  
  const [frameState, setFrameState] = useState<FrameState>({
    isLoading: false,
    currentStep: 'initial',
  });

  // Initialize frame
  useEffect(() => {
    if (frameContext.isInFrame) {
      loadFrame(config.homeFrameUrl);
    }
  }, [frameContext.isInFrame, config.homeFrameUrl]);

  const loadFrame = useCallback(async (url: string) => {
    setFrameState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const response = await handleFrameRequest(url, 'GET');
      const frameData = await response.json();
      
      setFrameState(prev => ({
        ...prev,
        isLoading: false,
        frameData,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load frame';
      setFrameState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      config.onError?.(errorMessage);
    }
  }, [config]);

  const handleButtonPress = useCallback(async (buttonIndex: number, inputText?: string) => {
    if (!frameContext.user) {
      throw new Error('User not authenticated');
    }

    setFrameState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // Create frame request
      const frameRequest: FrameRequest = {
        untrustedData: {
          fid: frameContext.user.fid,
          url: window.location.href,
          messageHash: '0x' + Math.random().toString(16).substr(2, 64),
          timestamp: Math.floor(Date.now() / 1000),
          network: 1, // Ethereum mainnet
          buttonIndex,
          inputText,
          castId: frameContext.parentCastFid && frameContext.parentCastHash ? {
            fid: frameContext.parentCastFid,
            hash: frameContext.parentCastHash,
          } : undefined,
        },
        trustedData: {
          messageBytes: await signFrameAction({
            fid: frameContext.user.fid,
            buttonIndex,
            inputText,
            url: window.location.href,
          }),
        },
      };

      // Validate request
      if (!validateFrameRequest(frameRequest)) {
        throw new Error('Invalid frame request');
      }

      // Send frame action
      const actionUrl = config.frameActionProxy || config.homeFrameUrl;
      const response = await handleFrameRequest(actionUrl, 'POST', frameRequest);
      const result = await response.json();

      setFrameState(prev => ({
        ...prev,
        isLoading: false,
        frameData: result,
        userInput: inputText,
      }));

      config.onFrameAction?.(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Frame action failed';
      setFrameState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      config.onError?.(errorMessage);
    }
  }, [frameContext, signFrameAction, config]);

  const updateStep = useCallback((step: string) => {
    setFrameState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const setUserInput = useCallback((input: string) => {
    setFrameState(prev => ({ ...prev, userInput: input }));
  }, []);

  const clearError = useCallback(() => {
    setFrameState(prev => ({ ...prev, error: undefined }));
  }, []);

  const refresh = useCallback(() => {
    loadFrame(config.homeFrameUrl);
  }, [loadFrame, config.homeFrameUrl]);

  return {
    frameState,
    frameContext,
    isConnected,
    address,
    actions: {
      handleButtonPress,
      updateStep,
      setUserInput,
      clearError,
      refresh,
      loadFrame,
    },
  };
};

/**
 * Hook for frame-specific wallet integration
 */
export const useFrameWallet = () => {
  const { address, isConnected } = useAccount();
  const { frameContext } = useFarcaster();

  const getConnectedAddress = useCallback(() => {
    // Prefer wallet address, fallback to Farcaster verification
    if (address) return address;
    if (frameContext.user?.verifications?.[0]) {
      return frameContext.user.verifications[0];
    }
    return undefined;
  }, [address, frameContext.user]);

  const isWalletConnected = useCallback(() => {
    return isConnected || !!frameContext.user?.verifications?.[0];
  }, [isConnected, frameContext.user]);

  return {
    address: getConnectedAddress(),
    isConnected: isWalletConnected(),
    frameUser: frameContext.user,
    isInFrame: frameContext.isInFrame,
  };
};

/**
 * Hook for generating frame URLs with parameters
 */
export const useFrameUrls = () => {
  const baseUrl = window.location.origin;

  const generateFrameUrl = useCallback((
    framePath: string,
    params?: Record<string, string>
  ) => {
    const url = new URL(`${baseUrl}/frames/${framePath}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }, [baseUrl]);

  const generateShareUrl = useCallback((
    framePath: string,
    params?: Record<string, string>
  ) => {
    const frameUrl = generateFrameUrl(framePath, params);
    // For Warpcast sharing
    return `https://warpcast.com/~/compose?text=${encodeURIComponent('Check out this STRAPT frame!')}&embeds[]=${encodeURIComponent(frameUrl)}`;
  }, [generateFrameUrl]);

  return {
    baseUrl,
    generateFrameUrl,
    generateShareUrl,
  };
};
