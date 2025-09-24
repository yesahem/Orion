'use client';

import { ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { useBettingStore } from '@/lib/store';
import { formatAptAmount } from '@/lib/config';

export default function RecentBets() {
  const { recentBets } = useBettingStore();

  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Bets</h3>
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Live</span>
        </div>
      </div>

      {recentBets.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <ArrowUp className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm">No recent bets</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {recentBets.slice(0, 10).map((bet, index) => (
            <div key={`${bet.user}-${bet.timestamp}-${index}`} className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  bet.sideUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {bet.sideUp ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-sm font-medium">
                      {formatAddress(bet.user)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      bet.sideUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {bet.sideUp ? 'UP' : 'DOWN'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatTimeAgo(bet.timestamp)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white text-sm font-semibold">
                  {formatAptAmount(bet.amount)} APT
                </div>
                <div className="text-xs text-gray-400">
                  Round #{bet.roundId}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
