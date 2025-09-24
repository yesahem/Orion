import { Network } from '@aptos-labs/ts-sdk';
import { Config } from '@/types';

export const config: Config = {
  network: (process.env.NEXT_PUBLIC_APTOS_NETWORK as Network) || Network.TESTNET,
  nodeUrl: process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.testnet.aptoslabs.com/v1',
  moduleAddress: process.env.NEXT_PUBLIC_MODULE_ADDRESS || '0x1',
  moduleName: process.env.NEXT_PUBLIC_MODULE_NAME || 'binary_betting',
  pythEndpoint: process.env.NEXT_PUBLIC_PYTH_ENDPOINT || 'https://hermes.pyth.network',
  pythPriceId: process.env.NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID || '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
};

export const ROUND_DURATION = 300; // 5 minutes in seconds
export const MIN_BET_AMOUNT = 0.01; // 0.01 APT minimum bet
export const OCTAS_PER_APT = 100000000; // 8 decimals

export function formatAptAmount(octas: number): string {
  return (octas / OCTAS_PER_APT).toFixed(4);
}

export function parseAptAmount(apt: number): number {
  return Math.round(apt * OCTAS_PER_APT);
}

export function formatPrice(price: number): string {
  return price.toFixed(4);
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function getExplorerUrl(hash: string): string {
  const baseUrl = config.network === Network.MAINNET 
    ? 'https://explorer.aptoslabs.com'
    : 'https://explorer.aptoslabs.com/?network=testnet';
  
  return `${baseUrl}/txn/${hash}`;
}
