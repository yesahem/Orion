'use client';

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network, InputTransactionData } from '@aptos-labs/ts-sdk';
import { config, parseAptAmount } from '@/lib/config';
import { useBettingStore } from '@/lib/store';
import { Round, UserBet } from '@/types';

export function useContract() {
  const { account, signAndSubmitTransaction } = useWallet();
  const { setTransactionStatus, addBetMarker, addRecentBet } = useBettingStore();

  const aptosConfig = new AptosConfig({ network: config.network as Network });
  const aptos = new Aptos(aptosConfig);

  const placeBet = async (sideUp: boolean, amount: number) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    try {
      setTransactionStatus({ pending: true, success: false });

      const amountInOctas = parseAptAmount(amount);

      const transaction: InputTransactionData = {
        data: {
          function: `${config.moduleAddress}::${config.moduleName}::place_bet`,
          functionArguments: [sideUp, amountInOctas],
        },
      };

      const response = await signAndSubmitTransaction(transaction);
      
      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      // Add bet marker to chart
      addBetMarker({
        time: Math.floor(Date.now() / 1000),
        position: sideUp ? 'belowBar' : 'aboveBar',
        color: sideUp ? '#10b981' : '#ef4444',
        shape: sideUp ? 'arrowUp' : 'arrowDown',
        text: `${sideUp ? 'UP' : 'DOWN'} ${amount} APT`,
        size: 1,
      });

      // Add to recent bets
      addRecentBet({
        roundId: 0, // Will be updated when we fetch current round
        user: account.address,
        sideUp,
        amount: amountInOctas,
        timestamp: Math.floor(Date.now() / 1000),
      });

      setTransactionStatus({ 
        pending: false, 
        success: true, 
        hash: response.hash 
      });

      return response;
    } catch (error) {
      console.error('Error placing bet:', error);
      setTransactionStatus({ 
        pending: false, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  };

  const claim = async (roundId: number) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    try {
      setTransactionStatus({ pending: true, success: false });

      const transaction: InputTransactionData = {
        data: {
          function: `${config.moduleAddress}::${config.moduleName}::claim`,
          functionArguments: [roundId],
        },
      };

      const response = await signAndSubmitTransaction(transaction);
      
      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      setTransactionStatus({ 
        pending: false, 
        success: true, 
        hash: response.hash 
      });

      return response;
    } catch (error) {
      console.error('Error claiming:', error);
      setTransactionStatus({ 
        pending: false, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  };

  const getCurrentRoundId = async (): Promise<number> => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${config.moduleAddress}::${config.moduleName}::get_current_round_id`,
          functionArguments: [],
        },
      });
      return (result as [number])[0];
    } catch (error) {
      console.error('Error getting current round ID:', error);
      return 0;
    }
  };

  const getRoundInfo = async (roundId: number): Promise<Round | null> => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${config.moduleAddress}::${config.moduleName}::get_round_info`,
          functionArguments: [roundId],
        },
      });

      const [startPrice, endPrice, expiryTime, settled, upPool, downPool] = result as [
        number, number, number, boolean, number, number
      ];

      return {
        id: roundId,
        startPrice: startPrice / 100000000, // Convert from 8 decimals
        endPrice: endPrice / 100000000,
        expiryTime,
        settled,
        upPool,
        downPool,
        upWins: settled ? endPrice > startPrice : undefined,
        isTie: settled ? endPrice === startPrice : undefined,
      };
    } catch (error) {
      console.error('Error getting round info:', error);
      return null;
    }
  };

  const getUserBet = async (roundId: number, userAddress?: string): Promise<UserBet | null> => {
    const address = userAddress || account?.address;
    if (!address) return null;

    try {
      const result = await aptos.view({
        payload: {
          function: `${config.moduleAddress}::${config.moduleName}::get_user_bet`,
          functionArguments: [roundId, address],
        },
      });

      const [upBet, downBet] = result as [number, number];

      const claimed = await aptos.view({
        payload: {
          function: `${config.moduleAddress}::${config.moduleName}::has_claimed`,
          functionArguments: [roundId, address],
        },
      });

      return {
        roundId,
        upBet,
        downBet,
        claimed: (claimed as [boolean])[0],
      };
    } catch (error) {
      console.error('Error getting user bet:', error);
      return null;
    }
  };

  const getAccountBalance = async (accountAddress?: string): Promise<number> => {
    const address = accountAddress || account?.address;
    if (!address) return 0;

    try {
      const resources = await aptos.getAccountResources({
        accountAddress: address,
      });

      const coinStore = resources.find(
        (resource) => resource.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
      );

      if (coinStore && 'data' in coinStore) {
        const data = coinStore.data as { coin: { value: string } };
        return parseInt(data.coin.value);
      }

      return 0;
    } catch (error) {
      console.error('Error getting account balance:', error);
      return 0;
    }
  };

  return {
    placeBet,
    claim,
    getCurrentRoundId,
    getRoundInfo,
    getUserBet,
    getAccountBalance,
  };
}
