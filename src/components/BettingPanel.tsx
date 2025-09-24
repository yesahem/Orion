'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { ArrowUp, ArrowDown, Clock, Wallet } from 'lucide-react';
import { useBettingStore } from '@/lib/store';
import { useContract } from '@/hooks/useContract';
import { formatTimeRemaining, formatAptAmount, MIN_BET_AMOUNT } from '@/lib/config';
import toast from 'react-hot-toast';

const PRESET_AMOUNTS = ['0.1', '0.5', '1.0', '2.0', '5.0'];

export default function BettingPanel() {
  const { connected, account } = useWallet();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [balance, setBalance] = useState(0);
  
  const { 
    currentRound, 
    selectedAmount, 
    setSelectedAmount,
    transactionStatus,
    getCurrentUserBet 
  } = useBettingStore();
  
  const { placeBet, getAccountBalance } = useContract();
  const currentUserBet = getCurrentUserBet();

  // Update countdown timer
  useEffect(() => {
    if (!currentRound) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, currentRound.expiryTime - now);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentRound]);

  // Fetch user balance
  useEffect(() => {
    if (connected && account) {
      getAccountBalance().then(setBalance);
    }
  }, [connected, account, getAccountBalance]);

  const handleAmountSelect = (amount: string) => {
    setSelectedAmount(amount);
    setSelectedPreset(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(value);
    setSelectedPreset('');
  };

  const handlePlaceBet = async (sideUp: boolean) => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(selectedAmount);
    if (isNaN(amount) || amount < MIN_BET_AMOUNT) {
      toast.error(`Minimum bet amount is ${MIN_BET_AMOUNT} APT`);
      return;
    }

    if (amount * 100000000 > balance) {
      toast.error('Insufficient balance');
      return;
    }

    if (timeRemaining <= 0) {
      toast.error('Betting period has ended');
      return;
    }

    try {
      await placeBet(sideUp, amount);
      toast.success(`Successfully placed ${amount} APT ${sideUp ? 'UP' : 'DOWN'} bet!`);
      setSelectedAmount('');
      setCustomAmount('');
      setSelectedPreset('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place bet');
    }
  };

  if (!currentRound) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Active Round</h3>
          <p className="text-gray-400">Waiting for the next betting round to start...</p>
        </div>
      </div>
    );
  }

  const isExpired = timeRemaining <= 0;
  const canBet = connected && !isExpired && !transactionStatus.pending;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Place Your Bet</h3>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className={`font-mono text-sm ${timeRemaining <= 30 ? 'text-red-400' : 'text-gray-400'}`}>
            {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Round Info */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Round</span>
            <p className="text-white font-semibold">#{currentRound.id}</p>
          </div>
          <div>
            <span className="text-gray-400">Start Price</span>
            <p className="text-white font-semibold">${currentRound.startPrice.toFixed(4)}</p>
          </div>
          <div>
            <span className="text-gray-400">UP Pool</span>
            <p className="text-green-400 font-semibold">{formatAptAmount(currentRound.upPool)} APT</p>
          </div>
          <div>
            <span className="text-gray-400">DOWN Pool</span>
            <p className="text-red-400 font-semibold">{formatAptAmount(currentRound.downPool)} APT</p>
          </div>
        </div>
      </div>

      {/* User's Current Bet */}
      {currentUserBet && (currentUserBet.upBet > 0 || currentUserBet.downBet > 0) && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h4 className="text-blue-400 font-semibold mb-2">Your Current Bets</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {currentUserBet.upBet > 0 && (
              <div>
                <span className="text-green-400">UP Bet</span>
                <p className="text-white font-semibold">{formatAptAmount(currentUserBet.upBet)} APT</p>
              </div>
            )}
            {currentUserBet.downBet > 0 && (
              <div>
                <span className="text-red-400">DOWN Bet</span>
                <p className="text-white font-semibold">{formatAptAmount(currentUserBet.downBet)} APT</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amount Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Amount (APT)
        </label>
        
        {/* Preset Amounts */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleAmountSelect(amount)}
              disabled={!canBet}
              className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                selectedPreset === amount
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              } ${!canBet ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {amount}
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min={MIN_BET_AMOUNT}
            placeholder={`Custom amount (min ${MIN_BET_AMOUNT})`}
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            disabled={!canBet}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <span className="absolute right-3 top-2 text-gray-400 text-sm">APT</span>
        </div>

        {/* Balance Info */}
        {connected && (
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <div className="flex items-center space-x-1">
              <Wallet className="w-3 h-3" />
              <span>Balance: {formatAptAmount(balance)} APT</span>
            </div>
            <button
              onClick={() => handleAmountSelect(formatAptAmount(balance))}
              disabled={!canBet}
              className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              Max
            </button>
          </div>
        )}
      </div>

      {/* Betting Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handlePlaceBet(true)}
          disabled={!canBet || !selectedAmount}
          className="flex items-center justify-center space-x-2 py-4 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          <ArrowUp className="w-5 h-5" />
          <span>BET UP</span>
        </button>
        
        <button
          onClick={() => handlePlaceBet(false)}
          disabled={!canBet || !selectedAmount}
          className="flex items-center justify-center space-x-2 py-4 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          <ArrowDown className="w-5 h-5" />
          <span>BET DOWN</span>
        </button>
      </div>

      {/* Status Messages */}
      {!connected && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm text-center">
            Connect your wallet to place bets
          </p>
        </div>
      )}

      {isExpired && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm text-center">
            Betting period has ended. Waiting for settlement...
          </p>
        </div>
      )}

      {transactionStatus.pending && (
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-blue-400 text-sm text-center">
            Transaction pending... Please wait.
          </p>
        </div>
      )}
    </div>
  );
}
