'use client';

import { useEffect, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useBettingStore } from '@/lib/store';
import { useContract } from '@/hooks/useContract';

export function useRoundData() {
  const { connected, account } = useWallet();
  const { 
    setCurrentRound, 
    setLoading, 
    setError,
    addUserBet,
    currentRound 
  } = useBettingStore();
  
  const { getCurrentRoundId, getRoundInfo, getUserBet } = useContract();

  const fetchCurrentRound = useCallback(async () => {
    try {
      setLoading(true);
      const currentId = await getCurrentRoundId();
      
      if (currentId > 0) {
        const round = await getRoundInfo(currentId);
        setCurrentRound(round);
        
        // Fetch user bet for current round if connected
        if (connected && account && round) {
          const userBet = await getUserBet(currentId);
          if (userBet) {
            addUserBet(userBet);
          }
        }
      } else {
        setCurrentRound(null);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error fetching current round:', error);
      setError('Failed to fetch current round data');
    } finally {
      setLoading(false);
    }
  }, [getCurrentRoundId, getRoundInfo, getUserBet, connected, account, setCurrentRound, setLoading, setError, addUserBet]);

  // Initial fetch
  useEffect(() => {
    fetchCurrentRound();
  }, [fetchCurrentRound]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchCurrentRound, 30000);
    return () => clearInterval(interval);
  }, [fetchCurrentRound]);

  // Refresh when wallet connection changes
  useEffect(() => {
    if (connected && account) {
      fetchCurrentRound();
    }
  }, [connected, account, fetchCurrentRound]);

  // Auto-refresh when round expires
  useEffect(() => {
    if (!currentRound) return;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = currentRound.expiryTime - now;

    if (timeUntilExpiry > 0 && timeUntilExpiry <= 300) { // If expires within 5 minutes
      const timeout = setTimeout(() => {
        fetchCurrentRound();
      }, (timeUntilExpiry + 5) * 1000); // Refresh 5 seconds after expiry

      return () => clearTimeout(timeout);
    }
  }, [currentRound, fetchCurrentRound]);

  return {
    fetchCurrentRound,
  };
}
