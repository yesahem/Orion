'use client'

import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { useBettingStore } from '@/store/betting'

export function WalletConnect() {
  const { connect, disconnect, account, connected, wallets } = useWallet()
  const balance = useBettingStore((state) => state.balance)

  const handleConnect = async () => {
    if (wallets && wallets.length > 0) {
      try {
        await connect(wallets[0].name)
      } catch (error) {
        console.error('Failed to connect wallet:', error)
      }
    }
  }

  if (connected && account) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <div className="text-white/60">Balance</div>
          <div className="font-mono">{formatCurrency(balance)} APT</div>
        </div>
        <div className="text-sm">
          <div className="text-white/60">Address</div>
          <div className="font-mono">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </div>
        </div>
        <Button
          onClick={disconnect}
          variant="outline"
          size="sm"
        >
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={handleConnect}
      className="bg-blue-600 hover:bg-blue-700"
    >
      Connect Wallet
    </Button>
  )
}
