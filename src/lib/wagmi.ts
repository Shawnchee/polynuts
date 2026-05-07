'use client';

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  coinbaseWallet,
  rainbowWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

const baseWallets = [injectedWallet, coinbaseWallet, metaMaskWallet, rainbowWallet];
// Only include WalletConnect when a project ID is set — otherwise RainbowKit throws.
const wallets = WC_PROJECT_ID ? [...baseWallets, walletConnectWallet] : baseWallets;

const connectors = connectorsForWallets(
  [{ groupName: 'Recommended', wallets }],
  {
    appName: 'Polynuts',
    projectId: WC_PROJECT_ID || 'polynuts',
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [base],
  transports: {
    [base.id]: http(RPC_URL),
  },
  ssr: true,
});
