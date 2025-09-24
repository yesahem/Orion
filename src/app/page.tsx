'use client';

import { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import PriceChart from '@/components/PriceChart';
import BettingPanel from '@/components/BettingPanel';
import WalletButton from '@/components/WalletButton';
import RoundsHistory from '@/components/RoundsHistory';
import RecentBets from '@/components/RecentBets';
import { useRoundData } from '@/hooks/useRoundData';
import { useBettingStore } from '@/lib/store';

export default function Home() {
  const { isLoading, error } = useBettingStore();
  useRoundData(); // Initialize round data fetching

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Orion</h1>
                <p className="text-xs text-gray-400">APT/USD Binary Betting</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Testnet</span>
              </div>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
              <p className="text-blue-400 text-sm">Loading round data...</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart and Betting */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart */}
            <PriceChart height={500} />
            
            {/* Betting Panel */}
            <BettingPanel />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Recent Bets */}
            <RecentBets />
            
            {/* Rounds History */}
            <RoundsHistory />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">1. Choose Direction</h3>
              <p className="text-gray-400">
                Predict if APT/USD will go UP or DOWN in the next 5 minutes
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-6 rounded-full bg-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">2. Place Your Bet</h3>
              <p className="text-gray-400">
                Set your bet amount and wait for the 5-minute round to end
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-6 text-purple-400">🎉</div>
              </div>
              <h3 className="font-semibold text-white mb-2">3. Claim Winnings</h3>
              <p className="text-gray-400">
                Winners share the total pool proportionally. Losers' bets go to winners
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <h4 className="font-semibold text-yellow-400 mb-2">Important Notes:</h4>
            <ul className="text-xs text-yellow-300 space-y-1">
              <li>• 2-5% fee goes to treasury on winning rounds</li>
              <li>• If price ends exactly where it started (tie), all bets are refunded</li>
              <li>• Prices are sourced from Pyth Network oracle for fairness</li>
              <li>• This is a testnet demo - use only testnet APT</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400 text-sm">
            <p className="mb-2">
              Powered by <span className="text-blue-400">Aptos</span> • 
              Price feeds by <span className="text-green-400">Pyth Network</span>
            </p>
            <p className="text-xs">
              This is a demo application on Aptos testnet. Do not use real funds.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
