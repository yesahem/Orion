'use client'

import { useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Button } from '@/components/ui/Button'
import { useBettingStore } from '@/store/betting'
// import { contractFunctions, aptos } from '@/lib/aptos'
import { formatTime, formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'

export function BettingPanel() {
  const { connected, account } = useWallet()
  const {
    currentRound,
    timeRemaining,
    betAmount,
    setBetAmount,
    isPlacingBet,
    setIsPlacingBet,
    currentPrice,
    addUserBet,
  } = useBettingStore()

  const [selectedSide, setSelectedSide] = useState<'up' | 'down' | null>(null)

  // Handle bet placement
  const handlePlaceBet = async (side: 'up' | 'down') => {
    if (!connected || !account || !currentRound || isPlacingBet) return

    const amount = parseFloat(betAmount)
    if (amount <= 0) return

    setIsPlacingBet(true)
    setSelectedSide(side)

    try {
      // TODO: Implement transaction after Move contract deployment
      // For now, simulate the bet placement
      console.log(`Placing ${side} bet of ${amount} APT on round ${currentRound.id}`)
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Add bet to local state for demo purposes
      addUserBet({
        roundId: currentRound.id,
        side,
        amount: Math.floor(amount * 100000000), // Convert to octas
        timestamp: Date.now(),
      })

      // Add marker to chart
      if (typeof window !== 'undefined' && (window as unknown as { addBetMarker?: (side: string, price: number) => void }).addBetMarker) {
        (window as unknown as { addBetMarker: (side: string, price: number) => void }).addBetMarker(side, currentPrice)
      }

      console.log('Demo bet placed successfully')
    } catch (error) {
      console.error('Error placing bet:', error)
    } finally {
      setIsPlacingBet(false)
      setSelectedSide(null)
    }
  }

  // Format pool display
  const formatPool = (pool: number) => {
    return formatCurrency(pool, 8) + ' APT'
  }

  if (!currentRound) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No active round</p>
          <p className="text-sm">Waiting for next round to start...</p>
        </div>
      </div>
    )
  }

  const isRoundExpired = timeRemaining <= 0
  const totalPool = currentRound.upPool + currentRound.downPool
  const upPercentage = totalPool > 0 ? (currentRound.upPool / totalPool) * 100 : 50
  const downPercentage = totalPool > 0 ? (currentRound.downPool / totalPool) * 100 : 50

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      {/* Round Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">
          Round #{currentRound.id}
        </h2>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>
            {isRoundExpired ? 'Round Ended' : `Time Remaining: ${formatTime(timeRemaining)}`}
          </span>
        </div>
      </div>

      {/* Pool Information */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Total Pool</span>
          <span className="text-white font-mono">{formatPool(totalPool)}</span>
        </div>
        
        {/* Pool Distribution Bar */}
        <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
            style={{ width: `${upPercentage}%` }}
          />
          <div 
            className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300"
            style={{ width: `${downPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs">
          <span className="text-green-400">UP: {formatPool(currentRound.upPool)}</span>
          <span className="text-red-400">DOWN: {formatPool(currentRound.downPool)}</span>
        </div>
      </div>

      {/* Betting Interface */}
      {!isRoundExpired && connected ? (
        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Bet Amount (APT)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.1"
                min="0.01"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isPlacingBet}
              />
            </div>
          </div>

          {/* Bet Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="up"
              size="lg"
              onClick={() => handlePlaceBet('up')}
              disabled={isPlacingBet || parseFloat(betAmount) <= 0}
              className={cn(
                "h-14 text-lg font-bold transition-all duration-200",
                isPlacingBet && selectedSide === 'up' && "opacity-50 cursor-not-allowed"
              )}
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              {isPlacingBet && selectedSide === 'up' ? 'Placing...' : 'UP'}
            </Button>
            
            <Button
              variant="down"
              size="lg"
              onClick={() => handlePlaceBet('down')}
              disabled={isPlacingBet || parseFloat(betAmount) <= 0}
              className={cn(
                "h-14 text-lg font-bold transition-all duration-200",
                isPlacingBet && selectedSide === 'down' && "opacity-50 cursor-not-allowed"
              )}
            >
              <TrendingDown className="w-5 h-5 mr-2" />
              {isPlacingBet && selectedSide === 'down' ? 'Placing...' : 'DOWN'}
            </Button>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {['0.1', '0.5', '1.0', '2.0'].map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                className="flex-1 py-2 px-3 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors"
                disabled={isPlacingBet}
              >
                {amount} APT
              </button>
            ))}
          </div>
        </div>
      ) : !connected ? (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Connect your wallet to place bets</p>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">Betting closed for this round</p>
        </div>
      )}

      {/* Current Price Display */}
      <div className="border-t border-gray-700 pt-4">
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Current APT Price</p>
          <p className="text-2xl font-mono font-bold text-white">
            ${currentPrice.toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  )
}
