import { useState, useEffect, useCallback } from 'react';
import { useXellarWallet } from './use-xellar-wallet';
import { useSentTransfersData, useReceivedTransfersData } from '@/services/TransfersDataService';
import { useStreamsData } from '@/services/StreamsDataService';
import { useStraptDrop } from './use-strapt-drop';

// Define the activity type
export interface ProfileActivity {
  id: string;
  type: 'transfer' | 'claim' | 'stream' | 'pool' | 'drop';
  title: string;
  amount: string;
  status: 'completed' | 'pending' | 'active' | 'failed';
  timestamp: string;
}

/**
 * Hook to get profile activity data
 * Combines data from transfers, streams, and drops
 * Optimized for faster loading with reduced initial data
 */
export function useProfileActivity() {
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useXellarWallet();

  // Get transfers data - limit initial load for performance
  const { transfers: sentTransfers, isLoading: isSentLoading } = useSentTransfersData();
  const { transfers: receivedTransfers, isLoading: isReceivedLoading } = useReceivedTransfersData();

  // Get streams data - only load if needed
  const { streams, isLoading: isStreamsLoading } = useStreamsData();

  // Get STRAPT drops data - lazy load
  const { getUserCreatedDrops, isLoadingUserDrops } = useStraptDrop();
  const [drops, setDrops] = useState<any[]>([]);
  const [dropsLoaded, setDropsLoaded] = useState(false);

  // Lazy fetch drops data only when needed
  useEffect(() => {
    const fetchDrops = async () => {
      if (!address || dropsLoaded) return;

      // Only load drops after other data is loaded to improve initial performance
      if (!isSentLoading && !isReceivedLoading && !isStreamsLoading) {
        try {
          const userDrops = await getUserCreatedDrops();
          setDrops(userDrops || []);
          setDropsLoaded(true);
        } catch (error) {
          console.error('Error fetching user drops:', error);
          setDrops([]);
          setDropsLoaded(true);
        }
      }
    };

    fetchDrops();
  }, [address, getUserCreatedDrops, dropsLoaded, isSentLoading, isReceivedLoading, isStreamsLoading]);

  // Combine all activity data
  useEffect(() => {
    const combineActivityData = () => {
      if (!address) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      // Check if all data is loaded
      if (isSentLoading || isReceivedLoading || isStreamsLoading || isLoadingUserDrops) {
        return;
      }

      const allActivities: ProfileActivity[] = [];

      // Add sent transfers
      if (sentTransfers && sentTransfers.length > 0) {
        sentTransfers.forEach(transfer => {
          allActivities.push({
            id: `transfer-sent-${transfer.id}`,
            type: 'transfer',
            title: `Transfer sent to ${transfer.recipient ? `${transfer.recipient.slice(0, 6)}...${transfer.recipient.slice(-4)}` : 'recipient'}`,
            amount: `${transfer.amount} ${transfer.tokenSymbol || 'tokens'}`,
            status: transfer.status === 'Claimed' ? 'completed' :
                   transfer.status === 'Refunded' ? 'failed' : 'pending',
            timestamp: new Date(Number(transfer.createdAt) * 1000).toISOString(),
          });
        });
      }

      // Add received transfers
      if (receivedTransfers && receivedTransfers.length > 0) {
        receivedTransfers.forEach(transfer => {
          allActivities.push({
            id: `transfer-received-${transfer.id}`,
            type: 'claim',
            title: `Transfer received from ${transfer.sender ? `${transfer.sender.slice(0, 6)}...${transfer.sender.slice(-4)}` : 'sender'}`,
            amount: `${transfer.amount} ${transfer.tokenSymbol || 'tokens'}`,
            status: transfer.status === 'Claimed' ? 'completed' :
                   transfer.status === 'Refunded' ? 'failed' : 'pending',
            timestamp: new Date(Number(transfer.createdAt) * 1000).toISOString(),
          });
        });
      }

      // Add streams
      if (streams && streams.length > 0) {
        streams.forEach(stream => {
          // Ensure we have a valid streamId for unique keys
          const streamId = stream.streamId || `${stream.sender}-${stream.recipient}-${stream.startTime}`;

          // Format the amount properly
          const formattedAmount = stream.totalAmount
            ? `${stream.totalAmount} ${stream.tokenSymbol || 'tokens'}`
            : `0 ${stream.tokenSymbol || 'tokens'}`;

          allActivities.push({
            id: `stream-${streamId}`,
            type: 'stream',
            title: stream.sender === address
              ? `Stream payment to ${stream.recipient.slice(0, 6)}...${stream.recipient.slice(-4)}`
              : `Stream payment from ${stream.sender.slice(0, 6)}...${stream.sender.slice(-4)}`,
            amount: formattedAmount,
            status: stream.status === 'Active' ? 'active' :
                   stream.status === 'Completed' ? 'completed' :
                   stream.status === 'Cancelled' ? 'failed' : 'pending',
            timestamp: new Date(Number(stream.startTime) * 1000).toISOString(),
          });
        });
      }

      // Add drops
      if (drops && drops.length > 0) {
        drops.forEach(drop => {
          allActivities.push({
            id: `drop-${drop.id}`,
            type: 'drop',
            title: `STRAPT Drop created`,
            amount: `${Number(drop.info.totalAmount) / (10 ** (drop.info.tokenAddress === '0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661' ? 2 : 6))} ${drop.info.tokenAddress === '0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661' ? 'IDRX' : 'USDC'}`,
            status: drop.info.isActive ? 'active' :
                   drop.info.remainingAmount === BigInt(0) ? 'completed' : 'pending',
            timestamp: new Date(Number(drop.info.expiryTime) * 1000 - 86400000).toISOString(), // 24 hours before expiry
          });
        });
      }

      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Set activities (empty array if no real data)
      setActivities(allActivities);
      setIsLoading(false);
    };

    combineActivityData();
  }, [
    address,
    sentTransfers,
    receivedTransfers,
    streams,
    drops,
    isSentLoading,
    isReceivedLoading,
    isStreamsLoading,
    isLoadingUserDrops
  ]);

  return { activities, isLoading };
}
