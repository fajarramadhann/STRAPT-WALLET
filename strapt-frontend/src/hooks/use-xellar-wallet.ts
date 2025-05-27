import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useConnectModal } from '@xellar/kit';
import { toast } from 'sonner';

export function useXellarWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { open } = useConnectModal();
  const navigate = useNavigate();

  // Auto-navigate to app after successful connection
  useEffect(() => {
    if (isConnected) {
      // Check if we're on the landing page and navigate if needed
      if (window.location.pathname === '/') {
        navigate('/app');
      }
    }
  }, [isConnected, navigate]);

  // Function to handle wallet connection
  const connectXellarWallet = async () => {
    try {
      console.log('connectXellarWallet called, open modal available:', !!open);
      
      // If the connect modal is available, use it
      if (open) {
        console.log('Opening Xellar connect modal');
        open();
        return true;
      }

      console.log('Xellar connect modal not available, trying fallback');
      // Fallback: try to connect using wagmi directly
      const xellarConnector = connectors.find(c => c.id === 'xellar');

      if (xellarConnector) {
        console.log('Found Xellar connector, attempting to connect');
        await connect({ connector: xellarConnector });
        return true;
      }

      console.log('No Xellar connector found');
      toast.error('Unable to connect wallet. Please try again later.');
      return false;
    } catch (error) {
      console.error("Xellar wallet connection error:", error);
      toast.error('Failed to connect wallet. Please try again.');
      return false;
    }
  };

  // Function to disconnect wallet
  const disconnectXellarWallet = async () => {
    try {
      await disconnect();
      navigate('/');
      return true;
    } catch (error) {
      console.error("Xellar wallet disconnection error:", error);
      toast.error('Failed to disconnect wallet. Please try again.');
      return false;
    }
  };

  // Return the necessary wallet functions and state
  return {
    isConnected,
    address,
    connectWallet: connectXellarWallet,
    disconnectWallet: disconnectXellarWallet,
  };
}
