'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Trophy, TrendingUp, TrendingDown, Clock, Gift, ExternalLink } from 'lucide-react';
import { useBettingStore } from '@/lib/store';
import { useContract } from '@/hooks/useContract';
import { formatAptAmount, formatPrice, getExplorerUrl } from '@/lib/config';
import { Round, UserBet } from '@/types';
import toast from 'react-hot-toast';

export default function RoundsHistory() {
  const { connected, account } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [claimingRounds, setClaimingRounds] = useState<Set<number>>(new Set());
  
  const { 
    pastRounds, 
    userBets, 
    setPastRounds, 
    setUserBets, 
    canClaim,
    transactionStatus 
  } = useBettingStore();
  
  const { getRoundInfo, getUserBet, claim } = useContract();

  // Fetch past rounds and user bets
  useEffect(() => {
    if (!connected || !account) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch last 20 rounds (assuming current round ID is available)
        const rounds: Round[] = [];
        const bets: UserBet[] = [];
        
        // This is a simplified version - in a real app, you'd have an API to get round IDs
        for (let i = 1; i <= 20; i++) {
          const round = await getRoundInfo(i);
          if (round && round.settled) {
            rounds.push(round);
            
            const userBet = await getUserBet(i);
            if (userBet) {
              bets.push(userBet);
            }
          }
        }
        
        setPastRounds(rounds.reverse()); // Most recent first
        setUserBets(bets);
      } catch (error) {
        console.error('Error fetching rounds history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [connected, account, getRoundInfo, getUserBet, setPastRounds, setUserBets]);

  const handleClaim = async (roundId: number) => {
    if (claimingRounds.has(roundId)) return;
    
    setClaimingRounds(prev => new Set(prev).add(roundId));
    
    try {
      await claim(roundId);
      toast.success('Successfully claimed winnings!');
      
      // Refresh user bet data
      if (account) {
        const updatedBet = await getUserBet(roundId);
        if (updatedBet) {
          setUserBets(userBets.map(bet => 
            bet.roundId === roundId ? updatedBet : bet
          ));
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to claim winnings');
    } finally {
      setClaimingRounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(roundId);
        return newSet;
      });
    }
  };

  const getRoundResult = (round: Round, userBet?: UserBet) => {
    if (!userBet || (userBet.upBet === 0 && userBet.downBet === 0)) {
      return { type: 'no-bet', text: 'No Bet', color: 'text-gray-400' };
    }

    if (round.isTie) {
      return { type: 'tie', text: 'Refunded', color: 'text-blue-400' };
    }

    const userBetUp = userBet.upBet > 0;
    const roundWentUp = round.upWins;

    if (userBetUp === roundWentUp) {
      return { type: 'win', text: 'Won', color: 'text-green-400' };
    } else {
      return { type: 'loss', text: 'Lost', color: 'text-red-400' };
    }
  };

  if (!connected) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Past Rounds</h3>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Connect your wallet to view your betting history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Past Rounds</h3>
        {isLoading && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
        )}
      </div>

      {pastRounds.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No betting history found</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {pastRounds.map((round) => {
            const userBet = userBets.find(bet => bet.roundId === round.id);
            const result = getRoundResult(round, userBet);
            const canClaimRound = canClaim(round.id);
            const isClaimingRound = claimingRounds.has(round.id);

            return (
              <div key={round.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400 text-sm">Round #{round.id}</span>
                    <div className="flex items-center space-x-1">
                      {round.upWins ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : round.isTie ? (
                        <Clock className="w-4 h-4 text-blue-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm text-white">
                        {formatPrice(round.startPrice)} → {formatPrice(round.endPrice)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${result.color}`}>
                    {result.text}
                  </span>
                </div>

                {userBet && (userBet.upBet > 0 || userBet.downBet > 0) && (
                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    {userBet.upBet > 0 && (
                      <div>
                        <span className="text-gray-400">UP Bet</span>
                        <p className="text-green-400 font-semibold">
                          {formatAptAmount(userBet.upBet)} APT
                        </p>
                      </div>
                    )}
                    {userBet.downBet > 0 && (
                      <div>
                        <span className="text-gray-400">DOWN Bet</span>
                        <p className="text-red-400 font-semibold">
                          {formatAptAmount(userBet.downBet)} APT
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-xs text-gray-400 mb-3">
                  <div>
                    <span>UP Pool</span>
                    <p className="text-green-400">{formatAptAmount(round.upPool)} APT</p>
                  </div>
                  <div>
                    <span>DOWN Pool</span>
                    <p className="text-red-400">{formatAptAmount(round.downPool)} APT</p>
                  </div>
                  <div>
                    <span>Total Pool</span>
                    <p className="text-white">{formatAptAmount(round.upPool + round.downPool)} APT</p>
                  </div>
                </div>

                {canClaimRound && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                    <div className="flex items-center space-x-2 text-sm">
                      <Gift className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Winnings available!</span>
                    </div>
                    <button
                      onClick={() => handleClaim(round.id)}
                      disabled={isClaimingRound || transactionStatus.pending}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
                    >
                      {isClaimingRound ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          <span>Claiming...</span>
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          <span>Claim</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
