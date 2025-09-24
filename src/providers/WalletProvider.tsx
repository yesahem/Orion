'use client';

import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import { PetraWallet } from 'petra-plugin-wallet-adapter';
import { PropsWithChildren } from 'react';

// Get network from environment variables
const network = (process.env.NEXT_PUBLIC_APTOS_NETWORK as Network) || Network.TESTNET;

const wallets = [
  new PetraWallet(),
];

export function WalletProvider({ children }: PropsWithChildren) {
  return (
    <AptosWalletAdapterProvider
      plugins={wallets}
      autoConnect={true}
      dappConfig={{
        network,
        aptosConnectDappId: 'orion-binary-betting',
        mizuwallet: {
          manifestURL: 'https://assets.mz.xyz/static/config/mizuwallet-connect-manifest.json',
        },
      }}
      onError={(error) => {
        console.error('Wallet connection error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
