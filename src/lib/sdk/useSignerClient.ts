'use client';

import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useAccount, useChainId, useConnectorClient } from 'wagmi';
import type { Account, Chain, Client, Transport } from 'viem';
import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { createSignerClient, POLYNUTS_CHAIN_ID } from './clients';

/**
 * Bridge a viem walletClient to an ethers.js v6 JsonRpcSigner.
 * This is the canonical wagmi v2 → ethers adapter pattern from the wagmi docs.
 *
 * IMPORTANT: we use `useConnectorClient` (not `useWalletClient`) because
 * the connector client is the underlying EIP-1193 transport bound to the
 * actual connected wallet — exactly what ethers needs to forward
 * eth_sendTransaction / eth_signTypedData calls. `useWalletClient` returns
 * a viem-flavoured wrapper that doesn't always cleanly expose the
 * provider's `request` method to ethers' BrowserProvider, which can result
 * in a signer whose sendTransaction silently hangs because the wallet
 * never sees the request.
 */
function clientToSigner(
  client: Client<Transport, Chain, Account>
): ethers.JsonRpcSigner {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.BrowserProvider(transport, network);
  return new ethers.JsonRpcSigner(provider, account.address);
}

export interface SignerClientState {
  signerClient: ThetanutsClient | null;
  signer: ethers.Signer | null;
  address: string | undefined;
  /** True only when the wallet is connected AND on the correct chain. */
  ready: boolean;
  /** Reason why a fill would fail right now, for surfacing in the UI. */
  notReadyReason: 'disconnected' | 'wrong-chain' | 'adapter-failed' | null;
}

export function useSignerClient(): SignerClientState {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: connectorClient } = useConnectorClient();

  return useMemo<SignerClientState>(() => {
    if (!isConnected || !connectorClient) {
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'disconnected',
      };
    }
    if (chainId !== POLYNUTS_CHAIN_ID) {
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'wrong-chain',
      };
    }
    try {
      const signer = clientToSigner(connectorClient);
      const signerClient = createSignerClient(signer);
      return {
        signerClient,
        signer,
        address: connectorClient.account.address,
        ready: true,
        notReadyReason: null,
      };
    } catch (err) {
      console.error('[polynuts] failed to build ethers signer from wagmi client', err);
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'adapter-failed',
      };
    }
  }, [isConnected, connectorClient, connectedAddress, chainId]);
}
