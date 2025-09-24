'use client';

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { Wallet, LogOut, ExternalLink } from 'lucide-react';
import { formatAptAmount } from '@/lib/config';
import { useContract } from '@/hooks/useContract';
import { useEffect, useState } from 'react';

export default function WalletButton() {
  const { connected, account, disconnect } = useWallet();
  const { getAccountBalance } = useContract();
  const [balance, setBalance] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (connected && account) {
      getAccountBalance().then(setBalance);
      // Update balance every 30 seconds
      const interval = setInterval(() => {
        getAccountBalance().then(setBalance);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, account, getAccountBalance]);

  if (!connected) {
    return (
      <WalletSelector>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
        </button>
      </WalletSelector>
    );
  }

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setShowDropdown(false);
    }
  };

  const viewOnExplorer = () => {
    if (account?.address) {
      const explorerUrl = `https://explorer.aptoslabs.com/account/${account.address}?network=testnet`;
      window.open(explorerUrl, '_blank');
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg transition-colors"
      >
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium">
            {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
          </div>
          <div className="text-xs text-gray-400">
            {formatAptAmount(balance)} APT
          </div>
        </div>
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-20">
            <div className="p-4 border-b border-gray-600">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white font-medium">Connected</div>
                  <div className="text-xs text-gray-400">
                    {account?.address?.slice(0, 8)}...{account?.address?.slice(-8)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2">
              <div className="px-3 py-2 text-sm">
                <div className="text-gray-400">Balance</div>
                <div className="text-white font-semibold">
                  {formatAptAmount(balance)} APT
                </div>
              </div>

              <button
                onClick={copyAddress}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center space-x-2"
              >
                <span>Copy Address</span>
              </button>

              <button
                onClick={viewOnExplorer}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on Explorer</span>
              </button>

              <hr className="border-gray-600 my-2" />

              <button
                onClick={handleDisconnect}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 rounded flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
