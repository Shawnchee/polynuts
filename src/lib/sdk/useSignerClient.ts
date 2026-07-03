'use client';

import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useAccount, useConnectorClient } from 'wagmi';
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
  // walletChainId is the wallet's REAL network (per-connection, tracks
  // chainChanged). useChainId() is pinned to the single-chain wagmi config
  // and never reports the wallet being on the wrong chain.
  const { address: connectedAddress, isConnected, chainId: walletChainId } = useAccount();
  const { data: connectorClient } = useConnectorClient();

  return useMemo<SignerClientState>(() => {
    if (!isConnected) {
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'disconnected',
      };
    }
    // Check the chain BEFORE connectorClient: on a wrong network the connector
    // client may be absent, and we must not mask that as 'disconnected'.
    if (walletChainId !== POLYNUTS_CHAIN_ID) {
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'wrong-chain',
      };
    }
    if (!connectorClient) {
      return {
        signerClient: null,
        signer: null,
        address: connectedAddress,
        ready: false,
        notReadyReason: 'disconnected',
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
  }, [isConnected, connectorClient, connectedAddress, walletChainId]);
}
